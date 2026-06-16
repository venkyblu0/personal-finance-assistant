/**
 * Shared UI Components
 * Reusable render functions and modal/toast helpers used across all views.
 */

import { store } from '../store.js';
import { formatCurrency, formatDate, formatDateInput } from '../utils/formatters.js';
import { escapeHtml } from '../utils/helpers.js';

/* =========================================================================
 * TOAST NOTIFICATIONS
 * ========================================================================= */

/**
 * Display a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} type
 * @param {number} duration - ms before auto-dismiss
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const iconMap = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
  const icon = iconMap[type] || 'info';

  toast.innerHTML = `
    <i data-lucide="${icon}" style="width:18px;height:18px;flex-shrink:0"></i>
    <span style="flex:1">${escapeHtml(message)}</span>
    <button class="toast__close" style="background:none;border:none;cursor:pointer;color:inherit;padding:0">
      <i data-lucide="x" style="width:14px;height:14px"></i>
    </button>
  `;

  toast.querySelector('.toast__close').addEventListener('click', () => removeToast(toast));
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  if (window.lucide) lucide.createIcons();

  // Auto-dismiss
  setTimeout(() => removeToast(toast), duration);
}

function removeToast(el) {
  el.classList.add('toast--exit');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  // Fallback removal
  setTimeout(() => { if (el.parentNode) el.remove(); }, 500);
}

/* =========================================================================
 * MODAL SYSTEM
 * ========================================================================= */

/**
 * Show a generic modal.
 * @param {Object} options
 * @returns {Promise<boolean>} Resolves true on confirm, false on cancel/close
 */
export function showModal({ title = '', content = '', onConfirm, onCancel, confirmText = 'Save', cancelText = 'Cancel', size = '' }) {
  return new Promise((resolve) => {
    const container = document.getElementById('modal-container');
    if (!container) { resolve(false); return; }

    const sizeClass = size ? `modal__content--${size}` : '';

    container.innerHTML = `
      <div class="modal__overlay">
        <div class="modal__content ${sizeClass}">
          <div class="modal__header">
            <h3 class="modal__title">${escapeHtml(title)}</h3>
            <button class="modal__close btn btn--icon btn--ghost" data-action="close">
              <i data-lucide="x" style="width:20px;height:20px"></i>
            </button>
          </div>
          <div class="modal__body" style="padding:1.25rem">${content}</div>
          <div class="modal__footer" style="display:flex;justify-content:flex-end;gap:0.75rem;padding:1rem 1.25rem;border-top:1px solid var(--border-color)">
            <button class="btn btn--ghost" data-action="cancel">${escapeHtml(cancelText)}</button>
            <button class="btn btn--primary" data-action="confirm">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>
    `;

    container.classList.add('active');
    if (window.lucide) lucide.createIcons();

    const close = (result) => {
      container.innerHTML = '';
      container.classList.remove('active');
      resolve(result);
    };

    container.querySelector('[data-action="close"]').addEventListener('click', () => {
      if (onCancel) onCancel();
      close(false);
    });
    container.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      if (onCancel) onCancel();
      close(false);
    });
    container.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      if (onConfirm) onConfirm();
      close(true);
    });
    container.querySelector('.modal__overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal__overlay')) {
        if (onCancel) onCancel();
        close(false);
      }
    });
  });
}

/**
 * Simple confirm dialog.
 * @param {string} message
 * @param {Function} onConfirm
 */
export async function showConfirmModal(message, onConfirm) {
  const confirmed = await showModal({
    title: 'Confirm',
    content: `<p style="color:var(--text-secondary);line-height:1.6">${escapeHtml(message)}</p>`,
    confirmText: 'Yes, continue',
    cancelText: 'Cancel',
  });
  if (confirmed && onConfirm) onConfirm();
}

/* =========================================================================
 * TRANSACTION MODAL
 * ========================================================================= */

/**
 * Show a modal form for adding or editing a transaction.
 * @param {Object|null} transaction - Existing transaction to edit, or null for new
 * @param {Function} onSave - Called with the form data object
 */
