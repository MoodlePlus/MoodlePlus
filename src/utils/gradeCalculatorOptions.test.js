import { describe, it, expect } from 'vitest';
import {
  applyWeightOverrides,
  formatCategoryOptionLabel,
  getSolvableCategories,
  resolvePendingCategoryNames,
  summarizeWeights,
} from './gradeCalculatorOptions.js';

const category = (overrides) => ({
  categoryId: 'cat',
  name: 'Category',
  weightPercent: 20,
  dropLowestCount: 0,
  items: [],
  ...overrides,
});

describe('getSolvableCategories', () => {
  it('excludes a fully-graded category', () => {
    const graded = category({ items: [{ id: '1', name: 'HW1', scorePercent: 90, maxScore: 100 }] });
    expect(getSolvableCategories([graded])).toEqual([]);
  });

  it('includes a category with at least one ungraded item', () => {
    const mixed = category({
      items: [
        { id: '1', name: 'HW1', scorePercent: 90, maxScore: 100 },
        { id: '2', name: 'HW2', scorePercent: null, maxScore: 100 },
      ],
    });
    expect(getSolvableCategories([mixed])).toEqual([mixed]);
  });

  it('includes an entirely ungraded category (e.g. a lone Final Exam)', () => {
    const final = category({ name: 'Final Exam', items: [{ id: '1', name: 'Final', scorePercent: null, maxScore: 100 }] });
    expect(getSolvableCategories([final])).toEqual([final]);
  });

  it('returns [] for no categories', () => {
    expect(getSolvableCategories([])).toEqual([]);
  });
});

describe('formatCategoryOptionLabel', () => {
  it('shows the weight percent when known', () => {
    expect(formatCategoryOptionLabel(category({ name: 'Exams', weightPercent: 45 }))).toBe('Exams (45%)');
  });

  it('falls back to "weight unknown" when the weight could not be read', () => {
    expect(formatCategoryOptionLabel(category({ name: 'Mystery', weightPercent: null }))).toBe('Mystery (weight unknown)');
  });
});

describe('resolvePendingCategoryNames', () => {
  const categories = [category({ categoryId: 'hw', name: 'Homework' }), category({ categoryId: 'quiz', name: 'Quizzes' })];

  it('maps ids to names', () => {
    expect(resolvePendingCategoryNames(categories, ['quiz'])).toEqual(['Quizzes']);
  });

  it('falls back to the raw id if a category is unknown', () => {
    expect(resolvePendingCategoryNames(categories, ['ghost'])).toEqual(['ghost']);
  });

  it('returns [] for no pending ids', () => {
    expect(resolvePendingCategoryNames(categories, [])).toEqual([]);
  });
});

describe('applyWeightOverrides', () => {
  const categories = [
    category({ categoryId: 'ind', name: 'Individual', weightPercent: null }),
    category({ categoryId: 'team', name: 'Team', weightPercent: 30 }),
  ];

  it('fills in a weight the gradebook hid', () => {
    expect(applyWeightOverrides(categories, { ind: 70 })[0].weightPercent).toBe(70);
  });

  it('also replaces a scraped weight the student corrected', () => {
    expect(applyWeightOverrides(categories, { team: 25 })[1].weightPercent).toBe(25);
  });

  it('ignores missing or non-numeric overrides and does not mutate its input', () => {
    const result = applyWeightOverrides(categories, { ind: NaN, team: undefined });
    expect(result.map((c) => c.weightPercent)).toEqual([null, 30]);
    expect(categories[0].weightPercent).toBeNull();
  });
});

describe('summarizeWeights', () => {
  it('lists categories still missing a weight and sums the known ones', () => {
    const summary = summarizeWeights([
      category({ name: 'Individual', weightPercent: null }),
      category({ name: 'Team', weightPercent: 30 }),
      category({ name: 'Quizzes', weightPercent: 12.5 }),
    ]);
    expect(summary.missing.map((c) => c.name)).toEqual(['Individual']);
    expect(summary.total).toBe(42.5);
  });
});
