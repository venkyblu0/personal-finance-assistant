/**
 * System Prompts & Financial Context Builder
 * Provides system instructions and assembles financial data context for LLM queries.
 */

import { store } from '../store.js';
import { formatCurrency, getCurrentMonth, getMonthName } from '../utils/formatters.js';

/**
 * Returns the system prompt that defines the AI assistant's personality and capabilities.
 * @returns {string}
 */
export function getSystemPrompt() {
  return `You are FinanceAI, a personal financial accountant and advisor. You have access to the user's complete financial data which is provided in each message as context.

Your capabilities:
- Answer questions about spending, income, budgets, and financial trends
- Provide actionable financial advice and recommendations
- Help plan budgets, savings goals, and debt payoff strategies
- Categorize transactions when asked
- Generate financial summaries and reports
- Add, update, and delete transactions, goals, debts, and budgets

Rules:
- Always be specific with numbers — use the ₹ symbol and exact amounts
- Use the Indian number system for large amounts (lakhs, crores)
- Be encouraging but honest about financial health
- When the user asks you to perform actions, respond with a JSON action block:
  \`\`\`json
  {"action": "action_name", "data": {...}}
  \`\`\`

Supported actions:
1. **add_transaction** — data: {date, type, amount, description, categoryId, subcategory, accountId, tags, notes}
2. **delete_transaction** — data: {id} OR {description, amount?, date?, type?} (search by description)
   - If you find the transaction in the context data, use its ID directly
   - If multiple matches, set deleteAll:true to delete all, or list them for the user
3. **update_transaction** — data: {id OR description, newAmount?, newDescription?, newDate?, newCategory?, newType?, notes?}
4. **bulk_delete_transactions** — data: {ids: ["id1", "id2", ...]}
5. **set_budget** — data: {month, totalBudget, categoryBudgets: {catId: amount}}
6. **add_goal** — data: {name, targetAmount, currentAmount, deadline, monthlyContribution, priority}
7. **delete_goal** — data: {id} OR {name}
8. **add_debt** — data: {name, type, principalAmount, remainingAmount, interestRate, emiAmount, lender}
9. **delete_debt** — data: {id} OR {name}
10. **financial_summary** — no data needed

IMPORTANT for deletions:
- The context includes transaction IDs. When the user says "delete the Swiggy order", find the matching transaction in the recent transactions context and use its exact ID.
- Always confirm what you're deleting in your response text.
- If there are multiple matches, list them and ask the user which one to delete.

- Keep responses concise but informative
- Use bullet points and formatting for clarity
- If you don't have enough data to answer, say so clearly`;
}

/**
 * Build a financial context string with relevant data for the current query.
 * Keeps the context compact to avoid exceeding token limits.
 * @param {string} query - The user's question
 * @returns {string}
 */