export function showTransactionModal(transaction = null, onSave) {
  const isEdit = !!transaction;
  const t = transaction || {};

  const categories = store.getCategories() || [];
  const accounts = store.getAccounts() || [];

  const expenseCats = categories.filter(c => c.type === 'expense');
  const incomeCats = categories.filter(c => c.type === 'income');

  const categoryOptions = (cats) => cats.map(c =>
    `<option value="${c.id}" ${t.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');

  const accountOptions = accounts.map(a =>
    `<option value="${a.id}" ${t.accountId === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`
  ).join('');

  const currentType = t.type || 'expense';

  const content = `
    <form id="transaction-form" class="flex flex-col gap-md">
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" name="date" class="form-input" value="${formatDateInput(t.date || new Date())}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select name="type" class="form-select" id="tx-type-select">
            <option value="expense" ${currentType === 'expense' ? 'selected' : ''}>Expense</option>
            <option value="income" ${currentType === 'income' ? 'selected' : ''}>Income</option>
          </select>
        </div>
      </div>

      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">Amount</label>
          <input type="number" name="amount" class="form-input" value="${t.amount || ''}" placeholder="0.00" step="0.01" min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select name="categoryId" class="form-select" id="tx-category-select">
            <option value="">Select category</option>
            <optgroup label="Expense" id="tx-expense-cats">${categoryOptions(expenseCats)}</optgroup>
            <optgroup label="Income" id="tx-income-cats">${categoryOptions(incomeCats)}</optgroup>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <input type="text" name="description" class="form-input" value="${escapeHtml(t.description || '')}" placeholder="What was this for?">
      </div>

      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">Account</label>
          <select name="accountId" class="form-select">
            <option value="">Select account</option>
            ${accountOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Subcategory</label>
          <input type="text" name="subcategory" class="form-input" value="${escapeHtml(t.subcategory || '')}" placeholder="Optional">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Tags (comma-separated)</label>
        <input type="text" name="tags" class="form-input" value="${escapeHtml((t.tags || []).join(', '))}" placeholder="food, travel, office">
      </div>

      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea name="notes" class="form-textarea" rows="2" placeholder="Any additional notes...">${escapeHtml(t.notes || '')}</textarea>
      </div>
    </form>
  `;

  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal__overlay">
      <div class="modal__content">
        <div class="modal__header">
          <h3 class="modal__title">${isEdit ? 'Edit Transaction' : 'Add Transaction'}</h3>
          <button class="modal__close btn btn--icon btn--ghost" data-action="close">
            <i data-lucide="x" style="width:20px;height:20px"></i>
          </button>
        </div>
        <div class="modal__body" style="padding:1.25rem">${content}</div>
        <div class="modal__footer" style="display:flex;justify-content:flex-end;gap:0.75rem;padding:1rem 1.25rem;border-top:1px solid var(--border-color)">
          <button class="btn btn--ghost" data-action="cancel">Cancel</button>
          <button class="btn btn--primary" data-action="save">
            <i data-lucide="${isEdit ? 'check' : 'plus'}" style="width:16px;height:16px"></i>
            ${isEdit ? 'Update' : 'Add Transaction'}
          </button>
        </div>
      </div>
    </div>
  `;

  container.classList.add('active');
  if (window.lucide) lucide.createIcons();

  // Toggle category optgroups based on selected type
  const typeSelect = container.querySelector('#tx-type-select');
  const updateCatVisibility = () => {
    const selectedType = typeSelect.value;
    const expGroup = container.querySelector('#tx-expense-cats');
    const incGroup = container.querySelector('#tx-income-cats');
    if (expGroup) expGroup.style.display = selectedType === 'expense' ? '' : 'none';
    if (incGroup) incGroup.style.display = selectedType === 'income' ? '' : 'none';
  };
  typeSelect.addEventListener('change', updateCatVisibility);
  updateCatVisibility();

  const closeModal = () => {
    container.innerHTML = '';
    container.classList.remove('active');
  };

  container.querySelector('[data-action="close"]').addEventListener('click', closeModal);
  container.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  container.querySelector('.modal__overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal__overlay')) closeModal();
  });

  container.querySelector('[data-action="save"]').addEventListener('click', () => {
    const form = container.querySelector('#transaction-form');
    const fd = new FormData(form);

    const amount = parseFloat(fd.get('amount'));
    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount', 'warning');
      return;
    }

    const data = {
      date: fd.get('date'),
      type: fd.get('type'),
      amount,
      categoryId: fd.get('categoryId'),
      description: fd.get('description') || '',
      accountId: fd.get('accountId') || '',
      subcategory: fd.get('subcategory') || '',
      tags: fd.get('tags') ? fd.get('tags').split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: fd.get('notes') || '',
    };

    // Resolve category name
    const cat = categories.find(c => c.id === data.categoryId);
    if (cat) data.category = cat.name;

    if (onSave) onSave(data);
    closeModal();
  });
}

/* =========================================================================
 * CATEGORY MODAL
 * ========================================================================= */

