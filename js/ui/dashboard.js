/**
 * Dashboard View
 * Main overview page with stats, charts, recent transactions, and budget summary.
 */

import { store } from '../store.js';
import { formatCurrency, getCurrentMonth, getMonthName, formatDate } from '../utils/formatters.js';
import { escapeHtml } from '../utils/helpers.js';
import { createDonutChart, createLineChart, destroyChart } from '../utils/charts.js';
import { renderTransactionRow, renderStatCard, renderProgressBar, renderEmptyState } from './components.js';

/** Chart instance references for cleanup */
let spendingChart = null;
let trendChart = null;

/**
 * Render the complete dashboard into #main-content.
 */
export function renderDashboard() {
  const container = document.getElementById('main-content');
  if (!container) return;

  // Destroy existing charts before re-render
  if (spendingChart) { destroyChart(spendingChart); spendingChart = null; }
  if (trendChart) { destroyChart(trendChart); trendChart = null; }

  const currentMonth = getCurrentMonth();
  const now = new Date();
  const monthName = getMonthName(now.getMonth());
  const year = now.getFullYear();

  // --- Gather data ---
  const stats = safeCall(() => store.getMonthlyStats(currentMonth)) || {};
  const accounts = safeCall(() => store.getAccounts()) || [];
  const transactions = safeCall(() => store.getTransactions({ month: currentMonth })) || [];
  const allTransactions = safeCall(() => store.getTransactions()) || [];
  const budget = safeCall(() => store.getBudget(currentMonth));
  const recurringTxns = safeCall(() => store.getRecurringTransactions()) || [];
  const categories = safeCall(() => store.getCategories('expense')) || [];

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const income = stats.income || 0;
  const expenses = stats.expenses || 0;
  const net = income - expenses;

  // Previous month comparison
  const prevDate = new Date(year, now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prevStats = safeCall(() => store.getMonthlyStats(prevMonth)) || {};
  const prevNet = (prevStats.income || 0) - (prevStats.expenses || 0);
  const netTrend = net >= prevNet ? 'up' : 'down';
  const netDiff = Math.abs(net - prevNet);

  // Category spending breakdown
  const catSpending = {};
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  for (const t of expenseTransactions) {
    const catId = t.categoryId || 'other';
    catSpending[catId] = (catSpending[catId] || 0) + (t.amount || 0);
  }

  // Recent transactions (last 10)
  const recentTxns = allTransactions.slice(0, 10);

  // Upcoming recurring
  const upcoming = recurringTxns
    .filter(r => r.nextDate)
    .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate))
    .slice(0, 5);

  // --- Build HTML ---
  container.innerHTML = `
    <div class="dashboard">
      <!-- Header -->
      <div class="dashboard__header">
        <div>
          <h1 style="margin:0;font-size:1.75rem;color:var(--text-primary)">Dashboard</h1>
          <p style="margin:0.25rem 0 0;color:var(--text-muted);font-size:0.9rem">${monthName} ${year} Overview</p>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="dashboard__stats grid grid-2" style="gap:1rem;margin-top:1.5rem">
        ${renderStatCard('wallet', 'Total Balance', formatCurrency(totalBalance), null, null, 'var(--accent-primary)')}
        ${renderStatCard('trending-up', 'Monthly Income', formatCurrency(income), null, null, 'var(--accent-success)')}
        ${renderStatCard('trending-down', 'Monthly Expenses', formatCurrency(expenses), null, null, 'var(--accent-danger)')}
        ${renderStatCard('piggy-bank', 'Net Savings', formatCurrency(net), netTrend, `${formatCurrency(netDiff)} vs last month`, 'var(--accent-warning)')}
      </div>

      <!-- Charts Row -->
      <div class="dashboard__charts grid grid-2" style="gap:1rem;margin-top:1.5rem">
        <div class="card card--glass">
          <div class="card__header">
            <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
              <i data-lucide="pie-chart" style="width:18px;height:18px;vertical-align:text-bottom"></i>
              Spending by Category
            </h3>
          </div>
          <div class="card__body" style="display:flex;flex-direction:column;align-items:center;gap:1rem">
            <div style="position:relative;width:220px;height:220px">
              <canvas id="spending-chart"></canvas>
            </div>
            <div id="spending-legend" style="display:flex;flex-wrap:wrap;gap:0.5rem 1rem;font-size:0.8rem;color:var(--text-secondary)"></div>
          </div>
        </div>
        <div class="card card--glass">
          <div class="card__header">
            <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
              <i data-lucide="bar-chart-3" style="width:18px;height:18px;vertical-align:text-bottom"></i>
              Income vs Expenses
            </h3>
          </div>
          <div class="card__body">
            <canvas id="trend-chart" style="width:100%;height:240px"></canvas>
          </div>
        </div>
      </div>

      <!-- Bottom Row -->
      <div class="dashboard__recent grid grid-2" style="gap:1rem;margin-top:1.5rem">
        <!-- Recent Transactions -->
        <div class="card card--glass">
          <div class="card__header flex items-center justify-between">
            <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
              <i data-lucide="receipt" style="width:18px;height:18px;vertical-align:text-bottom"></i>
              Recent Transactions
            </h3>
            <a href="#/transactions" class="btn btn--ghost btn--sm" style="font-size:0.8rem">
              View All <i data-lucide="arrow-right" style="width:14px;height:14px"></i>
            </a>
          </div>
          <div class="card__body" style="padding:0">
            ${recentTxns.length
              ? recentTxns.map(t => renderTransactionRow(t)).join('')
              : renderEmptyState('receipt', 'No transactions yet', 'Add your first transaction to get started.')}
          </div>
        </div>

        <!-- Right column: Budget + Upcoming -->
        <div class="flex flex-col gap-md">
          <!-- Budget Overview -->
          <div class="card card--glass">
            <div class="card__header">
              <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
                <i data-lucide="calculator" style="width:18px;height:18px;vertical-align:text-bottom"></i>
                Budget Overview
              </h3>
            </div>
            <div class="card__body">
              ${renderBudgetOverview(budget, catSpending, categories, expenses)}
            </div>
          </div>

          <!-- Upcoming Bills -->
          <div class="card card--glass">
            <div class="card__header">
              <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
                <i data-lucide="calendar-clock" style="width:18px;height:18px;vertical-align:text-bottom"></i>
                Upcoming Bills
              </h3>
            </div>
            <div class="card__body" style="padding:0">
              ${renderUpcomingBills(upcoming)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // --- Initialize charts ---
  initSpendingChart(catSpending, categories);
  initTrendChart();

  if (window.lucide) lucide.createIcons();
}

/* =========================================================================
 * CHART HELPERS
 * ========================================================================= */

function initSpendingChart(catSpending, categories) {
  const canvas = document.getElementById('spending-chart');
  if (!canvas) return;

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const entries = Object.entries(catSpending).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    canvas.parentElement.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">No expense data this month</p>';
    return;
  }

  const labels = [];
  const data = [];
  const colors = [];
  const defaultColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#64748b'];

  entries.forEach(([catId, amount], i) => {
    const cat = catMap[catId];
    labels.push(cat?.name || 'Other');
    data.push(amount);
    colors.push(cat?.color || defaultColors[i % defaultColors.length]);
  });

  try {
    spendingChart = createDonutChart(canvas, { labels, data, colors });
  } catch (e) {
    console.warn('[Dashboard] Failed to create donut chart:', e);
  }

  // Build legend
  const legendEl = document.getElementById('spending-legend');
  if (legendEl) {
    const total = data.reduce((s, v) => s + v, 0);
    legendEl.innerHTML = entries.map(([catId, amount], i) => {
      const cat = catMap[catId];
      const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
      const color = cat?.color || defaultColors[i % defaultColors.length];
      return `
        <div style="display:flex;align-items:center;gap:0.35rem">
          <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></span>
          <span>${escapeHtml(cat?.name || 'Other')}</span>
          <span style="color:var(--text-muted)">${formatCurrency(amount)} (${pct}%)</span>
        </div>
      `;
    }).join('');
  }
}

function initTrendChart() {
  const canvas = document.getElementById('trend-chart');
  if (!canvas) return;

  const now = new Date();
  const labels = [];
  const incomeData = [];
  const expenseData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    labels.push(getMonthName(d.getMonth()).slice(0, 3));

    const stats = safeCall(() => store.getMonthlyStats(month)) || {};
    incomeData.push(stats.income || 0);
    expenseData.push(stats.expenses || 0);
  }

  try {
    trendChart = createLineChart(canvas, {
      labels,
      datasets: [
        { label: 'Income', data: incomeData, color: '#10b981' },
        { label: 'Expenses', data: expenseData, color: '#ef4444' },
      ],
    });
  } catch (e) {
    console.warn('[Dashboard] Failed to create trend chart:', e);
  }
}

/* =========================================================================
 * SUB-RENDER HELPERS
 * ========================================================================= */

function renderBudgetOverview(budget, catSpending, categories, totalExpenses) {
  if (!budget || !budget.totalBudget) {
    return `
      <div style="text-align:center;padding:1rem;color:var(--text-muted)">
        <p>No budget set for this month</p>
        <a href="#/budgets" class="btn btn--primary btn--sm" style="margin-top:0.5rem">Set Budget</a>
      </div>
    `;
  }

  const totalBudget = budget.totalBudget;
  const overallPct = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0;
  const remaining = totalBudget - totalExpenses;
  const status = overallPct < 75 ? 'success' : overallPct < 90 ? 'warning' : 'danger';

  let categoryRows = '';
  if (budget.categoryBudgets) {
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
    const entries = Object.entries(budget.categoryBudgets).slice(0, 6);
    categoryRows = entries.map(([catId, budgetAmt]) => {
      const cat = catMap[catId];
      const spent = catSpending[catId] || 0;
      const pct = budgetAmt > 0 ? Math.round((spent / budgetAmt) * 100) : 0;
      return `
        <div style="margin-bottom:0.75rem">
          <div class="flex items-center justify-between" style="margin-bottom:0.25rem;font-size:0.85rem">
            <span style="color:var(--text-secondary)">${escapeHtml(cat?.name || catId)}</span>
            <span style="color:var(--text-muted)">${formatCurrency(spent)} / ${formatCurrency(budgetAmt)}</span>
          </div>
          ${renderProgressBar(pct)}
        </div>
      `;
    }).join('');
  }

  return `
    <div style="text-align:center;margin-bottom:1rem">
      <div style="font-size:2rem;font-weight:700;color:var(--text-primary)">${overallPct}%</div>
      <div style="font-size:0.85rem;color:var(--text-muted)">
        ${formatCurrency(totalExpenses)} of ${formatCurrency(totalBudget)} spent
      </div>
      <div style="font-size:0.8rem;color:var(--accent-${status});margin-top:0.25rem">
        ${remaining >= 0 ? `${formatCurrency(remaining)} remaining` : `${formatCurrency(Math.abs(remaining))} over budget`}
      </div>
    </div>
    ${renderProgressBar(overallPct, status)}
    <div style="margin-top:1rem">${categoryRows}</div>
  `;
}

function renderUpcomingBills(upcoming) {
  if (!upcoming.length) {
    return `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:0.875rem">No upcoming bills</div>`;
  }

  return upcoming.map(r => `
    <div class="transaction-row" style="cursor:default">
      <div class="transaction-row__icon" style="background:var(--accent-warning)15;color:var(--accent-warning)">
        <i data-lucide="calendar" style="width:18px;height:18px"></i>
      </div>
      <div class="transaction-row__details">
        <span class="transaction-row__name">${escapeHtml(r.description || r.name || 'Recurring')}</span>
        <span class="transaction-row__category">Due ${formatDate(r.nextDate)}</span>
      </div>
      <div class="transaction-row__amount transaction-row__amount--expense">
        ${formatCurrency(r.amount || 0)}
      </div>
    </div>
  `).join('');
}

/** Safely call a function, returning undefined on error */
function safeCall(fn) {
  try { return fn(); } catch { return undefined; }
}
