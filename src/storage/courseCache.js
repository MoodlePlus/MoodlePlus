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
const MOODLE_ORIGIN_KEY = 'moodleOrigin';
const courseKey = (courseId, kind) => `course.${courseId}.${kind}`;
const weightsKey = (courseId) => `course.${courseId}.weightOverrides`;
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

/**
 * Replaces the whole course list. Only the grades overview should call this: it's the
 * one page that lists every enrolled course, so it's authoritative.
 * @param {{ courseId: number, courseName: string, url: string }[]} courses
 */
export async function saveCourseList(courses) {
  await set(COURSE_LIST_KEY, { data: courses, lastScrapedAt: Date.now() });
}

export async function getCourseList() {
  return readEntry(COURSE_LIST_KEY);
}

/**
 * Adds courses seen on other pages (e.g. the calendar names each event's course) without
 * dropping ones we already know, so the UI works before the grades overview is visited.
 * Pure - see mergeIntoCourseList for the storage-backed version.
 * @param {{ courseId: number, courseName: string, url: string }[]} existing
 * @param {{ courseId: number, courseName?: string|null, url?: string|null }[]} incoming
 */
export function mergeCourseLists(existing, incoming) {
  const byId = new Map(existing.map((course) => [course.courseId, course]));
  for (const course of incoming) {
    if (byId.has(course.courseId) || !course.courseName) continue;
    byId.set(course.courseId, { courseId: course.courseId, courseName: course.courseName, url: course.url ?? null });
  }
  return [...byId.values()];
}

/** @param {{ courseId: number, courseName?: string|null, url?: string|null }[]} courses */
export async function mergeIntoCourseList(courses) {
  const current = await getCourseList();
  const merged = mergeCourseLists(current?.data ?? [], courses);
  if (merged.length === (current?.data.length ?? 0)) return; // nothing new - keep the old timestamp
  await set(COURSE_LIST_KEY, { data: merged, lastScrapedAt: Date.now() });
}

/**
 * Category weights the student typed in (from their syllabus) for a course, keyed by
 * categoryId - for weights the gradebook hides or gets wrong (Design doc 3.3: never rely on
 * scraped data alone). Kept apart from the scraped grades so a re-scrape never wipes them.
 * @param {number} courseId
 * @returns {Promise<Record<string, number>>}
 */
export async function getWeightOverrides(courseId) {
  const key = weightsKey(courseId);
  return (await get(key))[key] ?? {};
}

/**
 * @param {number} courseId
 * @param {Record<string, number>} overrides
 */
export async function saveWeightOverrides(courseId, overrides) {
  await set(weightsKey(courseId), overrides);
}

/** Where the student's Moodle lives, so the UI can link straight to the pages it reads. */
export async function saveMoodleOrigin(origin) {
  await set(MOODLE_ORIGIN_KEY, origin);
}

export async function getMoodleOrigin() {
  return (await get(MOODLE_ORIGIN_KEY))[MOODLE_ORIGIN_KEY] ?? null;
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
