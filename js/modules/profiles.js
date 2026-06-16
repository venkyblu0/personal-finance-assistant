/**
 * @module profiles
 * @description Multi-user local profile management. Each profile gets its own
 * isolated localStorage key so financial data is completely separate.
 *
 * Profiles metadata is stored under 'finance_ai_profiles'.
 * Each profile's data is stored under 'finance_ai_data_{profileId}'.
 */

const PROFILES_KEY = 'finance_ai_profiles';

/**
 * Generate a unique profile ID.
 * @returns {string}
 */
function generateProfileId() {
  return 'prof_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
}

/**
 * Hash a PIN using a simple but effective approach.
 * (For local-only use — not a security-critical backend hash.)
 * @param {string} pin
 * @returns {string}
 */
function hashPin(pin) {
  if (!pin) return '';
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Add a salt-like prefix to make it slightly more opaque
  return 'pin_' + Math.abs(hash).toString(36);
}

/**
 * Get all profiles.
 * @returns {{ profiles: Array<Object>, activeProfileId: string|null }}
 */
export function getProfilesData() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        profiles: data.profiles || [],
        activeProfileId: data.activeProfileId || null
      };
    }
  } catch (e) {
    console.error('[Profiles] Failed to load profiles:', e);
  }
  return { profiles: [], activeProfileId: null };
}

/**
 * Save profiles metadata.
 * @param {{ profiles: Array<Object>, activeProfileId: string|null }} data
 */
function saveProfilesData(data) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(data));
}

/**
 * Get all profiles.
 * @returns {Array<Object>}
 */
export function getProfiles() {
  return getProfilesData().profiles;
}

/**
 * Get the currently active profile ID.
 * @returns {string|null}
 */
export function getActiveProfileId() {
  return getProfilesData().activeProfileId;
}

/**
 * Get the storage key for a specific profile's financial data.
 * @param {string} profileId
 * @returns {string}
 */
export function getStorageKeyForProfile(profileId) {
  return `finance_ai_data_${profileId}`;
}

/**
 * Create a new profile.
 * @param {{ name: string, pin?: string, avatar?: string, color?: string }} data
 * @returns {Object} The created profile
 */
export function createProfile(data) {
  const profilesData = getProfilesData();

  const profile = {
    id: generateProfileId(),
    name: data.name || 'User',
    pin: hashPin(data.pin || ''),
    hasPin: !!data.pin,
    avatar: data.avatar || getRandomAvatar(),
    color: data.color || getRandomColor(),
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  profilesData.profiles.push(profile);
  saveProfilesData(profilesData);
  return profile;
}

/**
 * Update a profile.
 * @param {string} id
 * @param {Object} updates
 * @returns {Object|null}
 */
export function updateProfile(id, updates) {
  const profilesData = getProfilesData();
  const idx = profilesData.profiles.findIndex(p => p.id === id);
  if (idx === -1) return null;

  // Handle PIN update specially
  if (updates.pin !== undefined) {
    updates.pin = hashPin(updates.pin);
    updates.hasPin = !!updates.pin;
  }

  Object.assign(profilesData.profiles[idx], updates);
  saveProfilesData(profilesData);
  return profilesData.profiles[idx];
}

/**
 * Delete a profile and its associated financial data.
 * @param {string} id
 * @returns {boolean}
 */
export function deleteProfile(id) {
  const profilesData = getProfilesData();
  const before = profilesData.profiles.length;
  profilesData.profiles = profilesData.profiles.filter(p => p.id !== id);

  if (profilesData.profiles.length < before) {
    // Clear active if this was the active profile
    if (profilesData.activeProfileId === id) {
      profilesData.activeProfileId = null;
    }
    saveProfilesData(profilesData);

    // Remove the profile's financial data
    localStorage.removeItem(getStorageKeyForProfile(id));
    return true;
  }
  return false;
}

/**
 * Set the active profile and update last login time.
 * @param {string} profileId
 */
export function setActiveProfile(profileId) {
  const profilesData = getProfilesData();
  profilesData.activeProfileId = profileId;

  // Update last login
  const profile = profilesData.profiles.find(p => p.id === profileId);
  if (profile) {
    profile.lastLoginAt = new Date().toISOString();
  }

  saveProfilesData(profilesData);
}

/**
 * Verify a PIN against a profile.
 * @param {string} profileId
 * @param {string} enteredPin
 * @returns {boolean}
 */
export function verifyPin(profileId, enteredPin) {
  const profilesData = getProfilesData();
  const profile = profilesData.profiles.find(p => p.id === profileId);
  if (!profile) return false;
  if (!profile.hasPin) return true; // No PIN set, always allow
  return profile.pin === hashPin(enteredPin);
}

/**
 * Check if any profiles exist (first launch detection).
 * @returns {boolean}
 */
export function hasProfiles() {
  return getProfiles().length > 0;
}

/**
 * Migrate legacy data: if there's data under the old 'finance_ai_data' key
 * but no profiles exist, create a default profile and move the data.
 * @returns {string|null} The migrated profile ID, or null if no migration needed.
 */
export function migrateLegacyData() {
  const oldData = localStorage.getItem('finance_ai_data');
  if (!oldData || hasProfiles()) return null;

  // Create a default profile
  const profile = createProfile({ name: 'My Account' });

  // Move data to the new key
  localStorage.setItem(getStorageKeyForProfile(profile.id), oldData);

  // Set as active
  setActiveProfile(profile.id);

  // Remove old key
  localStorage.removeItem('finance_ai_data');

  return profile.id;
}

// --- Avatar & Color helpers ---

const AVATARS = ['😊', '🧑‍💼', '👤', '🦊', '🐱', '🌟', '💎', '🔥', '🚀', '🎯', '🏦', '💰', '📊', '🧮', '👨‍💻', '👩‍💻'];
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#f97316', '#84cc16'];

function getRandomAvatar() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export { AVATARS, COLORS };
