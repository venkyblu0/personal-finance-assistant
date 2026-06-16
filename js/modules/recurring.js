/**
 * @module RecurringManager
 * @description Manages recurring transactions: CRUD, toggle active state,
 * process overdue recurrences, and calculate upcoming/monthly cost totals.
 */

import { store } from '../store.js';

export const RecurringManager = {
  /**
   * Get all recurring transactions.
   * @returns {Array<Object>}
   */
  getAll() {
    return store.getRecurringTransactions();
  },

  /**
   * Create a new recurring transaction.
   * @param {Object} data
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  create(data) {
    const errors = [];
    if (!data.description) errors.push('Description is required');
    if (!data.amount || Number(data.amount) <= 0) errors.push('Amount must be positive');
    if (!data.frequency) errors.push('Frequency is required');

    if (errors.length > 0) return { success: false, errors };

    const rec = store.addRecurringTransaction(data);
    return { success: true, data: rec };
  },

  /**
   * Update an existing recurring transaction.
   * @param {string} id
   * @param {Object} data
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  update(id, data) {
    const existing = store.getRecurringTransactions().find(r => r.id === id);
    if (!existing) return { success: false, errors: ['Recurring transaction not found'] };

    const updated = store.updateRecurringTransaction(id, data);
    return { success: true, data: updated };
  },

  /**
   * Delete a recurring transaction.
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    return store.deleteRecurringTransaction(id);
  },

  /**
   * Toggle the isActive state of a recurring transaction.
   * @param {string} id
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  toggle(id) {
    const rec = store.getRecurringTransactions().find(r => r.id === id);
    if (!rec) return { success: false, errors: ['Recurring transaction not found'] };

    const updated = store.updateRecurringTransaction(id, { isActive: !rec.isActive });
    return { success: true, data: updated };
  },

  /**
   * Process all active recurring transactions that are overdue.
   * Creates actual transactions and advances their nextDueDate.
   * @returns {Array<Object>} Newly created transactions.
   */
  processAll() {
    return store.processRecurringTransactions();
  },

  /**
   * Get the next N upcoming recurring transactions sorted by nextDueDate.
   * @param {number} [limit=5]
   * @returns {Array<Object>}
   */
  getUpcoming(limit = 5) {
    const all = store.getRecurringTransactions()
      .filter(r => r.isActive && r.nextDueDate)
      .sort((a, b) => (a.nextDueDate || '').localeCompare(b.nextDueDate || ''));

    return all.slice(0, limit);
  },

  /**
   * Calculate the total monthly cost of all active recurring expenses.
   * Normalises weekly/daily/yearly frequencies to a monthly equivalent.
   * @returns {number} Monthly cost.
   */
  getMonthlyRecurringCost() {
    const active = store.getRecurringTransactions()
      .filter(r => r.isActive && r.type === 'expense');

    let total = 0;
    for (const rec of active) {
      switch (rec.frequency) {
        case 'daily':
          total += rec.amount * 30;
          break;
        case 'weekly':
          total += rec.amount * 4.33; // avg weeks per month
          break;
        case 'monthly':
          total += rec.amount;
          break;
        case 'yearly':
          total += rec.amount / 12;
          break;
        default:
          total += rec.amount;
      }
    }

    return Math.round(total);
  }
};
