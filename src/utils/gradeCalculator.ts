export interface GradeItem {
  id: string;
  name: string;
  scorePercent: number | null; // null represents an unentered/pending grade
  isTargetAssessment?: boolean; // true if this is the target assessment (e.g. Final Exam)
}

export interface GradeCategory {
  categoryId: string;
  name: string;
  weightPercent: number; // e.g. 20 for 20%
  dropLowestCount?: number; // number of lowest scores to drop
  items: GradeItem[];
}

export interface RequiredScoreResult {
  requiredScorePercent: number | null;
  isPossible: boolean;
  message: string;
}

/**
 * Calculates category average, handling dropped lowest scores and ignoring pending (null) grades.
 */
export function calculateCategoryAverage(
  items: GradeItem[],
  dropLowestCount: number = 0
): { average: number | null; droppedScores: number[] } {
  const gradedScores = items
    .filter((item) => item.scorePercent !== null && !item.isTargetAssessment)
    .map((item) => item.scorePercent as number);

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
 */
export function calculateCurrentGrade(categories: GradeCategory[]): number | null {
  let totalWeightedPoints = 0;
  let totalEvaluatedWeight = 0;

  for (const category of categories) {
    const { average } = calculateCategoryAverage(
      category.items,
      category.dropLowestCount
    );

    if (average !== null) {
      totalWeightedPoints += average * (category.weightPercent / 100);
      totalEvaluatedWeight += category.weightPercent / 100;
    }
  }

  if (totalEvaluatedWeight === 0) return null;

  return totalWeightedPoints / totalEvaluatedWeight;
}

/**
 * Solves algebraically for the required score on a target assessment to reach a desired overall grade.
 */
export function calculateRequiredScore(
  categories: GradeCategory[],
  targetOverallGrade: number,
  targetCategoryId: string
): RequiredScoreResult {
  const targetCategory = categories.find((c) => c.categoryId === targetCategoryId);

  if (!targetCategory) {
    return {
      requiredScorePercent: null,
      isPossible: false,
      message: "Target category not found.",
    };
  }

  const totalWeight = categories.reduce((sum, c) => sum + c.weightPercent, 0);
  const targetWeightFraction = targetCategory.weightPercent / 100;

  if (totalWeight <= 0 || targetWeightFraction <= 0) {
    return {
      requiredScorePercent: null,
      isPossible: false,
      message: "Invalid category weights configured.",
    };
  }

  let otherWeightedPoints = 0;
  for (const category of categories) {
    if (category.categoryId === targetCategoryId) continue;

    const { average } = calculateCategoryAverage(
      category.items,
      category.dropLowestCount
    );

    if (average !== null) {
      otherWeightedPoints += average * (category.weightPercent / 100);
    }
  }

  const existingScores = targetCategory.items
    .filter((item) => item.scorePercent !== null && !item.isTargetAssessment)
    .map((item) => item.scorePercent as number);

  const dropCount = targetCategory.dropLowestCount || 0;

  const simulateOverallGrade = (candidateScore: number): number => {
    const allScores = [...existingScores, candidateScore].sort((a, b) => a - b);
    const numToDrop = Math.min(dropCount, Math.max(0, allScores.length - 1));
    const activeScores = allScores.slice(numToDrop);
    const catAvg = activeScores.reduce((a, b) => a + b, 0) / activeScores.length;

    const catWeightedPoints = catAvg * targetWeightFraction;
    return (otherWeightedPoints + catWeightedPoints) / (totalWeight / 100);
  };

  let low = -100;
  let high = 300;
  let solvedScore = 0;

  for (let i = 0; i < 50; i++) {
    solvedScore = (low + high) / 2;
    if (simulateOverallGrade(solvedScore) < targetOverallGrade) {
      low = solvedScore;
    } else {
      high = solvedScore;
    }
  }

  const roundedScore = Math.round(solvedScore * 10) / 10;

  if (roundedScore > 100) {
    return {
      requiredScorePercent: roundedScore,
      isPossible: false,
      message: `Required score of ${roundedScore}% exceeds 100%. Target unreachable without extra credit.`,
    };
  }

  if (roundedScore < 0) {
    return {
      requiredScorePercent: 0,
      isPossible: true,
      message: "Target grade already secured (0% or higher needed).",
    };
  }

  return {
    requiredScorePercent: roundedScore,
    isPossible: true,
    message: `You need at least ${roundedScore}% on the remaining assessment to achieve ${targetOverallGrade}%.`,
  };
}