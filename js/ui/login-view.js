/**
 * @module login-view
 * @description Renders the login/profile selection screen and handles
 * profile creation, selection, and PIN verification.
 */

import {
  getProfiles,
  createProfile,
  deleteProfile,
  setActiveProfile,
  verifyPin,
  migrateLegacyData,
  hasProfiles,
  AVATARS,
  COLORS
} from '../modules/profiles.js';

/**
 * Check if user needs to see the login screen.
 * @returns {boolean}
 */
export function needsLogin() {
  // Migrate legacy data if needed
  migrateLegacyData();
  // If no profiles exist, show create screen
  // If profiles exist, show selection screen
  return true; // Always show login on fresh load
}

/**
 * Render the login/profile selection screen.
 * @param {Function} onLogin - Callback when a profile is selected. Receives profileId.
 */
export function renderLoginScreen(onLogin) {
  const profiles = getProfiles();
  const app = document.getElementById('app');
  const mobileNav = document.getElementById('mobile-nav');

  // Hide main app chrome
  if (app) app.style.display = 'none';
  if (mobileNav) mobileNav.style.display = 'none';

  // Create login overlay
  let loginEl = document.getElementById('login-screen');
  if (!loginEl) {
    loginEl = document.createElement('div');
    loginEl.id = 'login-screen';
    document.body.appendChild(loginEl);
  }

  if (profiles.length === 0) {
    renderCreateFirstProfile(loginEl, onLogin);
  } else {
    renderProfileSelection(loginEl, profiles, onLogin);
  }
}

/**
 * Remove the login screen and show the app.
 */
export function hideLoginScreen() {
  const loginEl = document.getElementById('login-screen');
  if (loginEl) {
    loginEl.classList.add('login-screen--exit');
    setTimeout(() => loginEl.remove(), 400);
  }

  const app = document.getElementById('app');
  const mobileNav = document.getElementById('mobile-nav');
  if (app) app.style.display = '';
  if (mobileNav) mobileNav.style.display = '';
}

// ---------- Profile Selection ----------

