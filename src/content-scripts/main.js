// The extension's only content script. Runs on every WolfWare page, works out which page
// it's on, runs the matching parser, and caches the result for the UI (Design doc 2.2).
//
// Parsers live in src/parsing/parsers/ and are pure functions (Document in, data out), so
// they can be unit-tested without a browser. Everything browser-specific stays in here.

import { detectPage, PAGE_TYPES } from '../parsing/pageType.js';
import { calculateCurrentGrade } from '../utils/gradeCalculator.js';
import { parseCalendarUpcoming } from '../parsing/parsers/calendarUpcoming.js';
import { parseGradesOverview } from '../parsing/parsers/gradesOverview.js';
import { parseUserReport } from '../parsing/parsers/userReport.js';
import { fail } from '../parsing/result.js';
import {
  COURSE_DATA_KINDS,
  saveCourseData,
  saveCourseList,
  saveParseStatus,
} from '../storage/courseCache.js';

const HANDLERS = {
  [PAGE_TYPES.USER_REPORT]: {
    parse: (doc, page) =>
      page.courseId === null
        ? fail("Couldn't tell which course this grade report is for.")
        : parseUserReport(doc, { courseId: page.courseId }),
    save: (report, page) => saveCourseData(page.courseId, COURSE_DATA_KINDS.GRADES, report),
    describe: (report) =>
      `${report.categories.length} categories, current grade ` +
      `${calculateCurrentGrade(report.categories)?.toFixed(2)}% (Moodle says ${report.courseTotalPercent}%)`,
  },
  [PAGE_TYPES.GRADES_OVERVIEW]: {
    parse: (doc) => parseGradesOverview(doc),
    save: (courses) => saveCourseList(courses),
    describe: (courses) => `${courses.length} courses`,
  },
  [PAGE_TYPES.CALENDAR_UPCOMING]: {
    parse: (doc) => parseCalendarUpcoming(doc),
    save: async (events) => {
      const byCourse = Map.groupBy(events, (event) => event.courseId);
      for (const [courseId, courseEvents] of byCourse) {
        await saveCourseData(courseId, COURSE_DATA_KINDS.ASSIGNMENTS, courseEvents);
      }
    },
    describe: (events) => `${events.length} upcoming events`,
  },
};

async function run() {
  const page = detectPage(document, location.href);
  const handler = HANDLERS[page.type];
  if (!handler) return;

  let result;
  try {
    result = handler.parse(document, page);
  } catch (err) {
    // A crash is still a failed parse: record it so the UI can say so.
    result = fail(`The ${page.type} parser crashed: ${err.message}`);
  }

  await saveParseStatus(page.type, result);

  if (!result.ok) {
    console.warn(`[Moodle+] Couldn't read this ${page.type} page: ${result.reason}`);
    return;
  }

  result.warnings.forEach((warning) => console.warn(`[Moodle+] ${warning}`));
  await handler.save(result.data, page);
  console.log(`[Moodle+] Read ${page.type}: ${handler.describe(result.data)}`, result.data);
}

run().catch((err) => console.error('[Moodle+] Content script failed.', err));
