/**
 * @module BudgetManager
 * @description Manages monthly budgets with per-category tracking, progress
 * calculation, and spending-pattern-based suggestions.
 */

import { store } from '../store.js';
import { validateBudget } from '../utils/validators.js';
import { getCurrentMonth, getMonthString } from '../utils/formatters.js';

export const BudgetManager = {
  /**
   * Get the budget for a specific month.
   * @param {string} month - e.g. '2026-06'
   * @returns {Object|null}
   */
  getBudget(month) {
    return store.getBudget(month);
  },

  /**
   * Set (create or update) a budget for a month.
   * @param {string} month
   * @param {number} totalBudget
   * @param {Object} categoryBudgets - { categoryId: amount }
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  setBudget(month, totalBudget, categoryBudgets = {}) {
    const { valid, errors } = validateBudget({ totalBudget, categoryBudgets });
    if (!valid) return { success: false, errors };

    const budget = store.setBudget(month, totalBudget, categoryBudgets);
    return { success: true, data: budget };
  },

  /**
   * Get per-category budget progress for a month.
   * @param {string} month - e.g. '2026-06'
   * @returns {Array<{categoryId: string, categoryName: string, budgeted: number, spent: number, remaining: number, percentage: number, color: string, icon: string, status: string}>}
   */
  getBudgetProgress(month) {
    const budget = store.getBudget(month);
    if (!budget) return [];

    const categories = store.getCategories('expense');
    const txns = store.getTransactions({ month, type: 'expense' });

    // Sum spending per category
    const spendMap = new Map();
    for (const t of txns) {
      spendMap.set(t.categoryId, (spendMap.get(t.categoryId) || 0) + t.amount);
    }

    const progress = [];
    for (const [catId, budgeted] of Object.entries(budget.categoryBudgets)) {
      const cat = categories.find(c => c.id === catId);
      const spent = spendMap.get(catId) || 0;
      const remaining = budgeted - spent;
      const percentage = budgeted > 0 ? Math.min((spent / budgeted) * 100, 999) : 0;

      let status = 'on-track';
      if (percentage >= 100) status = 'over-budget';
      else if (percentage >= 80) status = 'warning';

      progress.push({
        categoryId: catId,
        categoryName: cat?.name || 'Unknown',
        budgeted,
        spent,
        remaining,
        percentage: Math.round(percentage * 100) / 100,
        color: cat?.color || '#94a3b8',
        icon: cat?.icon || 'circle',
        status
      });
    }

    return progress.sort((a, b) => b.percentage - a.percentage);
  },

  /**
   * Get overall budget progress for a month.
   * @param {string} month
   * @returns {{ totalBudget: number, totalSpent: number, remaining: number, percentage: number }}
   */
  getOverallProgress(month) {
    const budget = store.getBudget(month);
    const stats = store.getMonthlyStats(month);

    const totalBudget = budget?.totalBudget || 0;
    const totalSpent = stats.totalExpenses;
    const remaining = totalBudget - totalSpent;
    const percentage = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 999) : 0;

    return {
      totalBudget,
      totalSpent,
      remaining,
      percentage: Math.round(percentage * 100) / 100
    };
  },

  /**
   * Suggest budget amounts based on the average spending over the past 3 months.
   * @param {string} [month] - Target month (defaults to current).
   * @returns {{ totalBudget: number, categoryBudgets: Object }}
   */
  getSuggestions(month) {
    const targetMonth = month || getCurrentMonth();
    const categories = store.getCategories('expense');
    const monthsToAnalyse = 3;
    const pastMonths = [];

    // Calculate past N months
    const [year, mon] = targetMonth.split('-').map(Number);
    for (let i = 1; i <= monthsToAnalyse; i++) {
      const d = new Date(year, mon - 1 - i, 1);
      pastMonths.push(getMonthString(d));
    }

    // Accumulate spending per category
    const catTotals = new Map();
    let monthsWithData = 0;

    for (const pm of pastMonths) {
      const txns = store.getTransactions({ month: pm, type: 'expense' });
      if (txns.length === 0) continue;
      monthsWithData++;

      for (const t of txns) {
        catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + t.amount);
      }
    }

    const divisor = Math.max(monthsWithData, 1);

    // Build category budgets (average + 10% buffer, rounded to nearest 500)
    const categoryBudgets = {};
    let totalBudget = 0;

    for (const cat of categories) {
      const avg = (catTotals.get(cat.id) || 0) / divisor;
      const suggested = Math.ceil((avg * 1.1) / 500) * 500; // 10% buffer, round up to 500
      if (suggested > 0) {
        categoryBudgets[cat.id] = suggested;
        totalBudget += suggested;
      }
    }

    // Round total to nearest 1000
    totalBudget = Math.ceil(totalBudget / 1000) * 1000;

    return { totalBudget, categoryBudgets };
  }
};
