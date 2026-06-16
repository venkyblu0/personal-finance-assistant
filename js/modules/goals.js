/**
 * @module GoalManager
 * @description Manages financial goals with progress tracking, contribution
 * recording, and on-track projection calculations.
 */

import { store } from '../store.js';
import { validateGoal } from '../utils/validators.js';

export const GoalManager = {
  /**
   * Get all goals.
   * @returns {Array<Object>}
   */
  getAll() {
    return store.getGoals();
  },

  /**
   * Create a new goal after validation.
   * @param {Object} data
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  create(data) {
    const { valid, errors } = validateGoal(data);
    if (!valid) return { success: false, errors };

    const goal = store.addGoal(data);
    return { success: true, data: goal };
  },

  /**
   * Update an existing goal.
   * @param {string} id
   * @param {Object} data
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  update(id, data) {
    const existing = store.getGoals().find(g => g.id === id);
    if (!existing) return { success: false, errors: ['Goal not found'] };

    const merged = { ...existing, ...data };
    const { valid, errors } = validateGoal(merged);
    if (!valid) return { success: false, errors };

    const updated = store.updateGoal(id, data);
    return { success: true, data: updated };
  },

  /**
   * Delete a goal.
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    return store.deleteGoal(id);
  },

  /**
   * Calculate progress details for a single goal.
   * @param {string} goalId
   * @returns {{ percentage: number, amountRemaining: number, monthsRemaining: number, onTrack: boolean, projectedDate: string|null }}
   */
  getProgress(goalId) {
    const goal = store.getGoals().find(g => g.id === goalId);
    if (!goal) {
      return { percentage: 0, amountRemaining: 0, monthsRemaining: 0, onTrack: false, projectedDate: null };
    }

    const { targetAmount, currentAmount, deadline, monthlyContribution } = goal;
    const amountRemaining = Math.max(0, targetAmount - currentAmount);
    const percentage = targetAmount > 0
      ? Math.min((currentAmount / targetAmount) * 100, 100)
      : 0;

    // Calculate months remaining until deadline
    let monthsRemaining = 0;
    if (deadline) {
      const now = new Date();
      const deadlineDate = new Date(deadline + 'T00:00:00');
      monthsRemaining = Math.max(0,
        (deadlineDate.getFullYear() - now.getFullYear()) * 12 +
        (deadlineDate.getMonth() - now.getMonth())
      );
    }

    // Calculate projected completion date based on monthly contribution
    let projectedDate = null;
    let onTrack = false;

    if (monthlyContribution > 0 && amountRemaining > 0) {
      const monthsNeeded = Math.ceil(amountRemaining / monthlyContribution);
      const projected = new Date();
      projected.setMonth(projected.getMonth() + monthsNeeded);
      projectedDate = projected.toISOString().split('T')[0];

      // On track if projected date is before or on deadline
      if (deadline) {
        onTrack = projectedDate <= deadline;
      } else {
        onTrack = true; // No deadline = always on track
      }
    } else if (amountRemaining <= 0) {
      onTrack = true; // Goal already met
      projectedDate = new Date().toISOString().split('T')[0];
    }

    return {
      percentage: Math.round(percentage * 100) / 100,
      amountRemaining,
      monthsRemaining,
      onTrack,
      projectedDate
    };
  },

  /**
   * Add a contribution to a goal (increase currentAmount).
   * @param {string} goalId
   * @param {number} amount - Contribution amount.
   * @returns {{ success: boolean, data?: Object, errors?: string[] }}
   */
  addContribution(goalId, amount) {
    if (!amount || Number(amount) <= 0) {
      return { success: false, errors: ['Contribution amount must be positive'] };
    }

    const goal = store.getGoals().find(g => g.id === goalId);
    if (!goal) return { success: false, errors: ['Goal not found'] };

    const newAmount = (goal.currentAmount || 0) + Number(amount);
    const updated = store.updateGoal(goalId, { currentAmount: newAmount });
    return { success: true, data: updated };
  },

  /**
   * Get all goals enriched with their progress data.
   * @returns {Array<Object>} Goals with additional progress fields.
   */
  getAllWithProgress() {
    const goals = store.getGoals();
    return goals.map(goal => ({
      ...goal,
      progress: this.getProgress(goal.id)
    }));
  }
};
