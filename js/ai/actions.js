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
