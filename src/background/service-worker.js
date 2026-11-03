// Moodle+ background script (Manifest V3). Runs as a service worker in Chrome and as a
// background script in Firefox (see the {{chrome}}/{{firefox}} keys in manifest.json).
//
// It has very little to do on purpose: the content scripts, popup and on-page overlay
// all share data through browser.storage (src/storage/), and react to each other's
// changes with storage.onChanged, so no message passing through here is needed.

import browser from 'webextension-polyfill';

browser.runtime.onInstalled.addListener(() => {
  console.log('[Moodle+] Extension installed.');
});
