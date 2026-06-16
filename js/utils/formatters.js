/**
 * @module formatters
 * @description Formatting utilities for currency (INR with Indian grouping),
 * dates, percentages, and relative time strings.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Format a number using the Indian numbering system (lakhs, crores).
 * @param {number} num - The number to format.
 * @returns {string} Formatted number string (e.g., "1,25,000").
 */
function formatIndianNumber(num) {
  if (num === 0) return '0';

  const isNegative = num < 0;
  const absStr = Math.abs(num).toString();
  const parts = absStr.split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  // Indian grouping: last 3 digits, then groups of 2
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    const groups = [];
    while (remaining.length > 2) {
      groups.unshift(remaining.slice(-2));
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) {
      groups.unshift(remaining);
    }
    intPart = groups.join(',') + ',' + last3;
  }

  let result = intPart;
  if (decPart !== undefined) {
    result += '.' + decPart;
  }

  return isNegative ? '-' + result : result;
}

/**
 * Format amount as Indian currency.
 * @param {number} amount - The monetary amount.
 * @param {string} [symbol='₹'] - Currency symbol.
 * @returns {string} Formatted currency string (e.g., "₹1,25,000").
 */
export function formatCurrency(amount, symbol = '₹') {
  if (amount == null || isNaN(amount)) return `${symbol}0`;

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  // Round to 2 decimal places
  const rounded = Math.round(absAmount * 100) / 100;
  const hasDecimals = rounded % 1 !== 0;

  let formatted;
  if (hasDecimals) {
    const fixedStr = rounded.toFixed(2);
    const [intStr, decStr] = fixedStr.split('.');
    const intFormatted = formatIndianNumber(parseInt(intStr, 10));
    formatted = `${symbol}${intFormatted}.${decStr}`;
  } else {
    formatted = `${symbol}${formatIndianNumber(rounded)}`;
  }

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format a date string to "15 Jun 2026" format.
 * @param {string} dateStr - ISO date string (YYYY-MM-DD).
 * @returns {string} Formatted date.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format a date string to "15/06/26" short format.
 * @param {string} dateStr - ISO date string.
 * @returns {string} Short formatted date.
 */
export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

/**
 * Format a date string for use in input[type="date"] value.
 * @param {string|Date} dateStr - Date string or Date object.
 * @returns {string} Date in YYYY-MM-DD format.
 */
export function formatDateInput(dateStr) {
  if (!dateStr) return '';
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a month string to readable form.
 * @param {string} monthStr - Month string like '2026-06'.
 * @returns {string} Formatted month (e.g., "June 2026").
 */
export function formatMonth(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return monthStr || '';
  const [year, month] = monthStr.split('-');
  const monthIndex = parseInt(month, 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return monthStr;
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

/**
 * Get a month string (YYYY-MM) from a Date object.
 * @param {Date} [date=new Date()] - Date object.
 * @returns {string} Month string (e.g., "2026-06").
 */
export function getMonthString(date = new Date()) {
  const d = date instanceof Date ? date : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get the current month string.
 * @returns {string} Current month (e.g., "2026-06").
 */
export function getCurrentMonth() {
  return getMonthString(new Date());
}

/**
 * Format a decimal value as a percentage.
 * @param {number} value - The percentage value (e.g., 85.333).
 * @param {number} [decimals=0] - Decimal places.
 * @returns {string} Formatted percentage (e.g., "85%").
 */
export function formatPercentage(value, decimals = 0) {
  if (value == null || isNaN(value)) return '0%';
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Format a number using the Indian numbering system (without currency symbol).
 * @param {number} num - The number to format.
 * @returns {string} Formatted number.
 */
export function formatNumber(num) {
  if (num == null || isNaN(num)) return '0';
  return formatIndianNumber(num);
}

/**
 * Get a human-readable relative time string.
 * @param {string} dateStr - ISO date string.
 * @returns {string} Relative time (e.g., "2 hours ago", "yesterday").
 */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks === 1) return '1 week ago';
  if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
  if (diffMonths === 1) return '1 month ago';
  if (diffMonths < 12) return `${diffMonths} months ago`;
  return formatDate(dateStr);
}

/**
 * Get the full month name by index.
 * @param {number} monthIndex - 0-based month index.
 * @returns {string} Month name (e.g., "January").
 */
export function getMonthName(monthIndex) {
  return MONTH_NAMES[monthIndex] || '';
}

/**
 * Get the number of days in a given month.
 * @param {string} monthStr - Month string like '2026-06'.
 * @returns {number} Number of days in the month.
 */
export function getDaysInMonth(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return 30;
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

/**
 * Get the start and end dates for a given month.
 * @param {string} monthStr - Month string like '2026-06'.
 * @returns {{ start: string, end: string }} Date range in YYYY-MM-DD format.
 */
export function getDateRange(monthStr) {
  if (!monthStr || !monthStr.includes('-')) {
    return { start: '', end: '' };
  }
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthPadded = String(month).padStart(2, '0');
  return {
    start: `${year}-${monthPadded}-01`,
    end: `${year}-${monthPadded}-${String(daysInMonth).padStart(2, '0')}`
  };
}
