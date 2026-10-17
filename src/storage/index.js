// Thin wrapper around browser.storage (via webextension-polyfill) so the rest
// of the extension doesn't need to deal with chrome.* vs browser.* directly.
// All storage access should go through this module.

import browser from 'webextension-polyfill';

/**
 * @param {string|string[]|null} keys a key, list of keys, or null for everything
 * @returns {Promise<Record<string, unknown>>}
 */
export async function get(keys) {
  return browser.storage.local.get(keys);
}

/**
 * @param {string} key
 * @param {unknown} value
 */
export async function set(key, value) {
  return browser.storage.local.set({ [key]: value });
}

/**
 * Writes several keys in one call.
 * @param {Record<string, unknown>} items
 */
export async function setMany(items) {
  return browser.storage.local.set(items);
}

/**
 * @param {string|string[]} keys
 */
export async function remove(keys) {
  return browser.storage.local.remove(keys);
}
