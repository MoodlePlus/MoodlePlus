// Cache for scraped data (Design doc 3.4, FR-9).
//
// - Keys are namespaced by course: "course.<courseId>.<kind>", e.g. "course.2.grades".
// - Every entry records lastScrapedAt; data older than STALE_AFTER_MS counts as stale.
// The UI reads from here, never from the page directly (Design doc 2.2).

import { get, set } from './index.js';

export const STALE_AFTER_MS = 30 * 60 * 1000;

/** What we store per course. */
export const COURSE_DATA_KINDS = Object.freeze({
  GRADES: 'grades', // output of parseUserReport
  ASSIGNMENTS: 'assignments', // due dates for the calendar
});

const COURSE_LIST_KEY = 'courses';
const courseKey = (courseId, kind) => `course.${courseId}.${kind}`;
const statusKey = (pageType) => `parseStatus.${pageType}`;

/**
 * @param {number} courseId
 * @param {string} kind one of COURSE_DATA_KINDS
 * @param {unknown} data
 */
export async function saveCourseData(courseId, kind, data) {
  await set(courseKey(courseId, kind), { data, lastScrapedAt: Date.now() });
}

/**
 * @param {number} courseId
 * @param {string} kind one of COURSE_DATA_KINDS
 * @returns {Promise<{ data: unknown, lastScrapedAt: number, isStale: boolean } | null>}
 */
export async function getCourseData(courseId, kind) {
  return readEntry(courseKey(courseId, kind));
}

/** @param {{ courseId: number, courseName: string, url: string }[]} courses */
export async function saveCourseList(courses) {
  await set(COURSE_LIST_KEY, { data: courses, lastScrapedAt: Date.now() });
}

export async function getCourseList() {
  return readEntry(COURSE_LIST_KEY);
}

/**
 * Records whether the last parse of a page type worked, so the UI can show a
 * "couldn't read this page" state instead of silently showing old data (NFR-4).
 * @param {string} pageType one of PAGE_TYPES
 * @param {{ ok: boolean, reason?: string }} result
 */
export async function saveParseStatus(pageType, result) {
  await set(statusKey(pageType), { ok: result.ok, reason: result.reason ?? null, at: Date.now() });
}

export async function getParseStatus(pageType) {
  const key = statusKey(pageType);
  return (await get(key))[key] ?? null;
}

async function readEntry(key) {
  const entry = (await get(key))[key];
  if (!entry) return null;
  return { ...entry, isStale: Date.now() - entry.lastScrapedAt > STALE_AFTER_MS };
}
