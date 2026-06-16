/**
 * AI Action Parser & Executor
 * Scans LLM responses for JSON action blocks and executes them via the store.
 */

import { store } from '../store.js';
import { formatCurrency, getCurrentMonth } from '../utils/formatters.js';

/**
 * Parse an AI response for embedded JSON action blocks.
 * Action blocks are fenced in ```json ... ``` and contain {action, data}.
 *
 * @param {string} responseText - Raw assistant response
 * @returns {{ text: string, actions: Array<{action: string, data: Object}> }}
 */
export function parseAIResponse(responseText) {
  if (!responseText) return { text: '', actions: [] };

  const actions = [];
  // Match ```json { ... } ``` blocks
  const pattern = /```json\s*(\{[\s\S]*?\})\s*```/g;
  let cleanedText = responseText;
  let match;

  while ((match = pattern.exec(responseText)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.action) {
        actions.push({ action: parsed.action, data: parsed.data || {} });
        // Remove the JSON block from the display text
        cleanedText = cleanedText.replace(match[0], '');
      }
    } catch (e) {
      console.warn('[Actions] Failed to parse action block:', e.message);
    }
  }

  // Also try to match inline JSON (not fenced) as a fallback
  if (actions.length === 0) {
    const inlinePattern = /\{"action"\s*:\s*"([^"]+)"\s*,\s*"data"\s*:\s*(\{[\s\S]*?\})\s*\}/g;
    while ((match = inlinePattern.exec(responseText)) !== null) {
      try {
        const data = JSON.parse(match[2]);
        actions.push({ action: match[1], data });
        cleanedText = cleanedText.replace(match[0], '');
      } catch {
        // skip
      }
    }
  }

  return { text: cleanedText.trim(), actions };
}

/**
 * Execute a single AI action against the store.
 * @param {{ action: string, data: Object }} actionObj
 * @returns {Promise<string>} Confirmation message
 */
