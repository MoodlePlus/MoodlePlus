// Applies dark mode to the live WolfWare page itself (separate from the overlay panel's
// own theme - see overlay.js). Runs at document_start, before the page paints, so flipping
// the setting doesn't cause a light-then-dark flash on every navigation (Moodle is a
// multi-page app: this runs fresh on every page load, not just once per session).
//
// Technique: inverting <html> with a CSS filter, with media elements exempted. This is a
// deliberate, documented tradeoff, not an oversight: per the CSS spec, a `filter` on an
// ancestor becomes the containing block for descendant `position: fixed` elements, and
// WolfWare's Boost/Boost Union theme uses position:fixed for its nav drawer, sticky
// footer, and Bootstrap modals - those will scroll with the page instead of staying
// pinned while dark mode is on. A fully correct fix means not filter-inverting the whole
// document, which is a much bigger lift than fits here; this still reads clearly as
// "dark mode," just with that one known rough edge.

import { getUserSettings } from '../storage/userSettings.js';
import { onChanged } from '../storage/index.js';

const DARK_CLASS = 'moodleplus-page-dark';
const STYLE_ID = 'moodleplus-page-dark-style';
const SETTINGS_KEY = 'settings.darkModeEnabled';

const STYLE = `
html.${DARK_CLASS} {
  filter: invert(1) hue-rotate(180deg);
  color-scheme: dark; /* native scrollbars/form controls aren't caught by the filter alone */
}
html.${DARK_CLASS} img,
html.${DARK_CLASS} video,
html.${DARK_CLASS} picture,
html.${DARK_CLASS} canvas,
html.${DARK_CLASS} iframe {
  filter: invert(1) hue-rotate(180deg); /* cancels the ancestor invert, so media stays normal */
}
`;

function ensureStyleTag() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  (document.head ?? document.documentElement).appendChild(style);
}

function applyPageDarkMode(enabled) {
  if (enabled) ensureStyleTag();
  document.documentElement.classList.toggle(DARK_CLASS, enabled);
}

async function init() {
  const { darkModeEnabled } = await getUserSettings();
  applyPageDarkMode(darkModeEnabled);

  onChanged((changes) => {
    if (SETTINGS_KEY in changes) {
      applyPageDarkMode(Boolean(changes[SETTINGS_KEY].newValue));
    }
  });
}

init().catch((err) => console.error('[Moodle+] Could not apply page dark mode.', err));
