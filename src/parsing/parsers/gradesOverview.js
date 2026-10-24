// Parser for the grades overview: /grade/report/overview/index.php (FR-1).
//
// This page lists every course the student is enrolled in, with a link to each course's
// user report, so it's the easiest reliable source for "which courses does this student
// have". (The dashboard's course list is loaded by JavaScript after the page loads, so it
// may not exist yet when the content script runs.)
//
// ---------------------------------------------------------------------------------------
// TODO(Divy): implement this. Suggested steps (details in docs/parsing-guide.md):
//
//   1. Open http://localhost:8000/grade/report/overview/index.php as student1 and inspect
//      the table in DevTools. Note the table's id/classes and how each course row looks.
//   2. Find the table with queryFirst(doc, [...]) - most stable selector first.
//   3. For each course row, read:
//        courseName - the link text (use cleanText)
//        courseId   - the "id" parameter of the link (use numberParamFromUrl)
//        url        - the link's absolute href (link.href)
//      Skip rows without a course link (e.g. totals/headers).
//   4. Return fail("...") if the table or every course link is missing; never return an
//      empty list as success unless the page really says "no courses".
//   5. Turn on the tests in gradesOverview.test.js and make them pass, first against your
//      captured page in tests/fixtures/moodle/student1/grades-overview.html.
//
// Output shape (Design doc 3.1 "Course"; term is optional for now):
//   [{ courseId: 2, courseName: "EX 101 (001) FALL 2026: ...", url: "http://..." }]
// ---------------------------------------------------------------------------------------

// Uncomment as you use them:
// import { cleanText, numberParamFromUrl, queryFirst } from '../dom.js';
import { fail } from '../result.js';

/**
 * @param {Document} _doc
 * @returns {{ ok: true, data: { courseId: number, courseName: string, url: string }[], warnings: string[] }
 *         | { ok: false, reason: string }}
 */
export function parseGradesOverview(_doc) {
  return fail('Grades overview parser not implemented yet.');
}
