// Dark-mode toggle wiring shared by the popup and the on-page overlay. Same
// optimistic-apply/persist/revert-on-failure pattern either way; the only difference
// between contexts is *what* gets the "dark" class toggled on it (document.body for the
// popup, the overlay's shadow host for the overlay - see themeRoot below).

import { getUserSettings, saveUserSettings } from '../storage/userSettings.js';

/**
 * @param {ParentNode} root where to find the #dark-mode-toggle checkbox
 * @param {HTMLElement} themeRoot the element whose "dark" class actually drives the theme
 *   (document.body in the popup; the shadow host element in the overlay, since :root/body
 *   selectors don't reach inside a shadow tree)
 */
export async function initDarkModeToggle(root, themeRoot) {
  const toggle = root.querySelector('#dark-mode-toggle');
  if (!toggle) return;

  const applyDarkMode = (enabled) => themeRoot.classList.toggle('dark', enabled);

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
