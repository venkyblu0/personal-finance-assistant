/**
 * FinanceAI — Main Entry Point
 * Initializes routes, event listeners, theme, and bootstraps the application.
 *
 * Loaded by index.html via <script type="module" src="js/app.js"></script>
 */

import { store } from './store.js';
import { router } from './router.js';
import { debounce } from './utils/helpers.js';
import { showTransactionModal, showToast } from './ui/components.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderTransactions } from './ui/transactions-view.js';
import { renderBudgets } from './ui/budgets-view.js';
import { renderGoals } from './ui/goals-view.js';
import { renderDebts } from './ui/debts-view.js';
import { renderSettings } from './ui/settings-view.js';
import { renderImport } from './ui/import-view.js';
import { initChat } from './ai/chat.js';
import { renderLoginScreen, hideLoginScreen } from './ui/login-view.js';
import { getProfiles, getActiveProfileId, setActiveProfile } from './modules/profiles.js';

/* =========================================================================
 * ROUTES
 * ========================================================================= */

router.addRoute('/dashboard', () => renderDashboard());
router.addRoute('/transactions', () => renderTransactions());
router.addRoute('/budgets', () => renderBudgets());
router.addRoute('/goals', () => renderGoals());
router.addRoute('/debts', () => renderDebts());
router.addRoute('/import', () => renderImport());
router.addRoute('/settings', () => renderSettings());

/* =========================================================================
 * GLOBAL EVENT LISTENERS
 * ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // --- Add Transaction button ---
  const addTxBtn = document.getElementById('add-transaction-btn');
  if (addTxBtn) {
    addTxBtn.addEventListener('click', () => {
      showTransactionModal(null, (data) => {
        store.addTransaction(data);
        showToast('Transaction added!', 'success');
        refreshCurrentView();
      });
    });
  }

  // --- Chat panel toggle ---
  const chatToggle = document.getElementById('chat-toggle-btn');
  const chatClose = document.getElementById('chat-close-btn');
  const chatOverlay = document.getElementById('chat-overlay');

  if (chatToggle) chatToggle.addEventListener('click', toggleChatPanel);
  if (chatClose) chatClose.addEventListener('click', toggleChatPanel);
  if (chatOverlay) chatOverlay.addEventListener('click', toggleChatPanel);

  // --- Mobile sidebar toggle ---
  const menuToggle = document.getElementById('menu-toggle');
  if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);

  // --- Theme toggle ---
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // --- Global search ---
  const globalSearch = document.getElementById('global-search');
  if (globalSearch) {
    globalSearch.addEventListener(
      'input',
      debounce((e) => {
        const query = e.target.value.trim();
        if (query) {
          router.navigate('/transactions');
          // Wait a tick for the route to render, then re-render with search
          requestAnimationFrame(() => renderTransactions(query));
        }
      }, 400)
    );
    // Enter key
    globalSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.trim();
        router.navigate('/transactions');
        requestAnimationFrame(() => renderTransactions(query));
      }
    });
  }

  // --- Sidebar navigation (event delegation) ---
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.addEventListener('click', (e) => {
      const item = e.target.closest('[data-route]');
      if (item) {
        e.preventDefault();
        const route = item.dataset.route;
        router.navigate(route);
        // Close sidebar on mobile
        sidebar.classList.remove('open');
      }
    });
  }

  // --- Sidebar profile click → switch profiles ---
  const sidebarProfile = document.getElementById('sidebar-profile');
  if (sidebarProfile) {
    sidebarProfile.addEventListener('click', () => {
      showLoginScreen();
    });
  }

  // --- Mobile bottom nav ---
  const mobileNav = document.getElementById('mobile-nav');
  if (mobileNav) {
    mobileNav.addEventListener('click', (e) => {
      const item = e.target.closest('[data-route]');
      if (item) {
        e.preventDefault();
        router.navigate(item.dataset.route);
      }
    });
  }

  // --- Listen for route changes ---
  window.addEventListener('route-changed', (e) => {
    const path = e.detail?.path || router.getCurrentRoute();
    updateActiveNav(path);
    refreshIcons();
  });

  // --- Listen for store updates → re-render current view ---
  let storeUpdatePending = false;
  window.addEventListener('store-updated', () => {
    if (storeUpdatePending) return;
    storeUpdatePending = true;
    requestAnimationFrame(() => {
      storeUpdatePending = false;
      // Only refresh if the app is visible (not on login screen)
      if (!document.getElementById('login-screen')) {
        refreshCurrentView();
      }
    });
  });

  // --- Start with login flow ---
  showLoginScreen();
});

/* =========================================================================
 * LOGIN FLOW
 * ========================================================================= */

/**
 * Show the login/profile selection screen.
 */
function showLoginScreen() {
  renderLoginScreen((profileId) => {
    onProfileSelected(profileId);
  });
}

/**
 * Called when a profile is selected from the login screen.
 * @param {string} profileId
 */
function onProfileSelected(profileId) {
  // Switch store to the selected profile's data
  setActiveProfile(profileId);
  store.switchProfile(profileId);

  // Hide login, show app
  hideLoginScreen();

  // Update sidebar profile indicator
  updateSidebarProfile();

  // Initialize the app
  initializeApp();
}

