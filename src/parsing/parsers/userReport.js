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
// Columns are found by class (.column-grade etc.), never by position: site admins can
// hide columns, which shifts positions around.
//
// Output uses the grade calculator's GradeCategory shape (src/utils/gradeCalculator.js),
// so the result can be passed straight to calculateCurrentGrade / calculateRequiredScore.

import { cleanText, numberParamFromUrl, queryFirst } from '../dom.js';
import { parseGrade, parsePercent, parseRange } from '../numbers.js';
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
      // Category header.
      const category = {
        categoryId: categoryIdOf(nameCell, name),
        name,
        level,
        isCourse: stack.length === 0,
        weightPercent: null,
        items: [],
      };
      stack.push(category);
      allCategories.push(category);
      continue;
    }

    if (!parent) return fail(`Found "${name}" outside of any category.`);

    if (isTotal) {
      if (parent.isCourse) {
        // Use Moodle's percentage, not grade / range: the range shows the course's full
        // maximum, but Moodle leaves ungraded items out of the percentage.
        courseTotalPercent = parsePercent(cleanText(row.querySelector('.column-percentage')));
      } else {
        parent.weightPercent = parsePercent(cleanText(row.querySelector('.column-weight')));
      }
      continue;
    }

    const item = parseItemRow(row, nameCell, name);
    if (!item.ok) return item;
    parent.items.push(item.data);
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

  return ok({ courseId, courseTotalPercent, categories, extraCreditItems }, warnings);
}

/** Reads one grade-item row. */
function parseItemRow(row, nameCell, name) {
  const gradeText = cleanText(row.querySelector('.column-grade'));
  const weightCell = row.querySelector('.column-weight');
  const weightText = cleanText(weightCell);
  const grade = parseGrade(gradeText);

  let scorePercent = null;
  if (grade !== null) {
    scorePercent = scorePercentOf(row);
    if (scorePercent === null) {
      // A grade we can't turn into a percentage must not quietly become "not graded yet".
      return fail(`Couldn't work out a percentage for "${name}" (grade "${gradeText}").`);
    }
  }

  const link = nameCell.querySelector('a[href]');
  const weightPercent = parsePercent(weightText);
  const isExtraCredit = /extra credit/i.test(weightText);
  const isDropped =
    row.querySelector('.dropped') !== null ||
    /dropped/i.test(weightText) ||
    (grade !== null && weightPercent === 0);

  return ok({
    id: String(numberParamFromUrl(link?.getAttribute('href'), 'id') ?? (nameCell.id || name)),
    name,
    scorePercent,
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
 *   - each top-level category keeps its own items
 *   - each grade item that sits directly in the course becomes its own category
 *     (e.g. "Participation", 15%), weighted by its own weight cell
 */
function toCalculatorCategories(allCategories, warnings) {
  const categories = [];
  const extraCreditItems = [];

  const toItem = ({ id, name, scorePercent, maxScore }) => ({ id, name, scorePercent, maxScore });
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

    if (category.level > 2) {
      // TODO: support nested categories (a category inside a category). Their total row's
      // weight is relative to the parent category, not the course.
      warnings.push(`"${category.name}" is a nested category; nested categories aren't supported yet.`);
    }

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
