// Dark mode for the live WolfWare page itself (the overlay panel has its own theme - see
// overlay.js). Driven by the same darkModeEnabled setting as the popup and overlay toggles,
// and kept in sync live across every open tab via storage.onChanged.
//
// How it works (no whole-page filter - that looked harsh and broke position:fixed UI like
// the nav drawer):
//   1. At document_start, before the page paints, a small base stylesheet darkens the page
//      background so there's no white flash on navigation.
//   2. Once the DOM exists, every element's *computed* colors are remapped to a soft dark
//      palette by src/utils/darkPalette.js - already-dark things (NC State red, buttons,
//      images) are left alone. Reading real colors rather than targeting selectors is what
//      lets this work on NC State's private theme, whose CSS we can't see.
//   3. A MutationObserver does the same for anything Moodle adds later (dropdowns, modals,
//      AJAX-loaded rows).
// Remapped values are stored as inline custom properties + a data attribute, and only take
// effect under html.moodleplus-page-dark - so turning dark mode off is just removing that
// one class; nothing has to be undone element by element.

import { getUserSettings } from '../storage/userSettings.js';
import { onChanged } from '../storage/index.js';
import { parseColor, remapBackground, remapBorder, remapText } from '../utils/darkPalette.js';

const DARK_CLASS = 'moodleplus-page-dark';
const STYLE_ID = 'moodleplus-page-dark-style';
const SETTINGS_KEY = 'settings.darkModeEnabled';
const MARK = 'data-mpd'; // tokens: b = background, f = text, r = border

// Media keeps its own colors; our overlay styles itself inside its shadow root.
const SKIP = 'img, video, picture, canvas, iframe, svg, svg *, #moodleplus-overlay-host, script, style, link, meta';

// The page background, plus Moodle's main layout wrappers (plain structural containers,
// never branded) so the content area doesn't flash white before the remap pass runs.
// Their surface shade matches what remapBackground() turns white into.
const STYLE = `
html.${DARK_CLASS} { color-scheme: dark; background-color: hsl(220, 8%, 12%) !important; }
html.${DARK_CLASS} body { background-color: hsl(220, 8%, 12%) !important; color: hsl(220, 4%, 90%); }
html.${DARK_CLASS} :is(#page, #page-wrapper, #topofscroll, #region-main-box) { background-color: hsl(220, 8%, 12%) !important; }
html.${DARK_CLASS} :is(.main-inner, #region-main) { background-color: hsl(220, 8%, 13.8%) !important; }
html.${DARK_CLASS} [${MARK}~="b"] { background-color: var(--mpd-bg) !important; }
html.${DARK_CLASS} [${MARK}~="f"] { color: var(--mpd-fg) !important; }
html.${DARK_CLASS} [${MARK}~="r"] { border-color: var(--mpd-border) !important; }
/* Moodle's small monochrome icon images are dark-gray glyphs that vanish on a dark
   background; lighten just those. Colored activity icons (.activityicon) keep their color. */
html.${DARK_CLASS} img.icon:not(.activityicon) { filter: invert(1) hue-rotate(180deg) brightness(0.9); }
`;

let enabled = false;

function ensureStyleTag() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  (document.head ?? document.documentElement).appendChild(style);
}

/**
 * Remaps every not-yet-processed element. Reads every computed style first, then writes,
 * so the browser recalculates styles once instead of once per element.
 */
function processElements(elements) {
  const updates = [];
  for (const el of elements) {
    if (el.hasAttribute(MARK) || el.matches(SKIP)) continue;
    const style = getComputedStyle(el);
    const bg = remapBackground(parseColor(style.backgroundColor));
    const fg = remapText(parseColor(style.color));
    const hasBorder = parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderBottomWidth) > 0;
    const border = hasBorder ? remapBorder(parseColor(style.borderTopColor)) : null;
    updates.push([el, bg, fg, border]);
  }

  for (const [el, bg, fg, border] of updates) {
    const tokens = [];
    if (bg) {
      el.style.setProperty('--mpd-bg', bg);
      tokens.push('b');
    }
    if (fg) {
      el.style.setProperty('--mpd-fg', fg);
      tokens.push('f');
    }
    if (border) {
      el.style.setProperty('--mpd-border', border);
      tokens.push('r');
    }
    // Mark even when nothing changed, so we never re-read the same element.
    el.setAttribute(MARK, tokens.join(' '));
  }
}

function processSubtree(root) {
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  processElements([root, ...root.querySelectorAll('*')]);
}

// New nodes are collected and processed once per animation frame, not per mutation.
let pending = [];
let flushScheduled = false;
const observer = new MutationObserver((mutations) => {
  if (!enabled) return;
  for (const mutation of mutations) pending.push(...mutation.addedNodes);
  if (flushScheduled || pending.length === 0) return;
  flushScheduled = true;
  requestAnimationFrame(() => {
    flushScheduled = false;
    const nodes = pending;
    pending = [];
    if (enabled) nodes.forEach(processSubtree);
  });
});

function whenDomReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function applyPageDarkMode(on) {
  enabled = on;
  if (on) ensureStyleTag();
  document.documentElement.classList.toggle(DARK_CLASS, on);
  if (on) {
    whenDomReady(() => {
      if (!enabled) return;
      processSubtree(document.body);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
}

async function init() {
  const { darkModeEnabled } = await getUserSettings();
  applyPageDarkMode(darkModeEnabled);

  onChanged((changes) => {
    if (SETTINGS_KEY in changes) applyPageDarkMode(Boolean(changes[SETTINGS_KEY].newValue));
  });
}

init().catch((err) => console.error('[Moodle+] Could not apply page dark mode.', err));
