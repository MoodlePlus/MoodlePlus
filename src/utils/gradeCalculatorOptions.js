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
 * Applies weights the student entered over the ones read from the gradebook. Any valid
 * number wins (to fix a wrong scraped weight too); anything else keeps the scraped value.
 * Does not mutate its input.
 * @param {GradeCategory[]} categories
 * @param {Record<string, number>} overrides by categoryId
 * @returns {GradeCategory[]}
 */
export function applyWeightOverrides(categories, overrides) {
  return categories.map((category) => {
    const override = overrides[category.categoryId];
    return Number.isFinite(override) ? { ...category, weightPercent: override } : category;
  });
}

/**
 * @param {GradeCategory[]} categories
 * @returns {{ missing: GradeCategory[], total: number }} categories with no weight yet, and
 *   the sum of the weights that are known
 */
export function summarizeWeights(categories) {
  const missing = categories.filter((category) => category.weightPercent === null);
  const total = categories.reduce((sum, category) => sum + (category.weightPercent ?? 0), 0);
  return { missing, total: Math.round(total * 100) / 100 };
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
