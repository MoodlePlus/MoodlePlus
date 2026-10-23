import { describe, it, expect } from 'vitest';
import { fixtureExists, htmlToDocument, loadFixture } from '../../../tests/helpers/fixtures.js';
import { calculateCurrentGrade } from '../../utils/gradeCalculator.js';
import { parseUserReport } from './userReport.js';

describe('parseUserReport (hand-written fixture)', () => {
  const result = parseUserReport(loadFixture('handmade/user-report.html'), { courseId: 2 });
  const byName = (name) => result.data.categories.find((category) => category.name === name);

  it('parses successfully', () => {
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('reads category weights from the category total rows', () => {
    expect(result.data.categories.map((c) => [c.name, c.weightPercent])).toEqual([
      ['Homework', 25],
      ['Quizzes', 15],
      ['Exams', 45],
      ['Participation', 15],
    ]);
  });

  it('keeps ungraded items as null, never 0', () => {
    const homework4 = byName('Homework').items.find((item) => item.name === 'Homework 4');
    expect(homework4.scorePercent).toBeNull();
  });

  it('strips screen-reader text from item names', () => {
    expect(byName('Homework').items[0].name).toBe('Homework 1');
  });

  it('works out drop-lowest from the dropped items', () => {
    expect(byName('Homework').dropLowestCount).toBe(1);
    expect(byName('Quizzes').dropLowestCount).toBe(0);
  });

  it('turns items directly in the course into their own category', () => {
    expect(byName('Participation').items).toHaveLength(1);
    expect(byName('Participation').items[0].scorePercent).toBe(90);
  });

  it('sets extra credit aside instead of mixing it into a category', () => {
    expect(result.data.extraCreditItems.map((item) => item.name)).toEqual(['Extra Credit: Course Survey']);
  });

  it("reads Moodle's course total", () => {
    expect(result.data.courseTotalPercent).toBe(87.83);
  });

  it('feeds the grade calculator: 86.65% before extra credit (tests/moodle-env/README.md)', () => {
    expect(calculateCurrentGrade(result.data.categories)).toBeCloseTo(86.65, 1);
  });
});

describe('parseUserReport failures', () => {
  it('fails when there is no grade table', () => {
    const result = parseUserReport(htmlToDocument('<body><p>Nothing here</p></body>'));
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('grade table') });
  });

  it('fails instead of guessing when a grade has no range or percentage', () => {
    const result = parseUserReport(
      htmlToDocument(`
        <table class="user-grade"><tbody>
          <tr><th class="level1 column-itemname">Course</th></tr>
          <tr><th class="level2 column-itemname">Homework</th></tr>
          <tr>
            <th class="level3 column-itemname">Homework 1</th>
            <td class="column-grade">18.00</td>
          </tr>
        </tbody></table>`),
    );
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('Homework 1') });
  });
});

// Real pages saved from the local Moodle instance with `npm run capture-fixtures`.
// These are skipped until the fixtures exist. Expected values are Moodle's own numbers
// from tests/moodle-env/README.md, before extra credit.
const REAL_PAGES = [
  { student: 'student1', currentGrade: 86.65, courseTotal: 87.83 },
  { student: 'student2', currentGrade: 92.83, courseTotal: 92.83 },
  { student: 'student3', currentGrade: 63.05, courseTotal: 63.64 },
];

for (const { student, currentGrade, courseTotal } of REAL_PAGES) {
  const fixture = `moodle/${student}/user-report.html`;

  describe.skipIf(!fixtureExists(fixture))(`parseUserReport (real page, ${student})`, () => {
    it('matches Moodle', () => {
      const result = parseUserReport(loadFixture(fixture), { courseId: 2 });
      if (!result.ok) throw new Error(result.reason);

      expect(result.data.courseTotalPercent).toBeCloseTo(courseTotal, 1);
      expect(calculateCurrentGrade(result.data.categories)).toBeCloseTo(currentGrade, 1);
    });
  });
}
