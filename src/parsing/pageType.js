// Works out which WolfWare/Moodle page we're on, so only the matching parser runs.
//
// Moodle stamps every page's <body> with an id built from its script path, e.g.
// /grade/report/user/index.php -> <body id="page-grade-report-user-index">, and a class
// with the course id, e.g. "course-2". Those are the most stable signals; the URL is the
// fallback.

export const PAGE_TYPES = Object.freeze({
  USER_REPORT: 'userReport', // one course's gradebook (FR-4)
  GRADES_OVERVIEW: 'gradesOverview', // grades for every enrolled course (FR-1)
  CALENDAR_UPCOMING: 'calendarUpcoming', // upcoming due dates across courses (FR-2)
  COURSE_PAGE: 'coursePage', // a course's main page
  UNKNOWN: 'unknown',
});

const BODY_ID_RULES = [
  { prefix: 'page-grade-report-user-index', type: PAGE_TYPES.USER_REPORT },
  { prefix: 'page-grade-report-overview-index', type: PAGE_TYPES.GRADES_OVERVIEW },
  { prefix: 'page-calendar-view', type: PAGE_TYPES.CALENDAR_UPCOMING, view: 'upcoming' },
  // The suffix depends on the course format (topics, weeks, ...), so match the prefix.
  { prefix: 'page-course-view-', type: PAGE_TYPES.COURSE_PAGE },
];

const PATH_RULES = [
  { path: '/grade/report/user/index.php', type: PAGE_TYPES.USER_REPORT },
  { path: '/grade/report/overview/index.php', type: PAGE_TYPES.GRADES_OVERVIEW },
  { path: '/calendar/view.php', type: PAGE_TYPES.CALENDAR_UPCOMING, view: 'upcoming' },
  { path: '/course/view.php', type: PAGE_TYPES.COURSE_PAGE },
];

/**
 * @param {Document} doc
 * @param {string} url the page URL (location.href)
 * @returns {{ type: string, courseId: number|null }}
 */
export function detectPage(doc, url) {
  const parsedUrl = new URL(url);
  const view = parsedUrl.searchParams.get('view');
  const viewMatches = (rule) => !rule.view || rule.view === view;

  const bodyId = doc.body?.id ?? '';
  const byBody = BODY_ID_RULES.find((rule) => bodyId.startsWith(rule.prefix) && viewMatches(rule));
  // Matching on the end of the path also handles Moodle installed in a subfolder.
  const byPath = PATH_RULES.find((rule) => parsedUrl.pathname.endsWith(rule.path) && viewMatches(rule));
  const type = (byBody ?? byPath)?.type ?? PAGE_TYPES.UNKNOWN;

  return { type, courseId: detectCourseId(doc, parsedUrl) };
}

/**
 * @param {Document} doc
 * @param {URL} parsedUrl
 * @returns {number|null}
 */
function detectCourseId(doc, parsedUrl) {
  const bodyClass = [...(doc.body?.classList ?? [])].find((name) => /^course-\d+$/.test(name));
  // course-1 is the site front page, not a real course.
  if (bodyClass && bodyClass !== 'course-1') return Number(bodyClass.slice('course-'.length));

  const idParam = Number(parsedUrl.searchParams.get('id'));
  return Number.isInteger(idParam) && idParam > 1 ? idParam : null;
}
