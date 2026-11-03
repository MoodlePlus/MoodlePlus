import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { fixtureExists, fixturePath, htmlToDocument, loadFixture } from '../../../tests/helpers/fixtures.js';
import { parseCalendarUpcoming } from './calendarUpcoming.js';

describe('parseCalendarUpcoming failures', () => {
  it('fails when the event list is missing entirely', () => {
    const result = parseCalendarUpcoming(htmlToDocument('<body><p>Nothing here</p></body>'));
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('find the calendar') });
  });

  it('returns an empty list (ok) when Moodle says there are no upcoming events', () => {
    const result = parseCalendarUpcoming(
      htmlToDocument('<div data-region="calendar"><p>There are no upcoming events</p></div>'),
    );
    expect(result).toEqual({ ok: true, data: [], warnings: [] });
  });
});

const fixture = 'moodle/student1/calendar-upcoming.html';

describe.skipIf(!fixtureExists(fixture))('parseCalendarUpcoming (real page, student1)', () => {
  const result = parseCalendarUpcoming(loadFixture(fixture));

  it('parses successfully with no warnings', () => {
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('lists Homework 4 and the Quiz 3 close event for the example course', () => {
    // The Final Exam (60 days out) is beyond Moodle's "upcoming" lookahead window and
    // genuinely does not appear on this page - that's a real limit of the source page,
    // not something this parser can work around.
    const titles = result.data.map((event) => event.title).sort();
    expect(titles).toEqual(['Homework 4 is due', 'Quiz 3 closes']);
    expect(result.data.every((event) => event.courseId === 2)).toBe(true);
  });

  it('reads due dates from timestamps, not from the display text', () => {
    // Due dates are relative to whenever the local Moodle was last seeded, so we can't
    // hardcode an expected value here - instead, pull each event's own timestamp straight
    // out of the fixture's raw markup (by its event id) and check the parser read that
    // same value, independent of event order or the human-readable text next to it.
    const raw = readFileSync(fixturePath(fixture), 'utf8');
    const expectedSecondsFor = (eventId) => {
      const eventStart = raw.indexOf(`data-event-id="${eventId}"`);
      const eventEnd = raw.indexOf('data-type="event"', eventStart + 1);
      const block = raw.slice(eventStart, eventEnd === -1 ? undefined : eventEnd);
      const [, seconds] = block.match(/view=day&amp;time=(\d+)/) ?? [];
      return seconds ? Number(seconds) : null;
    };

    for (const event of result.data) {
      const expectedSeconds = expectedSecondsFor(event.assignmentId);
      expect(expectedSeconds).not.toBeNull();
      expect(event.dueDate).toBe(new Date(expectedSeconds * 1000).toISOString());
    }
  });

  it('reads each event id and an activity url', () => {
    const quiz3 = result.data.find((event) => event.title === 'Quiz 3 closes');
    expect(quiz3.assignmentId).toBe('12');
    expect(quiz3.url).toContain('/mod/quiz/view.php?id=');
  });

  it('names each event\'s course, so the calendar works before the grades overview is visited', () => {
    for (const event of result.data) {
      expect(event.courseName).toBe('EX 101 (001) FALL 2026: Example Course for Grade Extension Testing');
      expect(event.courseUrl).toContain('/course/view.php?id=2');
    }
  });
});
