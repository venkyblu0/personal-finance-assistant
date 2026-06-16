/**
 * @module CSVImporter
 * @description Parses CSV files, auto-detects column mappings, detects
 * duplicates against existing transactions, and processes rows into
 * transaction objects ready for import.
 */

import { store } from '../store.js';
import { readFile, parseCSV } from '../utils/helpers.js';

/** Common header synonyms for auto-detection */
const HEADER_PATTERNS = {
  date: ['date', 'transaction date', 'txn date', 'trans date', 'value date', 'posting date', 'txndate'],
  amount: ['amount', 'debit', 'credit', 'value', 'txn amount', 'transaction amount', 'sum', 'withdrawal', 'deposit'],
  description: ['description', 'narration', 'particulars', 'details', 'remarks', 'memo', 'note', 'transaction details', 'payee'],
  type: ['type', 'transaction type', 'txn type', 'dr/cr', 'debit/credit', 'cr/dr']
};

export const CSVImporter = {
  /**
   * Read and parse a CSV file, returning headers and a preview.
   * @param {File} file - The CSV file to parse.
   * @returns {Promise<{headers: string[], rows: string[][], preview: string[][]}>}
   */
  async parseFile(file) {
    const text = await readFile(file);
    const allRows = parseCSV(text);

    if (allRows.length === 0) {
      return { headers: [], rows: [], preview: [] };
    }

    const headers = allRows[0];
    const dataRows = allRows.slice(1).filter(row => row.some(cell => cell !== ''));

    return {
      headers,
      rows: dataRows,
      preview: dataRows.slice(0, 10)
    };
  },

  /**
   * Store a column mapping for later use with processImport.
   * Returns the mapping object (passthrough).
   * @param {{ date: number, amount: number, description: number, type?: number }} mapping
   * @returns {{ date: number, amount: number, description: number, type?: number }}
   */
  mapColumns(mapping) {
    return { ...mapping };
  },

  /**
   * Convert CSV rows into transaction objects using a column mapping.
   * @param {string[][]} rows - Data rows (excluding header).
   * @param {{ date: number, amount: number, description: number, type?: number }} mapping
   * @param {string} defaultAccountId - Fallback account ID.
   * @param {string} defaultCategoryId - Fallback category ID.
   * @returns {{ transactions: Object[], duplicates: Object[], errors: Array<{row: number, message: string}> }}
   */
  processImport(rows, mapping, defaultAccountId, defaultCategoryId) {
    const transactions = [];
    const errors = [];
    const existingTxns = store.getTransactions();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +1 for header, +1 for 1-based

      try {
        // Extract fields
        const rawDate = row[mapping.date] || '';
        const rawAmount = row[mapping.amount] || '';
        const rawDescription = row[mapping.description] || '';
        const rawType = mapping.type != null ? (row[mapping.type] || '') : '';

        // Parse date
        const date = this._parseDate(rawDate);
        if (!date) {
          errors.push({ row: rowNum, message: `Invalid date: "${rawDate}"` });
          continue;
        }

        // Parse amount
        const amount = this._parseAmount(rawAmount);
        if (amount === null || amount === 0) {
          errors.push({ row: rowNum, message: `Invalid amount: "${rawAmount}"` });
          continue;
        }

        // Determine type
        let type = 'expense';
        if (rawType) {
          const typeLower = rawType.toLowerCase().trim();
          if (['income', 'credit', 'cr', 'deposit'].some(t => typeLower.includes(t))) {
            type = 'income';
          }
        } else if (amount > 0 && rawAmount.includes('+')) {
          type = 'income';
        }

        const txn = {
          date,
          amount: Math.abs(amount),
          type,
          categoryId: defaultCategoryId,
          subcategory: '',
          accountId: defaultAccountId,
          description: rawDescription.trim(),
          tags: ['imported'],
          isRecurring: false,
          recurringId: null,
          aiCategorized: false,
          notes: 'Imported from CSV'
        };

        transactions.push(txn);
      } catch (err) {
        errors.push({ row: rowNum, message: err.message || 'Unknown error' });
      }
    }

    // Detect duplicates
    const duplicates = this.detectDuplicates(transactions, existingTxns);

    return { transactions, duplicates, errors };
  },

  /**
   * Detect likely duplicates by matching date, amount, and similar description.
   * @param {Object[]} newTxns - New transactions to check.
   * @param {Object[]} existingTxns - Existing transactions in the store.
   * @returns {Object[]} Probable duplicate transactions from newTxns.
   */
  detectDuplicates(newTxns, existingTxns) {
    if (!existingTxns || existingTxns.length === 0) return [];

    const duplicates = [];

    for (const newTxn of newTxns) {
      const isDuplicate = existingTxns.some(existing => {
        // Must match date and amount
        if (existing.date !== newTxn.date) return false;
        if (Math.abs(existing.amount - newTxn.amount) > 0.01) return false;

        // Check description similarity (simple substring match)
        if (existing.description && newTxn.description) {
          const a = existing.description.toLowerCase();
          const b = newTxn.description.toLowerCase();
          if (a === b || a.includes(b) || b.includes(a)) return true;
          // Jaccard-like word overlap
          const wordsA = new Set(a.split(/\s+/));
          const wordsB = new Set(b.split(/\s+/));
          const overlap = [...wordsA].filter(w => wordsB.has(w)).length;
          const total = new Set([...wordsA, ...wordsB]).size;
          if (total > 0 && overlap / total > 0.5) return true;
        }

        // Same date + amount with no description is suspicious
        return true;
      });

      if (isDuplicate) {
        duplicates.push(newTxn);
      }
    }

    return duplicates;
  },

  /**
   * Auto-detect column mapping based on header names.
   * @param {string[]} headers - CSV header row.
   * @returns {{ date: number|null, amount: number|null, description: number|null, type: number|null }}
   */
  guessColumnMapping(headers) {
    const mapping = { date: null, amount: null, description: null, type: null };
    const normalised = headers.map(h => h.toLowerCase().trim());

    for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
      for (let i = 0; i < normalised.length; i++) {
        if (patterns.some(p => normalised[i] === p || normalised[i].includes(p))) {
          if (mapping[field] === null) {
            mapping[field] = i;
          }
          break;
        }
      }
    }

    return mapping;
  },

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Try to parse a date string into YYYY-MM-DD format.
   * Supports: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD Mon YYYY.
   * @param {string} dateStr
   * @returns {string|null} YYYY-MM-DD or null.
   * @private
   */
  _parseDate(dateStr) {
    if (!dateStr) return null;
    const str = dateStr.trim();

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const d = new Date(str + 'T00:00:00');
      return isNaN(d.getTime()) ? null : str;
    }

    // DD/MM/YYYY or DD-MM-YYYY (Indian bank format)
    const ddmmyyyy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      if (!isNaN(d.getTime())) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    // DD Mon YYYY (e.g., "15 Jun 2026")
    const ddmonyyyy = str.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
    if (ddmonyyyy) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    // Fallback: let Date parse it
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return null;
  },

  /**
   * Parse a currency/amount string into a number.
   * Handles: "₹1,25,000", "-450.00", "1,234.50", "Rs. 500", etc.
   * @param {string} amountStr
   * @returns {number|null}
   * @private
   */
  _parseAmount(amountStr) {
    if (!amountStr) return null;
    // Remove currency symbols and whitespace
    let cleaned = amountStr.replace(/[₹$€£¥Rs.INR\s]/gi, '').trim();
    // Detect negative
    const isNegative = cleaned.startsWith('-') || cleaned.startsWith('(');
    cleaned = cleaned.replace(/[()]/g, '');
    // Remove commas
    cleaned = cleaned.replace(/,/g, '');

    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    return isNegative ? -num : num;
  }
};