export function showCategoryModal(category = null, onSave) {
  const isEdit = !!category;
  const c = category || {};

  const content = `
    <form id="category-form" class="flex flex-col gap-md">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input type="text" name="name" class="form-input" value="${escapeHtml(c.name || '')}" placeholder="Category name" required>
      </div>
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select name="type" class="form-select">
            <option value="expense" ${c.type === 'expense' || !c.type ? 'selected' : ''}>Expense</option>
            <option value="income" ${c.type === 'income' ? 'selected' : ''}>Income</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Icon (Lucide name)</label>
          <input type="text" name="icon" class="form-input" value="${escapeHtml(c.icon || '')}" placeholder="e.g. shopping-cart">
        </div>
      </div>
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">Color</label>
          <input type="color" name="color" class="form-input" value="${c.color || '#6366f1'}" style="height:42px;padding:4px">
        </div>
        <div class="form-group">
          <label class="form-label">Budget</label>
          <input type="number" name="budget" class="form-input" value="${c.budget || ''}" placeholder="0" min="0" step="100">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Subcategories (comma-separated)</label>
        <input type="text" name="subcategories" class="form-input" value="${escapeHtml((c.subcategories || []).join(', '))}" placeholder="Sub1, Sub2">
      </div>
    </form>
  `;

  showModal({
    title: isEdit ? 'Edit Category' : 'Add Category',
    content,
    confirmText: isEdit ? 'Update' : 'Add',
    onConfirm: () => {
      const form = document.querySelector('#category-form');
      if (!form) return;
      const fd = new FormData(form);
      const data = {
        name: fd.get('name') || '',
        type: fd.get('type'),
        icon: fd.get('icon') || 'tag',
        color: fd.get('color') || '#6366f1',
        budget: parseFloat(fd.get('budget')) || 0,
        subcategories: fd.get('subcategories') ? fd.get('subcategories').split(',').map(s => s.trim()).filter(Boolean) : [],
      };
      if (onSave) onSave(data);
    },
  });
}

/* =========================================================================
 * RENDER HELPERS — return HTML strings
 * ========================================================================= */

/**
 * Render a transaction row.
 * @param {Object} transaction
 * @returns {string} HTML string
 */
export function renderTransactionRow(transaction) {
  const t = transaction;
  const isIncome = t.type === 'income';
  const amountClass = isIncome ? 'transaction-row__amount--income' : 'transaction-row__amount--expense';
  const sign = isIncome ? '+' : '-';

  // Find category for icon/color
  let catIcon = 'tag';
  let catColor = 'var(--text-muted)';
  try {
    const cat = store.getCategory(t.categoryId);
    if (cat) {
      catIcon = cat.icon || 'tag';
      catColor = cat.color || catColor;
    }
  } catch { /* skip */ }

  return `
    <div class="transaction-row" data-id="${t.id || ''}" tabindex="0">
      <div class="transaction-row__icon" style="background:${catColor}20;color:${catColor}">
        <i data-lucide="${escapeHtml(catIcon)}" style="width:18px;height:18px"></i>
      </div>
      <div class="transaction-row__details">
        <span class="transaction-row__name">${escapeHtml(t.description || t.category || 'Transaction')}</span>
        <span class="transaction-row__category">${escapeHtml(t.category || 'Uncategorized')}</span>
      </div>
      <div class="transaction-row__date">${formatDate(t.date)}</div>
      <div class="transaction-row__amount ${amountClass}">
        ${sign}${formatCurrency(t.amount || 0)}
      </div>
    </div>
  `;
}

/**
 * Render an empty state block.
 */
export function renderEmptyState(icon, title, text, actionBtn = '') {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">
        <i data-lucide="${escapeHtml(icon)}" style="width:48px;height:48px"></i>
      </div>
      <h3 class="empty-state__title">${escapeHtml(title)}</h3>
      <p class="empty-state__text">${escapeHtml(text)}</p>
      ${actionBtn}
    </div>
  `;
}

/**
 * Render a stat card.
 */
export function renderStatCard(icon, label, value, trend, trendValue, color = 'var(--accent-primary)') {
  const trendIcon = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : '';
  const trendClass = trend === 'up' ? 'stat-card__trend--up' : trend === 'down' ? 'stat-card__trend--down' : '';

  return `
    <div class="stat-card">
      <div class="stat-card__icon" style="background:${color}15;color:${color}">
        <i data-lucide="${escapeHtml(icon)}" style="width:24px;height:24px"></i>
      </div>
      <div class="stat-card__value">${value}</div>
      <div class="stat-card__label">${escapeHtml(label)}</div>
      ${trend ? `
        <div class="stat-card__trend ${trendClass}">
          <i data-lucide="${trendIcon}" style="width:14px;height:14px"></i>
          <span>${escapeHtml(trendValue || '')}</span>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render a progress bar.
 */
export function renderProgressBar(percentage, status) {
  const pct = Math.min(Math.max(percentage, 0), 100);
  let statusClass = '';
  if (status === 'success' || (!status && pct < 75)) statusClass = 'progress--success';
  else if (status === 'warning' || (!status && pct >= 75 && pct < 90)) statusClass = 'progress--warning';
  else if (status === 'danger' || (!status && pct >= 90)) statusClass = 'progress--danger';

  return `
    <div class="progress ${statusClass}">
      <div class="progress__bar" style="width:${pct}%"></div>
    </div>
  `;
}

/**
 * Render an SVG-based circular progress ring.
 */
export function renderCircularProgress(percentage, size = 80, color = 'var(--accent-primary)') {
  const pct = Math.min(Math.max(percentage, 0), 100);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
              fill="none" stroke="var(--bg-tertiary)" stroke-width="6"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
              fill="none" stroke="${color}" stroke-width="6"
              stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
              stroke-linecap="round"
              style="transition:stroke-dashoffset 0.6s ease"/>
    </svg>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${size * 0.2}px;color:var(--text-primary);transform:none">
      ${Math.round(pct)}%
    </div>
  `;
}
