// Parser for upcoming events: /calendar/view.php?view=upcoming (FR-2).
//
// Lists upcoming due dates across all of the student's courses, which is exactly what
// the unified calendar needs.
//
// ---------------------------------------------------------------------------------------
// TODO(Divy): implement this after parseGradesOverview. Suggested steps:
//
//   1. Open http://localhost:8000/calendar/view.php?view=upcoming as student1. Homework 4,
//      Quiz 3 and the Final Exam should be listed. Inspect one event in DevTools.
//   2. Moodle's calendar templates use data attributes, which are the most stable
//      selectors. Look for things like [data-region="event-item"] and data-event-id, and
//      prefer them over class names.
//   3. For each event, read:
//        assignmentId - data-event-id (or the activity link's "id" parameter)
//        title        - the event name
//        courseId     - from the course link in the event (numberParamFromUrl(..., 'id'))
//        dueDate      - DON'T parse the display text ("Friday, 24 October, 11:59 PM").
//                       Day links like calendar/view.php?view=day&time=1729814340 carry
//                       a Unix timestamp; look for one (or a data-* timestamp) instead.
//                       Store it as an ISO string: new Date(seconds * 1000).toISOString()
//        url          - the activity link's absolute href
//   4. Return fail("...") if the event list container is missing. An empty list is only
//      success if the page shows Moodle's "no upcoming events" message.
//   5. Enable the tests in calendarUpcoming.test.js and make them pass.
//
// Output shape (Design doc 3.1 "Assignment"; category/pointsPossible/status can come later):
//   [{ assignmentId: "42", courseId: 2, title: "Homework 4", dueDate: "2026-10-24T03:59:00.000Z", url: "http://..." }]
// ---------------------------------------------------------------------------------------

// Uncomment as you use them:
// import { cleanText, numberParamFromUrl, queryAllFirst, queryFirst } from '../dom.js';
import { fail } from '../result.js';

/**
 * @param {Document} _doc
 * @returns {{ ok: true, data: object[], warnings: string[] } | { ok: false, reason: string }}
 */
export function parseCalendarUpcoming(_doc) {
  return fail('Upcoming events parser not implemented yet.');
}
