/**
 * Debts View
 * Debt management with payoff tracking, EMI info, and payment recording.
 */

import { store } from '../store.js';
import { formatCurrency, formatDate, formatDateInput } from '../utils/formatters.js';
import { escapeHtml } from '../utils/helpers.js';
import { renderProgressBar, renderStatCard, renderEmptyState, showModal, showConfirmModal, showToast } from './components.js';

/**
 * Render the debts page.
 */
export function renderDebts() {
  const container = document.getElementById('main-content');
  if (!container) return;

  const debts = safeCall(() => store.getDebts()) || [];

  // Summary calculations
  const totalDebt = debts.reduce((s, d) => s + (d.remainingAmount || 0), 0);
  const totalEMI = debts.reduce((s, d) => s + (d.emiAmount || 0), 0);
  const totalInterest = debts.reduce((s, d) => {
    // Rough projected interest = remaining × rate/100 × months_left/12
    const monthsLeft = estimateMonthsLeft(d);
    return s + ((d.remainingAmount || 0) * (d.interestRate || 0) / 100 / 12 * monthsLeft);
  }, 0);

  container.innerHTML = `
    <div class="debts-page">
      <!-- Header -->
      <div class="flex items-center justify-between" style="margin-bottom:1.25rem;flex-wrap:wrap;gap:0.75rem">
        <div>
          <h1 style="margin:0;font-size:1.75rem;color:var(--text-primary)">Debt Management</h1>
          <p style="margin:0.25rem 0 0;color:var(--text-muted);font-size:0.875rem">Track and manage your debts and loans</p>
        </div>
        <button class="btn btn--primary" id="debt-add-btn">
          <i data-lucide="plus" style="width:18px;height:18px"></i> Add Debt
        </button>
      </div>

      ${debts.length ? `
        <!-- Summary Cards -->
        <div class="grid grid-3" style="gap:1rem;margin-bottom:1.5rem">
          ${renderStatCard('landmark', 'Total Debt', formatCurrency(totalDebt), null, null, 'var(--accent-danger)')}
          ${renderStatCard('calendar-check', 'Monthly EMI', formatCurrency(totalEMI), null, null, 'var(--accent-warning)')}
          ${renderStatCard('percent', 'Projected Interest', formatCurrency(totalInterest), null, null, 'var(--accent-primary)')}
        </div>
      ` : ''}

      <!-- Debts List -->
      <div id="debts-list" class="flex flex-col gap-md">
        ${debts.length
          ? debts.map(d => renderDebtCard(d)).join('')
          : renderEmptyState(
              'landmark',
              'No debts tracked',
              'Add your loans and credit cards to track payoff progress.',
              '<button class="btn btn--primary btn--sm debt-empty-add" style="margin-top:0.75rem"><i data-lucide="plus" style="width:16px;height:16px"></i> Add Debt</button>'
            )}
      </div>
    </div>
  `;

  // --- Events ---
  container.querySelector('#debt-add-btn')?.addEventListener('click', () => {
    showDebtModal(null, () => { renderDebts(); window.dispatchEvent(new CustomEvent('store-updated')); });
  });

  container.querySelector('.debt-empty-add')?.addEventListener('click', () => {
    showDebtModal(null, () => { renderDebts(); window.dispatchEvent(new CustomEvent('store-updated')); });
  });

  // Delegated events on list
  container.querySelector('#debts-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-debt-action]');
    if (!btn) return;
    const id = btn.dataset.debtId;
    const action = btn.dataset.debtAction;

    const debt = debts.find(d => d.id === id);

    switch (action) {
      case 'payment':
        if (debt) showPaymentModal(debt, () => { renderDebts(); window.dispatchEvent(new CustomEvent('store-updated')); });
        break;
      case 'edit':
        if (debt) showDebtModal(debt, () => { renderDebts(); window.dispatchEvent(new CustomEvent('store-updated')); });
        break;
      case 'delete':
        showConfirmModal('Delete this debt? This cannot be undone.', () => {
          store.deleteDebt(id);
          showToast('Debt deleted', 'success');
          renderDebts();
          window.dispatchEvent(new CustomEvent('store-updated'));
        });
        break;
    }
  });

  if (window.lucide) lucide.createIcons();
}

/**
 * Render a single debt card.
 */
