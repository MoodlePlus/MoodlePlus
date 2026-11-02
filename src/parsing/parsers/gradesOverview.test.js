import { describe, it, expect } from 'vitest';
import { fixtureExists, htmlToDocument, loadFixture } from '../../../tests/helpers/fixtures.js';
import { parseGradesOverview } from './gradesOverview.js';

describe('parseGradesOverview failures', () => {
  it('fails when there is no overview table', () => {
    const result = parseGradesOverview(htmlToDocument('<body><div id="region-main"><p>Nothing here</p></div></body>'));
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('grades overview table') });
  });

  it('fails when the table has rows but none of them link to a course', () => {
    const result = parseGradesOverview(
      htmlToDocument(`
        <table id="overview-grade"><tbody>
          <tr class="emptyrow"><td class="cell c0"></td><td class="cell c1"></td></tr>
        </tbody></table>`),
    );
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('no row linked to a course') });
  });

  it('returns an empty list when the page says the student has no courses', () => {
    const result = parseGradesOverview(
      htmlToDocument('<body><div id="region-main"><p>You are not enrolled in any courses.</p></div></body>'),
    );
    expect(result).toEqual({ ok: true, data: [], warnings: [] });
  });
});

const fixture = 'moodle/student1/grades-overview.html';

describe.skipIf(!fixtureExists(fixture))('parseGradesOverview (real page, student1)', () => {
  const result = parseGradesOverview(loadFixture(fixture));

  it('finds the example course: courseId 2, its full name, and its URL', () => {
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([
      {
        courseId: 2,
        courseName: 'EX 101 (001) FALL 2026: Example Course for Grade Extension Testing',
        url: expect.stringContaining('/course/user.php?mode=grade&id=2'),
      },
    ]);
  });

  it('skips rows that are not courses (headers, totals)', () => {
    // The real page pads the table with ~29 empty rows; only the one real course survives.
    expect(result.data).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });
});
