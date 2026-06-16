/**
 * Goals View
 * Savings goal management with circular progress, contributions, and CRUD.
 */

import { store } from '../store.js';
import { formatCurrency, formatDate, formatDateInput } from '../utils/formatters.js';
import { escapeHtml } from '../utils/helpers.js';
import { renderCircularProgress, renderEmptyState, showModal, showConfirmModal, showToast } from './components.js';

/**
 * Render the goals page.
 */
export function renderGoals() {
  const container = document.getElementById('main-content');
  if (!container) return;

  const goals = safeCall(() => store.getGoals()) || [];

  // Summary stats
  const totalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
  const totalSaved = goals.reduce((s, g) => s + (g.currentAmount || 0), 0);
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  container.innerHTML = `
    <div class="goals-page">
      <!-- Header -->
      <div class="flex items-center justify-between" style="margin-bottom:1.25rem;flex-wrap:wrap;gap:0.75rem">
        <div>
          <h1 style="margin:0;font-size:1.75rem;color:var(--text-primary)">Savings Goals</h1>
          <p style="margin:0.25rem 0 0;color:var(--text-muted);font-size:0.875rem">
            ${goals.length ? `${formatCurrency(totalSaved)} saved of ${formatCurrency(totalTarget)} (${overallPct}%)` : 'Track your savings targets'}
          </p>
        </div>
        <button class="btn btn--primary" id="goal-add-btn">
          <i data-lucide="plus" style="width:18px;height:18px"></i> Add Goal
        </button>
      </div>

      <!-- Goals Grid -->
      <div id="goals-grid" class="grid grid-2" style="gap:1rem">
        ${goals.length
          ? goals.map(g => renderGoalCard(g)).join('')
          : `<div style="grid-column:1/-1">${renderEmptyState(
              'target',
              'No goals yet',
              'Create your first savings goal to start tracking your progress.',
              '<button class="btn btn--primary btn--sm goal-empty-add" style="margin-top:0.75rem"><i data-lucide="plus" style="width:16px;height:16px"></i> Create Goal</button>'
            )}</div>`}
      </div>
    </div>
  `;

  // --- Events ---
  container.querySelector('#goal-add-btn')?.addEventListener('click', () => {
    showGoalModal(null, () => { renderGoals(); window.dispatchEvent(new CustomEvent('store-updated')); });
  });

  container.querySelector('.goal-empty-add')?.addEventListener('click', () => {
    showGoalModal(null, () => { renderGoals(); window.dispatchEvent(new CustomEvent('store-updated')); });
  });

  // Delegated events on grid
  container.querySelector('#goals-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goal-action]');
    if (!btn) return;
    const id = btn.dataset.goalId;
    const action = btn.dataset.goalAction;

    switch (action) {
      case 'contribute': {
        const goal = store.getGoal ? store.getGoal(id) : goals.find(g => g.id === id);
        if (goal) showContributeModal(goal, () => { renderGoals(); window.dispatchEvent(new CustomEvent('store-updated')); });
        break;
      }
      case 'edit': {
        const goal = store.getGoal ? store.getGoal(id) : goals.find(g => g.id === id);
        if (goal) showGoalModal(goal, () => { renderGoals(); window.dispatchEvent(new CustomEvent('store-updated')); });
        break;
      }
      case 'delete':
        showConfirmModal('Delete this goal? This cannot be undone.', () => {
          store.deleteGoal(id);
          showToast('Goal deleted', 'success');
          renderGoals();
          window.dispatchEvent(new CustomEvent('store-updated'));
        });
        break;
    }
  });

  if (window.lucide) lucide.createIcons();
}

/**
 * Render a single goal card.
 */
