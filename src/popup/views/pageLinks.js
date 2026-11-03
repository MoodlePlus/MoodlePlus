// Empty-state help shared by the calendar and calculator views: tells the student exactly
// which Moodle pages to open (as real links once we know where their Moodle lives),
// instead of a vague "visit WolfWare".

import { getMoodleOrigin } from '../../storage/courseCache.js';

export const MOODLE_PAGES = Object.freeze({
  gradesOverview: { label: 'Grades overview', path: '/grade/report/overview/index.php' },
  upcomingEvents: { label: 'Upcoming events', path: '/calendar/view.php?view=upcoming' },
});

// From the toolbar popup a link should open a tab; from the on-page panel it can just
// navigate the page the student is already on.
const OPENS_NEW_TAB = /^(chrome|moz)-extension:$/.test(location.protocol);

function buildLink(href, text) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = text;
  if (OPENS_NEW_TAB) {
    link.target = '_blank';
    link.rel = 'noopener';
  }
  return link;
}

/**
 * Direct links to each course's own grade report - the page the calculator actually
 * reads (category weights + item grades). Saves a detour through the grades overview,
 * which only lists course totals.
 * @param {string} intro e.g. "Open a course's grades once to use it here:"
 * @param {{ courseId: number, courseName: string, url?: string|null }[]} courses
 * @returns {Promise<HTMLElement>}
 */
export async function buildCourseGradeLinks(intro, courses) {
  const container = document.createElement('div');
  container.className = 'course-grade-links';

  const text = document.createElement('p');
  text.textContent = intro;
  container.appendChild(text);

  const savedOrigin = await getMoodleOrigin().catch(() => null);
  const list = document.createElement('ul');
  list.className = 'page-links';
  for (const course of courses) {
    let origin = savedOrigin;
    try {
      origin ??= new URL(course.url).origin;
    } catch {
      continue; // no way to build a link for this one
    }
    const item = document.createElement('li');
    item.appendChild(buildLink(`${origin}/grade/report/user/index.php?id=${course.courseId}`, `${course.courseName} →`));
    list.appendChild(item);
  }
  container.appendChild(list);
  return container;
}

/**
 * @param {string} message what's missing, e.g. "No grades loaded yet."
 * @param {(keyof typeof MOODLE_PAGES)[]} pageKeys
 * @param {string} linkIntro shown above the links, e.g. "Open these once:" - only when
 *   there are links to show (before Moodle+ has seen the Moodle site, a plain-text hint
 *   is shown instead)
 * @returns {Promise<HTMLElement>}
 */
export async function buildEmptyStateWithLinks(message, pageKeys, linkIntro) {
  const container = document.createElement('div');
  container.className = 'empty-state';
  const paragraph = (text) => {
    const p = document.createElement('p');
    p.textContent = text;
    container.appendChild(p);
  };

  paragraph(message);

  const origin = await getMoodleOrigin().catch(() => null);
  if (!origin) {
    paragraph(
      `Open your course site on WolfWare, then go to ${pageKeys.map((key) => MOODLE_PAGES[key].label).join(' and ')}.`,
    );
    return container;
  }

  paragraph(linkIntro);
  const list = document.createElement('ul');
  list.className = 'page-links';
  for (const key of pageKeys) {
    const item = document.createElement('li');
    item.appendChild(buildLink(origin + MOODLE_PAGES[key].path, `Open ${MOODLE_PAGES[key].label} →`));
    list.appendChild(item);
  }
  container.appendChild(list);
  return container;
}
