// Injects the on-page overlay (FR-7: a cleaner, mobile-responsive way to reach the
// calendar/calculator while browsing WolfWare itself, not just from the toolbar popup).
//
// Built in a Shadow DOM so WolfWare's own page CSS can't bleed into our panel and vice
// versa (Design doc 2.1 "Overlay UI instead of replacing WolfWare's DOM" - same reasoning
// as the rest of this project's overlay choice). Reuses the exact same tab/view wiring and
// view modules as the popup (src/ui/tabs.js, src/ui/darkModeToggle.js,
// src/popup/views/*) rather than duplicating them - those modules only ever touch a
// passed-in `root`, so they work unmodified inside a shadow tree.

import popupCss from '../popup/popup.css?raw';
import { initDarkModeToggle } from '../ui/darkModeToggle.js';
import { initTabs } from '../ui/tabs.js';
import { initCalendarView } from '../popup/views/calendarView.js';
import { initCalculatorView } from '../popup/views/calculatorView.js';

// popup.css's `:root`/`body.dark` blocks don't match inside a shadow tree (:root only ever
// matches the real document's <html>), so the same custom-property *values* have to be
// re-declared under :host/:host(.dark) for the reused component CSS to have anything to
// read. Kept as plain strings, not a shared module, since there are exactly two places
// these ever need to live and a shared source would be more indirection than value here.
const HOST_THEME_VARS = `
:host {
  all: initial;
  --bg: #ffffff; --text: #1f2328; --switch-off: #767676; --switch-on: #0b63c4;
  --switch-thumb: #ffffff; --accent: #0b63c4; --border: #d0d7de; --muted-text: #57606a;
  --surface: #f6f8fa; --input-bg: #ffffff; --danger: #cf222e; --danger-bg: #ffebe9;
  --success: #1a7f37; --success-bg: #dafbe1; --warning: #9a6700; --warning-bg: #fff8c5;
  position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
  font-family: system-ui, sans-serif; color-scheme: light;
}
:host(.dark) {
  --bg: #1e1f22; --text: #e6e6e6; --switch-on: #4c9aff; --accent: #4c9aff;
  --border: #3a3d41; --muted-text: #9aa4af; --surface: #2a2b2e; --input-bg: #26272a;
  --danger: #f85149; --danger-bg: #3c1618; --success: #3fb950; --success-bg: #0d2818;
  --warning: #d29922; --warning-bg: #3c2e03; color-scheme: dark;
}
`;

const OVERLAY_CSS = `
.fab {
  width: 48px; height: 48px; border-radius: 50%;
  border: none; background: var(--accent); color: #fff;
  font: 600 0.85rem system-ui, sans-serif; cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.fab:hover { filter: brightness(1.08); }

.panel {
  position: absolute;
  bottom: 56px; right: 0;
  width: 340px; max-height: 480px;
  background: var(--bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  display: flex; flex-direction: column; overflow: hidden;
}
.panel[hidden] { display: none; }

.panel #app { padding: 16px; display: flex; flex-direction: column; flex: 1; min-height: 0; }

@media (max-width: 600px) {
  .panel {
    position: fixed; left: 0; right: 0; bottom: 0;
    width: auto; max-height: 80vh; border-radius: 10px 10px 0 0;
  }
}
`;

const PANEL_MARKUP = `
  <div id="app">
    <div id="topbar">
      <div><h1>Moodle+</h1></div>
      <div>
        <label class="switch">
          <input type="checkbox" id="dark-mode-toggle" role="switch" aria-label="Dark mode">
          <span class="slider round"></span>
        </label>
      </div>
    </div>
    <nav id="tabs" role="tablist" aria-label="Moodle+ views">
      <button type="button" class="tab" id="tab-calendar" role="tab"
              aria-selected="true" aria-controls="view-calendar">Calendar</button>
      <button type="button" class="tab" id="tab-calculator" role="tab"
              aria-selected="false" aria-controls="view-calculator" tabindex="-1">Grade Calculator</button>
    </nav>
    <main id="views">
      <section id="view-calendar" class="view" role="tabpanel" aria-labelledby="tab-calendar"></section>
      <section id="view-calculator" class="view" role="tabpanel" aria-labelledby="tab-calculator" hidden></section>
    </main>
  </div>
`;

function mount() {
  const host = document.createElement('div');
  host.id = 'moodleplus-overlay-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = popupCss + HOST_THEME_VARS + OVERLAY_CSS;
  shadow.appendChild(style);

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'fab';
  fab.textContent = 'M+';
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-label', 'Open Moodle+');
  shadow.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.hidden = true;
  panel.innerHTML = PANEL_MARKUP; // static, fully-controlled markup - never scraped content
  shadow.appendChild(panel);

  initTabs(panel);
  initDarkModeToggle(panel, host);

  // Lazy: the two views do their own storage reads (course list + per-course data), which
  // is wasted I/O on every page load if the user never opens the panel. Only pay for it
  // once, on first open.
  let viewsInitialized = false;
  fab.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    fab.setAttribute('aria-expanded', String(opening));
    if (opening && !viewsInitialized) {
      viewsInitialized = true;
      initCalendarView(panel.querySelector('#view-calendar'));
      initCalculatorView(panel.querySelector('#view-calculator'));
    }
  });
}

mount();
