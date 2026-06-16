/**
 * @module DebtManager
 * @description Manages debts and loans with payoff projections, interest
 * calculations, and payment recording.
 */

import { store } from '../store.js';
import { validateDebt } from '../utils/validators.js';

export const DebtManager = {
  /**
   * Get all debts.
   * @returns {Array<Object>}
   */
  getAll() {
    return store.getDebts();
  },

  /**
   * Create a new debt after validation.
   * @param {Object} data
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  create(data) {
    const { valid, errors } = validateDebt(data);
    if (!valid) return { success: false, errors };

    const debt = store.addDebt(data);
    return { success: true, data: debt };
  },

  /**
   * Update an existing debt.
   * @param {string} id
   * @param {Object} data
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  update(id, data) {
    const existing = store.getDebts().find(d => d.id === id);
    if (!existing) return { success: false, errors: ['Debt not found'] };

    const merged = { ...existing, ...data };
    const { valid, errors } = validateDebt(merged);
    if (!valid) return { success: false, errors };

    const updated = store.updateDebt(id, data);
    return { success: true, data: updated };
  },

  /**
   * Delete a debt.
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    return store.deleteDebt(id);
  },

  /**
   * Get the total remaining debt across all debts.
   * @returns {number}
   */
  getTotalDebt() {
    const debts = store.getDebts();
    return debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
  },

  /**
   * Project payoff details for a specific debt using simple amortisation.
   * @param {string} debtId
   * @returns {{ totalPayable: number, totalInterest: number, payoffDate: string, monthsRemaining: number }}
   */
  getPayoffProjection(debtId) {
    const debt = store.getDebts().find(d => d.id === debtId);
    if (!debt) {
      return { totalPayable: 0, totalInterest: 0, payoffDate: '', monthsRemaining: 0 };
    }

    const { remainingAmount, interestRate, emiAmount } = debt;

    if (!emiAmount || emiAmount <= 0) {
      return { totalPayable: remainingAmount, totalInterest: 0, payoffDate: '', monthsRemaining: 0 };
    }

    const monthlyRate = (interestRate || 0) / 100 / 12;
    let balance = remainingAmount;
    let months = 0;
    let totalPaid = 0;
    const maxMonths = 600; // Safety cap: 50 years

    if (monthlyRate > 0) {
      // With interest: simulate month by month
      while (balance > 0 && months < maxMonths) {
        const interest = balance * monthlyRate;
        const principal = Math.min(emiAmount - interest, balance);

        if (principal <= 0) {
          // EMI doesn't cover interest — will never pay off
          break;
        }

        balance -= principal;
        totalPaid += emiAmount;
        months++;

        if (balance < 1) balance = 0; // Handle floating point
      }
    } else {
      // No interest: simple division
      months = Math.ceil(balance / emiAmount);
      totalPaid = months * emiAmount;
      balance = 0;
    }

    const totalInterest = totalPaid - (remainingAmount - balance);

    // Calculate payoff date
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);

    return {
      totalPayable: Math.round(totalPaid),
      totalInterest: Math.round(Math.max(0, totalInterest)),
      payoffDate: payoffDate.toISOString().split('T')[0],
      monthsRemaining: months
    };
  },

  /**
   * Get a comprehensive summary of all debts with projections.
   * @returns {{ totalDebt: number, totalEMI: number, totalInterest: number, debts: Array<Object> }}
   */
  getDebtSummary() {
    const debts = store.getDebts();
    let totalDebt = 0;
    let totalEMI = 0;
    let totalInterest = 0;

    const enriched = debts.map(debt => {
      const projection = this.getPayoffProjection(debt.id);
      totalDebt += debt.remainingAmount || 0;
      totalEMI += debt.emiAmount || 0;
      totalInterest += projection.totalInterest;

      return {
        ...debt,
        projection
      };
    });

    return {
      totalDebt,
      totalEMI,
      totalInterest,
      debts: enriched
    };
  },

  /**
   * Record a payment against a debt: reduce remaining amount and advance
   * the next payment date by one month.
   * @param {string} debtId
   * @param {number} amount - Payment amount.
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  recordPayment(debtId, amount) {
    if (!amount || Number(amount) <= 0) {
      return { success: false, errors: ['Payment amount must be positive'] };
    }

    const debt = store.getDebts().find(d => d.id === debtId);
    if (!debt) return { success: false, errors: ['Debt not found'] };

    const newRemaining = Math.max(0, (debt.remainingAmount || 0) - Number(amount));

    // Advance nextPaymentDate by one month
    let nextPaymentDate = debt.nextPaymentDate;
    if (nextPaymentDate) {
      const d = new Date(nextPaymentDate + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      nextPaymentDate = d.toISOString().split('T')[0];
    }

    const updated = store.updateDebt(debtId, {
      remainingAmount: newRemaining,
      nextPaymentDate
    });

    return { success: true, data: updated };
  }
};