export function buildFinancialContext(query) {
  const sections = [];
  const currentMonth = getCurrentMonth();
  const monthName = getMonthName(new Date().getMonth());
  const year = new Date().getFullYear();

  // --- Current month stats ---
  try {
    const stats = store.getMonthlyStats(currentMonth);
    if (stats) {
      sections.push(
        `## ${monthName} ${year} Summary`,
        `- Income: ${formatCurrency(stats.income || 0)}`,
        `- Expenses: ${formatCurrency(stats.expenses || 0)}`,
        `- Net Savings: ${formatCurrency((stats.income || 0) - (stats.expenses || 0))}`
      );
    }
  } catch { /* stats unavailable */ }

  // --- Accounts ---
  try {
    const accounts = store.getAccounts();
    if (accounts?.length) {
      sections.push('\n## Accounts');
      let totalBalance = 0;
      for (const acc of accounts) {
        sections.push(`- ${acc.name}: ${formatCurrency(acc.balance || 0)}`);
        totalBalance += acc.balance || 0;
      }
      sections.push(`- **Total Balance: ${formatCurrency(totalBalance)}**`);
    }
  } catch { /* accounts unavailable */ }

  // --- Active budgets ---
  try {
    const budget = store.getBudget(currentMonth);
    if (budget) {
      sections.push('\n## Current Budget');
      sections.push(`- Total Budget: ${formatCurrency(budget.totalBudget || 0)}`);
      if (budget.categoryBudgets && typeof budget.categoryBudgets === 'object') {
        const cats = store.getCategories('expense') || [];
        const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
        const entries = Object.entries(budget.categoryBudgets);
        for (const [catId, amount] of entries.slice(0, 10)) {
          const name = catMap[catId] || catId;
          sections.push(`  - ${name}: ${formatCurrency(amount)}`);
        }
      }
    }
  } catch { /* budget unavailable */ }

  // --- Category spending breakdown (current month) ---
  try {
    const transactions = store.getTransactions({ month: currentMonth, type: 'expense' });
    if (transactions?.length) {
      const cats = store.getCategories('expense') || [];
      const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
      const spending = {};
      for (const t of transactions) {
        const name = catMap[t.categoryId] || t.category || 'Uncategorized';
        spending[name] = (spending[name] || 0) + (t.amount || 0);
      }
      const sorted = Object.entries(spending).sort((a, b) => b[1] - a[1]);
      sections.push('\n## Spending by Category (This Month)');
      for (const [name, total] of sorted.slice(0, 12)) {
        sections.push(`- ${name}: ${formatCurrency(total)}`);
      }
    }
  } catch { /* spending breakdown unavailable */ }

  // --- Goals ---
  try {
    const goals = store.getGoals();
    if (goals?.length) {
      sections.push('\n## Savings Goals');
      for (const g of goals) {
        const pct = g.targetAmount ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
        sections.push(`- ${g.name}: ${formatCurrency(g.currentAmount || 0)} / ${formatCurrency(g.targetAmount || 0)} (${pct}%)${g.deadline ? ` — Deadline: ${g.deadline}` : ''}`);
      }
    }
  } catch { /* goals unavailable */ }

  // --- Debts ---
  try {
    const debts = store.getDebts();
    if (debts?.length) {
      sections.push('\n## Debts');
      let totalDebt = 0;
      for (const d of debts) {
        totalDebt += d.remainingAmount || 0;
        sections.push(`- ${d.name}: ${formatCurrency(d.remainingAmount || 0)} remaining at ${d.interestRate || 0}% — EMI ${formatCurrency(d.emiAmount || 0)}`);
      }
      sections.push(`- **Total Outstanding: ${formatCurrency(totalDebt)}**`);
    }
  } catch { /* debts unavailable */ }

  // --- Recent transactions (with IDs for action references) ---
  try {
    const recent = store.getTransactions();
    if (recent?.length) {
      const last = recent.slice(0, 25);
      sections.push('\n## Recent Transactions (last 25, with IDs)');
      for (const t of last) {
        const sign = t.type === 'income' ? '+' : '-';
        const cats = store.getCategories() || [];
        const catName = cats.find(c => c.id === t.categoryId)?.name || t.category || '';
        sections.push(`- [${t.id}] ${t.date || ''} | ${t.description || 'No description'} | ${sign}${formatCurrency(t.amount || 0)} | ${catName}`);
      }
    }
  } catch { /* transactions unavailable */ }

  if (!sections.length) {
    return 'No financial data available yet. The user has not added any transactions, budgets, or goals.';
  }

  return `# User's Financial Data\n${sections.join('\n')}`;
}

/**
 * Build a compact list of available categories for auto-categorization prompts.
 * @returns {string}
 */
export function buildCategoryContext() {
  try {
    const income = store.getCategories('income') || [];
    const expense = store.getCategories('expense') || [];

    const lines = ['Available Categories:'];

    if (expense.length) {
      lines.push('\nExpense:');
      for (const c of expense) {
        const subs = c.subcategories?.length ? ` (${c.subcategories.join(', ')})` : '';
        lines.push(`- ${c.name}${subs}`);
      }
    }
    if (income.length) {
      lines.push('\nIncome:');
      for (const c of income) {
        lines.push(`- ${c.name}`);
      }
    }

    return lines.join('\n');
  } catch {
    return 'Categories not available.';
  }
}
