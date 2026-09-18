// Moodle+ background service worker (Manifest V3).
// TODO: wire up messaging between content scripts, the popup, and storage.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Moodle+] Extension installed.');
});
