import { describe, it } from 'vitest';
// import { expect } from 'vitest';
// import { fixtureExists, htmlToDocument, loadFixture } from '../../../tests/helpers/fixtures.js';
// import { parseCalendarUpcoming } from './calendarUpcoming.js';

// TODO(Divy): turn each it.todo into a real test (see userReport.test.js for the pattern).
// Start with the real captured page: tests/fixtures/moodle/student1/calendar-upcoming.html
describe('parseCalendarUpcoming', () => {
  it.todo('lists Homework 4, Quiz 3 and the Final Exam for the example course');
  it.todo('reads due dates from timestamps, not from the display text');
  it.todo('returns an empty list (ok) when Moodle says there are no upcoming events');
  it.todo('fails when the event list is missing entirely');
});
