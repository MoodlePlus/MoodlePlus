// Thin wrapper around browser.storage (via webextension-polyfill) so the rest
// of the extension doesn't need to deal with chrome.* vs browser.* directly.
// TODO: implement get/set/remove helpers and a schema for settings + cached data.

import browser from 'webextension-polyfill';

export async function get(key) {
  // TODO: implement
  return browser.storage.local.get(key);
}

export async function set(key, value) {
  // TODO: implement
  return browser.storage.local.set({ [key]: value });
}
