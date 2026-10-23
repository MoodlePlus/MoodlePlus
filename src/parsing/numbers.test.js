import { describe, it, expect } from 'vitest';
import { parseGrade, parsePercent, parseRange } from './numbers.js';

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