export async function executeAction(actionObj) {
  const { action, data } = actionObj;

  switch (action) {
    case 'add_transaction': {
      try {
        const txData = {
          date: data.date || new Date().toISOString().split('T')[0],
          type: data.type || 'expense',
          amount: parseFloat(data.amount) || 0,
          description: data.description || '',
          categoryId: data.categoryId || data.category_id || '',
          category: data.category || '',
          subcategory: data.subcategory || '',
          accountId: data.accountId || data.account_id || '',
          tags: Array.isArray(data.tags) ? data.tags : (data.tags?.split(',').map(t => t.trim()) || []),
          notes: data.notes || '',
        };
        store.addTransaction(txData);
        return `✅ Transaction added: ${txData.type === 'income' ? '+' : '-'}${formatCurrency(txData.amount)} — ${txData.description || txData.category}`;
      } catch (e) {
        return `❌ Failed to add transaction: ${e.message}`;
      }
    }

    case 'delete_transaction': {
      try {
        // Support deletion by ID directly
        if (data.id) {
          const txn = store.getTransaction(data.id);
          if (!txn) return `❌ Transaction with ID "${data.id}" not found.`;
          store.deleteTransaction(data.id);
          return `✅ Deleted transaction: ${txn.description || 'Unknown'} — ${formatCurrency(txn.amount)}`;
        }
        // Support deletion by search (description + optional amount/date)
        if (data.description || data.search) {
          const matches = findTransactions(data);
          if (matches.length === 0) return `❌ No matching transactions found for "${data.description || data.search}".`;
          if (matches.length === 1) {
            store.deleteTransaction(matches[0].id);
            return `✅ Deleted transaction: ${matches[0].description} — ${formatCurrency(matches[0].amount)} on ${matches[0].date}`;
          }
          // Multiple matches — delete all if data.deleteAll is true
          if (data.deleteAll || data.delete_all) {
            const ids = matches.map(m => m.id);
            const count = store.deleteTransactions(ids);
            return `✅ Deleted ${count} matching transactions for "${data.description || data.search}".`;
          }
          // Otherwise list them for user to pick
          const list = matches.slice(0, 5).map((t, i) => `  ${i + 1}. ${t.date} — ${t.description} — ${formatCurrency(t.amount)} (ID: ${t.id})`).join('\n');
          return `⚠️ Found ${matches.length} matching transactions:\n${list}\nPlease specify which one to delete by providing the exact ID.`;
        }
        return `❌ Please specify which transaction to delete — provide description, amount, or date.`;
      } catch (e) {
        return `❌ Failed to delete transaction: ${e.message}`;
      }
    }

    case 'update_transaction': {
      try {
        if (!data.id && !data.description) return `❌ Please specify which transaction to update (by ID or description).`;
        let txnId = data.id;
        if (!txnId && data.description) {
          const matches = findTransactions(data);
          if (matches.length === 0) return `❌ No matching transaction found for "${data.description}".`;
          if (matches.length > 1) {
            const list = matches.slice(0, 5).map((t, i) => `  ${i + 1}. ${t.date} — ${t.description} — ${formatCurrency(t.amount)} (ID: ${t.id})`).join('\n');
            return `⚠️ Found ${matches.length} matches:\n${list}\nSpecify the exact ID to update.`;
          }
          txnId = matches[0].id;
        }
        const updates = {};
        if (data.newAmount !== undefined || data.new_amount !== undefined) updates.amount = parseFloat(data.newAmount || data.new_amount);
        if (data.newDescription || data.new_description) updates.description = data.newDescription || data.new_description;
        if (data.newDate || data.new_date) updates.date = data.newDate || data.new_date;
        if (data.newCategory || data.new_category_id) updates.categoryId = data.newCategory || data.new_category_id;
        if (data.newType || data.new_type) updates.type = data.newType || data.new_type;
        if (data.notes) updates.notes = data.notes;
        const updated = store.updateTransaction(txnId, updates);
        if (!updated) return `❌ Transaction not found.`;
        return `✅ Updated transaction: ${updated.description} — ${formatCurrency(updated.amount)}`;
      } catch (e) {
        return `❌ Failed to update transaction: ${e.message}`;
      }
    }

    case 'bulk_delete_transactions': {
      try {
        const ids = data.ids || [];
        if (!ids.length) return `❌ No transaction IDs provided.`;
        const count = store.deleteTransactions(ids);
        return `✅ Deleted ${count} transaction(s).`;
      } catch (e) {
        return `❌ Failed to bulk delete: ${e.message}`;
      }
    }

    case 'set_budget': {
      try {
        const month = data.month || getCurrentMonth();
        const totalBudget = parseFloat(data.totalBudget || data.total_budget) || 0;
        const categoryBudgets = data.categoryBudgets || data.category_budgets || {};
        store.setBudget(month, totalBudget, categoryBudgets);
        return `✅ Budget set for ${month}: ${formatCurrency(totalBudget)}`;
      } catch (e) {
        return `❌ Failed to set budget: ${e.message}`;
      }
    }

    case 'add_goal': {
      try {
        const goalData = {
          name: data.name || 'Untitled Goal',
          targetAmount: parseFloat(data.targetAmount || data.target_amount) || 0,
          currentAmount: parseFloat(data.currentAmount || data.current_amount) || 0,
          deadline: data.deadline || '',
          monthlyContribution: parseFloat(data.monthlyContribution || data.monthly_contribution) || 0,
          priority: data.priority || 'medium',
          icon: data.icon || 'target',
          color: data.color || '#6366f1',
        };
        store.addGoal(goalData);
        return `✅ Goal created: "${goalData.name}" — Target: ${formatCurrency(goalData.targetAmount)}`;
      } catch (e) {
        return `❌ Failed to create goal: ${e.message}`;
      }
    }

    case 'delete_goal': {
      try {
        if (data.id) {
          store.deleteGoal(data.id);
          return `✅ Goal deleted.`;
        }
        // Find by name
        const goals = store.getGoals() || [];
        const match = goals.find(g => g.name.toLowerCase().includes((data.name || '').toLowerCase()));
        if (!match) return `❌ No goal found matching "${data.name}".`;
        store.deleteGoal(match.id);
        return `✅ Deleted goal: "${match.name}"`;
      } catch (e) {
        return `❌ Failed to delete goal: ${e.message}`;
      }
    }

    case 'add_debt': {
      try {
        const debtData = {
          name: data.name || 'Unnamed Debt',
          type: data.type || 'loan',
          principalAmount: parseFloat(data.principalAmount || data.principal_amount) || 0,
          remainingAmount: parseFloat(data.remainingAmount || data.remaining_amount) || 0,
          interestRate: parseFloat(data.interestRate || data.interest_rate) || 0,
          emiAmount: parseFloat(data.emiAmount || data.emi_amount) || 0,
          startDate: data.startDate || data.start_date || new Date().toISOString().split('T')[0],
          endDate: data.endDate || data.end_date || '',
          lender: data.lender || '',
        };
        store.addDebt(debtData);
        return `✅ Debt added: "${debtData.name}" — ${formatCurrency(debtData.remainingAmount)} at ${debtData.interestRate}%`;
      } catch (e) {
        return `❌ Failed to add debt: ${e.message}`;
      }
    }

    case 'delete_debt': {
      try {
        if (data.id) {
          store.deleteDebt(data.id);
          return `✅ Debt deleted.`;
        }
        const debts = store.getDebts() || [];
        const match = debts.find(d => d.name.toLowerCase().includes((data.name || '').toLowerCase()));
        if (!match) return `❌ No debt found matching "${data.name}".`;
        store.deleteDebt(match.id);
        return `✅ Deleted debt: "${match.name}"`;
      } catch (e) {
        return `❌ Failed to delete debt: ${e.message}`;
      }
    }

    case 'financial_summary': {
      try {
        return generateFinancialSummary();
      } catch (e) {
        return `❌ Failed to generate summary: ${e.message}`;
      }
    }

    default:
      return "I tried to do something but I'm not sure how. Could you be more specific?";
  }
}

