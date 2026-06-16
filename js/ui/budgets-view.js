/**
 * Budgets View
 * Monthly budget management with overall progress and per-category breakdown.
 */

import { store } from '../store.js';
import { formatCurrency, getCurrentMonth, getMonthName } from '../utils/formatters.js';
import { escapeHtml } from '../utils/helpers.js';
import { renderProgressBar, showModal, showToast, renderEmptyState } from './components.js';

/**
 * Render the budgets page.
 */
export function renderBudgets() {
  const container = document.getElementById('main-content');
  if (!container) return;

  const currentMonth = getCurrentMonth();
  const now = new Date();

  // Build month selector options
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${getMonthName(d.getMonth())} ${d.getFullYear()}`;
    monthOptions.push(`<option value="${val}" ${val === currentMonth ? 'selected' : ''}>${label}</option>`);
  }

  container.innerHTML = `
    <div class="budgets-page">
      <!-- Header -->
      <div class="flex items-center justify-between" style="margin-bottom:1.25rem;flex-wrap:wrap;gap:0.75rem">
        <div>
          <h1 style="margin:0;font-size:1.75rem;color:var(--text-primary)">Budgets</h1>
          <p style="margin:0.25rem 0 0;color:var(--text-muted);font-size:0.875rem">Track and manage your monthly budgets</p>
        </div>
        <div class="flex gap-sm items-center">
          <select class="form-select" id="budget-month-select" style="min-width:180px">
            ${monthOptions.join('')}
          </select>
          <button class="btn btn--primary" id="budget-edit-btn">
            <i data-lucide="edit-3" style="width:16px;height:16px"></i> Edit Budget
          </button>
        </div>
      </div>

      <div id="budget-content">
        <!-- Rendered dynamically -->
      </div>
    </div>
  `;

  renderBudgetContent(currentMonth);

  container.querySelector('#budget-month-select')?.addEventListener('change', (e) => {
    renderBudgetContent(e.target.value);
  });

  container.querySelector('#budget-edit-btn')?.addEventListener('click', () => {
    const month = container.querySelector('#budget-month-select')?.value || currentMonth;
    showBudgetEditModal(month, () => {
      renderBudgetContent(month);
      window.dispatchEvent(new CustomEvent('store-updated'));
    });
  });

  if (window.lucide) lucide.createIcons();
}

/**
 * Render budget details for a specific month.
 */
function renderBudgetContent(month) {
  const contentEl = document.getElementById('budget-content');
  if (!contentEl) return;

  const budget = safeCall(() => store.getBudget(month));
  const categories = safeCall(() => store.getCategories('expense')) || [];
  const transactions = safeCall(() => store.getTransactions({ month, type: 'expense' })) || [];

  // Calculate spending per category
  const catSpending = {};
  let totalSpent = 0;
  for (const t of transactions) {
    const catId = t.categoryId || 'other';
    catSpending[catId] = (catSpending[catId] || 0) + (t.amount || 0);
    totalSpent += t.amount || 0;
  }

  if (!budget || !budget.totalBudget) {
    contentEl.innerHTML = renderEmptyState(
      'calculator',
      'No budget set',
      'Set a budget for this month to start tracking your spending.',
      `<button class="btn btn--primary btn--sm" id="budget-set-empty" style="margin-top:0.75rem">
        <i data-lucide="plus" style="width:16px;height:16px"></i> Set Budget
      </button>`
    );

    contentEl.querySelector('#budget-set-empty')?.addEventListener('click', () => {
      showBudgetEditModal(month, () => {
        renderBudgetContent(month);
        window.dispatchEvent(new CustomEvent('store-updated'));
      });
    });

    if (window.lucide) lucide.createIcons();
    return;
  }

  const totalBudget = budget.totalBudget;
  const remaining = totalBudget - totalSpent;
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const status = overallPct < 75 ? 'success' : overallPct < 90 ? 'warning' : 'danger';

  // Category budget cards
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const categoryBudgets = budget.categoryBudgets || {};
  const defaultColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

  const catCards = Object.entries(categoryBudgets)
    .filter(([, amt]) => amt > 0)
    .map(([catId, budgetAmt], idx) => {
      const cat = catMap[catId];
      const spent = catSpending[catId] || 0;
      const catRemaining = budgetAmt - spent;
      const pct = budgetAmt > 0 ? Math.round((spent / budgetAmt) * 100) : 0;
      const catStatus = pct < 75 ? 'success' : pct < 90 ? 'warning' : 'danger';
      const color = cat?.color || defaultColors[idx % defaultColors.length];
      const icon = cat?.icon || 'tag';

      return `
        <div class="card card--glass" style="padding:1.25rem">
          <div class="flex items-center gap-sm" style="margin-bottom:0.75rem">
            <div style="width:36px;height:36px;border-radius:10px;background:${color}20;color:${color};display:flex;align-items:center;justify-content:center">
              <i data-lucide="${escapeHtml(icon)}" style="width:18px;height:18px"></i>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;color:var(--text-primary);font-size:0.95rem">${escapeHtml(cat?.name || catId)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700;color:var(--text-primary);font-size:1.1rem">${pct}%</div>
            </div>
          </div>

          ${renderProgressBar(pct, catStatus)}

          <div class="grid grid-3 gap-sm" style="margin-top:0.75rem;text-align:center;font-size:0.8rem">
            <div>
              <div style="color:var(--text-muted)">Budgeted</div>
              <div style="font-weight:600;color:var(--text-primary)">${formatCurrency(budgetAmt)}</div>
            </div>
            <div>
              <div style="color:var(--text-muted)">Spent</div>
              <div style="font-weight:600;color:var(--accent-danger)">${formatCurrency(spent)}</div>
            </div>
            <div>
              <div style="color:var(--text-muted)">Remaining</div>
              <div style="font-weight:600;color:${catRemaining >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}">
                ${catRemaining >= 0 ? formatCurrency(catRemaining) : `-${formatCurrency(Math.abs(catRemaining))}`}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

  contentEl.innerHTML = `
    <!-- Overall Progress Card -->
    <div class="card card--glass" style="margin-bottom:1.25rem">
      <div class="card__body" style="text-align:center">
        <div style="font-size:3rem;font-weight:800;color:var(--text-primary);line-height:1">${overallPct}%</div>
        <div style="color:var(--text-secondary);margin:0.5rem 0;font-size:0.95rem">
          ${formatCurrency(totalSpent)} spent of ${formatCurrency(totalBudget)}
        </div>
        ${renderProgressBar(overallPct, status)}
        <div style="margin-top:0.75rem;font-size:0.9rem;color:var(--accent-${status});font-weight:500">
          ${remaining >= 0
            ? `${formatCurrency(remaining)} remaining this month`
            : `${formatCurrency(Math.abs(remaining))} over budget!`}
        </div>
      </div>
    </div>

    <!-- Category Budgets Grid -->
    <h3 style="margin:0 0 1rem;font-size:1.1rem;color:var(--text-primary)">
      <i data-lucide="layers" style="width:18px;height:18px;vertical-align:text-bottom"></i>
      Category Budgets
    </h3>
    <div class="grid grid-2" style="gap:1rem">
      ${catCards || '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center">No category budgets configured.</p>'}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

/**
 * Show the budget editing modal.
 */
function showBudgetEditModal(month, onSaved) {
  const budget = safeCall(() => store.getBudget(month)) || {};
  const categories = safeCall(() => store.getCategories('expense')) || [];
  const categoryBudgets = budget.categoryBudgets || {};

  const catInputs = categories.map(c => `
    <div class="flex items-center gap-sm" style="margin-bottom:0.5rem">
      <label style="flex:1;font-size:0.875rem;color:var(--text-secondary)">${escapeHtml(c.name)}</label>
      <input type="number" class="form-input cat-budget-input"
             data-cat-id="${c.id}"
             value="${categoryBudgets[c.id] || c.budget || ''}"
             placeholder="0" min="0" step="100"
             style="width:140px;font-size:0.875rem">
    </div>
  `).join('');

  const content = `
    <div class="flex flex-col gap-md">
      <div class="form-group">
        <label class="form-label">Total Monthly Budget</label>
        <input type="number" class="form-input" id="total-budget-input"
               value="${budget.totalBudget || ''}" placeholder="e.g. 50000" min="0" step="1000"
               style="font-size:1.1rem;font-weight:600">
      </div>
      <div>
        <label class="form-label" style="margin-bottom:0.75rem;display:block">Category Budgets</label>
        <div style="max-height:300px;overflow-y:auto;padding-right:0.5rem">
          ${catInputs || '<p style="color:var(--text-muted)">No expense categories found. Add categories first.</p>'}
        </div>
      </div>
      <button class="btn btn--ghost btn--sm" id="auto-distribute-btn" style="align-self:flex-start">
        <i data-lucide="sparkles" style="width:14px;height:14px"></i> Auto-distribute evenly
      </button>
    </div>
  `;

  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  showModal({
    title: `Set Budget — ${month}`,
    content,
    confirmText: 'Save Budget',
    onConfirm: () => {
      const totalInput = document.getElementById('total-budget-input');
      const totalBudget = parseFloat(totalInput?.value) || 0;
      const newCatBudgets = {};
      document.querySelectorAll('.cat-budget-input').forEach(input => {
        const val = parseFloat(input.value);
        if (val > 0) newCatBudgets[input.dataset.catId] = val;
      });
      store.setBudget(month, totalBudget, newCatBudgets);
      showToast('Budget saved!', 'success');
      if (onSaved) onSaved();
    },
  });

  // Auto-distribute
  setTimeout(() => {
    document.getElementById('auto-distribute-btn')?.addEventListener('click', () => {
      const totalInput = document.getElementById('total-budget-input');
      const total = parseFloat(totalInput?.value) || 0;
      const inputs = document.querySelectorAll('.cat-budget-input');
      if (total > 0 && inputs.length) {
        const perCat = Math.floor(total / inputs.length);
        inputs.forEach(input => { input.value = perCat; });
      }
    });
    if (window.lucide) lucide.createIcons();
  }, 100);
}

function safeCall(fn) {
  try { return fn(); } catch { return undefined; }
}
