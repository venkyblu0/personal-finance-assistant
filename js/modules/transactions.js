/**
 * @module TransactionManager
 * @description High-level API for creating, querying, and analysing transactions.
 * Delegates persistence to the store and adds validation, search, and aggregation.
 */

import { store } from '../store.js';
import { validateTransaction } from '../utils/validators.js';
import { getCurrentMonth, getDateRange, getDaysInMonth } from '../utils/formatters.js';

/**
 * @typedef {Object} TransactionResult
 * @property {boolean} success
 * @property {Object} [data] - The transaction, if successful.
 * @property {string[]} [errors] - Validation errors, if any.
 */

export const TransactionManager = {
  /**
   * Get all transactions, optionally filtered.
   * @param {Object} [filters] - See store.getTransactions for filter options.
   * @returns {Array<Object>}
   */
  getAll(filters) {
    return store.getTransactions(filters);
  },

  /**
   * Get a single transaction by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getById(id) {
    return store.getTransaction(id);
  },

  /**
   * Create a new transaction after validation.
   * @param {Object} data - Transaction data.
   * @returns {TransactionResult}
   */
  create(data) {
    const { valid, errors } = validateTransaction(data);
    if (!valid) {
      return { success: false, errors };
    }
    const txn = store.addTransaction(data);
    return { success: true, data: txn };
  },

  /**
   * Update an existing transaction after validation.
   * @param {string} id
   * @param {Object} data - Fields to update.
   * @returns {TransactionResult}
   */
  update(id, data) {
    const existing = store.getTransaction(id);
    if (!existing) {
      return { success: false, errors: ['Transaction not found'] };
    }
    // Merge for validation
    const merged = { ...existing, ...data };
    const { valid, errors } = validateTransaction(merged);
    if (!valid) {
      return { success: false, errors };
    }
    const updated = store.updateTransaction(id, data);
    return { success: true, data: updated };
  },

  /**
   * Delete a transaction by ID.
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    return store.deleteTransaction(id);
  },

  /**
   * Bulk delete transactions.
   * @param {string[]} ids
   * @returns {number} Count of deleted transactions.
   */
  bulkDelete(ids) {
    return store.deleteTransactions(ids);
  },

  /**
   * Search transactions by keyword across description, category name, notes, and tags.
   * @param {string} query - Search keyword.
   * @param {Array<Object>} [transactions] - Transactions to search in (defaults to all).
   * @returns {Array<Object>}
   */
  search(query, transactions) {
    if (!query || typeof query !== 'string') return transactions || store.getTransactions();

    const txns = transactions || store.getTransactions();
    const q = query.toLowerCase();
    const categories = store.getCategories();

    return txns.filter(t => {
      if ((t.description || '').toLowerCase().includes(q)) return true;
      if ((t.notes || '').toLowerCase().includes(q)) return true;
      if ((t.subcategory || '').toLowerCase().includes(q)) return true;
      if ((t.tags || []).some(tag => tag.toLowerCase().includes(q))) return true;
      // Also search by category name
      const cat = categories.find(c => c.id === t.categoryId);
      if (cat && cat.name.toLowerCase().includes(q)) return true;
      return false;
    });
  },

  /**
   * Get transactions within a date range.
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Array<Object>}
   */
  getByDateRange(startDate, endDate) {
    return store.getTransactions({ startDate, endDate });
  },

  /**
   * Get transactions for a specific category, optionally within a month.
   * @param {string} categoryId
   * @param {string} [month] - e.g. '2026-06'
   * @returns {Array<Object>}
   */
  getByCategory(categoryId, month) {
    const filters = { categoryId };
    if (month) filters.month = month;
    return store.getTransactions(filters);
  },

  /**
   * Get the most recent transactions.
   * @param {number} [limit=10]
   * @returns {Array<Object>}
   */
  getRecentTransactions(limit = 10) {
    const all = store.getTransactions();
    return all.slice(0, limit);
  },

  /**
   * Get daily income/expense totals for a month.
   * @param {string} month - e.g. '2026-06'
   * @returns {Array<{date: string, income: number, expense: number}>}
   */
  getDailyTotals(month) {
    const txns = store.getTransactions({ month });
    const days = getDaysInMonth(month);
    const [year, mon] = month.split('-');
    const dailyMap = new Map();

    // Initialise every day in the month
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${mon}-${String(d).padStart(2, '0')}`;
      dailyMap.set(dateStr, { date: dateStr, income: 0, expense: 0 });
    }

    for (const t of txns) {
      const day = dailyMap.get(t.date);
      if (day) {
        if (t.type === 'income') day.income += t.amount;
        else if (t.type === 'expense') day.expense += t.amount;
      }
    }

    return Array.from(dailyMap.values());
  },

  /**
   * Get spending totals grouped by category for a month.
   * @param {string} month - e.g. '2026-06'
   * @returns {Array<{categoryId: string, categoryName: string, total: number, color: string, icon: string}>}
   */
  getCategoryTotals(month) {
    const txns = store.getTransactions({ month, type: 'expense' });
    const categories = store.getCategories();
    const totals = new Map();

    for (const t of txns) {
      const current = totals.get(t.categoryId) || 0;
      totals.set(t.categoryId, current + t.amount);
    }

    const result = [];
    for (const [catId, total] of totals) {
      const cat = categories.find(c => c.id === catId);
      result.push({
        categoryId: catId,
        categoryName: cat?.name || 'Unknown',
        total,
        color: cat?.color || '#94a3b8',
        icon: cat?.icon || 'circle'
      });
    }

    return result.sort((a, b) => b.total - a.total);
  }
};
