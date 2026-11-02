// Pure helpers for the popup's grade calculator view: turns a course's parsed
// GradeCategory[] (src/parsing/parsers/userReport.js) into choices for the "what do I
// need on X" picker. No DOM - keeps this testable without the calculator or storage.

/**
 * @typedef {import('./gradeCalculator.js').GradeCategory} GradeCategory
 */

/**
 * Only categories with something left ungraded are worth solving for - a fully-graded
 * category's average is already fixed, so "what score do I need" has no meaning for it.
 * @param {GradeCategory[]} categories
 * @returns {GradeCategory[]}
 */
export function getSolvableCategories(categories) {
  return categories.filter((category) => category.items.some((item) => item.scorePercent === null));
}

/**
 * A label for a <select> option, e.g. "Exams (45%)" or "Participation (weight unknown)".
 * @param {GradeCategory} category
 */
export function formatCategoryOptionLabel(category) {
  const weight = category.weightPercent === null ? 'weight unknown' : `${category.weightPercent}%`;
  return `${category.name} (${weight})`;
}

/**
 * Maps calculateRequiredScore's pendingCategoryIds (categories left out of the
 * calculation because nothing in them is graded yet) back to display names, so the UI
 * can say *which* categories weren't counted instead of just "something was excluded".
 * @param {GradeCategory[]} categories
 * @param {string[]} pendingCategoryIds
 * @returns {string[]}
 */
export function resolvePendingCategoryNames(categories, pendingCategoryIds) {
  const nameById = new Map(categories.map((category) => [category.categoryId, category.name]));
  return pendingCategoryIds.map((id) => nameById.get(id) ?? id);
}
