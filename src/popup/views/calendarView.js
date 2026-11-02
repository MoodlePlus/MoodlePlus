// Calendar tab: reads cached assignments across every known course and renders them as
// an agenda grouped by day (see src/utils/calendarAgenda.js for why an agenda instead of
// a month grid - the popup is only 320px wide). DOM/storage glue only; the date logic
// itself lives in calendarAgenda.js so it can be unit-tested without a DOM.

import { COURSE_DATA_KINDS, getCourseData, getCourseList, getParseStatus } from '../../storage/courseCache.js';
import { getUserSettings, saveUserSettings } from '../../storage/userSettings.js';
import { PAGE_TYPES } from '../../parsing/pageType.js';
import { buildAgenda, formatDayLabel, withCourseNames } from '../../utils/calendarAgenda.js';

const VIEW_MODES = [
  { mode: 'day', label: 'Day' },
  { mode: 'week', label: 'Week' },
  { mode: 'month', label: 'Month' },
];

/** @param {HTMLElement} root */
export async function initCalendarView(root) {
  let viewMode = (await getUserSettings().catch(() => null))?.calendarViewMode ?? 'month';

  let assignments = [];
  let isStale = false;
  let state = 'ok'; // 'ok' | 'error' | 'no-courses' | 'no-assignments'
  let noAssignmentsReason = null;

  try {
    const courseList = await getCourseList();
    if (!courseList || courseList.data.length === 0) {
      state = 'no-courses';
    } else {
      const entries = await Promise.all(
        courseList.data.map((course) => getCourseData(course.courseId, COURSE_DATA_KINDS.ASSIGNMENTS)),
      );
      assignments = withCourseNames(
        entries.flatMap((entry) => entry?.data ?? []),
        courseList.data,
      );
      isStale = courseList.isStale || entries.some((entry) => entry?.isStale);

      if (assignments.length === 0) {
        state = 'no-assignments';
        const status = await getParseStatus(PAGE_TYPES.CALENDAR_UPCOMING).catch(() => null);
        if (status && status.ok === false) noAssignmentsReason = status.reason;
      }
    }
  } catch (err) {
    console.error('[Moodle+] Could not load calendar data.', err);
    state = 'error';
  }

  render();

  function render() {
    root.textContent = '';

    if (state === 'error') {
      root.appendChild(banner('error', "Couldn't load your calendar data. Try reopening the popup."));
      return;
    }

    if (state === 'no-courses') {
      root.appendChild(emptyState('Visit WolfWare to load your courses, then reopen the popup.'));
      return;
    }

    if (isStale) {
      root.appendChild(banner('warning', 'Showing cached data — visit a WolfWare page to refresh it.'));
    }

    if (state === 'no-assignments') {
      root.appendChild(
        emptyState(
          noAssignmentsReason
            ? `Couldn't read the upcoming events page: ${noAssignmentsReason}`
            : 'Visit the WolfWare calendar page to load upcoming assignments.',
        ),
      );
      return;
    }

    root.appendChild(buildSegmentedControl());

    const agenda = buildAgenda(assignments, viewMode);
    if (agenda.overdue.length === 0 && agenda.days.length === 0) {
      root.appendChild(emptyState("Nothing due — you're all caught up."));
      return;
    }

    if (agenda.overdue.length > 0) {
      root.appendChild(buildDayGroup('Overdue', agenda.overdue, true));
    }
    for (const day of agenda.days) {
      root.appendChild(buildDayGroup(formatDayLabel(day.date), day.items, false));
    }
  }

  function buildSegmentedControl() {
    const nav = document.createElement('div');
    nav.className = 'segmented';
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', 'Calendar range');

    for (const { mode, label } of VIEW_MODES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-pressed', String(mode === viewMode));
      button.addEventListener('click', () => onViewModeChange(mode));
      nav.appendChild(button);
    }
    return nav;
  }

  async function onViewModeChange(mode) {
    if (mode === viewMode) return;
    const previous = viewMode;
    viewMode = mode;
    render();
    try {
      await saveUserSettings({ calendarViewMode: mode });
    } catch (err) {
      console.error('[Moodle+] Could not save calendar view mode.', err);
      viewMode = previous;
      render();
    }
  }
}

function buildDayGroup(label, items, isOverdue) {
  const section = document.createElement('div');
  section.className = isOverdue ? 'day-group overdue' : 'day-group';

  const heading = document.createElement('h3');
  heading.textContent = label;
  section.appendChild(heading);

  for (const item of items) {
    section.appendChild(buildAssignmentItem(item));
  }
  return section;
}

function buildAssignmentItem(item) {
  const el = document.createElement('div');
  el.className = 'assignment-item';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = item.title; // textContent only - titles are scraped page content.
  el.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const time = new Date(item.dueDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  meta.textContent = `${item.courseName} · ${time}`;
  el.appendChild(meta);

  return el;
}

function banner(variant, message) {
  const el = document.createElement('div');
  el.className = `banner banner--${variant}`;
  el.textContent = message;
  return el;
}

function emptyState(message) {
  const el = document.createElement('p');
  el.className = 'empty-state';
  el.textContent = message;
  return el;
}
