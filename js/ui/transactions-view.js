/**
 * Transactions View
 * Full transaction management: filters, list, bulk actions, CRUD modals.
 */

import { store } from '../store.js';
import { formatCurrency, formatDate, formatDateInput, getCurrentMonth, getMonthName } from '../utils/formatters.js';
import { escapeHtml, debounce } from '../utils/helpers.js';
import {
  renderTransactionRow, renderEmptyState, showTransactionModal,
  showConfirmModal, showToast,
} from './components.js';

/** Track selected transaction IDs for bulk operations */
let selectedIds = new Set();

/**
 * Render the transactions page.
 * @param {string} [searchQuery] - Pre-filled search query from global search
 */
export function renderTransactions(searchQuery = '') {
  const container = document.getElementById('main-content');
  if (!container) return;

  selectedIds.clear();

  const categories = safeCall(() => store.getCategories()) || [];
  const accounts = safeCall(() => store.getAccounts()) || [];

  // Build month options (last 12 months + All)
  const now = new Date();
  const monthOptions = ['<option value="all">All Months</option>'];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${getMonthName(d.getMonth())} ${d.getFullYear()}`;
    const selected = i === 0 && !searchQuery ? 'selected' : '';
    monthOptions.push(`<option value="${val}" ${selected}>${label}</option>`);
  }

  const categoryOpts = categories.map(c =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`
  ).join('');

  container.innerHTML = `
    <div class="transactions-page">
      <!-- Header -->
      <div class="flex items-center justify-between" style="margin-bottom:1.25rem">
        <div>
          <h1 style="margin:0;font-size:1.75rem;color:var(--text-primary)">Transactions</h1>
          <p style="margin:0.25rem 0 0;color:var(--text-muted);font-size:0.875rem">Manage your income and expenses</p>
        </div>
        <button class="btn btn--primary" id="tx-add-btn">
          <i data-lucide="plus" style="width:18px;height:18px"></i> Add Transaction
        </button>
      </div>

      <!-- Filters -->
      <div class="card card--glass" style="margin-bottom:1rem">
        <div class="card__body" style="padding:0.75rem 1rem">
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.75rem;align-items:end">
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:0.75rem">Month</label>
              <select class="form-select" id="tx-filter-month" style="font-size:0.85rem">${monthOptions.join('')}</select>
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:0.75rem">Type</label>
              <select class="form-select" id="tx-filter-type" style="font-size:0.85rem">
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:0.75rem">Category</label>
              <select class="form-select" id="tx-filter-category" style="font-size:0.85rem">
                <option value="all">All Categories</option>
                ${categoryOpts}
              </select>
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:0.75rem">Search</label>
              <input type="text" class="form-input" id="tx-filter-search" placeholder="Search transactions…"
                     value="${escapeHtml(searchQuery)}" style="font-size:0.85rem">
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:0.75rem">Sort</label>
              <select class="form-select" id="tx-sort" style="font-size:0.85rem">
                <option value="date-desc">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="amount-desc">Amount (High → Low)</option>
                <option value="amount-asc">Amount (Low → High)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Bar -->
      <div id="tx-summary" class="flex gap-lg items-center" style="margin-bottom:1rem;font-size:0.85rem;color:var(--text-secondary);flex-wrap:wrap"></div>

      <!-- Bulk Actions (hidden by default) -->
      <div id="tx-bulk-bar" class="card" style="display:none;margin-bottom:1rem;background:var(--accent-primary);border:none">
        <div class="card__body flex items-center justify-between" style="padding:0.6rem 1rem">
          <span style="color:#fff;font-size:0.875rem"><strong id="tx-selected-count">0</strong> selected</span>
          <div class="flex gap-sm">
            <button class="btn btn--sm" id="tx-bulk-delete" style="background:rgba(255,255,255,0.2);color:#fff;border:none">
              <i data-lucide="trash-2" style="width:14px;height:14px"></i> Delete
            </button>
            <button class="btn btn--sm" id="tx-bulk-deselect" style="background:rgba(255,255,255,0.2);color:#fff;border:none">
              Deselect All
            </button>
          </div>
        </div>
      </div>

      <!-- Transactions List -->
      <div class="card card--glass">
        <div class="card__body" style="padding:0" id="tx-list-container">
          <!-- Rendered dynamically -->
        </div>
      </div>
    </div>
  `;

  // Initial render
  renderFilteredList(container);

  // --- Event Listeners ---
  const filterEls = ['tx-filter-month', 'tx-filter-type', 'tx-filter-category', 'tx-sort'];
  filterEls.forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener('change', () => renderFilteredList(container));
  });

  container.querySelector('#tx-filter-search')?.addEventListener(
    'input',
    debounce(() => renderFilteredList(container), 300)
  );

  container.querySelector('#tx-add-btn')?.addEventListener('click', () => {
    showTransactionModal(null, (data) => {
      store.addTransaction(data);
      showToast('Transaction added!', 'success');
      renderFilteredList(container);
      window.dispatchEvent(new CustomEvent('store-updated'));
    });
  });

  container.querySelector('#tx-bulk-delete')?.addEventListener('click', () => {
    showConfirmModal(`Delete ${selectedIds.size} transactions?`, () => {
      store.deleteTransactions([...selectedIds]);
      selectedIds.clear();
      showToast('Transactions deleted', 'success');
      renderFilteredList(container);
      window.dispatchEvent(new CustomEvent('store-updated'));
    });
  });

  container.querySelector('#tx-bulk-deselect')?.addEventListener('click', () => {
    selectedIds.clear();
    renderFilteredList(container);
  });

  // Delegated click on list
  container.querySelector('#tx-list-container')?.addEventListener('click', (e) => {
    // Checkbox toggle
    const checkbox = e.target.closest('.tx-checkbox');
    if (checkbox) {
      const id = checkbox.dataset.id;
      if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
      updateBulkBar(container);
      checkbox.classList.toggle('checked');
      return;
    }

    // Delete single
    const deleteBtn = e.target.closest('.tx-delete-btn');
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.dataset.id;
      const tx = store.getTransaction(id);
      const desc = tx ? `Delete "${tx.description || 'transaction'}" — ${formatCurrency(tx.amount)}?` : 'Delete this transaction?';
      showConfirmModal(desc, () => {
        store.deleteTransaction(id);
        showToast('Transaction deleted', 'success');
        renderFilteredList(container);
        window.dispatchEvent(new CustomEvent('store-updated'));
      });
      return;
    }

    // Edit via edit button
    const editBtn = e.target.closest('.tx-edit-btn');
    if (editBtn) {
      e.stopPropagation();
      const tx = store.getTransaction(editBtn.dataset.id);
      if (tx) {
        showTransactionModal(tx, (data) => {
          store.updateTransaction(tx.id, data);
          showToast('Transaction updated', 'success');
          renderFilteredList(container);
          window.dispatchEvent(new CustomEvent('store-updated'));
        });
      }
      return;
    }

    // Click row to edit
    const row = e.target.closest('.transaction-row');
    if (row && row.dataset.id) {
      const tx = store.getTransaction(row.dataset.id);
      if (tx) {
        showTransactionModal(tx, (data) => {
          store.updateTransaction(tx.id, data);
          showToast('Transaction updated', 'success');
          renderFilteredList(container);
          window.dispatchEvent(new CustomEvent('store-updated'));
        });
      }
    }
  });

  if (window.lucide) lucide.createIcons();
}

