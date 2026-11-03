// Parser for one course's gradebook: /grade/report/user/index.php?id=<courseId> (FR-4).
//
// The user report is one <table> where every row is either:
//   - a category header  ("Homework")         - name cell only, no grade cell
//   - a grade item       ("Homework 1")       - has grade / range / weight cells
//   - a category total   ("Homework total")   - closes a category; its weight cell is the
//                                               category's weight in the course
//   - the course total   ("Course total")
// Nesting is given by a "levelN" class on each row's name cell (level1 = the course).
//
// Real courses vary a lot, and the parser has to cope with all of these (seen on NC State's
// WolfWare, not just the local test course):
//   - Nested categories (Individual > Personal Contribution > Logs). The calculator works in
//     top-level categories - the ones a syllabus gives weights for - so every grade item is
//     counted in its top-level category, however deep it sits.
//   - Hidden columns. Instructors can hide "Calculated weight", "Range" and "Percentage";
//     a weight we can't read stays null for the student to enter (Design doc 3.3).
//   - Grades shown as letters ("A+") or "letter (percentage)" ("C- (70.00 %)"). A printed
//     percentage is used as-is; a letter on its own is estimated (see numbers.js).
//
// Columns are found by class (.column-grade etc.), never by position: site admins can
// hide columns, which shifts positions around.
//
// Output uses the grade calculator's GradeCategory shape (src/utils/gradeCalculator.js),
// so the result can be passed straight to calculateCurrentGrade / calculateRequiredScore.

import { cleanText, numberParamFromUrl, queryFirst } from '../dom.js';
import { isEmptyGrade, letterGradeFloor, parseGrade, parsePercent, parseRange, percentInText } from '../numbers.js';
import { fail, ok } from '../result.js';

const TABLE_SELECTORS = ['table.user-grade', 'table[id^="user-grade"]', '#region-main table.generaltable'];

/**
 * @typedef {import('../../utils/gradeCalculator.js').GradeCategory} GradeCategory
 *
 * @typedef {Object} UserReport
 * @property {number|null} courseId
 * @property {number|null} courseTotalPercent Moodle's own course total, for cross-checking our math
 * @property {GradeCategory[]} categories
 * @property {{ id: string, name: string, scorePercent: number|null }[]} extraCreditItems
 *   not in `categories` yet: the calculator doesn't support extra credit
 * @property {boolean} hasEstimatedGrades true if any grade was a bare letter we had to estimate
 */

/**
 * @param {Document} doc
 * @param {{ courseId?: number|null }} [context]
 * @returns {{ ok: true, data: UserReport, warnings: string[] } | { ok: false, reason: string }}
 */
