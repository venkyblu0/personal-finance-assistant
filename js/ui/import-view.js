/**
 * Import View
 * CSV file import with drag-and-drop, column mapping, preview, and import execution.
 */

import { store } from '../store.js';
import { formatCurrency, formatDateInput } from '../utils/formatters.js';
import { escapeHtml } from '../utils/helpers.js';
import { showToast, renderEmptyState } from './components.js';

/** Parsed CSV data state */
let csvRows = [];
let csvHeaders = [];
let columnMapping = {};
let importedFile = null;

/**
 * Render the CSV import page.
 */
export function renderImport() {
  const container = document.getElementById('main-content');
  if (!container) return;

  // Reset state
  csvRows = [];
  csvHeaders = [];
  columnMapping = {};
  importedFile = null;

  const accounts = safeCall(() => store.getAccounts()) || [];
  const categories = safeCall(() => store.getCategories()) || [];

  const accountOpts = accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  const categoryOpts = categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  container.innerHTML = `
    <div class="import-page" style="max-width:900px;margin:0 auto">
      <div style="margin-bottom:1.5rem">
        <h1 style="margin:0;font-size:1.75rem;color:var(--text-primary)">Import Transactions</h1>
        <p style="margin:0.25rem 0 0;color:var(--text-muted);font-size:0.875rem">Import transactions from a CSV file</p>
      </div>

      <!-- Drop Zone -->
      <div id="drop-zone" class="card card--glass" style="margin-bottom:1.25rem;cursor:pointer;transition:border-color 0.2s ease">
        <div class="card__body" style="padding:3rem;text-align:center;border:2px dashed var(--border-color);border-radius:12px;transition:border-color 0.2s ease,background 0.2s ease">
          <i data-lucide="upload-cloud" style="width:48px;height:48px;color:var(--accent-primary);margin-bottom:1rem"></i>
          <h3 style="margin:0 0 0.5rem;color:var(--text-primary)">Drop your CSV file here</h3>
          <p style="margin:0;color:var(--text-muted);font-size:0.875rem">or click to browse</p>
          <p style="margin:0.5rem 0 0;color:var(--text-muted);font-size:0.75rem">Supports CSV files from most banks and apps</p>
          <input type="file" accept=".csv,.txt" id="csv-file-input" style="display:none">
        </div>
      </div>

      <!-- Column Mapping (hidden initially) -->
      <div id="mapping-section" style="display:none">
        <div class="card card--glass" style="margin-bottom:1.25rem">
          <div class="card__header flex items-center justify-between">
            <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
              <i data-lucide="columns" style="width:18px;height:18px;vertical-align:text-bottom"></i>
              Column Mapping
            </h3>
            <span style="color:var(--text-muted);font-size:0.8rem" id="file-name-display"></span>
          </div>
          <div class="card__body" style="overflow-x:auto;padding:1rem">
            <!-- Preview table -->
            <div class="table-container" id="preview-table-container"></div>
          </div>
        </div>

        <!-- Import Options -->
        <div class="card card--glass" style="margin-bottom:1.25rem">
          <div class="card__header">
            <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
              <i data-lucide="settings" style="width:18px;height:18px;vertical-align:text-bottom"></i>
              Import Options
            </h3>
          </div>
          <div class="card__body grid grid-2 gap-md" style="padding:1.25rem">
            <div class="form-group" style="margin:0">
              <label class="form-label">Default Account</label>
              <select class="form-select" id="import-account">
                <option value="">None</option>
                ${accountOpts}
              </select>
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label">Default Category</label>
              <select class="form-select" id="import-category">
                <option value="">None (auto-detect)</option>
                ${categoryOpts}
              </select>
            </div>
          </div>
        </div>

        <!-- Preview & Import -->
        <div class="card card--glass" style="margin-bottom:1.25rem">
          <div class="card__header flex items-center justify-between">
            <h3 style="margin:0;font-size:1rem;color:var(--text-primary)">
              <i data-lucide="eye" style="width:18px;height:18px;vertical-align:text-bottom"></i>
              Preview
            </h3>
            <span style="color:var(--text-muted);font-size:0.85rem" id="preview-count"></span>
          </div>
          <div class="card__body" style="padding:0" id="parsed-preview">
            <!-- Parsed transactions preview -->
          </div>
          <div class="card__footer flex items-center justify-between" style="padding:1rem 1.25rem;border-top:1px solid var(--border-color)">
            <span style="font-size:0.85rem;color:var(--text-muted)" id="duplicate-warning"></span>
            <button class="btn btn--primary" id="import-btn">
              <i data-lucide="download" style="width:16px;height:16px"></i> Import Transactions
            </button>
          </div>
        </div>

        <!-- Results (hidden initially) -->
        <div id="import-results" style="display:none" class="card card--glass">
          <div class="card__body" style="text-align:center;padding:2rem">
          </div>
        </div>
      </div>
    </div>
  `;

  // --- Drop Zone Events ---
  const dropZone = container.querySelector('#drop-zone');
  const fileInput = container.querySelector('#csv-file-input');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.querySelector('.card__body').style.borderColor = 'var(--accent-primary)';
      dropZone.querySelector('.card__body').style.background = 'var(--accent-primary)08';
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.querySelector('.card__body').style.borderColor = 'var(--border-color)';
      dropZone.querySelector('.card__body').style.background = '';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.querySelector('.card__body').style.borderColor = 'var(--border-color)';
      dropZone.querySelector('.card__body').style.background = '';
      const file = e.dataTransfer?.files?.[0];
      if (file) processFile(file);
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    });
  }

  // Import button
  container.querySelector('#import-btn')?.addEventListener('click', executeImport);

  if (window.lucide) lucide.createIcons();
}

