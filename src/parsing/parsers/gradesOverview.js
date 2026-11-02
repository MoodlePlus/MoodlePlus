// Parser for the grades overview: /grade/report/overview/index.php (FR-1).
//
// This page lists every course the student is enrolled in, with a link to each course's
// user report, so it's the easiest reliable source for "which courses does this student
// have". (The dashboard's course list is loaded by JavaScript after the page loads, so it
// may not exist yet when the content script runs.)
//
// The table (id="overview-grade") pads itself out to a fixed row count with empty
// "emptyrow" rows that have no course link - we skip any row without one rather than
// trying to special-case that class, so this also tolerates themes that drop the class.
//
// Output shape (Design doc 3.1 "Course"; term is optional for now):
//   [{ courseId: 2, courseName: "EX 101 (001) FALL 2026: ...", url: "http://..." }]

import { cleanText, numberParamFromUrl, queryFirst } from '../dom.js';
import { fail, ok } from '../result.js';

const TABLE_SELECTORS = ['table#overview-grade', 'table.generaltable[id*="overview"]', '#region-main table.generaltable'];
const NO_COURSES_PATTERN = /not enrolled in any courses|no courses/i;

/**
 * @param {Document} doc
 * @returns {{ ok: true, data: { courseId: number, courseName: string, url: string }[], warnings: string[] }
 *         | { ok: false, reason: string }}
 */
export function parseGradesOverview(doc) {
  const table = queryFirst(doc, TABLE_SELECTORS);
  if (!table) {
    // A student enrolled in nothing may not get a table at all; only trust that reading
    // if the page actually says so, rather than assuming "no table" means "no courses".
    if (NO_COURSES_PATTERN.test(cleanText(doc.querySelector('#region-main')))) {
      return ok([], []);
    }
    return fail("Couldn't find the grades overview table on this page.");
  }

  const warnings = [];
  const courses = [];

  for (const row of table.querySelectorAll('tbody tr')) {
    const link = row.querySelector('td a[href]');
    if (!link) continue; // emptyrow padding, or a row with no course link.

    const courseId = numberParamFromUrl(link.getAttribute('href'), 'id');
    const courseName = cleanText(link);
    if (courseId === null || !courseName) {
      warnings.push(`Skipped a course row we couldn't fully read (link text "${courseName}").`);
      continue;
    }

    courses.push({ courseId, courseName, url: link.href });
  }

  if (courses.length === 0) {
    if (NO_COURSES_PATTERN.test(cleanText(table))) return ok([], []);
    return fail('Found the grades overview table but no row linked to a course.');
  }

  return ok(courses, warnings);
}
