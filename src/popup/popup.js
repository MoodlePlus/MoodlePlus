// Moodle+ popup entry point.
// TODO: wire up popup UI - calendar view, grade calculator entry point.

import { getUserSettings, saveUserSettings } from '../storage/userSettings.js';

function applyDarkMode(enabled) {
  document.body.classList.toggle('dark', enabled);
}

async function initDarkModeToggle() {
  const toggle = document.getElementById('dark-mode-toggle');

  const { darkModeEnabled } = await getUserSettings();
  toggle.checked = darkModeEnabled;
  applyDarkMode(darkModeEnabled);

  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    applyDarkMode(enabled);
    try {
      await saveUserSettings({ darkModeEnabled: enabled });
    } catch (err) {
      // Revert so the toggle never shows a state that wasn't saved.
      console.error('[Moodle+] Could not save dark mode setting.', err);
      toggle.checked = !enabled;
      applyDarkMode(!enabled);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initDarkModeToggle();
});