/**
 * Read and parse a CSV file.
 */
function processFile(file) {
  importedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text !== 'string') return;

    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      showToast('File appears empty or has no data rows.', 'warning');
      return;
    }

    csvHeaders = parseCSVLine(lines[0]);
    csvRows = lines.slice(1).map(l => parseCSVLine(l)).filter(r => r.length === csvHeaders.length);

    // Auto-detect column mapping
    columnMapping = autoDetectColumns(csvHeaders);

    // Show mapping section
    const section = document.getElementById('mapping-section');
    if (section) section.style.display = '';

    const fileDisplay = document.getElementById('file-name-display');
    if (fileDisplay) fileDisplay.textContent = `${file.name} (${csvRows.length} rows)`;

    renderPreviewTable();
    renderParsedPreview();
  };

  reader.onerror = () => {
    showToast('Failed to read file.', 'error');
  };

  reader.readAsText(file);
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Try to auto-detect which columns map to Date, Amount, Description, Type.
 */
function autoDetectColumns(headers) {
  const mapping = {};
  const lowerHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z]/g, ''));

  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    if (!mapping.date && (h.includes('date') || h.includes('time'))) mapping.date = i;
    else if (!mapping.amount && (h.includes('amount') || h.includes('sum') || h.includes('debit') || h.includes('value'))) mapping.amount = i;
    else if (!mapping.description && (h.includes('desc') || h.includes('narration') || h.includes('particular') || h.includes('remark') || h.includes('memo'))) mapping.description = i;
    else if (!mapping.type && (h.includes('type') || h.includes('credit') || h.includes('mode'))) mapping.type = i;
  }

  return mapping;
}

/**
 * Render the preview table with column mapping dropdowns.
 */
