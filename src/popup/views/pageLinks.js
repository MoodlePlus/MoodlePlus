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

/**
 * @param {string} message
 * @param {(keyof typeof MOODLE_PAGES)[]} pageKeys
 * @returns {Promise<HTMLElement>}
 */
export async function buildEmptyStateWithLinks(message, pageKeys) {
  const container = document.createElement('div');
  container.className = 'empty-state';

  const text = document.createElement('p');
  text.textContent = message;
  container.appendChild(text);

  const origin = await getMoodleOrigin().catch(() => null);
  if (!origin) {
    const hint = document.createElement('p');
    hint.textContent = `Open your course site on WolfWare, then go to ${pageKeys
      .map((key) => MOODLE_PAGES[key].label)
      .join(' and ')}.`;
    container.appendChild(hint);
    return container;
  }

  const list = document.createElement('ul');
  list.className = 'page-links';
  for (const key of pageKeys) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = origin + MOODLE_PAGES[key].path;
    link.textContent = `Open ${MOODLE_PAGES[key].label} →`;
    if (OPENS_NEW_TAB) {
      link.target = '_blank';
      link.rel = 'noopener';
    }
    item.appendChild(link);
    list.appendChild(item);
  }
  container.appendChild(list);
  return container;
}
