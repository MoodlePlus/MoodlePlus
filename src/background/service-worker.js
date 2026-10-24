// Moodle+ background script (Manifest V3). Runs as a service worker in Chrome and as a
// background script in Firefox (see the {{chrome}}/{{firefox}} keys in manifest.json).
// TODO: wire up messaging between content scripts, the popup, and storage.

import browser from 'webextension-polyfill';

browser.runtime.onInstalled.addListener(() => {
  console.log('[Moodle+] Extension installed.');
});