/**
 * Update the sidebar profile indicator with the current profile info.
 */
function updateSidebarProfile() {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  const profile = profiles.find(p => p.id === activeId);

  const avatarEl = document.getElementById('sidebar-profile-avatar');
  const nameEl = document.getElementById('sidebar-profile-name');

  if (profile) {
    if (avatarEl) {
      avatarEl.textContent = profile.avatar || '👤';
      avatarEl.style.background = `${profile.color || '#6366f1'}20`;
      avatarEl.style.borderColor = profile.color || '#6366f1';
    }
    if (nameEl) nameEl.textContent = profile.name;

    // Update the meta userName in store
    try {
      const data = store.getData();
      if (data.meta && data.meta.userName !== profile.name) {
        store.updateSettings({}); // just trigger a save to align
      }
    } catch { /* ok */ }
  }
}

/* =========================================================================
 * INITIALIZATION
 * ========================================================================= */

function initializeApp() {
  // 1. Load theme from settings
  initTheme();

  // 2. Process any due recurring transactions
  processRecurring();

  // 3. Initialize chat panel
  initChat();

  // 4. Start the router (will render the matching route or default)
  router.init();

  // 5. Set the active nav state for the current route
  const currentRoute = router.getCurrentRoute() || '/dashboard';
  updateActiveNav(currentRoute);

  // 6. Render icons
  refreshIcons();
}

/* =========================================================================
 * HELPERS
 * ========================================================================= */

/**
 * Update the active state on sidebar and mobile nav items.
 * @param {string} path - Current route path
 */
function updateActiveNav(path) {
  // Normalize: strip leading slash for comparison
  const normalizedRoute = path.replace(/^\//, '');

  // Sidebar items
  document.querySelectorAll('#sidebar [data-route]').forEach(item => {
    item.classList.toggle(
      'sidebar__item--active',
      item.dataset.route === normalizedRoute
    );
  });

  // Mobile nav items
  document.querySelectorAll('#mobile-nav [data-route]').forEach(item => {
    item.classList.toggle(
      'mobile-nav__item--active',
      item.dataset.route === normalizedRoute
    );
  });
}

/**
 * Toggle the chat slide panel open/closed.
 */
function toggleChatPanel() {
  const panel = document.getElementById('chat-panel');
  const overlay = document.getElementById('chat-overlay');
  const badge = document.getElementById('chat-badge');

  if (panel) panel.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');

  // Hide badge when opening
  if (panel?.classList.contains('open') && badge) {
    badge.style.display = 'none';
  }
}

/**
 * Toggle mobile sidebar open/closed.
 */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

/**
 * Toggle between dark and light themes.
 */
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', next);

  // Persist
  try { store.updateSettings({ theme: next }); } catch { /* ok */ }

  // Update the toggle button icon
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const icon = btn.querySelector('[data-lucide]');
    if (icon) icon.setAttribute('data-lucide', next === 'dark' ? 'moon' : 'sun');
    refreshIcons();
  }
}

/**
 * Initialise theme from saved settings.
 */
function initTheme() {
  try {
    const settings = store.getSettings();
    const theme = settings?.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    // Update toggle icon
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      const icon = btn.querySelector('[data-lucide]');
      if (icon) icon.setAttribute('data-lucide', theme === 'dark' ? 'moon' : 'sun');
    }
  } catch { /* settings may not be ready */ }
}

/**
 * Process recurring transactions that are due.
 */
function processRecurring() {
  try {
    // Try the store method first
    if (typeof store.processRecurringTransactions === 'function') {
      store.processRecurringTransactions();
      return;
    }

    // Fallback: manually check and process via RecurringManager
    const recurring = store.getRecurringTransactions?.();
    if (!recurring?.length) return;

    const today = new Date().toISOString().split('T')[0];
    for (const r of recurring) {
      if (r.nextDate && r.nextDate <= today && r.active !== false) {
        store.addTransaction({
          date: r.nextDate,
          type: r.type || 'expense',
          amount: r.amount || 0,
          description: r.description || r.name || '',
          categoryId: r.categoryId || '',
          category: r.category || '',
          accountId: r.accountId || '',
          tags: ['recurring'],
          notes: `Auto-generated from recurring: ${r.name || r.description || ''}`,
        });
      }
    }
  } catch { /* recurring not available */ }
}

/**
 * Re-render the current route's view.
 */
function refreshCurrentView() {
  const route = router.getCurrentRoute() || '/dashboard';

  const renderers = {
    '/dashboard': renderDashboard,
    '/transactions': renderTransactions,
    '/budgets': renderBudgets,
    '/goals': renderGoals,
    '/debts': renderDebts,
    '/import': renderImport,
    '/settings': renderSettings,
  };

  const renderer = renderers[route];
  if (renderer) renderer();
  refreshIcons();
}

/**
 * Activate Lucide icons after DOM updates.
 */
function refreshIcons() {
  if (window.lucide) {
    try { lucide.createIcons(); } catch { /* ok */ }
  }
}