export function parseUserReport(doc, { courseId = null } = {}) {
  const table = queryFirst(doc, TABLE_SELECTORS);
  if (!table) return fail("Couldn't find the grade table on this page.");

  const warnings = [];
  const allCategories = []; // every category header, in page order
  const stack = []; // categories enclosing the current row, outermost first
  let courseTotalPercent = null;

  for (const row of table.querySelectorAll('tbody tr')) {
    const nameCell = row.querySelector('.column-itemname');
    if (!nameCell) continue; // spacer / layout rows

    const level = levelOf(nameCell);
    if (level === null) return fail(`Couldn't tell how "${cleanText(nameCell)}" is nested.`);

    const name = cleanText(nameCell.querySelector('.gradeitemheader') ?? nameCell);
    const gradeCell = row.querySelector('.column-grade');
    const isTotal = isTotalRow(nameCell, name);

    // A row at level N closes every category at level N or deeper. What's left on top of
    // the stack is the row's parent. Moodle totals sit at their category's level;
    // keep that category on the stack for its total row.
    while (
      stack.length > 0 &&
      (stack.at(-1).level > level || (!isTotal && stack.at(-1).level === level))
    ) stack.pop();
    const parent = stack.at(-1);

    if (!gradeCell) {
      // Category header. `top` is the top-level category it belongs to (itself, for a
      // top-level one); the course row has none.
      const isCourse = stack.length === 0;
      const category = {
        categoryId: categoryIdOf(nameCell, name),
        name,
        level,
        isCourse,
        weightPercent: null,
        items: [],
      };
      category.top = isCourse ? null : parent.isCourse ? category : parent.top;
      stack.push(category);
      allCategories.push(category);
      continue;
    }

    if (!parent) return fail(`Found "${name}" outside of any category.`);

    if (isTotal) {
      if (parent.isCourse) {
        // Use Moodle's percentage, not grade / range: the range shows the course's full
        // maximum, but Moodle leaves ungraded items out of the percentage. Without a
        // percentage column, Moodle may still print one in the grade: "C- (70.00 %)".
        courseTotalPercent =
          parsePercent(cleanText(row.querySelector('.column-percentage'))) ??
          percentInText(cleanText(gradeCell));
      } else if (parent.top === parent) {
        // Only a top-level category's weight is a share of the course. A nested category's
        // weight is relative to its parent, so it isn't a weight the calculator can use.
        parent.weightPercent = parsePercent(cleanText(row.querySelector('.column-weight')));
      }
      continue;
    }

    const item = parseItemRow(row, nameCell, name);
    if (!item.ok) return item;
    if (item.data === null) {
      warnings.push(...item.warnings);
      continue;
    }
    // Course-level items stay on the course; anything inside a category counts toward its
    // top-level category, however deeply nested.
    (parent.isCourse ? parent : parent.top).items.push(item.data);
  }

  if (allCategories.length === 0) return fail("Couldn't find any grade categories in the table.");

  const { categories, extraCreditItems } = toCalculatorCategories(allCategories, warnings);

  if (categories.every((category) => category.items.length === 0)) {
    return fail("Couldn't find any grade items in the table.");
  }

  const knownWeights = categories.filter((c) => c.weightPercent !== null);
  const weightSum = knownWeights.reduce((sum, c) => sum + c.weightPercent, 0);
  if (knownWeights.length === categories.length && Math.abs(weightSum - 100) > 0.5) {
    warnings.push(`Category weights add up to ${weightSum}%, not 100%.`);
  }

  const hasEstimatedGrades = categories.some((category) => category.items.some((item) => item.isEstimated));
  if (hasEstimatedGrades) {
    warnings.push("Some grades are shown only as letters; they're estimated at the bottom of each letter's range.");
  }

  return ok({ courseId, courseTotalPercent, categories, extraCreditItems, hasEstimatedGrades }, warnings);
}

/**
 * Reads one grade-item row. Returns ok(null, warnings) for an item whose grade can't be
 * turned into a percentage at all (e.g. a "Satisfactory" scale): it's left out and the
 * student is told, rather than it silently looking "not graded yet".
 */
function parseItemRow(row, nameCell, name) {
  const gradeText = cleanText(row.querySelector('.column-grade'));
  const weightCell = row.querySelector('.column-weight');
  const weightText = cleanText(weightCell);

  let scorePercent = null;
  let isEstimated = false;
  if (!isEmptyGrade(gradeText)) {
    if (parseGrade(gradeText) !== null) {
      // A number: needs a range or percentage to mean anything.
      scorePercent = scorePercentOf(row) ?? percentInText(gradeText);
      if (scorePercent === null) {
        // A grade we can't turn into a percentage must not quietly become "not graded yet".
        return fail(`Couldn't work out a percentage for "${name}" (grade "${gradeText}").`);
      }
    } else {
      // Not a number: "B+ (88.00 %)", a bare letter "A+", or a scale word like "Complete".
      scorePercent = percentInText(gradeText);
      if (scorePercent === null) {
        scorePercent = letterGradeFloor(gradeText);
        isEstimated = scorePercent !== null;
      }
      if (scorePercent === null) {
        return ok(null, [`Couldn't turn the grade "${gradeText}" for "${name}" into a percentage; it's left out.`]);
      }
    }
  }

  const link = nameCell.querySelector('a[href]');
  const weightPercent = parsePercent(weightText);
  const isExtraCredit = /extra credit/i.test(weightText);
  const isDropped =
    row.querySelector('.dropped') !== null ||
    /dropped/i.test(weightText) ||
    (scorePercent !== null && weightPercent === 0);

  return ok({
    id: String(numberParamFromUrl(link?.getAttribute('href'), 'id') ?? (nameCell.id || name)),
    name,
    scorePercent,
    isEstimated,
    maxScore: parseRange(cleanText(row.querySelector('.column-range')))?.max ?? null,
    weightPercent,
    isDropped,
    isExtraCredit,
  });
}

