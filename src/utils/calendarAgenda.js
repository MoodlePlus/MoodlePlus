// Pure helpers for the popup's calendar view: turns cached assignment data into an
// agenda (grouped by day) for a given day/week/month view mode. No DOM, no storage -
// keeps the date math testable on its own (see calendarAgenda.test.js).

const DAYS_BY_MODE = { day: 1, week: 7, month: 30 };

/**
 * @typedef {Object} Assignment
 * @property {string} assignmentId
 * @property {number} courseId
 * @property {string} title
 * @property {string} dueDate ISO string
 * @property {string|null} url
 */

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * A forward-looking window starting today, sized by view mode. Unknown modes fall back
 * to "month" rather than throwing, since this only ever comes from validated settings.
 * @param {'day'|'week'|'month'} viewMode
 * @param {Date} [referenceDate]
 * @returns {{ start: Date, end: Date }}
 */
export function getDateRange(viewMode, referenceDate = new Date()) {
  const days = DAYS_BY_MODE[viewMode] ?? DAYS_BY_MODE.month;
  const start = startOfDay(referenceDate);
  const end = startOfDay(referenceDate);
  end.setDate(end.getDate() + days);
  return { start, end };
}

/**
 * Joins in each assignment's course name by courseId. Does not mutate the input.
 * @param {Assignment[]} assignments
 * @param {{ courseId: number, courseName: string }[]} courses
 */
export function withCourseNames(assignments, courses) {
  const nameById = new Map(courses.map((c) => [c.courseId, c.courseName]));
  return assignments.map((a) => ({ ...a, courseName: nameById.get(a.courseId) ?? 'Unknown course' }));
}

/**
 * Groups assignments into an "Overdue" bucket (independent of view mode, so nothing a
 * student forgot about silently disappears just because they're looking at "day") plus
 * day buckets within the view mode's window.
 * @param {Assignment[]} assignments
 * @param {'day'|'week'|'month'} viewMode
 * @param {Date} [referenceDate]
 * @returns {{ overdue: Assignment[], days: { dateKey: string, date: Date, items: Assignment[] }[] }}
 */
export function buildAgenda(assignments, viewMode, referenceDate = new Date()) {
  const { start, end } = getDateRange(viewMode, referenceDate);
  const sorted = [...assignments].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const overdue = sorted.filter((a) => new Date(a.dueDate) < start);
  const inRange = sorted.filter((a) => {
    const due = new Date(a.dueDate);
    return due >= start && due < end;
  });

  const byDay = new Map();
  for (const item of inRange) {
    const key = dateKey(new Date(item.dueDate));
    if (!byDay.has(key)) byDay.set(key, { dateKey: key, date: startOfDay(item.dueDate), items: [] });
    byDay.get(key).items.push(item);
  }

  return { overdue, days: [...byDay.values()].sort((a, b) => a.date - b.date) };
}

/**
 * "Today" / "Tomorrow" / a short weekday+date for anything further out. Takes the
 * reference date as a parameter (never reads Date.now() itself) so it stays pure.
 * @param {Date} date
 * @param {Date} [referenceDate]
 */
export function formatDayLabel(date, referenceDate = new Date()) {
  const diffDays = Math.round((startOfDay(date) - startOfDay(referenceDate)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
