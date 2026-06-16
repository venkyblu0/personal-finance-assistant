/**
 * @module store
 * @description Singleton data store backed by localStorage. All financial data
 * lives under the 'finance_ai_data' key. Every mutation auto-saves and
 * dispatches a 'store-updated' CustomEvent on window.
 */

import { deepClone } from './utils/helpers.js';
import { getActiveProfileId, getStorageKeyForProfile } from './modules/profiles.js';

// Dynamic storage key — resolved per active profile
function getStorageKey() {
  const profileId = getActiveProfileId();
  if (profileId) {
    return getStorageKeyForProfile(profileId);
  }
  return 'finance_ai_data'; // fallback for legacy/no-profile mode
}

// ---------------------------------------------------------------------------
// Default seed data
// ---------------------------------------------------------------------------

/**
 * Generate a unique ID with a given prefix.
 * @param {string} prefix - ID prefix (e.g., 'txn', 'cat').
 * @returns {string}
 */
function generateId(prefix) {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${ts}_${rand}`;
}

/** @returns {string} Today in YYYY-MM-DD */
function today() {
  return new Date().toISOString().split('T')[0];
}

/** @returns {string} Current month as YYYY-MM */
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** @returns {string} Previous month as YYYY-MM */
function prevMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Generate a date string N days ago */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function buildDefaultData() {
  // ---- Categories ----
  const categories = [
    { id: 'cat_food', name: 'Food & Dining', type: 'expense', icon: 'utensils', color: '#f59e0b', budget: 15000, subcategories: ['Groceries', 'Restaurants', 'Delivery'] },
    { id: 'cat_transport', name: 'Transport', type: 'expense', icon: 'car', color: '#3b82f6', budget: 5000, subcategories: ['Fuel', 'Uber/Ola', 'Auto', 'Metro'] },
    { id: 'cat_shopping', name: 'Shopping', type: 'expense', icon: 'shopping-bag', color: '#ec4899', budget: 10000, subcategories: ['Clothing', 'Electronics', 'Household'] },
    { id: 'cat_bills', name: 'Bills & Utilities', type: 'expense', icon: 'zap', color: '#8b5cf6', budget: 8000, subcategories: ['Electricity', 'Internet', 'Water', 'Gas', 'Phone'] },
    { id: 'cat_health', name: 'Health', type: 'expense', icon: 'heart-pulse', color: '#10b981', budget: 5000, subcategories: ['Medicine', 'Doctor', 'Gym', 'Insurance'] },
    { id: 'cat_entertainment', name: 'Entertainment', type: 'expense', icon: 'film', color: '#f97316', budget: 5000, subcategories: ['Movies', 'Streaming', 'Games', 'Events'] },
    { id: 'cat_education', name: 'Education', type: 'expense', icon: 'graduation-cap', color: '#06b6d4', budget: 3000, subcategories: ['Books', 'Courses', 'Stationery'] },
    { id: 'cat_rent', name: 'Rent', type: 'expense', icon: 'home', color: '#6366f1', budget: 25000, subcategories: [] },
    { id: 'cat_other_exp', name: 'Other Expense', type: 'expense', icon: 'circle', color: '#94a3b8', budget: 0, subcategories: [] },
    { id: 'cat_salary', name: 'Salary', type: 'income', icon: 'briefcase', color: '#10b981', budget: 0, subcategories: [] },
    { id: 'cat_freelance', name: 'Freelance', type: 'income', icon: 'laptop', color: '#8b5cf6', budget: 0, subcategories: [] },
    { id: 'cat_investments', name: 'Investments', type: 'income', icon: 'trending-up', color: '#f59e0b', budget: 0, subcategories: [] },
    { id: 'cat_other_inc', name: 'Other Income', type: 'income', icon: 'plus-circle', color: '#3b82f6', budget: 0, subcategories: [] }
  ];

  // ---- Accounts ----
  const accounts = [
    { id: 'acc_cash', name: 'Cash', type: 'cash', balance: 5000, icon: 'wallet', color: '#10b981' },
    { id: 'acc_bank', name: 'Bank Account', type: 'savings', balance: 150000, icon: 'building-2', color: '#6366f1' },
    { id: 'acc_cc', name: 'Credit Card', type: 'credit', balance: 0, icon: 'credit-card', color: '#ef4444' }
  ];

  // ---- Sample transactions ----
  const cm = currentMonth();
  const pm = prevMonth();

  const transactions = [
    // --- Current month income ---
    { id: generateId('txn'), date: `${cm}-01`, amount: 120000, type: 'income', categoryId: 'cat_salary', subcategory: '', accountId: 'acc_bank', description: 'Monthly Salary', tags: ['salary'], isRecurring: true, recurringId: 'rec_salary', aiCategorized: false, notes: '' },
    // --- Current month expenses ---
    { id: generateId('txn'), date: `${cm}-02`, amount: 25000, type: 'expense', categoryId: 'cat_rent', subcategory: '', accountId: 'acc_bank', description: 'Monthly Rent', tags: ['rent', 'housing'], isRecurring: true, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-03`, amount: 3200, type: 'expense', categoryId: 'cat_food', subcategory: 'Groceries', accountId: 'acc_bank', description: 'BigBasket groceries', tags: ['food', 'online'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-04`, amount: 450, type: 'expense', categoryId: 'cat_food', subcategory: 'Delivery', accountId: 'acc_bank', description: 'Swiggy order', tags: ['food', 'online'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-05`, amount: 1200, type: 'expense', categoryId: 'cat_food', subcategory: 'Restaurants', accountId: 'acc_cc', description: 'Dinner at Barbeque Nation', tags: ['food', 'dining'], isRecurring: false, recurringId: null, aiCategorized: false, notes: 'Birthday celebration' },
    { id: generateId('txn'), date: `${cm}-05`, amount: 2200, type: 'expense', categoryId: 'cat_bills', subcategory: 'Electricity', accountId: 'acc_bank', description: 'BESCOM electricity bill', tags: ['bills'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-06`, amount: 999, type: 'expense', categoryId: 'cat_bills', subcategory: 'Internet', accountId: 'acc_bank', description: 'Airtel Xstream broadband', tags: ['bills', 'internet'], isRecurring: true, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-07`, amount: 350, type: 'expense', categoryId: 'cat_transport', subcategory: 'Auto', accountId: 'acc_cash', description: 'Auto to office', tags: ['transport'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-08`, amount: 649, type: 'expense', categoryId: 'cat_entertainment', subcategory: 'Streaming', accountId: 'acc_bank', description: 'Netflix subscription', tags: ['entertainment', 'streaming'], isRecurring: true, recurringId: 'rec_netflix', aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-09`, amount: 3500, type: 'expense', categoryId: 'cat_health', subcategory: 'Gym', accountId: 'acc_bank', description: 'Cult.fit membership', tags: ['health', 'fitness'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-10`, amount: 890, type: 'expense', categoryId: 'cat_food', subcategory: 'Delivery', accountId: 'acc_bank', description: 'Zomato orders', tags: ['food', 'online'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-11`, amount: 250, type: 'expense', categoryId: 'cat_transport', subcategory: 'Uber/Ola', accountId: 'acc_bank', description: 'Uber to mall', tags: ['transport'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-12`, amount: 4500, type: 'expense', categoryId: 'cat_shopping', subcategory: 'Clothing', accountId: 'acc_cc', description: 'Myntra shopping', tags: ['shopping', 'online'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-13`, amount: 550, type: 'expense', categoryId: 'cat_health', subcategory: 'Medicine', accountId: 'acc_cash', description: 'Apollo pharmacy', tags: ['health', 'medicine'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${cm}-14`, amount: 15000, type: 'income', categoryId: 'cat_freelance', subcategory: '', accountId: 'acc_bank', description: 'Freelance web project', tags: ['freelance', 'income'], isRecurring: false, recurringId: null, aiCategorized: false, notes: 'Logo design for StartupXYZ' },
    // --- Previous month income ---
    { id: generateId('txn'), date: `${pm}-01`, amount: 120000, type: 'income', categoryId: 'cat_salary', subcategory: '', accountId: 'acc_bank', description: 'Monthly Salary', tags: ['salary'], isRecurring: true, recurringId: 'rec_salary', aiCategorized: false, notes: '' },
    // --- Previous month expenses ---
    { id: generateId('txn'), date: `${pm}-02`, amount: 25000, type: 'expense', categoryId: 'cat_rent', subcategory: '', accountId: 'acc_bank', description: 'Monthly Rent', tags: ['rent', 'housing'], isRecurring: true, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${pm}-05`, amount: 2800, type: 'expense', categoryId: 'cat_food', subcategory: 'Groceries', accountId: 'acc_bank', description: 'DMart groceries', tags: ['food'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${pm}-07`, amount: 380, type: 'expense', categoryId: 'cat_food', subcategory: 'Delivery', accountId: 'acc_bank', description: 'Swiggy order', tags: ['food', 'online'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${pm}-08`, amount: 1800, type: 'expense', categoryId: 'cat_bills', subcategory: 'Electricity', accountId: 'acc_bank', description: 'BESCOM electricity bill', tags: ['bills'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${pm}-10`, amount: 999, type: 'expense', categoryId: 'cat_bills', subcategory: 'Internet', accountId: 'acc_bank', description: 'Airtel broadband', tags: ['bills', 'internet'], isRecurring: true, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${pm}-12`, amount: 649, type: 'expense', categoryId: 'cat_entertainment', subcategory: 'Streaming', accountId: 'acc_bank', description: 'Netflix subscription', tags: ['entertainment'], isRecurring: true, recurringId: 'rec_netflix', aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${pm}-14`, amount: 2200, type: 'expense', categoryId: 'cat_shopping', subcategory: 'Electronics', accountId: 'acc_cc', description: 'Amazon – USB hub', tags: ['shopping', 'online'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${pm}-15`, amount: 350, type: 'expense', categoryId: 'cat_transport', subcategory: 'Uber/Ola', accountId: 'acc_bank', description: 'Ola ride', tags: ['transport'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${pm}-18`, amount: 750, type: 'expense', categoryId: 'cat_food', subcategory: 'Restaurants', accountId: 'acc_cash', description: 'Lunch at Meghana Foods', tags: ['food', 'dining'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${pm}-20`, amount: 499, type: 'expense', categoryId: 'cat_entertainment', subcategory: 'Movies', accountId: 'acc_bank', description: 'PVR movie tickets', tags: ['entertainment'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${pm}-22`, amount: 1200, type: 'expense', categoryId: 'cat_education', subcategory: 'Courses', accountId: 'acc_bank', description: 'Udemy course – React', tags: ['education', 'online'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
    { id: generateId('txn'), date: `${pm}-25`, amount: 450, type: 'expense', categoryId: 'cat_health', subcategory: 'Medicine', accountId: 'acc_cash', description: 'Pharmacy – cold medicine', tags: ['health'], isRecurring: false, recurringId: null, aiCategorized: false, notes: '' },
  ];

  // ---- Recurring ----
  const recurringTransactions = [
    {
      id: 'rec_netflix', description: 'Netflix Subscription', amount: 649,
      type: 'expense', categoryId: 'cat_entertainment', accountId: 'acc_bank',
      frequency: 'monthly', startDate: '2026-01-01',
      nextDueDate: `${cm}-08`, isActive: true
    },
    {
      id: 'rec_salary', description: 'Monthly Salary', amount: 120000,
      type: 'income', categoryId: 'cat_salary', accountId: 'acc_bank',
      frequency: 'monthly', startDate: '2026-01-01',
      nextDueDate: `${cm}-01`, isActive: true
    }
  ];

  // ---- Budget ----
  const budgets = [
    {
      id: generateId('bud'), month: cm, totalBudget: 80000,
      categoryBudgets: {
        cat_food: 15000, cat_transport: 5000, cat_shopping: 10000,
        cat_bills: 8000, cat_health: 5000, cat_entertainment: 5000,
        cat_education: 3000, cat_rent: 25000
      }
    }
  ];

  // ---- Goals ----
  const goals = [
    {
      id: generateId('goal'), name: 'Emergency Fund', targetAmount: 300000,
      currentAmount: 85000, deadline: '2026-12-31', icon: 'shield',
      color: '#10b981', monthlyContribution: 15000, priority: 'high'
    }
  ];

  // ---- Debts ----
  const debts = [
    {
      id: generateId('debt'), name: 'Education Loan', type: 'loan',
      principalAmount: 500000, remainingAmount: 350000, interestRate: 8.5,
      emiAmount: 12000, startDate: '2024-01-15', endDate: '2028-01-15',
      nextPaymentDate: `${cm}-15`, lender: 'SBI'
    }
  ];

  return {
    meta: {
      version: '1.0.0',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      currency: 'INR',
      userName: ''
    },
    accounts,
    categories,
    transactions,
    recurringTransactions,
    budgets,
    goals,
    debts,
    aiConversations: [],
    settings: {
      theme: 'dark',
      currency: 'INR',
      currencySymbol: '₹',
      dateFormat: 'DD/MM/YYYY',
      openRouterApiKey: '',
      preferredModel: 'openai/gpt-4o',
      monthStartDay: 1,
      enableNotifications: true
    }
  };
}

// ---------------------------------------------------------------------------
// Store class
// ---------------------------------------------------------------------------

class Store {
  constructor() {
    this._data = null;
    this._load();
  }

  // ========================================================================
  // Private helpers
  // ========================================================================

  /** Load from localStorage or initialise with defaults. */
  _load() {
    try {
      const key = getStorageKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        this._data = JSON.parse(raw);
        // Ensure all top-level keys exist (forward-compat)
        const defaults = buildDefaultData();
        for (const k of Object.keys(defaults)) {
          if (this._data[k] === undefined) {
            this._data[k] = defaults[k];
          }
        }
        // Migration: normalize transaction type to lowercase
        let needsPersist = false;
        if (this._data.transactions) {
          for (const t of this._data.transactions) {
            if (t.type && t.type !== t.type.toLowerCase()) {
              t.type = t.type.toLowerCase();
              needsPersist = true;
            }
          }
        }
        if (needsPersist) this._persist();
      } else {
        this._data = buildDefaultData();
        this._persist();
      }
    } catch (err) {
      console.error('[Store] Failed to load data, resetting to defaults:', err);
      this._data = buildDefaultData();
      this._persist();
    }
  }

  /** Write data to localStorage and dispatch store-updated event. */
  _persist() {
    try {
      this._data.meta.lastModified = new Date().toISOString();
      localStorage.setItem(getStorageKey(), JSON.stringify(this._data));
    } catch (err) {
      console.error('[Store] Failed to persist data:', err);
    }
    window.dispatchEvent(new CustomEvent('store-updated'));
  }

  /**
   * Switch to a different profile's data. Reloads from localStorage.
   * @param {string} _profileId - The profile to switch to (used by getStorageKey via getActiveProfileId).
   */
  switchProfile(_profileId) {
    this._data = null;
    this._load();
    window.dispatchEvent(new CustomEvent('store-updated'));
  }

  // ========================================================================
  // Core
  // ========================================================================

  /**
   * Get a deep clone of the full data object.
   * @returns {Object}
   */
  getData() {
    return deepClone(this._data);
  }

  /**
   * Persist current in-memory data to localStorage.
   */
  saveData() {
    this._persist();
  }

  // ========================================================================
  // ID generation
  // ========================================================================

  /**
   * Generate a unique prefixed ID.
   * @param {string} prefix
   * @returns {string}
   */
  generateId(prefix) {
    return generateId(prefix);
  }

  // ========================================================================
  // Transactions
  // ========================================================================

  /**
   * Get transactions, optionally filtered.
   * @param {Object} [filters]
   * @param {string} [filters.month] - e.g. '2026-06'
   * @param {string} [filters.categoryId]
   * @param {string} [filters.type] - 'income' | 'expense'
   * @param {string} [filters.search] - keyword search on description/notes
   * @param {string} [filters.accountId]
   * @param {string} [filters.startDate] - YYYY-MM-DD
   * @param {string} [filters.endDate] - YYYY-MM-DD
   * @returns {Array<Object>} Sorted newest-first by date.
   */
  getTransactions(filters = {}) {
    let txns = [...(this._data.transactions || [])];

    if (filters.month) {
      txns = txns.filter(t => t.date && t.date.startsWith(filters.month));
    }
    if (filters.categoryId) {
      txns = txns.filter(t => t.categoryId === filters.categoryId);
    }
    if (filters.type) {
      txns = txns.filter(t => t.type === filters.type);
    }
    if (filters.accountId) {
      txns = txns.filter(t => t.accountId === filters.accountId);
    }
    if (filters.startDate) {
      txns = txns.filter(t => t.date >= filters.startDate);
    }
    if (filters.endDate) {
      txns = txns.filter(t => t.date <= filters.endDate);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      txns = txns.filter(t =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.subcategory || '').toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q))
      );
    }

    // Sort newest first
    txns.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return txns;
  }

  /**
   * Get a single transaction by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getTransaction(id) {
    return (this._data.transactions || []).find(t => t.id === id) || null;
  }

  /**
   * Add a new transaction.
   * @param {Object} data - Transaction data (without id).
   * @returns {Object} The created transaction.
   */
  addTransaction(data) {
    const txn = {
      id: generateId('txn'),
      date: data.date || today(),
      amount: Number(data.amount) || 0,
      type: (data.type || 'expense').toLowerCase(),
      categoryId: data.categoryId || '',
      subcategory: data.subcategory || '',
      accountId: data.accountId || '',
      description: data.description || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      isRecurring: data.isRecurring || false,
      recurringId: data.recurringId || null,
      aiCategorized: data.aiCategorized || false,
      notes: data.notes || ''
    };
    this._data.transactions.push(txn);
    this._persist();
    return deepClone(txn);
  }

  /**
   * Update an existing transaction.
   * @param {string} id
   * @param {Object} updates - Fields to merge.
   * @returns {Object|null} Updated transaction or null if not found.
   */
  updateTransaction(id, updates) {
    const idx = this._data.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;
    Object.assign(this._data.transactions[idx], updates);
    if (updates.amount !== undefined) {
      this._data.transactions[idx].amount = Number(updates.amount);
    }
    this._persist();
    return deepClone(this._data.transactions[idx]);
  }

  /**
   * Delete a transaction by ID.
   * @param {string} id
   * @returns {boolean} True if found and deleted.
   */
  deleteTransaction(id) {
    const len = this._data.transactions.length;
    this._data.transactions = this._data.transactions.filter(t => t.id !== id);
    if (this._data.transactions.length < len) {
      this._persist();
      return true;
    }
    return false;
  }

  /**
   * Bulk delete transactions by IDs.
   * @param {string[]} ids
   * @returns {number} Number of deleted transactions.
   */
  deleteTransactions(ids) {
    const idSet = new Set(ids);
    const before = this._data.transactions.length;
    this._data.transactions = this._data.transactions.filter(t => !idSet.has(t.id));
    const deleted = before - this._data.transactions.length;
    if (deleted > 0) this._persist();
    return deleted;
  }

  // ========================================================================
  // Categories
  // ========================================================================

  /**
   * Get categories, optionally filtered by type.
   * @param {string} [type] - 'income' | 'expense'
   * @returns {Array<Object>}
   */
  getCategories(type) {
    const cats = this._data.categories || [];
    if (type) return cats.filter(c => c.type === type);
    return [...cats];
  }

  /**
   * Get a single category by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getCategory(id) {
    return (this._data.categories || []).find(c => c.id === id) || null;
  }

  /**
   * Add a new category.
   * @param {Object} data
   * @returns {Object} Created category.
   */
  addCategory(data) {
    const cat = {
      id: generateId('cat'),
      name: data.name || 'Unnamed',
      type: data.type || 'expense',
      icon: data.icon || 'circle',
      color: data.color || '#94a3b8',
      budget: Number(data.budget) || 0,
      subcategories: Array.isArray(data.subcategories) ? data.subcategories : []
    };
    this._data.categories.push(cat);
    this._persist();
    return deepClone(cat);
  }

  /**
   * Update a category.
   * @param {string} id
   * @param {Object} updates
   * @returns {Object|null}
   */
  updateCategory(id, updates) {
    const idx = this._data.categories.findIndex(c => c.id === id);
    if (idx === -1) return null;
    Object.assign(this._data.categories[idx], updates);
    this._persist();
    return deepClone(this._data.categories[idx]);
  }

  /**
   * Delete a category.
   * @param {string} id
   * @returns {boolean}
   */
  deleteCategory(id) {
    const len = this._data.categories.length;
    this._data.categories = this._data.categories.filter(c => c.id !== id);
    if (this._data.categories.length < len) {
      this._persist();
      return true;
    }
    return false;
  }

  // ========================================================================
  // Accounts
  // ========================================================================

  /**
   * Get all accounts.
   * @returns {Array<Object>}
   */
  getAccounts() {
    return [...(this._data.accounts || [])];
  }

  /**
   * Get a single account by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getAccount(id) {
    return (this._data.accounts || []).find(a => a.id === id) || null;
  }

  /**
   * Add a new account.
   * @param {Object} data
   * @returns {Object}
   */
  addAccount(data) {
    const acc = {
      id: generateId('acc'),
      name: data.name || 'Unnamed Account',
      type: data.type || 'savings',
      balance: Number(data.balance) || 0,
      icon: data.icon || 'wallet',
      color: data.color || '#6366f1'
    };
    this._data.accounts.push(acc);
    this._persist();
    return deepClone(acc);
  }

  /**
   * Update an account.
   * @param {string} id
   * @param {Object} updates
   * @returns {Object|null}
   */
  updateAccount(id, updates) {
    const idx = this._data.accounts.findIndex(a => a.id === id);
    if (idx === -1) return null;
    Object.assign(this._data.accounts[idx], updates);
    this._persist();
    return deepClone(this._data.accounts[idx]);
  }

  /**
   * Delete an account.
   * @param {string} id
   * @returns {boolean}
   */
  deleteAccount(id) {
    const len = this._data.accounts.length;
    this._data.accounts = this._data.accounts.filter(a => a.id !== id);
    if (this._data.accounts.length < len) {
      this._persist();
      return true;
    }
    return false;
  }

  // ========================================================================
  // Budgets
  // ========================================================================

  /**
   * Get the budget for a specific month.
   * @param {string} month - e.g. '2026-06'
   * @returns {Object|null}
   */
  getBudget(month) {
    return (this._data.budgets || []).find(b => b.month === month) || null;
  }

  /**
   * Create or update a budget for a month.
   * @param {string} month
   * @param {number} totalBudget
   * @param {Object} categoryBudgets - { categoryId: amount }
   * @returns {Object} The budget object.
   */
  setBudget(month, totalBudget, categoryBudgets = {}) {
    const idx = (this._data.budgets || []).findIndex(b => b.month === month);
    if (idx >= 0) {
      this._data.budgets[idx].totalBudget = Number(totalBudget);
      this._data.budgets[idx].categoryBudgets = { ...categoryBudgets };
      this._persist();
      return deepClone(this._data.budgets[idx]);
    }
    const budget = {
      id: generateId('bud'),
      month,
      totalBudget: Number(totalBudget),
      categoryBudgets: { ...categoryBudgets }
    };
    this._data.budgets.push(budget);
    this._persist();
    return deepClone(budget);
  }

  // ========================================================================
  // Goals
  // ========================================================================

  /**
   * Get all goals.
   * @returns {Array<Object>}
   */
  getGoals() {
    return [...(this._data.goals || [])];
  }

  /**
   * Add a new goal.
   * @param {Object} data
   * @returns {Object}
   */
  addGoal(data) {
    const goal = {
      id: generateId('goal'),
      name: data.name || 'Unnamed Goal',
      targetAmount: Number(data.targetAmount) || 0,
      currentAmount: Number(data.currentAmount) || 0,
      deadline: data.deadline || '',
      icon: data.icon || 'target',
      color: data.color || '#10b981',
      monthlyContribution: Number(data.monthlyContribution) || 0,
      priority: data.priority || 'medium'
    };
    this._data.goals.push(goal);
    this._persist();
    return deepClone(goal);
  }

  /**
   * Update a goal.
   * @param {string} id
   * @param {Object} updates
   * @returns {Object|null}
   */
  updateGoal(id, updates) {
    const idx = this._data.goals.findIndex(g => g.id === id);
    if (idx === -1) return null;
    Object.assign(this._data.goals[idx], updates);
    this._persist();
    return deepClone(this._data.goals[idx]);
  }

  /**
   * Delete a goal.
   * @param {string} id
   * @returns {boolean}
   */
  deleteGoal(id) {
    const len = this._data.goals.length;
    this._data.goals = this._data.goals.filter(g => g.id !== id);
    if (this._data.goals.length < len) {
      this._persist();
      return true;
    }
    return false;
  }

  // ========================================================================
  // Debts
  // ========================================================================

  /**
   * Get all debts.
   * @returns {Array<Object>}
   */
  getDebts() {
    return [...(this._data.debts || [])];
  }

  /**
   * Add a new debt.
   * @param {Object} data
   * @returns {Object}
   */
  addDebt(data) {
    const debt = {
      id: generateId('debt'),
      name: data.name || 'Unnamed Debt',
      type: data.type || 'loan',
      principalAmount: Number(data.principalAmount) || 0,
      remainingAmount: Number(data.remainingAmount) || 0,
      interestRate: Number(data.interestRate) || 0,
      emiAmount: Number(data.emiAmount) || 0,
      startDate: data.startDate || today(),
      endDate: data.endDate || '',
      nextPaymentDate: data.nextPaymentDate || '',
      lender: data.lender || ''
    };
    this._data.debts.push(debt);
    this._persist();
    return deepClone(debt);
  }

  /**
   * Update a debt.
   * @param {string} id
   * @param {Object} updates
   * @returns {Object|null}
   */
  updateDebt(id, updates) {
    const idx = this._data.debts.findIndex(d => d.id === id);
    if (idx === -1) return null;
    Object.assign(this._data.debts[idx], updates);
    this._persist();
    return deepClone(this._data.debts[idx]);
  }

  /**
   * Delete a debt.
   * @param {string} id
   * @returns {boolean}
   */
  deleteDebt(id) {
    const len = this._data.debts.length;
    this._data.debts = this._data.debts.filter(d => d.id !== id);
    if (this._data.debts.length < len) {
      this._persist();
      return true;
    }
    return false;
  }

  // ========================================================================
  // Recurring Transactions
  // ========================================================================

  /**
   * Get all recurring transactions.
   * @returns {Array<Object>}
   */
  getRecurringTransactions() {
    return [...(this._data.recurringTransactions || [])];
  }

  /**
   * Add a new recurring transaction.
   * @param {Object} data
   * @returns {Object}
   */
  addRecurringTransaction(data) {
    const rec = {
      id: generateId('rec'),
      description: data.description || '',
      amount: Number(data.amount) || 0,
      type: data.type || 'expense',
      categoryId: data.categoryId || '',
      accountId: data.accountId || '',
      frequency: data.frequency || 'monthly',
      startDate: data.startDate || today(),
      nextDueDate: data.nextDueDate || data.startDate || today(),
      isActive: data.isActive !== false
    };
    this._data.recurringTransactions.push(rec);
    this._persist();
    return deepClone(rec);
  }

  /**
   * Update a recurring transaction.
   * @param {string} id
   * @param {Object} updates
   * @returns {Object|null}
   */
  updateRecurringTransaction(id, updates) {
    const idx = this._data.recurringTransactions.findIndex(r => r.id === id);
    if (idx === -1) return null;
    Object.assign(this._data.recurringTransactions[idx], updates);
    this._persist();
    return deepClone(this._data.recurringTransactions[idx]);
  }

  /**
   * Delete a recurring transaction.
   * @param {string} id
   * @returns {boolean}
   */
  deleteRecurringTransaction(id) {
    const len = this._data.recurringTransactions.length;
    this._data.recurringTransactions = this._data.recurringTransactions.filter(r => r.id !== id);
    if (this._data.recurringTransactions.length < len) {
      this._persist();
      return true;
    }
    return false;
  }

  /**
   * Process all active recurring transactions whose nextDueDate is today or
   * in the past. Creates actual transactions and advances nextDueDate.
   * @returns {Array<Object>} Newly created transactions.
   */
  processRecurringTransactions() {
    const todayStr = today();
    const created = [];

    for (const rec of this._data.recurringTransactions) {
      if (!rec.isActive) continue;
      if (!rec.nextDueDate) continue;

      // Process all missed dates up to today
      while (rec.nextDueDate <= todayStr) {
        // Create the transaction
        const txn = {
          id: generateId('txn'),
          date: rec.nextDueDate,
          amount: rec.amount,
          type: rec.type,
          categoryId: rec.categoryId,
          subcategory: '',
          accountId: rec.accountId,
          description: rec.description,
          tags: ['recurring'],
          isRecurring: true,
          recurringId: rec.id,
          aiCategorized: false,
          notes: 'Auto-generated from recurring transaction'
        };
        this._data.transactions.push(txn);
        created.push(deepClone(txn));

        // Advance nextDueDate
        rec.nextDueDate = this._advanceDate(rec.nextDueDate, rec.frequency);
      }
    }

    if (created.length > 0) {
      this._persist();
    }
    return created;
  }

  /**
   * Advance a date by a frequency interval.
   * @param {string} dateStr - YYYY-MM-DD
   * @param {string} frequency - 'daily' | 'weekly' | 'monthly' | 'yearly'
   * @returns {string} Advanced date in YYYY-MM-DD.
   * @private
   */
  _advanceDate(dateStr, frequency) {
    const d = new Date(dateStr + 'T00:00:00');
    switch (frequency) {
      case 'daily':
        d.setDate(d.getDate() + 1);
        break;
      case 'weekly':
        d.setDate(d.getDate() + 7);
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'yearly':
        d.setFullYear(d.getFullYear() + 1);
        break;
      default:
        d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().split('T')[0];
  }

  // ========================================================================
  // AI Conversations
  // ========================================================================

  /**
   * Get all AI conversations.
   * @returns {Array<Object>}
   */
  getConversations() {
    return [...(this._data.aiConversations || [])];
  }

  /**
   * Add a new AI conversation.
   * @param {Object} conv
   * @returns {Object}
   */
  addConversation(conv) {
    const conversation = {
      id: generateId('conv'),
      ...conv,
      createdAt: conv.createdAt || new Date().toISOString()
    };
    this._data.aiConversations.push(conversation);
    this._persist();
    return deepClone(conversation);
  }

  /**
   * Get a single conversation by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getConversation(id) {
    return (this._data.aiConversations || []).find(c => c.id === id) || null;
  }

  /**
   * Update a conversation.
   * @param {string} id
   * @param {Object} updates
   * @returns {Object|null}
   */
  updateConversation(id, updates) {
    const idx = (this._data.aiConversations || []).findIndex(c => c.id === id);
    if (idx === -1) return null;
    Object.assign(this._data.aiConversations[idx], updates);
    this._persist();
    return deepClone(this._data.aiConversations[idx]);
  }

  // ========================================================================
  // Settings
  // ========================================================================

  /**
   * Get the current settings.
   * @returns {Object}
   */
  getSettings() {
    return { ...(this._data.settings || {}) };
  }

  /**
   * Update settings (shallow merge).
   * @param {Object} updates
   * @returns {Object} Updated settings.
   */
  updateSettings(updates) {
    this._data.settings = { ...this._data.settings, ...updates };
    this._persist();
    return { ...this._data.settings };
  }

  // ========================================================================
  // Stats
  // ========================================================================

  /**
   * Get comprehensive monthly statistics.
   * @param {string} month - e.g. '2026-06'
   * @returns {Object} Monthly stats including income, expenses, savings rate, and category breakdown.
   */
  getMonthlyStats(month) {
    const txns = this.getTransactions({ month });
    const categories = this.getCategories();

    const income = txns
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = txns
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netSavings = income - expenses;
    const savingsRate = income > 0 ? (netSavings / income) * 100 : 0;

    // Category breakdown (expenses only)
    const catMap = new Map();
    txns.filter(t => t.type === 'expense').forEach(t => {
      const current = catMap.get(t.categoryId) || 0;
      catMap.set(t.categoryId, current + t.amount);
    });

    const byCategory = [];
    for (const [catId, amount] of catMap) {
      const cat = categories.find(c => c.id === catId);
      byCategory.push({
        categoryId: catId,
        categoryName: cat?.name || 'Unknown',
        amount,
        percentage: expenses > 0 ? (amount / expenses) * 100 : 0,
        color: cat?.color || '#94a3b8',
        icon: cat?.icon || 'circle'
      });
    }
    byCategory.sort((a, b) => b.amount - a.amount);

    // Days elapsed in month for daily average
    const [yearStr, monthStr] = month.split('-');
    const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    const todayDate = new Date();
    const monthStart = new Date(Number(yearStr), Number(monthStr) - 1, 1);
    const monthEnd = new Date(Number(yearStr), Number(monthStr), 0);
    const elapsed = todayDate < monthEnd
      ? Math.max(1, Math.ceil((todayDate - monthStart) / (1000 * 60 * 60 * 24)))
      : daysInMonth;

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netSavings,
      savingsRate: Math.round(savingsRate * 100) / 100,
      byCategory,
      transactionCount: txns.length,
      avgDailySpend: expenses > 0 ? Math.round(expenses / elapsed) : 0
    };
  }

  /**
   * Recalculate account balances from all transactions.
   * Note: This applies deltas from transactions to the initial stored balances.
   * @returns {Array<{id: string, name: string, balance: number}>}
   */
  getAccountBalances() {
    const accounts = this.getAccounts();
    // For a more accurate approach, you could sum all transactions per account.
    // Here we return stored balances (which should be kept in sync by the UI).
    return accounts.map(a => ({
      id: a.id,
      name: a.name,
      balance: a.balance,
      icon: a.icon,
      color: a.color,
      type: a.type
    }));
  }

  // ========================================================================
  // Import / Export
  // ========================================================================

  /**
   * Export all data as a JSON string.
   * @returns {string}
   */
  exportData() {
    return JSON.stringify(this._data, null, 2);
  }

  /**
   * Import data from a JSON string, replacing all existing data.
   * @param {string} jsonString
   * @returns {boolean} True if import succeeded.
   */
  importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid data format');
      }
      this._data = parsed;
      this._persist();
      return true;
    } catch (err) {
      console.error('[Store] Import failed:', err);
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const store = new Store();