function renderGoalCard(goal) {
  const g = goal;
  const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
  const remaining = (g.targetAmount || 0) - (g.currentAmount || 0);
  const color = g.color || 'var(--accent-primary)';
  const icon = g.icon || 'target';

  // Status calculation
  let statusText = 'On track';
  let statusColor = 'var(--accent-success)';
  if (g.deadline) {
    const deadlineDate = new Date(g.deadline);
    const now = new Date();
    const monthsLeft = Math.max(0, (deadlineDate.getFullYear() - now.getFullYear()) * 12 + deadlineDate.getMonth() - now.getMonth());
    if (monthsLeft > 0 && remaining > 0) {
      const neededPerMonth = remaining / monthsLeft;
      if (g.monthlyContribution && g.monthlyContribution < neededPerMonth) {
        statusText = 'Behind schedule';
        statusColor = 'var(--accent-warning)';
      }
    }
    if (now > deadlineDate && remaining > 0) {
      statusText = 'Overdue';
      statusColor = 'var(--accent-danger)';
    }
    if (remaining <= 0) {
      statusText = 'Completed! 🎉';
      statusColor = 'var(--accent-success)';
    }
  }

  const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
  const priorityColor = priorityColors[g.priority] || priorityColors.medium;

  return `
    <div class="card card--glass" style="padding:1.25rem;position:relative;overflow:hidden">
      <!-- Decorative accent -->
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${color}"></div>

      <!-- Top row: icon + name + priority -->
      <div class="flex items-center gap-sm" style="margin-bottom:1rem">
        <div style="width:40px;height:40px;border-radius:12px;background:${color}20;color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i data-lucide="${escapeHtml(icon)}" style="width:20px;height:20px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;color:var(--text-primary);font-size:1.05rem">${escapeHtml(g.name)}</div>
          <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.15rem">
            <span class="badge" style="background:${priorityColor}20;color:${priorityColor};font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:20px;font-weight:600">${(g.priority || 'medium').toUpperCase()}</span>
            <span style="font-size:0.75rem;color:${statusColor};font-weight:500">${statusText}</span>
          </div>
        </div>
      </div>

      <!-- Circular progress -->
      <div style="display:flex;justify-content:center;margin-bottom:1rem">
        <div style="position:relative;width:100px;height:100px">
          ${renderCircularProgress(pct, 100, color)}
        </div>
      </div>

      <!-- Amount details -->
      <div style="text-align:center;margin-bottom:1rem">
        <div style="font-size:1.2rem;font-weight:700;color:var(--text-primary)">
          ${formatCurrency(g.currentAmount || 0)}
          <span style="font-size:0.85rem;font-weight:400;color:var(--text-muted)"> / ${formatCurrency(g.targetAmount || 0)}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.25rem">
          ${remaining > 0 ? `${formatCurrency(remaining)} to go` : 'Goal reached!'}
        </div>
      </div>

      <!-- Meta info -->
      <div class="grid grid-2 gap-sm" style="font-size:0.8rem;margin-bottom:1rem;text-align:center">
        ${g.deadline ? `
          <div>
            <div style="color:var(--text-muted)">Deadline</div>
            <div style="font-weight:600;color:var(--text-secondary)">${formatDate(g.deadline)}</div>
          </div>
        ` : ''}
        ${g.monthlyContribution ? `
          <div>
            <div style="color:var(--text-muted)">Monthly</div>
            <div style="font-weight:600;color:var(--text-secondary)">${formatCurrency(g.monthlyContribution)}</div>
          </div>
        ` : ''}
      </div>

      <!-- Action buttons -->
      <div class="flex gap-sm" style="margin-top:auto">
        <button class="btn btn--primary btn--sm" style="flex:1" data-goal-action="contribute" data-goal-id="${g.id}">
          <i data-lucide="plus-circle" style="width:14px;height:14px"></i> Contribute
        </button>
        <button class="btn btn--ghost btn--sm btn--icon" data-goal-action="edit" data-goal-id="${g.id}" title="Edit">
          <i data-lucide="edit-3" style="width:14px;height:14px"></i>
        </button>
        <button class="btn btn--ghost btn--sm btn--icon" data-goal-action="delete" data-goal-id="${g.id}" title="Delete" style="color:var(--accent-danger)">
          <i data-lucide="trash-2" style="width:14px;height:14px"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Show the add/edit goal modal.
 */
function showGoalModal(goal = null, onSaved) {
  const isEdit = !!goal;
  const g = goal || {};

  const content = `
    <form id="goal-form" class="flex flex-col gap-md">
      <div class="form-group">
        <label class="form-label">Goal Name</label>
        <input type="text" name="name" class="form-input" value="${escapeHtml(g.name || '')}" placeholder="e.g. Emergency Fund" required>
      </div>
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">Target Amount</label>
          <input type="number" name="targetAmount" class="form-input" value="${g.targetAmount || ''}" placeholder="100000" min="1" step="100" required>
        </div>
        <div class="form-group">
          <label class="form-label">Current Amount</label>
          <input type="number" name="currentAmount" class="form-input" value="${g.currentAmount || 0}" placeholder="0" min="0" step="100">
        </div>
      </div>
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">Deadline</label>
          <input type="date" name="deadline" class="form-input" value="${g.deadline ? formatDateInput(g.deadline) : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Monthly Contribution</label>
          <input type="number" name="monthlyContribution" class="form-input" value="${g.monthlyContribution || ''}" placeholder="5000" min="0" step="100">
        </div>
      </div>
      <div class="grid grid-3 gap-md">
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select name="priority" class="form-select">
            <option value="low" ${g.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${g.priority === 'medium' || !g.priority ? 'selected' : ''}>Medium</option>
            <option value="high" ${g.priority === 'high' ? 'selected' : ''}>High</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Icon (Lucide)</label>
          <input type="text" name="icon" class="form-input" value="${escapeHtml(g.icon || 'target')}" placeholder="target">
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <input type="color" name="color" class="form-input" value="${g.color || '#6366f1'}" style="height:42px;padding:4px">
        </div>
      </div>
    </form>
  `;

  showModal({
    title: isEdit ? 'Edit Goal' : 'Add Goal',
    content,
    confirmText: isEdit ? 'Update' : 'Create Goal',
    onConfirm: () => {
      const form = document.getElementById('goal-form');
      if (!form) return;
      const fd = new FormData(form);
      const data = {
        name: fd.get('name') || 'Untitled Goal',
        targetAmount: parseFloat(fd.get('targetAmount')) || 0,
        currentAmount: parseFloat(fd.get('currentAmount')) || 0,
        deadline: fd.get('deadline') || '',
        monthlyContribution: parseFloat(fd.get('monthlyContribution')) || 0,
        priority: fd.get('priority') || 'medium',
        icon: fd.get('icon') || 'target',
        color: fd.get('color') || '#6366f1',
      };

      if (!data.name || !data.targetAmount) {
        showToast('Please fill in the goal name and target amount.', 'warning');
        return;
      }

      if (isEdit) {
        store.updateGoal(goal.id, data);
        showToast('Goal updated!', 'success');
      } else {
        store.addGoal(data);
        showToast('Goal created!', 'success');
      }
      if (onSaved) onSaved();
    },
  });
}

/**
 * Show a simple contribution modal.
 */
function showContributeModal(goal, onSaved) {
  const content = `
    <div class="flex flex-col gap-md">
      <p style="color:var(--text-secondary);margin:0">
        Add funds to <strong>${escapeHtml(goal.name)}</strong>
      </p>
      <p style="color:var(--text-muted);font-size:0.85rem;margin:0">
        Current: ${formatCurrency(goal.currentAmount || 0)} / ${formatCurrency(goal.targetAmount || 0)}
      </p>
      <div class="form-group" style="margin:0">
        <label class="form-label">Contribution Amount</label>
        <input type="number" id="contribute-amount" class="form-input"
               placeholder="Enter amount" min="1" step="100"
               ${goal.monthlyContribution ? `value="${goal.monthlyContribution}"` : ''}
               style="font-size:1.1rem;font-weight:600">
      </div>
    </div>
  `;

  showModal({
    title: 'Add Contribution',
    content,
    confirmText: 'Add Funds',
    onConfirm: () => {
      const amountEl = document.getElementById('contribute-amount');
      const amount = parseFloat(amountEl?.value);
      if (!amount || amount <= 0) {
        showToast('Please enter a valid amount.', 'warning');
        return;
      }
      const newAmount = (goal.currentAmount || 0) + amount;
      store.updateGoal(goal.id, { currentAmount: newAmount });
      showToast(`Added ${formatCurrency(amount)} to "${goal.name}"`, 'success');
      if (onSaved) onSaved();
    },
  });
}

function safeCall(fn) {
  try { return fn(); } catch { return undefined; }
}
