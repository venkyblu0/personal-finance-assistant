/**
 * Settings View
 * App configuration: profile, AI settings, data management, appearance.
 */

import { store } from '../store.js';
import { escapeHtml, debounce, downloadJSON, readFile } from '../utils/helpers.js';
import { showToast, showConfirmModal } from './components.js';
import { openRouterClient } from '../ai/openrouter.js';

/** List of supported OpenRouter models */
const MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
];

/**
 * Render the settings page.
 */
export function renderSettings() {
  const container = document.getElementById('main-content');
  if (!container) return;

  const settings = safeCall(() => store.getSettings()) || {};

  const modelOptions = MODELS.map(m =>
    `<option value="${m.id}" ${settings.preferredModel === m.id ? 'selected' : ''}>${m.name} (${m.id})</option>`
  ).join('');

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

  container.innerHTML = `
    <div class="settings-page" style="max-width:720px;margin:0 auto">
      <div style="margin-bottom:1.5rem">
        <h1 style="margin:0;font-size:1.75rem;color:var(--text-primary)">Settings</h1>
        <p style="margin:0.25rem 0 0;color:var(--text-muted);font-size:0.875rem">Configure your FinanceAI experience</p>
      </div>

      <!-- Profile -->
      <div class="card card--glass" style="margin-bottom:1.25rem">
        <div class="card__header">
          <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
            <i data-lucide="user" style="width:18px;height:18px;vertical-align:text-bottom"></i>
            Profile
          </h3>
        </div>
        <div class="card__body grid grid-2 gap-md" style="padding:1.25rem">
          <div class="form-group" style="margin:0">
            <label class="form-label">Your Name</label>
            <input type="text" class="form-input setting-input" data-key="userName"
                   value="${escapeHtml(settings.userName || '')}" placeholder="Enter your name">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Currency</label>
            <select class="form-select setting-input" data-key="currency">
              <option value="INR" ${settings.currency === 'INR' || !settings.currency ? 'selected' : ''}>₹ INR (Indian Rupee)</option>
              <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>$ USD (US Dollar)</option>
              <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>€ EUR (Euro)</option>
              <option value="GBP" ${settings.currency === 'GBP' ? 'selected' : ''}>£ GBP (British Pound)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- AI Settings -->
      <div class="card card--glass" style="margin-bottom:1.25rem">
        <div class="card__header">
          <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
            <i data-lucide="bot" style="width:18px;height:18px;vertical-align:text-bottom"></i>
            AI Settings
          </h3>
        </div>
        <div class="card__body flex flex-col gap-md" style="padding:1.25rem">
          <div class="form-group" style="margin:0">
            <label class="form-label">OpenRouter API Key</label>
            <div style="position:relative">
              <input type="password" class="form-input setting-input" data-key="openRouterApiKey"
                     id="api-key-input"
                     value="${escapeHtml(settings.openRouterApiKey || '')}"
                     placeholder="sk-or-v1-..."
                     style="padding-right:80px">
              <button class="btn btn--ghost btn--sm" id="toggle-key-btn"
                      style="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:0.75rem">
                <i data-lucide="eye" style="width:14px;height:14px"></i> Show
              </button>
            </div>
            <p style="margin:0.35rem 0 0;font-size:0.75rem;color:var(--text-muted)">
              Get your key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" style="color:var(--accent-primary)">openrouter.ai/keys</a>
            </p>
          </div>

          <div class="form-group" style="margin:0">
            <label class="form-label">Preferred Model</label>
            <select class="form-select setting-input" data-key="preferredModel" id="model-select">
              ${modelOptions}
            </select>
          </div>

          <button class="btn btn--outline btn--sm" id="test-connection-btn" style="align-self:flex-start">
            <i data-lucide="zap" style="width:14px;height:14px"></i> Test Connection
          </button>
          <div id="connection-status" style="font-size:0.85rem"></div>
        </div>
      </div>

      <!-- Data Management -->
      <div class="card card--glass" style="margin-bottom:1.25rem">
        <div class="card__header">
          <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
            <i data-lucide="database" style="width:18px;height:18px;vertical-align:text-bottom"></i>
            Data Management
          </h3>
        </div>
        <div class="card__body flex flex-col gap-md" style="padding:1.25rem">
          <div class="flex gap-sm" style="flex-wrap:wrap">
            <button class="btn btn--outline btn--sm" id="export-data-btn">
              <i data-lucide="download" style="width:14px;height:14px"></i> Export Data (JSON)
            </button>
            <label class="btn btn--outline btn--sm" style="cursor:pointer;margin:0">
              <i data-lucide="upload" style="width:14px;height:14px"></i> Import Data
              <input type="file" accept=".json" id="import-data-input" style="display:none">
            </label>
          </div>
          <hr style="border:none;border-top:1px solid var(--border-color);margin:0.5rem 0">
          <button class="btn btn--danger btn--sm" id="clear-data-btn" style="align-self:flex-start">
            <i data-lucide="trash-2" style="width:14px;height:14px"></i> Clear All Data
          </button>
          <p style="margin:0;font-size:0.75rem;color:var(--text-muted)">⚠️ This permanently deletes all transactions, budgets, goals, and settings.</p>
        </div>
      </div>

      <!-- Appearance -->
      <div class="card card--glass" style="margin-bottom:1.25rem">
        <div class="card__header">
          <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
            <i data-lucide="palette" style="width:18px;height:18px;vertical-align:text-bottom"></i>
            Appearance
          </h3>
        </div>
        <div class="card__body grid grid-3 gap-md" style="padding:1.25rem">
          <div class="form-group" style="margin:0">
            <label class="form-label">Theme</label>
            <select class="form-select" id="theme-select">
              <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark</option>
              <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Date Format</label>
            <select class="form-select setting-input" data-key="dateFormat">
              <option value="DD/MM/YYYY" ${settings.dateFormat === 'DD/MM/YYYY' || !settings.dateFormat ? 'selected' : ''}>DD/MM/YYYY</option>
              <option value="MM/DD/YYYY" ${settings.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
              <option value="YYYY-MM-DD" ${settings.dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Month Start Day</label>
            <select class="form-select setting-input" data-key="monthStartDay">
              <option value="1" ${(settings.monthStartDay || 1) === 1 ? 'selected' : ''}>1st</option>
              <option value="25" ${settings.monthStartDay === 25 ? 'selected' : ''}>25th</option>
              <option value="26" ${settings.monthStartDay === 26 ? 'selected' : ''}>26th</option>
              <option value="28" ${settings.monthStartDay === 28 ? 'selected' : ''}>28th</option>
            </select>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="card card--glass">
        <div class="card__body" style="padding:1.25rem;text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:var(--accent-primary);margin-bottom:0.25rem">
            <i data-lucide="sparkles" style="width:20px;height:20px;vertical-align:text-bottom"></i> FinanceAI
          </div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem">Version 1.0.0</div>
          <p style="font-size:0.8rem;color:var(--text-secondary);margin:0;max-width:400px;margin:0 auto;line-height:1.5">
            Your intelligent personal finance assistant. Track expenses, manage budgets, achieve savings goals,
            and get AI-powered financial advice — all in one place.
          </p>
        </div>
      </div>
    </div>
  `;

  // --- Event Listeners ---

  // Auto-save settings on change (debounced)
  const debouncedSave = debounce((key, value) => {
    store.updateSettings({ [key]: value });

    // Also update the live OpenRouter client
    if (key === 'openRouterApiKey') openRouterClient.setApiKey(value);
    if (key === 'preferredModel') openRouterClient.setModel(value);
  }, 500);

  container.querySelectorAll('.setting-input').forEach(el => {
    const event = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(event, () => {
      debouncedSave(el.dataset.key, el.value);
    });
  });

  // Toggle API key visibility
  container.querySelector('#toggle-key-btn')?.addEventListener('click', () => {
    const input = document.getElementById('api-key-input');
    const btn = document.getElementById('toggle-key-btn');
    if (input && btn) {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}" style="width:14px;height:14px"></i> ${isPassword ? 'Hide' : 'Show'}`;
      if (window.lucide) lucide.createIcons();
    }
  });

  // Test connection
  container.querySelector('#test-connection-btn')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--text-muted)">Testing…</span>';

    // Apply current input values before testing
    const keyInput = document.getElementById('api-key-input');
    const modelSelect = document.getElementById('model-select');
    if (keyInput) openRouterClient.setApiKey(keyInput.value);
    if (modelSelect) openRouterClient.setModel(modelSelect.value);

    const result = await openRouterClient.testConnection();
    if (statusEl) {
      statusEl.innerHTML = result.ok
        ? `<span style="color:var(--accent-success)">✅ ${escapeHtml(result.message)}</span>`
        : `<span style="color:var(--accent-danger)">❌ ${escapeHtml(result.message)}</span>`;
    }
  });

  // Theme select
  container.querySelector('#theme-select')?.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
    store.updateSettings({ theme: e.target.value });
  });

  // Export data
  container.querySelector('#export-data-btn')?.addEventListener('click', () => {
    try {
      const data = store.exportData();
      downloadJSON(data, `financeai-backup-${new Date().toISOString().split('T')[0]}.json`);
      showToast('Data exported successfully!', 'success');
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error');
    }
  });

  // Import data
  container.querySelector('#import-data-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await readFile(file);
      showConfirmModal(
        `Import data from "${file.name}"? This will merge with or replace your existing data.`,
        () => {
          try {
            store.importData(text);
            showToast('Data imported successfully!', 'success');
            renderSettings(); // refresh
            window.dispatchEvent(new CustomEvent('store-updated'));
          } catch (err) {
            showToast('Import failed: ' + err.message, 'error');
          }
        }
      );
    } catch (err) {
      showToast('Could not read file: ' + err.message, 'error');
    }

    // Reset file input
    e.target.value = '';
  });

  // Clear all data
  container.querySelector('#clear-data-btn')?.addEventListener('click', () => {
    showConfirmModal(
      'This will permanently delete ALL your data — transactions, budgets, goals, debts, and settings. This action cannot be undone. Are you sure?',
      () => {
        try {
          localStorage.clear();
          showToast('All data cleared. Refreshing…', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
          showToast('Failed to clear data: ' + e.message, 'error');
        }
      }
    );
  });

  if (window.lucide) lucide.createIcons();
}

function safeCall(fn) {
  try { return fn(); } catch { return undefined; }
}
