// Moodle+ popup entry point.

import { getUserSettings, saveUserSettings } from '../storage/userSettings.js';
import { initCalendarView } from './views/calendarView.js';
import { initCalculatorView } from './views/calculatorView.js';

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

function initTabs() {
  const tabs = [...document.querySelectorAll('#tabs [role="tab"]')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      for (const other of tabs) {
        const selected = other === tab;
        other.setAttribute('aria-selected', String(selected));
        other.tabIndex = selected ? 0 : -1;
        document.getElementById(other.getAttribute('aria-controls')).hidden = !selected;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initDarkModeToggle();
  initTabs();
  initCalendarView(document.getElementById('view-calendar'));
  initCalculatorView(document.getElementById('view-calculator'));
});
