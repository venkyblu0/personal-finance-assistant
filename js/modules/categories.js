/**
 * @module CategoryManager
 * @description High-level API for managing expense/income categories.
 * Includes spending totals per category and default category presets.
 */

import { store } from '../store.js';
import { validateCategory } from '../utils/validators.js';
import { getCurrentMonth } from '../utils/formatters.js';

export const CategoryManager = {
  /**
   * Get all categories, optionally filtered by type.
   * @param {string} [type] - 'income' | 'expense'
   * @returns {Array<Object>}
   */
  getAll(type) {
    return store.getCategories(type);
  },

  /**
   * Get a single category by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getById(id) {
    return store.getCategory(id);
  },

  /**
   * Create a new category after validation.
   * @param {Object} data
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  create(data) {
    const { valid, errors } = validateCategory(data);
    if (!valid) return { success: false, errors };

    const cat = store.addCategory(data);
    return { success: true, data: cat };
  },

  /**
   * Update an existing category after validation.
   * @param {string} id
   * @param {Object} data
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  update(id, data) {
    const existing = store.getCategory(id);
    if (!existing) return { success: false, errors: ['Category not found'] };

    const merged = { ...existing, ...data };
    const { valid, errors } = validateCategory(merged);
    if (!valid) return { success: false, errors };

    const updated = store.updateCategory(id, data);
    return { success: true, data: updated };
  },

  /**
   * Delete a category. Returns a warning if transactions reference it.
   * @param {string} id
   * @returns {{ success: boolean, warning?: string }}
   */
  remove(id) {
    // Check if any transactions use this category
    const txns = store.getTransactions({ categoryId: id });
    let warning;
    if (txns.length > 0) {
      warning = `${txns.length} transaction(s) still reference this category. They will become uncategorised.`;
    }
    const deleted = store.deleteCategory(id);
    return { success: deleted, warning };
  },

  /**
   * Get categories enriched with their spending total for a given month.
   * @param {string} [month] - e.g. '2026-06'. Defaults to current month.
   * @returns {Array<Object>} Categories with a `spent` property.
   */
  getWithSpending(month) {
    const m = month || getCurrentMonth();
    const categories = store.getCategories('expense');
    const txns = store.getTransactions({ month: m, type: 'expense' });

    // Sum spending per category
    const spendMap = new Map();
    for (const t of txns) {
      spendMap.set(t.categoryId, (spendMap.get(t.categoryId) || 0) + t.amount);
    }

    return categories.map(cat => ({
      ...cat,
      spent: spendMap.get(cat.id) || 0
    }));
  },

  /**
   * Return the default category presets (useful for reset or reference).
   * @returns {Array<Object>}
   */
  getDefaultCategories() {
    return [
      { name: 'Food & Dining', type: 'expense', icon: 'utensils', color: '#f59e0b', budget: 15000, subcategories: ['Groceries', 'Restaurants', 'Delivery'] },
      { name: 'Transport', type: 'expense', icon: 'car', color: '#3b82f6', budget: 5000, subcategories: ['Fuel', 'Uber/Ola', 'Auto', 'Metro'] },
      { name: 'Shopping', type: 'expense', icon: 'shopping-bag', color: '#ec4899', budget: 10000, subcategories: ['Clothing', 'Electronics', 'Household'] },
      { name: 'Bills & Utilities', type: 'expense', icon: 'zap', color: '#8b5cf6', budget: 8000, subcategories: ['Electricity', 'Internet', 'Water', 'Gas', 'Phone'] },
      { name: 'Health', type: 'expense', icon: 'heart-pulse', color: '#10b981', budget: 5000, subcategories: ['Medicine', 'Doctor', 'Gym', 'Insurance'] },
      { name: 'Entertainment', type: 'expense', icon: 'film', color: '#f97316', budget: 5000, subcategories: ['Movies', 'Streaming', 'Games', 'Events'] },
      { name: 'Education', type: 'expense', icon: 'graduation-cap', color: '#06b6d4', budget: 3000, subcategories: ['Books', 'Courses', 'Stationery'] },
      { name: 'Rent', type: 'expense', icon: 'home', color: '#6366f1', budget: 25000, subcategories: [] },
      { name: 'Other Expense', type: 'expense', icon: 'circle', color: '#94a3b8', budget: 0, subcategories: [] },
      { name: 'Salary', type: 'income', icon: 'briefcase', color: '#10b981', budget: 0, subcategories: [] },
      { name: 'Freelance', type: 'income', icon: 'laptop', color: '#8b5cf6', budget: 0, subcategories: [] },
      { name: 'Investments', type: 'income', icon: 'trending-up', color: '#f59e0b', budget: 0, subcategories: [] },
      { name: 'Other Income', type: 'income', icon: 'plus-circle', color: '#3b82f6', budget: 0, subcategories: [] }
    ];
  }
};
