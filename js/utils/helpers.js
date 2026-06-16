/**
 * @module helpers
 * @description General-purpose utility functions: debounce, throttle, deep clone,
 * collection operations, HTML escaping, file I/O, CSV parsing, and animations.
 */

/**
 * Create a debounced version of a function.
 * @param {Function} fn - Function to debounce.
 * @param {number} [ms=300] - Delay in milliseconds.
 * @returns {Function} Debounced function with .cancel() method.
 */
export function debounce(fn, ms = 300) {
  let timeoutId;
  const debounced = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(null, args), ms);
  };
  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
}

/**
 * Create a throttled version of a function.
 * @param {Function} fn - Function to throttle.
 * @param {number} [ms=300] - Minimum interval in milliseconds.
 * @returns {Function} Throttled function.
 */
export function throttle(fn, ms = 300) {
  let lastCall = 0;
  let timeoutId = null;
  return (...args) => {
    const now = Date.now();
    const remaining = ms - (now - lastCall);

    if (remaining <= 0) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastCall = now;
      fn.apply(null, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(null, args);
      }, remaining);
    }
  };
}

/**
 * Deep clone an object.
 * @param {*} obj - Object to clone.
 * @returns {*} Deep clone of the object.
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  try {
    return structuredClone(obj);
  } catch {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  }
}

/**
 * Group an array of objects by a key.
 * @param {Array<Object>} array - Array to group.
 * @param {string} key - Key to group by.
 * @returns {Object} Object with keys as group values and arrays as values.
 */
export function groupBy(array, key) {
  if (!Array.isArray(array)) return {};
  return array.reduce((groups, item) => {
    const value = item?.[key] ?? 'undefined';
    if (!groups[value]) groups[value] = [];
    groups[value].push(item);
    return groups;
  }, {});
}

/**
 * Sort an array of objects by a key.
 * @param {Array<Object>} array - Array to sort.
 * @param {string} key - Key to sort by.
 * @param {string} [order='desc'] - Sort order: 'asc' or 'desc'.
 * @returns {Array<Object>} New sorted array.
 */
export function sortBy(array, key, order = 'desc') {
  if (!Array.isArray(array)) return [];
  return [...array].sort((a, b) => {
    const aVal = a?.[key] ?? '';
    const bVal = b?.[key] ?? '';

    let comparison;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return order === 'asc' ? comparison : -comparison;
  });
}

/**
 * Sum a specific numeric property across an array of objects.
 * @param {Array<Object>} array - Array of objects.
 * @param {string} key - Key whose values to sum.
 * @returns {number} Total sum.
 */
export function sumBy(array, key) {
  if (!Array.isArray(array)) return 0;
  return array.reduce((sum, item) => {
    const val = Number(item?.[key] ?? 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

/**
 * Deduplicate an array by a key.
 * @param {Array<Object>} array - Array to deduplicate.
 * @param {string} key - Key to check uniqueness by.
 * @returns {Array<Object>} Deduplicated array (first occurrence kept).
 */
export function uniqueBy(array, key) {
  if (!Array.isArray(array)) return [];
  const seen = new Set();
  return array.filter(item => {
    const val = item?.[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str - String to escape.
 * @returns {string} Escaped string.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return str.replace(/[&<>"']/g, char => escapeMap[char]);
}

/**
 * Truncate a string to a maximum length.
 * @param {string} str - String to truncate.
 * @param {number} [maxLen=50] - Maximum length.
 * @returns {string} Truncated string with '...' if needed.
 */
export function truncate(str, maxLen = 50) {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Trigger a browser download of a JSON file.
 * @param {*} data - Data to serialize as JSON.
 * @param {string} filename - Download filename.
 */
export function downloadJSON(data, filename) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'data.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read a file as text using FileReader.
 * @param {File} file - File to read.
 * @returns {Promise<string>} File text content.
 */
export function readFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Parse CSV text into an array of arrays, handling quoted fields.
 * @param {string} csvText - Raw CSV text.
 * @param {string} [delimiter=','] - Column delimiter.
 * @returns {Array<Array<string>>} Parsed rows and columns.
 */
export function parseCSV(csvText, delimiter = ',') {
  if (!csvText || typeof csvText !== 'string') return [];

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else if (char === '\r') {
        // Skip carriage return (handle \r\n)
        continue;
      } else {
        currentField += char;
      }
    }
  }

  // Handle last field/row
  currentRow.push(currentField.trim());
  if (currentRow.some(field => field !== '')) {
    rows.push(currentRow);
  }

  return rows;
}

/** @type {string[]} Curated palette of pleasant, distinct colors */
const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
  '#a855f7', '#d946ef', '#f43f5e', '#fb923c', '#facc15',
  '#4ade80', '#2dd4bf', '#22d3ee', '#60a5fa', '#818cf8'
];

/**
 * Get a random color from a curated palette.
 * @returns {string} Hex color string.
 */
export function getRandomColor() {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}

/**
 * Animate an element with a CSS class, automatically removing it after the duration.
 * @param {HTMLElement} element - Element to animate.
 * @param {string} animation - CSS class name to add.
 * @param {number} [duration=300] - Duration in ms before removing the class.
 * @returns {Promise<void>} Resolves when the animation completes.
 */
export function animate(element, animation, duration = 300) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }
    element.classList.add(animation);
    setTimeout(() => {
      element.classList.remove(animation);
      resolve();
    }, duration);
  });
}
