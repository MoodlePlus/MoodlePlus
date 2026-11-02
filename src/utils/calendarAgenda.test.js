import { describe, it, expect } from 'vitest';
import { getDateRange, withCourseNames, buildAgenda, formatDayLabel } from './calendarAgenda.js';

const REF = new Date('2026-11-02T12:00:00Z');

const assignment = (id, courseId, dueDate, title = `Item ${id}`) => ({
  assignmentId: id,
  courseId,
  title,
  dueDate,
  url: null,
});

describe('getDateRange', () => {
  it('day mode is a 1-day window starting today', () => {
    const { start, end } = getDateRange('day', REF);
    expect(end - start).toBe(1 * 86400000);
  });

  it('week mode is 7 days, month mode is 30 days', () => {
    expect(getDateRange('week', REF).end - getDateRange('week', REF).start).toBe(7 * 86400000);
    expect(getDateRange('month', REF).end - getDateRange('month', REF).start).toBe(30 * 86400000);
  });

  it('falls back to month for an unknown view mode', () => {
    const range = getDateRange('decade', REF);
    expect(range.end - range.start).toBe(30 * 86400000);
  });
});

describe('withCourseNames', () => {
  it('joins in the course name by courseId', () => {
    const result = withCourseNames([assignment('1', 2, REF.toISOString())], [{ courseId: 2, courseName: 'CSC 201' }]);
    expect(result[0].courseName).toBe('CSC 201');
  });

  it('falls back to "Unknown course" and does not mutate the input', () => {
    const input = [assignment('1', 99, REF.toISOString())];
    const result = withCourseNames(input, [{ courseId: 2, courseName: 'CSC 201' }]);
    expect(result[0].courseName).toBe('Unknown course');
    expect(input[0].courseName).toBeUndefined();
  });
});

describe('buildAgenda', () => {
  it('puts a past-due item in overdue, independent of view mode', () => {
    const past = assignment('1', 2, '2026-10-20T12:00:00Z');
    expect(buildAgenda([past], 'day', REF).overdue).toHaveLength(1);
    expect(buildAgenda([past], 'month', REF).overdue).toHaveLength(1);
  });

  it('includes an item exactly at the start of the window', () => {
    const atStart = assignment('1', 2, '2026-11-02T00:00:00');
    expect(buildAgenda([atStart], 'day', REF).days).toHaveLength(1);
  });

  it('excludes an item exactly at the end of the window', () => {
    const atEnd = assignment('1', 2, '2026-11-03T00:00:00');
    const agenda = buildAgenda([atEnd], 'day', REF);
    expect(agenda.days).toHaveLength(0);
    expect(agenda.overdue).toHaveLength(0);
  });

  it('groups same-day items together, sorted within the day by time, days ascending', () => {
    const items = [
      assignment('1', 2, '2026-11-05T09:00:00', 'Second day, 9am'),
      assignment('2', 2, '2026-11-02T18:00:00', 'First day'),
      assignment('3', 2, '2026-11-05T08:00:00', 'Second day, 8am'),
    ];
    const { days } = buildAgenda(items, 'week', REF);
    expect(days.map((d) => d.dateKey)).toEqual(['2026-11-02', '2026-11-05']);
    expect(days[1].items.map((i) => i.title)).toEqual(['Second day, 8am', 'Second day, 9am']);
  });

  it('returns empty buckets for no assignments', () => {
    expect(buildAgenda([], 'month', REF)).toEqual({ overdue: [], days: [] });
  });
});

describe('formatDayLabel', () => {
  it('labels today and tomorrow', () => {
    expect(formatDayLabel(new Date('2026-11-02T08:00:00'), REF)).toBe('Today');
    expect(formatDayLabel(new Date('2026-11-03T08:00:00'), REF)).toBe('Tomorrow');
  });

  it('falls back to a short weekday + date for anything further out', () => {
    const label = formatDayLabel(new Date('2026-11-09T08:00:00'), REF);
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toBe('Today');
    expect(label).not.toBe('Tomorrow');
  });
});
