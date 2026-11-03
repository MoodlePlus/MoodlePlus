// Moodle+ toolbar popup: the dark mode switch plus the Calendar and Grade Calculator tabs.
//
// Everything here is shared with the on-page overlay (src/content-scripts/overlay.js):
// the views and the toggle/tab wiring each take a root element, so the popup passes its
// own document and the overlay passes its shadow root. The popup only reads from storage;
// the content scripts are what fill it as the student browses WolfWare.

import { initDarkModeToggle } from '../ui/darkModeToggle.js';
import { initTabs } from '../ui/tabs.js';
import { initCalendarView } from './views/calendarView.js';
import { initCalculatorView } from './views/calculatorView.js';

document.addEventListener('DOMContentLoaded', () => {
  initDarkModeToggle(document, document.body);
  initTabs(document);
  initCalendarView(document.getElementById('view-calendar'));
  initCalculatorView(document.getElementById('view-calculator'));
});