function renderProfileSelection(container, profiles, onLogin) {
  const profileCards = profiles.map(p => `
    <div class="login-profile-card" data-profile-id="${p.id}">
      <button class="login-profile-delete" data-delete-id="${p.id}" title="Delete profile">
        <i data-lucide="x" style="width:14px;height:14px"></i>
      </button>
      <div class="login-profile-avatar" style="background:${p.color}20; border-color:${p.color}">
        <span>${p.avatar || '👤'}</span>
      </div>
      <div class="login-profile-name">${escapeHtml(p.name)}</div>
      ${p.hasPin ? '<div class="login-profile-lock"><i data-lucide="lock" style="width:12px;height:12px"></i> PIN protected</div>' : ''}
    </div>
  `).join('');

  container.innerHTML = `
    <div class="login-screen">
      <div class="login-container">
        <div class="login-header">
          <div class="login-logo">💰</div>
          <h1 class="login-title">FinanceAI</h1>
          <p class="login-subtitle">Choose your profile to continue</p>
        </div>

        <div class="login-profiles-grid">
          ${profileCards}
          <div class="login-profile-card login-profile-card--add" id="add-profile-card">
            <div class="login-profile-avatar login-profile-avatar--add">
              <i data-lucide="plus" style="width:28px;height:28px;color:var(--accent-primary)"></i>
            </div>
            <div class="login-profile-name">New Profile</div>
          </div>
        </div>

        <!-- PIN entry (hidden by default) -->
        <div id="pin-entry" class="login-pin-entry" style="display:none">
          <div class="login-pin-back" id="pin-back">
            <i data-lucide="arrow-left" style="width:18px;height:18px"></i>
            Back
          </div>
          <div class="login-pin-avatar" id="pin-avatar"></div>
          <p class="login-pin-label">Enter PIN for <strong id="pin-name"></strong></p>
          <div class="login-pin-dots" id="pin-dots">
            <span></span><span></span><span></span><span></span>
          </div>
          <div class="login-pin-keypad" id="pin-keypad">
            ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k =>
              k === '' ? '<button class="login-key login-key--empty" disabled></button>'
              : k === '⌫' ? '<button class="login-key login-key--backspace" data-key="backspace"><i data-lucide="delete" style="width:20px;height:20px"></i></button>'
              : `<button class="login-key" data-key="${k}">${k}</button>`
            ).join('')}
          </div>
          <p id="pin-error" class="login-pin-error" style="display:none">Incorrect PIN. Try again.</p>
        </div>
      </div>
    </div>
  `;

  // Init icons
  if (window.lucide) lucide.createIcons();

  // --- Event handlers ---
  const profilesGrid = container.querySelector('.login-profiles-grid');
  const pinEntry = container.querySelector('#pin-entry');
  let selectedProfileId = null;
  let enteredPin = '';

  // Profile card click
  profilesGrid.addEventListener('click', (e) => {
    // Check if delete button clicked
    const deleteBtn = e.target.closest('[data-delete-id]');
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.dataset.deleteId;
      const profile = profiles.find(p => p.id === id);
      if (confirm(`Delete profile "${profile?.name}"? All financial data for this profile will be permanently lost.`)) {
        deleteProfile(id);
        renderProfileSelection(container, getProfiles(), onLogin);
      }
      return;
    }

    // Add new profile
    if (e.target.closest('#add-profile-card')) {
      renderCreateProfile(container, onLogin, true);
      return;
    }

    // Select profile
    const card = e.target.closest('[data-profile-id]');
    if (!card) return;

    selectedProfileId = card.dataset.profileId;
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) return;

    if (profile.hasPin) {
      // Show PIN entry
      showPinEntry(profile);
    } else {
      // No PIN, login directly
      loginWithProfile(selectedProfileId, onLogin);
    }
  });

  // PIN entry
  function showPinEntry(profile) {
    pinEntry.style.display = '';
    profilesGrid.style.display = 'none';
    container.querySelector('.login-subtitle').style.display = 'none';
    enteredPin = '';
    updatePinDots();

    const avatar = container.querySelector('#pin-avatar');
    avatar.innerHTML = `<div class="login-profile-avatar" style="background:${profile.color}20; border-color:${profile.color};width:64px;height:64px;font-size:28px"><span>${profile.avatar}</span></div>`;
    container.querySelector('#pin-name').textContent = profile.name;
    container.querySelector('#pin-error').style.display = 'none';

    if (window.lucide) lucide.createIcons();
  }

  // PIN back button
  container.querySelector('#pin-back')?.addEventListener('click', () => {
    pinEntry.style.display = 'none';
    profilesGrid.style.display = '';
    container.querySelector('.login-subtitle').style.display = '';
    selectedProfileId = null;
    enteredPin = '';
  });

  // PIN keypad
  container.querySelector('#pin-keypad')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-key]');
    if (!btn) return;

    const key = btn.dataset.key;

    if (key === 'backspace') {
      enteredPin = enteredPin.slice(0, -1);
    } else if (enteredPin.length < 4) {
      enteredPin += key;
    }

    updatePinDots();

    // Auto-submit when 4 digits entered
    if (enteredPin.length === 4) {
      setTimeout(() => {
        if (verifyPin(selectedProfileId, enteredPin)) {
          loginWithProfile(selectedProfileId, onLogin);
        } else {
          container.querySelector('#pin-error').style.display = '';
          enteredPin = '';
          updatePinDots();
          // Shake animation
          const dots = container.querySelector('#pin-dots');
          dots.classList.add('shake');
          setTimeout(() => dots.classList.remove('shake'), 500);
        }
      }, 200);
    }
  });

  function updatePinDots() {
    const dots = container.querySelectorAll('#pin-dots span');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < enteredPin.length);
    });
  }
}

// ---------- Create Profile ----------

function renderCreateFirstProfile(container, onLogin) {
  renderCreateProfile(container, onLogin, false);
}

