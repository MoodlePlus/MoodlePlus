// Moodle+ popup entry point.

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
