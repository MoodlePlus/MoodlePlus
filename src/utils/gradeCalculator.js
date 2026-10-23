/**
 * @typedef {Object} GradeItem
 * @property {string} id
 * @property {string} name
 * @property {number|null} scorePercent null represents an unentered/pending grade (never treated as 0)
 * @property {boolean} [isTargetAssessment] true if this is the target assessment (e.g. Final Exam)
 */

/**
 * @typedef {Object} GradeCategory
 * @property {string} categoryId
 * @property {string} name
 * @property {number} weightPercent e.g. 20 for 20%
 * @property {number} [dropLowestCount] number of lowest scores to drop
 * @property {GradeItem[]} items
 */

/**
 * @typedef {Object} RequiredScoreResult
 * @property {number|null} requiredScorePercent
 * @property {boolean} isPossible
 * @property {string} message
 * @property {string[]} pendingCategoryIds categories left out because they have no scores entered yet
 */

// Upper bound when searching for a required score; anything above this is reported as unreachable.
const MAX_SEARCH_SCORE = 1e6;

/**
 * Calculates category average, handling dropped lowest scores and ignoring pending (null) grades.
 * @param {GradeItem[]} items
 * @param {number} [dropLowestCount]
 * @returns {{ average: number|null, droppedScores: number[] }}
 */
export function calculateCategoryAverage(items, dropLowestCount = 0) {
  const gradedScores = items
    .filter((item) => item.scorePercent !== null && !item.isTargetAssessment)
    .map((item) => item.scorePercent);

  if (gradedScores.length === 0) {
    return { average: null, droppedScores: [] };
  }

  const sorted = [...gradedScores].sort((a, b) => a - b);
  const numToDrop = Math.min(dropLowestCount, Math.max(0, sorted.length - 1));
  const droppedScores = sorted.slice(0, numToDrop);
  const remainingScores = sorted.slice(numToDrop);

  const sum = remainingScores.reduce((acc, score) => acc + score, 0);
  const average = sum / remainingScores.length;

  return { average, droppedScores };
}

/**
 * Calculates current overall weighted percentage across categories.
 * @param {GradeCategory[]} categories
 * @returns {number|null}
 */
export function calculateCurrentGrade(categories) {
  let totalWeightedPoints = 0;
  let totalEvaluatedWeight = 0;

  for (const category of categories) {
    const { average } = calculateCategoryAverage(category.items, category.dropLowestCount);

    if (average !== null) {
      totalWeightedPoints += average * (category.weightPercent / 100);
      totalEvaluatedWeight += category.weightPercent / 100;
    }
  }

  if (totalEvaluatedWeight === 0) return null;

  return totalWeightedPoints / totalEvaluatedWeight;
}

/**
 * Rounds up to one decimal place so "you need at least X%" is never short of the target.
 * The small epsilon absorbs floating-point noise from the search (e.g. 90.0000000001 -> 90).
 * @param {number} score
 */
function roundUpToTenth(score) {
  return Math.ceil(score * 10 - 1e-6) / 10;
}

/**
 * Solves for the required score on a target assessment to reach a desired overall grade.
 *
 * Categories with no scores entered yet are left out of the calculation rather than counted
 * as 0 (see Design doc 3.3); their ids are returned in `pendingCategoryIds` so the UI can
 * prompt for an estimate. Entering an estimated score on one of their items includes them.
 *
 * @param {GradeCategory[]} categories
 * @param {number} targetOverallGrade
 * @param {string} targetCategoryId
 * @returns {RequiredScoreResult}
 */
export function calculateRequiredScore(categories, targetOverallGrade, targetCategoryId) {
  const targetCategory = categories.find((c) => c.categoryId === targetCategoryId);

  if (!targetCategory) {
    return {
      requiredScorePercent: null,
      isPossible: false,
      message: "Target category not found.",
      pendingCategoryIds: [],
    };
  }

  const targetWeightFraction = targetCategory.weightPercent / 100;
  let otherWeightedPoints = 0;
  let countedWeight = targetCategory.weightPercent;
  const pendingCategoryIds = [];

  for (const category of categories) {
    if (category.categoryId === targetCategoryId) continue;

    const { average } = calculateCategoryAverage(category.items, category.dropLowestCount);

    if (average === null) {
      pendingCategoryIds.push(category.categoryId);
      continue;
    }

    otherWeightedPoints += average * (category.weightPercent / 100);
    countedWeight += category.weightPercent;
  }

  if (countedWeight <= 0 || targetWeightFraction <= 0) {
    return {
      requiredScorePercent: null,
      isPossible: false,
      message: "Invalid category weights configured.",
      pendingCategoryIds,
    };
  }

  const existingScores = targetCategory.items
    .filter((item) => item.scorePercent !== null && !item.isTargetAssessment)
    .map((item) => item.scorePercent);

  const dropCount = targetCategory.dropLowestCount || 0;

  // Overall grade if the target assessment scores `candidateScore`. Non-decreasing in
  // candidateScore (a low candidate may be dropped, but never lowers the grade), so we can bisect.
  const simulateOverallGrade = (candidateScore) => {
    const allScores = [...existingScores, candidateScore].sort((a, b) => a - b);
    const numToDrop = Math.min(dropCount, Math.max(0, allScores.length - 1));
    const activeScores = allScores.slice(numToDrop);
    const catAvg = activeScores.reduce((a, b) => a + b, 0) / activeScores.length;

    return (otherWeightedPoints + catAvg * targetWeightFraction) / (countedWeight / 100);
  };

  if (simulateOverallGrade(0) >= targetOverallGrade) {
    return {
      requiredScorePercent: 0,
      isPossible: true,
      message: "Target grade already secured (0% or higher needed).",
      pendingCategoryIds,
    };
  }

  // Grow the upper bound until it reaches the target, so large requirements aren't capped.
  let low = 0;
  let high = 100;
  while (simulateOverallGrade(high) < targetOverallGrade && high < MAX_SEARCH_SCORE) {
    low = high;
    high *= 2;
  }

  if (simulateOverallGrade(high) < targetOverallGrade) {
    return {
      requiredScorePercent: null,
      isPossible: false,
      message: "Target unreachable, even with unlimited extra credit on the remaining assessment.",
      pendingCategoryIds,
    };
  }

  // Invariant: simulate(low) < target <= simulate(high).
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (simulateOverallGrade(mid) < targetOverallGrade) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const requiredScore = roundUpToTenth(high);

  if (requiredScore > 100) {
    return {
      requiredScorePercent: requiredScore,
      isPossible: false,
      message: `Required score of ${requiredScore}% exceeds 100%. Target unreachable without extra credit.`,
      pendingCategoryIds,
    };
  }

  return {
    requiredScorePercent: requiredScore,
    isPossible: true,
    message: `You need at least ${requiredScore}% on the remaining assessment to achieve ${targetOverallGrade}%.`,
    pendingCategoryIds,
  };
}
