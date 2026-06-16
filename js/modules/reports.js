/**
 * @module ReportManager
 * @description Generates monthly reports, yearly summaries, spending trends,
 * category trends, and net-worth calculations.
 */

import { store } from '../store.js';
import { getCurrentMonth, getMonthString, formatMonth } from '../utils/formatters.js';

export const ReportManager = {
  /**
   * Generate a comprehensive monthly report with comparison to the previous month.
   * @param {string} month - e.g. '2026-06'
   * @returns {Object} Full monthly report.
   */
  getMonthlyReport(month) {
    const stats = store.getMonthlyStats(month);
    const txns = store.getTransactions({ month });
    const categories = store.getCategories();

    // Top 5 single expenses
    const topExpenses = txns
      .filter(t => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        return {
          ...t,
          categoryName: cat?.name || 'Unknown',
          categoryColor: cat?.color || '#94a3b8',
          categoryIcon: cat?.icon || 'circle'
        };
      });

    // Previous month comparison
    const [year, mon] = month.split('-').map(Number);
    const prevDate = new Date(year, mon - 2, 1); // mon-1 is current, mon-2 is previous
    const prevMonthStr = getMonthString(prevDate);
    const prevStats = store.getMonthlyStats(prevMonthStr);

    const comparison = {
      incomeDiff: {
        amount: stats.totalIncome - prevStats.totalIncome,
        percentage: prevStats.totalIncome > 0
          ? ((stats.totalIncome - prevStats.totalIncome) / prevStats.totalIncome) * 100
          : 0
      },
      expenseDiff: {
        amount: stats.totalExpenses - prevStats.totalExpenses,
        percentage: prevStats.totalExpenses > 0
          ? ((stats.totalExpenses - prevStats.totalExpenses) / prevStats.totalExpenses) * 100
          : 0
      },
      savingsDiff: {
        amount: stats.netSavings - prevStats.netSavings,
        percentage: prevStats.netSavings !== 0
          ? ((stats.netSavings - prevStats.netSavings) / Math.abs(prevStats.netSavings)) * 100
          : 0
      }
    };

    // Round percentages
    comparison.incomeDiff.percentage = Math.round(comparison.incomeDiff.percentage * 100) / 100;
    comparison.expenseDiff.percentage = Math.round(comparison.expenseDiff.percentage * 100) / 100;
    comparison.savingsDiff.percentage = Math.round(comparison.savingsDiff.percentage * 100) / 100;

    return {
      month,
      monthLabel: formatMonth(month),
      income: stats.totalIncome,
      expenses: stats.totalExpenses,
      savings: stats.netSavings,
      savingsRate: stats.savingsRate,
      byCategory: stats.byCategory,
      topExpenses,
      dailyAverage: stats.avgDailySpend,
      transactionCount: stats.transactionCount,
      comparison
    };
  },

  /**
   * Generate monthly totals for every month in a given year.
   * @param {string|number} year - e.g. '2026' or 2026
   * @returns {Array<{month: string, monthLabel: string, income: number, expenses: number, savings: number}>}
   */
  getYearlyReport(year) {
    const yearStr = String(year);
    const months = [];

    for (let m = 1; m <= 12; m++) {
      const monthStr = `${yearStr}-${String(m).padStart(2, '0')}`;
      const stats = store.getMonthlyStats(monthStr);

      months.push({
        month: monthStr,
        monthLabel: formatMonth(monthStr),
        income: stats.totalIncome,
        expenses: stats.totalExpenses,
        savings: stats.netSavings
      });
    }

    return months;
  },

  /**
   * Get income, expense, and savings trend for the last N months.
   * @param {number} [months=6] - Number of months to look back.
   * @returns {Array<{month: string, monthLabel: string, income: number, expenses: number, savings: number}>}
   */
  getSpendingTrend(months = 6) {
    const trend = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = getMonthString(d);
      const stats = store.getMonthlyStats(monthStr);

      trend.push({
        month: monthStr,
        monthLabel: formatMonth(monthStr),
        income: stats.totalIncome,
        expenses: stats.totalExpenses,
        savings: stats.netSavings
      });
    }

    return trend;
  },

  /**
   * Get spending trend for a specific category over the last N months.
   * @param {string} categoryId
   * @param {number} [months=6]
   * @returns {Array<{month: string, monthLabel: string, amount: number}>}
   */
  getCategoryTrend(categoryId, months = 6) {
    const trend = [];
    const now = new Date();
    const category = store.getCategory(categoryId);

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = getMonthString(d);
      const txns = store.getTransactions({ month: monthStr, categoryId });

      const amount = txns.reduce((sum, t) => sum + t.amount, 0);

      trend.push({
        month: monthStr,
        monthLabel: formatMonth(monthStr),
        amount,
        categoryName: category?.name || 'Unknown',
        categoryColor: category?.color || '#94a3b8'
      });
    }

    return trend;
  },

  /**
   * Calculate net worth: sum of all account balances minus total debt.
   * @returns {number} Net worth.
   */
  getNetWorth() {
    const accounts = store.getAccounts();
    const debts = store.getDebts();

    const totalAssets = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalDebts = debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);

    return totalAssets - totalDebts;
  }
};
