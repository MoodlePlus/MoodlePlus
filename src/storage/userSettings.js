// Persisted user preferences (Design doc 3.1 "UserSettings").
//
// Each setting is stored under its own key (e.g. "settings.darkModeEnabled") so two
// saves that change different settings at the same time can't overwrite each other.

import { get, setMany } from './index.js';

const KEY_PREFIX = 'settings.';

export const CALENDAR_VIEW_MODES = Object.freeze(['day', 'week', 'month']);

/**
 * @typedef {Object} UserSettings
 * @property {boolean} darkModeEnabled
 * @property {'day'|'week'|'month'} calendarViewMode
 * @property {number|null} notificationLeadTime hours before a due date to notify; null = off (stretch, FR-10)
 */

/** @type {Readonly<UserSettings>} */
export const DEFAULT_SETTINGS = Object.freeze({
  darkModeEnabled: false,
  calendarViewMode: 'month',
  notificationLeadTime: null,
});

const VALIDATORS = {
  darkModeEnabled: (value) => typeof value === 'boolean',
  calendarViewMode: (value) => CALENDAR_VIEW_MODES.includes(value),
  notificationLeadTime: (value) => value === null || (Number.isFinite(value) && value >= 0),
};

const SETTING_NAMES = Object.keys(DEFAULT_SETTINGS);

/**
 * Retrieves persisted user settings, falling back to the default for any setting that is
 * missing or holds an invalid value. Always returns a fresh object.
 * @returns {Promise<UserSettings>}
 */
export async function getUserSettings() {
  let stored;
  try {
    stored = await get(SETTING_NAMES.map((name) => KEY_PREFIX + name));
  } catch (err) {
    console.warn('[Moodle+] Could not read settings, using defaults.', err);
    return { ...DEFAULT_SETTINGS };
  }

  const settings = { ...DEFAULT_SETTINGS };
  for (const name of SETTING_NAMES) {
    const value = stored[KEY_PREFIX + name];
    if (VALIDATORS[name](value)) {
      settings[name] = value;
    }
  }
  return settings;
}

/**
 * Persists the given settings. Rejects on unknown or invalid settings, or if the write
 * fails, so callers can revert their UI instead of showing an unsaved state.
 * @param {Partial<UserSettings>} newSettings
 * @returns {Promise<UserSettings>} the full settings after saving
 */
export async function saveUserSettings(newSettings) {
  const items = {};
  for (const [name, value] of Object.entries(newSettings)) {
    if (!(name in VALIDATORS)) {
      throw new TypeError(`Unknown setting: ${name}`);
    }
    if (!VALIDATORS[name](value)) {
      throw new TypeError(`Invalid value for ${name}: ${JSON.stringify(value)}`);
    }
    items[KEY_PREFIX + name] = value;
  }

  await setMany(items);
  return getUserSettings();
}