/**
 * A row's score as a percentage: from grade and range when possible (more precise than
 * the rounded percentage column), otherwise from the percentage column.
 */
function scorePercentOf(row) {
  const grade = parseGrade(cleanText(row.querySelector('.column-grade')));
  const range = parseRange(cleanText(row.querySelector('.column-range')));
  if (grade !== null && range && range.max > range.min) {
    return ((grade - range.min) / (range.max - range.min)) * 100;
  }
  return parsePercent(cleanText(row.querySelector('.column-percentage')));
}

/**
 * Flattens the parsed tree into calculator categories:
 *   - each top-level category, holding every grade item nested anywhere inside it
 *   - each grade item that sits directly in the course becomes its own category
 *     (e.g. "Participation", 15%), weighted by its own weight cell
 * Nested categories don't become calculator categories of their own.
 */
function toCalculatorCategories(allCategories, warnings) {
  const categories = [];
  const extraCreditItems = [];

  const toItem = ({ id, name, scorePercent, maxScore, isEstimated }) => ({
    id,
    name,
    scorePercent,
    maxScore,
    isEstimated,
  });
  const keepItem = (item) => {
    if (!item.isExtraCredit) return true;
    extraCreditItems.push({ id: item.id, name: item.name, scorePercent: item.scorePercent });
    return false;
  };

  // Real categories first, then the course-level items.
  const courseLast = [...allCategories].sort((a, b) => Number(a.isCourse) - Number(b.isCourse));

  for (const category of courseLast) {
    if (category.isCourse) {
      for (const item of category.items.filter(keepItem)) {
        categories.push({
          categoryId: `item-${item.id}`,
          name: item.name,
          weightPercent: item.weightPercent,
          items: [toItem(item)],
        });
      }
      continue;
    }

    // A nested category's items were already counted in its top-level category.
    if (category.top !== category) continue;

    const items = category.items.filter(keepItem);
    categories.push({
      categoryId: category.categoryId,
      name: category.name,
      weightPercent: category.weightPercent,
      // The report doesn't say "drop lowest N" anywhere; it only marks the dropped items.
      dropLowestCount: items.filter((item) => item.isDropped).length,
      items: items.map(toItem),
    });
  }

  for (const category of categories) {
    if (category.weightPercent === null) {
      warnings.push(`Couldn't read the weight of "${category.name}"; the user will need to enter it.`);
    }
  }

  return { categories, extraCreditItems };
}

/** "level3" -> 3 */
function levelOf(cell) {
  const match = cell.className.match(/\blevel(\d+)\b/);
  return match ? Number(match[1]) : null;
}

/** Moodle gives category header cells ids like "cat_12_3" (category 12, user 3). */
function categoryIdOf(cell, name) {
  const match = cell.id.match(/^cat_(\d+)/);
  return match ? match[1] : name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * Category and course totals: Moodle marks their name cell with "baggt"/"baggb"
 * (aggregate top/bottom). Falling back to the name catches themes that drop the class.
 */
function isTotalRow(nameCell, name) {
  return /\bbagg[tb]\b/.test(nameCell.className) || /\btotal$/i.test(name);
}
