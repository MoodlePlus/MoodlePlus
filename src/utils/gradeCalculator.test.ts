import { describe, it, expect } from "vitest";
import {
  calculateCategoryAverage,
  calculateCurrentGrade,
  calculateRequiredScore,
  GradeCategory,
} from "./gradeCalculator";

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
    const categories: GradeCategory[] = [
      {
        categoryId: "cat1",
        name: "Homework",
        weightPercent: 40,
        items: [{ id: "1", name: "HW1", scorePercent: 80 }],
      },
      {
        categoryId: "cat2",
        name: "Exams",
        weightPercent: 60,
        items: [{ id: "2", name: "Exam1", scorePercent: 90 }],
      },
    ];
    expect(calculateCurrentGrade(categories)).toBe(86);
  });

  it("calculates required score on target final exam", () => {
    const categories: GradeCategory[] = [
      {
        categoryId: "hw",
        name: "Homework",
        weightPercent: 50,
        items: [{ id: "1", name: "HW Avg", scorePercent: 90 }],
      },
      {
        categoryId: "exam",
        name: "Final Exam",
        weightPercent: 50,
        items: [{ id: "2", name: "Final", scorePercent: null, isTargetAssessment: true }],
      },
    ];

    const result = calculateRequiredScore(categories, 90, "exam");
    expect(result.isPossible).toBe(true);
    expect(result.requiredScorePercent).toBe(90);
  });
});