function renderCreateProfile(container, onLogin, showBack = false) {
  const selectedAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const selectedColor = COLORS[Math.floor(Math.random() * COLORS.length)];

  container.innerHTML = `
    <div class="login-screen">
      <div class="login-container">
        ${showBack ? `
          <div class="login-pin-back" id="create-back">
            <i data-lucide="arrow-left" style="width:18px;height:18px"></i>
            Back
          </div>
        ` : ''}
        <div class="login-header">
          <div class="login-logo">💰</div>
          <h1 class="login-title">${showBack ? 'New Profile' : 'Welcome to FinanceAI'}</h1>
          <p class="login-subtitle">${showBack ? 'Create a new profile' : 'Let\'s set up your profile to get started'}</p>
        </div>

        <div class="login-create-form">
          <!-- Avatar selector -->
          <div class="login-avatar-section">
            <div class="login-profile-avatar login-profile-avatar--large" id="selected-avatar" style="background:${selectedColor}20; border-color:${selectedColor}">
              <span>${selectedAvatar}</span>
            </div>
            <div class="login-avatar-grid" id="avatar-grid">
              ${AVATARS.map(a => `
                <button class="login-avatar-option ${a === selectedAvatar ? 'login-avatar-option--active' : ''}" data-avatar="${a}">${a}</button>
              `).join('')}
            </div>
          </div>

          <!-- Name input -->
          <div class="form-group">
            <label class="form-label">Your Name</label>
            <input type="text" id="profile-name" class="form-input" placeholder="Enter your name" autofocus maxlength="30">
          </div>

          <!-- Color picker -->
          <div class="form-group">
            <label class="form-label">Profile Color</label>
            <div class="login-color-grid" id="color-grid">
              ${COLORS.map(c => `
                <button class="login-color-option ${c === selectedColor ? 'login-color-option--active' : ''}" data-color="${c}" style="background:${c}"></button>
              `).join('')}
            </div>
          </div>

          <!-- PIN (optional) -->
          <div class="form-group">
            <label class="form-label">PIN Lock <span class="text-muted">(optional, 4 digits)</span></label>
            <input type="password" id="profile-pin" class="form-input" placeholder="Enter 4-digit PIN" maxlength="4" inputmode="numeric" pattern="[0-9]*">
          </div>

          <!-- Create button -->
          <button id="create-profile-btn" class="btn btn--primary btn--lg login-create-btn">
            <i data-lucide="user-plus" style="width:18px;height:18px"></i>
            <span>${showBack ? 'Create Profile' : 'Get Started'}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  // State
  let currentAvatar = selectedAvatar;
  let currentColor = selectedColor;

  // Back button
  if (showBack) {
    container.querySelector('#create-back')?.addEventListener('click', () => {
      renderProfileSelection(container, getProfiles(), onLogin);
    });
  }

  // Avatar selection
  container.querySelector('#avatar-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-avatar]');
    if (!btn) return;

    currentAvatar = btn.dataset.avatar;
    container.querySelectorAll('.login-avatar-option').forEach(b => b.classList.remove('login-avatar-option--active'));
    btn.classList.add('login-avatar-option--active');

    const preview = container.querySelector('#selected-avatar span');
    if (preview) preview.textContent = currentAvatar;
  });

  // Color selection
  container.querySelector('#color-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-color]');
    if (!btn) return;

    currentColor = btn.dataset.color;
    container.querySelectorAll('.login-color-option').forEach(b => b.classList.remove('login-color-option--active'));
    btn.classList.add('login-color-option--active');

    const avatarEl = container.querySelector('#selected-avatar');
    if (avatarEl) {
      avatarEl.style.background = `${currentColor}20`;
      avatarEl.style.borderColor = currentColor;
    }
  });

  // PIN validation — only digits
  const pinInput = container.querySelector('#profile-pin');
  if (pinInput) {
    pinInput.addEventListener('input', () => {
      pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
    });
  }

  // Create profile
  container.querySelector('#create-profile-btn')?.addEventListener('click', () => {
    const name = container.querySelector('#profile-name')?.value.trim();
    const pin = container.querySelector('#profile-pin')?.value.trim();

    if (!name) {
      container.querySelector('#profile-name')?.focus();
      container.querySelector('#profile-name')?.classList.add('form-input--error');
      return;
    }

    if (pin && pin.length !== 4) {
      container.querySelector('#profile-pin')?.focus();
      container.querySelector('#profile-pin')?.classList.add('form-input--error');
      return;
    }

    const profile = createProfile({
      name,
      pin: pin || '',
      avatar: currentAvatar,
      color: currentColor
    });

    loginWithProfile(profile.id, onLogin);
  });

  // Enter key on name input
  container.querySelector('#profile-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      container.querySelector('#create-profile-btn')?.click();
    }
  });
}

// ---------- Login action ----------

function loginWithProfile(profileId, onLogin) {
  setActiveProfile(profileId);
  onLogin(profileId);
}

// ---------- Helper ----------

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
