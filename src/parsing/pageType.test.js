import { describe, it, expect } from 'vitest';
import { htmlToDocument } from '../../tests/helpers/fixtures.js';
import { detectPage, PAGE_TYPES } from './pageType.js';

const body = (id, className = '') => htmlToDocument(`<body id="${id}" class="${className}"></body>`);

describe('detectPage', () => {
  it("recognises the user report from Moodle's body id and reads the course id class", () => {
    const page = detectPage(
      body('page-grade-report-user-index', 'path-grade course-2'),
      'https://moodle-courses.wolfware.ncsu.edu/grade/report/user/index.php?id=2',
    );
    expect(page).toEqual({ type: PAGE_TYPES.USER_REPORT, courseId: 2 });
  });

  it('falls back to the URL when the body id is missing', () => {
    const page = detectPage(body(''), 'http://localhost:8000/grade/report/user/index.php?id=7');
    expect(page).toEqual({ type: PAGE_TYPES.USER_REPORT, courseId: 7 });
  });

  it('matches any course format on course pages', () => {
    const page = detectPage(body('page-course-view-weeks', 'course-5'), 'http://localhost:8000/course/view.php?id=5');
    expect(page.type).toBe(PAGE_TYPES.COURSE_PAGE);
  });

  it('only treats the calendar as "upcoming" in the upcoming view', () => {
    const doc = body('page-calendar-view');
    expect(detectPage(doc, 'http://localhost:8000/calendar/view.php?view=upcoming').type).toBe(PAGE_TYPES.CALENDAR_UPCOMING);
    expect(detectPage(doc, 'http://localhost:8000/calendar/view.php?view=month').type).toBe(PAGE_TYPES.UNKNOWN);
  });

  it('ignores the site front page course (course-1)', () => {
    const page = detectPage(body('page-site-index', 'course-1'), 'http://localhost:8000/');
    expect(page).toEqual({ type: PAGE_TYPES.UNKNOWN, courseId: null });
  });
});
