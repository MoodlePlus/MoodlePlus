// Parser for upcoming events: /calendar/view.php?view=upcoming (FR-2).
//
// Lists upcoming due dates across all of the student's courses, which is exactly what
// the unified calendar needs. NOTE: this is Moodle's "upcoming" window (a near-term
// lookahead, not "every future event") - on the example course, Homework 4 and the Quiz 3
// close event show up here, but the Final Exam (60 days out) does not. That's a real limit
// of this page, not a parser bug; a true "every assignment" view would need a different
// source (e.g. each course's own calendar/assignment index) - out of scope for now.
//
// Each event is a <div data-type="event" data-course-id="…" data-event-id="…" …>; the
// course id and event id are read straight off those attributes (most stable: Design doc
// 3.2 rule 1), rather than re-deriving them from links inside the card.
//
// Output shape (Design doc 3.1 "Assignment"; category/pointsPossible/status can come later):
//   [{ assignmentId: "42", courseId: 2, courseName: "EX 101 ...", courseUrl: "http://...",
//      title: "Homework 4 is due", dueDate: "2026-10-24T03:59:00.000Z", url: "http://..." }]

import { cleanText, numberParamFromUrl, queryFirst } from '../dom.js';
import { fail, ok } from '../result.js';

const CONTAINER_SELECTORS = ['[data-region="calendar"]', '#region-main'];
const EVENT_SELECTOR = '[data-type="event"][data-event-id]';
const NO_EVENTS_PATTERN = /no (upcoming )?events/i;

/**
 * @param {Document} doc
 * @returns {{ ok: true, data: { assignmentId: string, courseId: number, courseName: string|null, courseUrl: string|null, title: string, dueDate: string, url: string|null }[], warnings: string[] }
 *         | { ok: false, reason: string }}
 */
export function parseCalendarUpcoming(doc) {
  const container = queryFirst(doc, CONTAINER_SELECTORS);
  if (!container) return fail("Couldn't find the calendar on this page.");

  const eventEls = [...container.querySelectorAll(EVENT_SELECTOR)];
  if (eventEls.length === 0) {
    if (NO_EVENTS_PATTERN.test(cleanText(container))) return ok([], []);
    return fail("Couldn't find any upcoming events on this page.");
  }

  const warnings = [];
  const events = [];

  for (const el of eventEls) {
    const assignmentId = el.getAttribute('data-event-id');
    const courseLink = queryFirst(el, ['a[href*="course/view.php"]']);
    const courseId = el.hasAttribute('data-course-id')
      ? Number(el.getAttribute('data-course-id'))
      : numberParamFromUrl(courseLink?.getAttribute('href'), 'id');

    const title = cleanText(queryFirst(el, ['.name', 'h3'])) || el.getAttribute('data-event-title') || '';
    const timeLink = queryFirst(el, ['a[href*="view=day"]']);
    const seconds = numberParamFromUrl(timeLink?.getAttribute('href'), 'time');

    if (!assignmentId || !Number.isFinite(courseId) || seconds === null || !title) {
      warnings.push(`Skipped an event we couldn't fully read (title "${title || assignmentId}").`);
      continue;
    }

    const activityLink = queryFirst(el, ['.description-content a.autolink', '.description-content a[href]']);

    events.push({
      assignmentId: String(assignmentId),
      courseId,
      // The card links to its course, so this page alone is enough to name the course -
      // the calendar doesn't have to wait for a visit to the grades overview.
      courseName: cleanText(courseLink) || null,
      courseUrl: courseLink?.href ?? null,
      title,
      dueDate: new Date(seconds * 1000).toISOString(),
      url: activityLink?.href ?? null,
    });
  }

  if (events.length === 0) return fail('Found event cards but could not read any of them.');

  return ok(events, warnings);
}
