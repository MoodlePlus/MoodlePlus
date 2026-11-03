import { describe, it, expect, vi } from 'vitest';

// courseCache imports the storage wrapper, which needs a browser extension runtime.
vi.mock('webextension-polyfill', () => ({ default: { storage: { local: {}, onChanged: {} } } }));

const { mergeCourseLists } = await import('./courseCache.js');

const course = (courseId, courseName, url = `http://x/course/view.php?id=${courseId}`) => ({
  courseId,
  courseName,
  url,
});

describe('mergeCourseLists', () => {
  it('adds courses it has not seen before', () => {
    expect(mergeCourseLists([course(2, 'CSC 201')], [course(5, 'CSC 226')])).toEqual([
      course(2, 'CSC 201'),
      course(5, 'CSC 226'),
    ]);
  });

  it('keeps the existing entry when a course is seen again (the grades overview stays authoritative)', () => {
    const existing = [course(2, 'CSC 201 Full Official Name', 'http://overview-link')];
    expect(mergeCourseLists(existing, [course(2, 'CSC 201 short', 'http://other')])).toEqual(existing);
  });

  it('skips incoming courses with no name rather than storing a blank one', () => {
    expect(mergeCourseLists([], [{ courseId: 9, courseName: null, url: null }])).toEqual([]);
  });

  it('de-duplicates within a single batch (e.g. several events from one course)', () => {
    const merged = mergeCourseLists([], [course(2, 'CSC 201'), course(2, 'CSC 201')]);
    expect(merged).toHaveLength(1);
  });

  it('does not mutate its inputs', () => {
    const existing = [course(2, 'CSC 201')];
    mergeCourseLists(existing, [course(5, 'CSC 226')]);
    expect(existing).toHaveLength(1);
  });
});
