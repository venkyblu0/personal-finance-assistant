/**
 * @module validators
 * @description Validation utilities for transactions, categories, budgets,
 * goals, debts, settings, and primitive value checks.
 */

/**
 * Check if a value is a positive number.
 * @param {*} val - Value to check.
 * @returns {boolean}
 */
export function isPositiveNumber(val) {
  if (val == null) return false;
  const num = Number(val);
  return !isNaN(num) && isFinite(num) && num > 0;
}

/**
 * Check if a string is a valid date (YYYY-MM-DD or parseable).
 * @param {string} dateStr - Date string to validate.
 * @returns {boolean}
 */
export function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  // Check YYYY-MM-DD format
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (isoMatch) {
    const d = new Date(dateStr + 'T00:00:00');
    return !isNaN(d.getTime());
  }
  // Fallback: try parsing
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * Check if a string is valid JSON.
 * @param {string} str - String to check.
 * @returns {boolean}
 */
export function isValidJSON(str) {
  if (typeof str !== 'string') return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate transaction data.
 * @param {Object} data - Transaction data to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTransaction(data) {
  const errors = [];

  if (!data) {
    return { valid: false, errors: ['Transaction data is required'] };
  }

  if (!data.date) {
    errors.push('Date is required');
  } else if (!isValidDate(data.date)) {
    errors.push('Invalid date format');
  }

  if (data.amount == null || data.amount === '') {
    errors.push('Amount is required');
  } else if (isNaN(Number(data.amount))) {
    errors.push('Amount must be a valid number');
  } else if (Number(data.amount) <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!data.type) {
    errors.push('Transaction type is required');
  } else if (!['income', 'expense', 'transfer'].includes(data.type)) {
    errors.push('Transaction type must be "income", "expense", or "transfer"');
  }

  if (!data.categoryId) {
    errors.push('Category is required');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate category data.
 * @param {Object} data - Category data to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCategory(data) {
  const errors = [];

  if (!data) {
    return { valid: false, errors: ['Category data is required'] };
  }

  if (!data.name || (typeof data.name === 'string' && data.name.trim() === '')) {
    errors.push('Category name is required');
  }

  if (!data.type) {
    errors.push('Category type is required');
  } else if (!['income', 'expense'].includes(data.type)) {
    errors.push('Category type must be "income" or "expense"');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate budget data.
 * @param {Object} data - Budget data to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBudget(data) {
  const errors = [];

  if (!data) {
    return { valid: false, errors: ['Budget data is required'] };
  }

  if (data.totalBudget == null) {
    errors.push('Total budget is required');
  } else if (!isPositiveNumber(data.totalBudget)) {
    errors.push('Total budget must be a positive number');
  }

  if (data.categoryBudgets && typeof data.categoryBudgets === 'object') {
    for (const [catId, amount] of Object.entries(data.categoryBudgets)) {
      if (amount != null && Number(amount) < 0) {
        errors.push(`Budget for category ${catId} cannot be negative`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate goal data.
 * @param {Object} data - Goal data to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateGoal(data) {
  const errors = [];

  if (!data) {
    return { valid: false, errors: ['Goal data is required'] };
  }

  if (!data.name || (typeof data.name === 'string' && data.name.trim() === '')) {
    errors.push('Goal name is required');
  }

  if (data.targetAmount == null) {
    errors.push('Target amount is required');
  } else if (!isPositiveNumber(data.targetAmount)) {
    errors.push('Target amount must be a positive number');
  }

  if (data.deadline && !isValidDate(data.deadline)) {
    errors.push('Invalid deadline date');
  }

  if (data.currentAmount != null && Number(data.currentAmount) < 0) {
    errors.push('Current amount cannot be negative');
  }

  if (data.monthlyContribution != null && Number(data.monthlyContribution) < 0) {
    errors.push('Monthly contribution cannot be negative');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate debt data.
 * @param {Object} data - Debt data to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDebt(data) {
  const errors = [];

  if (!data) {
    return { valid: false, errors: ['Debt data is required'] };
  }

  if (!data.name || (typeof data.name === 'string' && data.name.trim() === '')) {
    errors.push('Debt name is required');
  }

  if (data.remainingAmount == null) {
    errors.push('Remaining amount is required');
  } else if (Number(data.remainingAmount) < 0) {
    errors.push('Remaining amount cannot be negative');
  }

  if (data.interestRate == null) {
    errors.push('Interest rate is required');
  } else if (Number(data.interestRate) < 0) {
    errors.push('Interest rate cannot be negative');
  }

  if (data.emiAmount == null) {
    errors.push('EMI amount is required');
  } else if (!isPositiveNumber(data.emiAmount)) {
    errors.push('EMI amount must be a positive number');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate settings data.
 * @param {Object} data - Settings data to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSettings(data) {
  const errors = [];

  if (!data) {
    return { valid: false, errors: ['Settings data is required'] };
  }

  if (data.theme && !['light', 'dark', 'system'].includes(data.theme)) {
    errors.push('Invalid theme. Must be "light", "dark", or "system"');
  }

  if (data.monthStartDay != null) {
    const day = Number(data.monthStartDay);
    if (isNaN(day) || day < 1 || day > 28) {
      errors.push('Month start day must be between 1 and 28');
    }
  }

  if (data.currency && typeof data.currency !== 'string') {
    errors.push('Currency must be a string');
  }

  return { valid: errors.length === 0, errors };
}
