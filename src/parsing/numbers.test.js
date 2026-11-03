import { describe, it, expect } from 'vitest';
import { isEmptyGrade, letterGradeFloor, parseGrade, parsePercent, parseRange, percentInText } from './numbers.js';

describe('parseGrade', () => {
  it('treats an empty grade as null and a real zero as 0', () => {
    expect(parseGrade('-')).toBeNull();
    expect(parseGrade('')).toBeNull();
    expect(parseGrade('0.00')).toBe(0);
  });

  it('reads plain and thousands-separated numbers', () => {
    expect(parseGrade('18.00')).toBe(18);
    expect(parseGrade('1,234.50')).toBe(1234.5);
  });
});

describe('parsePercent', () => {
  it('reads "90.00 %" and "90%"', () => {
    expect(parsePercent('90.00 %')).toBe(90);
    expect(parsePercent('90%')).toBe(90);
    expect(parsePercent('-')).toBeNull();
  });
});

describe('parseRange', () => {
  it("reads Moodle's en-dash ranges", () => {
    expect(parseRange('0–20')).toEqual({ min: 0, max: 20 });
    expect(parseRange('0-100')).toEqual({ min: 0, max: 100 });
    expect(parseRange('n/a')).toBeNull();
  });
});

describe('isEmptyGrade', () => {
  it("recognises Moodle's not-graded markers but not a real zero", () => {
    expect(isEmptyGrade('-')).toBe(true);
    expect(isEmptyGrade('  ')).toBe(true);
    expect(isEmptyGrade('0.00')).toBe(false);
    expect(isEmptyGrade('A+')).toBe(false);
  });

  it('treats a dash followed by a link (a quiz\'s "- Grade analysis") as empty, but not a negative number', () => {
    expect(isEmptyGrade('- Grade analysis')).toBe(true);
    expect(isEmptyGrade('-5.00')).toBe(false);
  });
});

describe('percentInText', () => {
  it('reads the percentage in a "letter (percentage)" grade', () => {
    expect(percentInText('C- (70.00 %)')).toBe(70);
    expect(percentInText('A (95.5%)')).toBe(95.5);
  });

  it('returns null when there is no percentage', () => {
    expect(percentInText('A+')).toBeNull();
    expect(percentInText('-')).toBeNull();
  });
});

describe('letterGradeFloor', () => {
  it("maps letters to the bottom of NC State's range", () => {
    expect(letterGradeFloor('A+')).toBe(97);
    expect(letterGradeFloor('C-')).toBe(70);
    expect(letterGradeFloor(' b ')).toBe(83);
    expect(letterGradeFloor('F')).toBe(0);
  });

  it('reads the leading letter when other text follows', () => {
    expect(letterGradeFloor('A+ Grade analysis')).toBe(97);
    expect(letterGradeFloor('C- (70.00 %)')).toBe(70);
  });

  it('returns null for anything that does not start with a letter grade', () => {
    expect(letterGradeFloor('Satisfactory')).toBeNull();
    expect(letterGradeFloor('Fair')).toBeNull();
    expect(letterGradeFloor('E')).toBeNull();
    expect(letterGradeFloor('-')).toBeNull();
  });
});