function renderDebtCard(debt) {
  const d = debt;
  const principal = d.principalAmount || d.remainingAmount || 0;
  const remaining = d.remainingAmount || 0;
  const paid = principal - remaining;
  const paidPct = principal > 0 ? Math.round((paid / principal) * 100) : 0;
  const monthsLeft = estimateMonthsLeft(d);
  const projectedInterest = remaining * (d.interestRate || 0) / 100 / 12 * monthsLeft;

  const typeLabels = {
    'home-loan': 'Home Loan', 'car-loan': 'Car Loan', 'personal-loan': 'Personal Loan',
    'education-loan': 'Education', 'credit-card': 'Credit Card', 'other': 'Other',
  };
  const typeLabel = typeLabels[d.type] || d.type || 'Loan';
  const typeColors = {
    'home-loan': '#6366f1', 'car-loan': '#3b82f6', 'personal-loan': '#8b5cf6',
    'education-loan': '#ec4899', 'credit-card': '#ef4444', 'other': '#64748b',
  };
  const typeColor = typeColors[d.type] || '#64748b';

  return `
    <div class="card card--glass" style="overflow:hidden">
      <!-- Accent bar -->
      <div style="height:3px;background:${typeColor}"></div>
      <div class="card__body" style="padding:1.25rem">
        <!-- Header -->
        <div class="flex items-center justify-between" style="margin-bottom:1rem">
          <div class="flex items-center gap-sm">
            <div style="width:40px;height:40px;border-radius:12px;background:${typeColor}20;color:${typeColor};display:flex;align-items:center;justify-content:center">
              <i data-lucide="landmark" style="width:20px;height:20px"></i>
            </div>
            <div>
              <div style="font-weight:700;font-size:1.05rem;color:var(--text-primary)">${escapeHtml(d.name)}</div>
              <div class="flex gap-sm items-center" style="margin-top:0.15rem">
                <span class="badge" style="background:${typeColor}20;color:${typeColor};font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:20px;font-weight:600">${typeLabel}</span>
                ${d.lender ? `<span style="font-size:0.8rem;color:var(--text-muted)">${escapeHtml(d.lender)}</span>` : ''}
              </div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.3rem;font-weight:800;color:var(--accent-danger)">${formatCurrency(remaining)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">remaining</div>
          </div>
        </div>

        <!-- Progress -->
        <div style="margin-bottom:1rem">
          <div class="flex items-center justify-between" style="font-size:0.8rem;margin-bottom:0.35rem">
            <span style="color:var(--text-muted)">${paidPct}% paid off</span>
            <span style="color:var(--text-muted)">${formatCurrency(paid)} / ${formatCurrency(principal)}</span>
          </div>
          ${renderProgressBar(paidPct, paidPct > 50 ? 'success' : 'warning')}
        </div>

        <!-- Details Grid -->
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:0.75rem;margin-bottom:1rem">
          <div style="text-align:center;padding:0.5rem;background:var(--bg-tertiary);border-radius:8px">
            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Interest</div>
            <div style="font-weight:700;color:var(--text-primary);font-size:0.95rem">${d.interestRate || 0}%</div>
          </div>
          <div style="text-align:center;padding:0.5rem;background:var(--bg-tertiary);border-radius:8px">
            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">EMI</div>
            <div style="font-weight:700;color:var(--text-primary);font-size:0.95rem">${formatCurrency(d.emiAmount || 0)}</div>
          </div>
          ${d.nextPaymentDate ? `
            <div style="text-align:center;padding:0.5rem;background:var(--bg-tertiary);border-radius:8px">
              <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Next Due</div>
              <div style="font-weight:700;color:var(--text-primary);font-size:0.95rem">${formatDate(d.nextPaymentDate)}</div>
            </div>
          ` : ''}
          <div style="text-align:center;padding:0.5rem;background:var(--bg-tertiary);border-radius:8px">
            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Months Left</div>
            <div style="font-weight:700;color:var(--text-primary);font-size:0.95rem">${monthsLeft || '—'}</div>
          </div>
          <div style="text-align:center;padding:0.5rem;background:var(--bg-tertiary);border-radius:8px">
            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Total Interest</div>
            <div style="font-weight:700;color:var(--accent-warning);font-size:0.95rem">≈ ${formatCurrency(projectedInterest)}</div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-sm">
          <button class="btn btn--primary btn--sm" style="flex:1" data-debt-action="payment" data-debt-id="${d.id}">
            <i data-lucide="banknote" style="width:14px;height:14px"></i> Record Payment
          </button>
          <button class="btn btn--ghost btn--sm btn--icon" data-debt-action="edit" data-debt-id="${d.id}" title="Edit">
            <i data-lucide="edit-3" style="width:14px;height:14px"></i>
          </button>
          <button class="btn btn--ghost btn--sm btn--icon" data-debt-action="delete" data-debt-id="${d.id}" title="Delete" style="color:var(--accent-danger)">
            <i data-lucide="trash-2" style="width:14px;height:14px"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Estimate months left on a debt.
 */
function estimateMonthsLeft(d) {
  if (d.endDate) {
    const end = new Date(d.endDate);
    const now = new Date();
    return Math.max(0, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth());
  }
  if (d.emiAmount && d.emiAmount > 0 && d.remainingAmount > 0) {
    return Math.ceil(d.remainingAmount / d.emiAmount);
  }
  return 0;
}

/**
 * Show add/edit debt modal.
 */
function showDebtModal(debt = null, onSaved) {
  const isEdit = !!debt;
  const d = debt || {};

  const content = `
    <form id="debt-form" class="flex flex-col gap-md">
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">Debt Name</label>
          <input type="text" name="name" class="form-input" value="${escapeHtml(d.name || '')}" placeholder="e.g. Home Loan" required>
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select name="type" class="form-select">
            <option value="home-loan" ${d.type === 'home-loan' ? 'selected' : ''}>Home Loan</option>
            <option value="car-loan" ${d.type === 'car-loan' ? 'selected' : ''}>Car Loan</option>
            <option value="personal-loan" ${d.type === 'personal-loan' || !d.type ? 'selected' : ''}>Personal Loan</option>
            <option value="education-loan" ${d.type === 'education-loan' ? 'selected' : ''}>Education Loan</option>
            <option value="credit-card" ${d.type === 'credit-card' ? 'selected' : ''}>Credit Card</option>
            <option value="other" ${d.type === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
      </div>

      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">Principal Amount</label>
          <input type="number" name="principalAmount" class="form-input" value="${d.principalAmount || ''}" placeholder="500000" min="0" step="1000" required>
        </div>
        <div class="form-group">
          <label class="form-label">Remaining Amount</label>
          <input type="number" name="remainingAmount" class="form-input" value="${d.remainingAmount || ''}" placeholder="350000" min="0" step="1000" required>
        </div>
      </div>

      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">Interest Rate (%)</label>
          <input type="number" name="interestRate" class="form-input" value="${d.interestRate || ''}" placeholder="8.5" min="0" step="0.1">
        </div>
        <div class="form-group">
          <label class="form-label">EMI Amount</label>
          <input type="number" name="emiAmount" class="form-input" value="${d.emiAmount || ''}" placeholder="15000" min="0" step="100">
        </div>
      </div>

      <div class="grid grid-3 gap-md">
        <div class="form-group">
          <label class="form-label">Start Date</label>
          <input type="date" name="startDate" class="form-input" value="${d.startDate ? formatDateInput(d.startDate) : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">End Date</label>
          <input type="date" name="endDate" class="form-input" value="${d.endDate ? formatDateInput(d.endDate) : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Next Payment</label>
          <input type="date" name="nextPaymentDate" class="form-input" value="${d.nextPaymentDate ? formatDateInput(d.nextPaymentDate) : ''}">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Lender</label>
        <input type="text" name="lender" class="form-input" value="${escapeHtml(d.lender || '')}" placeholder="e.g. SBI, HDFC">
      </div>
    </form>
  `;

  showModal({
    title: isEdit ? 'Edit Debt' : 'Add Debt',
    content,
    confirmText: isEdit ? 'Update' : 'Add Debt',
    onConfirm: () => {
      const form = document.getElementById('debt-form');
      if (!form) return;
      const fd = new FormData(form);
      const data = {
        name: fd.get('name') || '',
        type: fd.get('type') || 'personal-loan',
        principalAmount: parseFloat(fd.get('principalAmount')) || 0,
        remainingAmount: parseFloat(fd.get('remainingAmount')) || 0,
        interestRate: parseFloat(fd.get('interestRate')) || 0,
        emiAmount: parseFloat(fd.get('emiAmount')) || 0,
        startDate: fd.get('startDate') || '',
        endDate: fd.get('endDate') || '',
        nextPaymentDate: fd.get('nextPaymentDate') || '',
        lender: fd.get('lender') || '',
      };

      if (!data.name) {
        showToast('Please enter a debt name.', 'warning');
        return;
      }

      if (isEdit) {
        store.updateDebt(debt.id, data);
        showToast('Debt updated!', 'success');
      } else {
        store.addDebt(data);
        showToast('Debt added!', 'success');
      }
      if (onSaved) onSaved();
    },
  });
}

/**
 * Show a payment recording modal.
 */
function showPaymentModal(debt, onSaved) {
  const content = `
    <div class="flex flex-col gap-md">
      <p style="color:var(--text-secondary);margin:0">
        Record payment for <strong>${escapeHtml(debt.name)}</strong>
      </p>
      <p style="color:var(--text-muted);font-size:0.85rem;margin:0">
        Remaining: ${formatCurrency(debt.remainingAmount || 0)} | EMI: ${formatCurrency(debt.emiAmount || 0)}
      </p>
      <div class="form-group" style="margin:0">
        <label class="form-label">Payment Amount</label>
        <input type="number" id="payment-amount" class="form-input"
               value="${debt.emiAmount || ''}" placeholder="Enter amount"
               min="1" step="100" style="font-size:1.1rem;font-weight:600">
      </div>
    </div>
  `;

  showModal({
    title: 'Record Payment',
    content,
    confirmText: 'Record Payment',
    onConfirm: () => {
      const amountEl = document.getElementById('payment-amount');
      const amount = parseFloat(amountEl?.value);
      if (!amount || amount <= 0) {
        showToast('Please enter a valid amount.', 'warning');
        return;
      }
      const newRemaining = Math.max(0, (debt.remainingAmount || 0) - amount);
      store.updateDebt(debt.id, { remainingAmount: newRemaining });
      showToast(`Payment of ${formatCurrency(amount)} recorded for "${debt.name}"`, 'success');
      if (onSaved) onSaved();
    },
  });
}

function safeCall(fn) {
  try { return fn(); } catch { return undefined; }
}