/**
 * Read current filter state, query the store, sort, and render the list.
 */
function renderFilteredList(root) {
  const monthEl = root.querySelector('#tx-filter-month');
  const typeEl = root.querySelector('#tx-filter-type');
  const catEl = root.querySelector('#tx-filter-category');
  const searchEl = root.querySelector('#tx-filter-search');
  const sortEl = root.querySelector('#tx-sort');

  const filters = {};
  const month = monthEl?.value;
  if (month && month !== 'all') filters.month = month;
  const type = typeEl?.value;
  if (type && type !== 'all') filters.type = type;
  const cat = catEl?.value;
  if (cat && cat !== 'all') filters.categoryId = cat;
  const search = searchEl?.value?.trim();
  if (search) filters.search = search;

  let transactions = safeCall(() => store.getTransactions(filters)) || [];

  // Sort
  const sort = sortEl?.value || 'date-desc';
  switch (sort) {
    case 'date-asc':
      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case 'date-desc':
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      break;
    case 'amount-desc':
      transactions.sort((a, b) => (b.amount || 0) - (a.amount || 0));
      break;
    case 'amount-asc':
      transactions.sort((a, b) => (a.amount || 0) - (b.amount || 0));
      break;
  }

  // Summary
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const summaryEl = root.querySelector('#tx-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <span><strong>${transactions.length}</strong> transactions</span>
      <span style="color:var(--accent-success)">Income: ${formatCurrency(totalIncome)}</span>
      <span style="color:var(--accent-danger)">Expenses: ${formatCurrency(totalExpense)}</span>
      <span>Net: <strong style="color:${totalIncome - totalExpense >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}">${formatCurrency(totalIncome - totalExpense)}</strong></span>
    `;
  }

  // List
  const listContainer = root.querySelector('#tx-list-container');
  if (!listContainer) return;

  if (!transactions.length) {
    listContainer.innerHTML = renderEmptyState(
      'receipt',
      'No transactions found',
      search ? 'Try adjusting your filters or search query.' : 'Add your first transaction to get started.',
      !search ? '<button class="btn btn--primary btn--sm tx-empty-add" style="margin-top:0.75rem"><i data-lucide="plus" style="width:16px;height:16px"></i> Add Transaction</button>' : ''
    );

    listContainer.querySelector('.tx-empty-add')?.addEventListener('click', () => {
      showTransactionModal(null, (data) => {
        store.addTransaction(data);
        showToast('Transaction added!', 'success');
        renderFilteredList(root);
        window.dispatchEvent(new CustomEvent('store-updated'));
      });
    });
  } else {
    listContainer.innerHTML = transactions.map(t => {
      const checked = selectedIds.has(t.id) ? 'checked' : '';
      return `
        <div style="display:flex;align-items:center;gap:0.5rem;padding-left:0.75rem;position:relative" class="tx-row-wrapper">
          <div class="tx-checkbox ${checked}" data-id="${t.id}" style="width:18px;height:18px;border:2px solid var(--glass-border-hover);border-radius:4px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s ease;${checked ? 'background:var(--accent-primary);border-color:var(--accent-primary)' : ''}">
            ${checked ? '<i data-lucide="check" style="width:12px;height:12px;color:#fff"></i>' : ''}
          </div>
          <div style="flex:1;min-width:0">
            ${renderTransactionRow(t)}
          </div>
          <div class="tx-row-actions" style="display:flex;gap:0.25rem;flex-shrink:0;padding-right:0.75rem">
            <button class="tx-edit-btn btn btn--icon btn--ghost btn--sm" data-id="${t.id}" title="Edit">
              <i data-lucide="pencil" style="width:15px;height:15px;color:var(--accent-primary)"></i>
            </button>
            <button class="tx-delete-btn btn btn--icon btn--ghost btn--sm" data-id="${t.id}" title="Delete">
              <i data-lucide="trash-2" style="width:15px;height:15px;color:var(--accent-danger)"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  updateBulkBar(root);
  if (window.lucide) lucide.createIcons();
}

function updateBulkBar(root) {
  const bar = root.querySelector('#tx-bulk-bar');
  const countEl = root.querySelector('#tx-selected-count');
  if (bar) bar.style.display = selectedIds.size > 0 ? '' : 'none';
  if (countEl) countEl.textContent = selectedIds.size;
}

function safeCall(fn) {
  try { return fn(); } catch { return undefined; }
}