/**
 * Execute an array of actions and return a combined result summary.
 * @param {Array<{action: string, data: Object}>} actions
 * @returns {Promise<string>}
 */
export async function executeActions(actions) {
  if (!actions?.length) return '';

  const results = [];
  for (const action of actions) {
    const result = await executeAction(action);
    results.push(result);
  }
  return results.join('\n');
}

/**
 * Find transactions matching search criteria.
 * @param {Object} criteria - { description, search, amount, date, type }
 * @returns {Array<Object>}
 */
function findTransactions(criteria) {
  const all = store.getTransactions();
  const query = (criteria.description || criteria.search || '').toLowerCase();

  return all.filter(t => {
    // Match by description (fuzzy)
    const descMatch = !query || (t.description || '').toLowerCase().includes(query)
      || (t.notes || '').toLowerCase().includes(query);
    // Match by amount (if provided)
    const amtMatch = !criteria.amount || Math.abs(t.amount - parseFloat(criteria.amount)) < 1;
    // Match by date (if provided)
    const dateMatch = !criteria.date || t.date === criteria.date;
    // Match by type (if provided)
    const typeMatch = !criteria.type || t.type === criteria.type;

    return descMatch && amtMatch && dateMatch && typeMatch;
  });
}

/**
 * Generate a compact financial summary from current data.
 * @returns {string}
 */
function generateFinancialSummary() {
  const currentMonth = getCurrentMonth();
  const stats = store.getMonthlyStats(currentMonth);
  const accounts = store.getAccounts() || [];
  const goals = store.getGoals() || [];
  const debts = store.getDebts() || [];

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const income = stats?.income || 0;
  const expenses = stats?.expenses || 0;
  const savings = income - expenses;
  const savingsRate = income > 0 ? ((savings / income) * 100).toFixed(1) : 0;

  const totalDebt = debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
  const totalGoalTarget = goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
  const totalGoalCurrent = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);

  const lines = [
    `📊 **Financial Summary — ${currentMonth}**`,
    '',
    `💰 **Total Balance:** ${formatCurrency(totalBalance)}`,
    `📈 **Monthly Income:** ${formatCurrency(income)}`,
    `📉 **Monthly Expenses:** ${formatCurrency(expenses)}`,
    `💵 **Net Savings:** ${formatCurrency(savings)} (${savingsRate}% rate)`,
    '',
  ];

  if (goals.length) {
    lines.push(`🎯 **Goals:** ${goals.length} active — ${formatCurrency(totalGoalCurrent)} / ${formatCurrency(totalGoalTarget)} saved`);
  }
  if (debts.length) {
    lines.push(`🏦 **Debts:** ${debts.length} active — ${formatCurrency(totalDebt)} outstanding`);
  }

  // Top spending categories
  try {
    const txns = store.getTransactions({ month: currentMonth, type: 'expense' });
    if (txns?.length) {
      const catSpend = {};
      for (const t of txns) {
        const cat = t.category || 'Uncategorized';
        catSpend[cat] = (catSpend[cat] || 0) + (t.amount || 0);
      }
      const sorted = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 5);
      lines.push('', '📋 **Top Spending Categories:**');
      for (const [name, amt] of sorted) {
        lines.push(`  • ${name}: ${formatCurrency(amt)}`);
      }
    }
  } catch { /* skip */ }

  return lines.join('\n');
}