function renderPreviewTable() {
  const tableContainer = document.getElementById('preview-table-container');
  if (!tableContainer) return;

  const mappingOptions = ['skip', 'date', 'amount', 'description', 'type'];
  const previewRows = csvRows.slice(0, 5);

  let html = '<table class="table" style="font-size:0.8rem;width:100%">';

  // Mapping dropdowns row
  html += '<thead><tr>';
  for (let i = 0; i < csvHeaders.length; i++) {
    const currentMap = Object.entries(columnMapping).find(([, idx]) => idx === i)?.[0] || 'skip';
    html += `<th style="padding:0.5rem">
      <select class="form-select column-map-select" data-col="${i}" style="font-size:0.75rem;padding:0.25rem;min-width:100px">
        ${mappingOptions.map(opt => `<option value="${opt}" ${currentMap === opt ? 'selected' : ''}>${opt.charAt(0).toUpperCase() + opt.slice(1)}</option>`).join('')}
      </select>
    </th>`;
  }
  html += '</tr>';

  // Headers row
  html += '<tr>';
  for (const h of csvHeaders) {
    html += `<th style="padding:0.35rem 0.5rem;color:var(--text-muted);font-weight:500;font-size:0.75rem;border-bottom:1px solid var(--border-color)">${escapeHtml(h)}</th>`;
  }
  html += '</tr></thead>';

  // Data rows
  html += '<tbody>';
  for (const row of previewRows) {
    html += '<tr>';
    for (const cell of row) {
      html += `<td style="padding:0.35rem 0.5rem;color:var(--text-secondary);font-size:0.8rem;border-bottom:1px solid var(--border-color)">${escapeHtml(cell)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  tableContainer.innerHTML = html;

  // Listen for mapping changes
  tableContainer.querySelectorAll('.column-map-select').forEach(sel => {
    sel.addEventListener('change', () => {
      // Rebuild mapping
      columnMapping = {};
      tableContainer.querySelectorAll('.column-map-select').forEach(s => {
        const val = s.value;
        if (val !== 'skip') columnMapping[val] = parseInt(s.dataset.col, 10);
      });
      renderParsedPreview();
    });
  });
}

/**
 * Render the parsed transactions preview based on current column mapping.
 */
function renderParsedPreview() {
  const previewEl = document.getElementById('parsed-preview');
  const countEl = document.getElementById('preview-count');
  if (!previewEl) return;

  const parsed = parseTransactions();
  if (countEl) countEl.textContent = `${parsed.length} transactions`;

  if (!parsed.length) {
    previewEl.innerHTML = '<p style="padding:1.5rem;text-align:center;color:var(--text-muted)">No valid transactions parsed. Check your column mapping.</p>';
    return;
  }

  const preview = parsed.slice(0, 20);
  previewEl.innerHTML = preview.map(t => `
    <div class="transaction-row" style="cursor:default">
      <div class="transaction-row__icon" style="background:${t.type === 'income' ? 'var(--accent-success)' : 'var(--accent-danger)'}15;color:${t.type === 'income' ? 'var(--accent-success)' : 'var(--accent-danger)'}">
        <i data-lucide="${t.type === 'income' ? 'trending-up' : 'trending-down'}" style="width:18px;height:18px"></i>
      </div>
      <div class="transaction-row__details">
        <span class="transaction-row__name">${escapeHtml(t.description || 'No description')}</span>
        <span class="transaction-row__category">${escapeHtml(t.date || 'No date')}</span>
      </div>
      <div class="transaction-row__amount transaction-row__amount--${t.type}">
        ${t.type === 'income' ? '+' : '-'}${formatCurrency(Math.abs(t.amount || 0))}
      </div>
    </div>
  `).join('');

  if (parsed.length > 20) {
    previewEl.innerHTML += `<p style="padding:0.75rem;text-align:center;color:var(--text-muted);font-size:0.8rem">… and ${parsed.length - 20} more</p>`;
  }

  if (window.lucide) lucide.createIcons();
}

/**
 * Parse CSV rows into transaction objects using current column mapping.
 */
function parseTransactions() {
  return csvRows.map(row => {
    const tx = { type: 'expense' };

    if (columnMapping.date !== undefined) tx.date = normalizeDate(row[columnMapping.date]);
    if (columnMapping.amount !== undefined) {
      const raw = row[columnMapping.amount]?.replace(/[^0-9.\-]/g, '');
      tx.amount = parseFloat(raw) || 0;
    }
    if (columnMapping.description !== undefined) tx.description = row[columnMapping.description] || '';
    if (columnMapping.type !== undefined) {
      const typeRaw = (row[columnMapping.type] || '').toLowerCase();
      tx.type = (typeRaw.includes('credit') || typeRaw.includes('income') || typeRaw.includes('cr')) ? 'income' : 'expense';
    }

    // Infer type from amount sign if no type column
    if (columnMapping.type === undefined && tx.amount < 0) {
      tx.type = 'expense';
      tx.amount = Math.abs(tx.amount);
    } else if (columnMapping.type === undefined && tx.amount > 0) {
      // Positive = could be either; keep as expense unless explicitly marked
    }

    return tx;
  }).filter(t => t.amount > 0 || t.description);
}

/**
 * Try to normalise various date formats to YYYY-MM-DD.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  // Try native parse first
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

  // Try DD/MM/YYYY or DD-MM-YYYY
  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match) {
    let [, day, month, year] = match;
    if (year.length === 2) year = '20' + year;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Execute the actual import into the store.
 */
function executeImport() {
  const parsed = parseTransactions();
  if (!parsed.length) {
    showToast('No transactions to import.', 'warning');
    return;
  }

  const defaultAccount = document.getElementById('import-account')?.value || '';
  const defaultCategory = document.getElementById('import-category')?.value || '';

  let imported = 0;
  let skipped = 0;

  for (const tx of parsed) {
    try {
      const data = {
        ...tx,
        accountId: defaultAccount,
        categoryId: defaultCategory,
        tags: ['imported'],
        notes: `Imported from ${importedFile?.name || 'CSV'}`,
      };
      store.addTransaction(data);
      imported++;
    } catch {
      skipped++;
    }
  }

  // Show results
  const resultsEl = document.getElementById('import-results');
  if (resultsEl) {
    resultsEl.style.display = '';
    resultsEl.querySelector('.card__body').innerHTML = `
      <div style="margin-bottom:1rem">
        <i data-lucide="check-circle" style="width:48px;height:48px;color:var(--accent-success)"></i>
      </div>
      <h3 style="margin:0 0 0.5rem;color:var(--text-primary)">Import Complete!</h3>
      <p style="color:var(--text-secondary);margin:0;font-size:0.9rem">
        <strong>${imported}</strong> transactions imported successfully
        ${skipped ? `<br><span style="color:var(--accent-warning)">${skipped} skipped</span>` : ''}
      </p>
      <div class="flex gap-sm" style="margin-top:1rem;justify-content:center">
        <a href="#/transactions" class="btn btn--primary btn--sm">
          <i data-lucide="list" style="width:14px;height:14px"></i> View Transactions
        </a>
        <button class="btn btn--outline btn--sm" id="import-another-btn">
          <i data-lucide="upload" style="width:14px;height:14px"></i> Import Another
        </button>
      </div>
    `;

    resultsEl.querySelector('#import-another-btn')?.addEventListener('click', () => renderImport());
    if (window.lucide) lucide.createIcons();
  }

  showToast(`${imported} transactions imported!`, 'success');
  window.dispatchEvent(new CustomEvent('store-updated'));
}

function safeCall(fn) {
  try { return fn(); } catch { return undefined; }
}
