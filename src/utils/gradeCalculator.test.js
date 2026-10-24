import { describe, it, expect } from "vitest";
import {
  calculateCategoryAverage,
  calculateCurrentGrade,
  calculateRequiredScore,
} from "./gradeCalculator.js";

// Builds a single-item category, e.g. category("hw", 50, 90).
const category = (categoryId, weightPercent, scorePercent, isTargetAssessment = false) => ({
  categoryId,
  name: categoryId,
  weightPercent,
  items: [{ id: categoryId, name: categoryId, scorePercent, isTargetAssessment }],
});

describe("gradeCalculator", () => {
  it("drops lowest score correctly in category calculation", () => {
    const items = [
      { id: "1", name: "Quiz 1", scorePercent: 60 },
      { id: "2", name: "Quiz 2", scorePercent: 90 },
      { id: "3", name: "Quiz 3", scorePercent: 80 },
    ];
    const { average, droppedScores } = calculateCategoryAverage(items, 1);
    expect(droppedScores).toEqual([60]);
    expect(average).toBe(85);
  });

  it("ignores pending (null) scores without treating them as zero", () => {
    const items = [
      { id: "1", name: "HW 1", scorePercent: 100 },
      { id: "2", name: "HW 2", scorePercent: null },
    ];
    const { average } = calculateCategoryAverage(items, 0);
    expect(average).toBe(100);
  });

  it("calculates overall weighted current grade correctly", () => {
    const categories = [category("hw", 40, 80), category("exams", 60, 90)];
    expect(calculateCurrentGrade(categories)).toBe(86);
  });

  it("calculates required score on target final exam", () => {
    const categories = [category("hw", 50, 90), category("exam", 50, null, true)];

    const result = calculateRequiredScore(categories, 90, "exam");
    expect(result.isPossible).toBe(true);
    expect(result.requiredScorePercent).toBe(90);
  });

  it("leaves categories with no scores yet out instead of counting them as zero", () => {
    // HW 50% @ 90, Project 20% not entered yet, Final 30%. Target 80.
    // Over the 80% of weight that counts: (45 + 0.3 * S) / 0.8 = 80  =>  S = 63.33...
    const categories = [
      category("hw", 50, 90),
      category("project", 20, null),
      category("final", 30, null, true),
    ];

    const result = calculateRequiredScore(categories, 80, "final");
    expect(result.isPossible).toBe(true);
    expect(result.requiredScorePercent).toBe(63.4);
    expect(result.pendingCategoryIds).toEqual(["project"]);
  });

  it("reports the true required score when it is far above 100%", () => {
    // (47.5 + 0.05 * S) = 90  =>  S = 850
    const categories = [category("hw", 95, 50), category("final", 5, null, true)];

    const result = calculateRequiredScore(categories, 90, "final");
    expect(result.isPossible).toBe(false);
    expect(result.requiredScorePercent).toBe(850);
  });

  it("rounds the required score up so it always reaches the target", () => {
    // 40.04 + 0.5 * S = 90  =>  S = 99.92, so 99.9% would fall short.
    const categories = [category("hw", 50, 80.08), category("final", 50, null, true)];

    const result = calculateRequiredScore(categories, 90, "final");
    expect(result.isPossible).toBe(true);
    expect(result.requiredScorePercent).toBe(100);
  });

  it("reports an already-secured target as needing 0%", () => {
    const categories = [category("hw", 90, 100), category("final", 10, null, true)];

    const result = calculateRequiredScore(categories, 80, "final");
    expect(result.isPossible).toBe(true);
    expect(result.requiredScorePercent).toBe(0);
  });
});
