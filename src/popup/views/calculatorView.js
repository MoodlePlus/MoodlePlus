// Grade calculator tab: lets the student pick a course, then a still-ungraded category,
// and see what score they need in it to hit a target overall grade. DOM/storage glue
// only - the math lives in src/utils/gradeCalculator.js (unchanged) and the pure
// filtering/labelling helpers live in src/utils/gradeCalculatorOptions.js.

import { COURSE_DATA_KINDS, getCourseData, getCourseList } from '../../storage/courseCache.js';
import { buildCourseGradeLinks, buildEmptyStateWithLinks } from './pageLinks.js';
import { calculateCurrentGrade, calculateRequiredScore } from '../../utils/gradeCalculator.js';
import {
  formatCategoryOptionLabel,
  getSolvableCategories,
  resolvePendingCategoryNames,
} from '../../utils/gradeCalculatorOptions.js';

/** @param {HTMLElement} root */
export async function initCalculatorView(root) {
  /** @type {Map<number, { courseName: string, report: object, isStale: boolean }>} */
  let gradesByCourseId = new Map();
  let loadError = false;

  let selectedCourseId = null;
  let selectedCategoryId = null;
  let targetGradeInput = '';

  let knownCourses = [];

  try {
    const courseList = await getCourseList();
    knownCourses = courseList?.data ?? [];
    if (courseList) {
      const entries = await Promise.all(
        courseList.data.map(async (course) => {
          const entry = await getCourseData(course.courseId, COURSE_DATA_KINDS.GRADES);
          return entry ? { course, entry } : null;
        }),
      );
      for (const item of entries) {
        if (!item) continue;
        gradesByCourseId.set(item.course.courseId, {
          courseName: item.course.courseName,
          report: item.entry.data,
          isStale: item.entry.isStale,
        });
      }
    }
  } catch (err) {
    console.error('[Moodle+] Could not load grade data.', err);
    loadError = true;
  }

  selectedCourseId = gradesByCourseId.keys().next().value ?? null;

  // Courses we know about but haven't read a grade report for yet - linked straight to
  // their grade report, the one page the calculator can use.
  const unloadedCourses = knownCourses.filter((course) => !gradesByCourseId.has(course.courseId));

  let emptyHelp = null;
  let moreCourses = null;
  if (!loadError && gradesByCourseId.size === 0) {
    emptyHelp =
      unloadedCourses.length > 0
        ? await buildCourseGradeLinks("No grades loaded yet. Open a course's grades once to use it here:", unloadedCourses)
        : await buildEmptyStateWithLinks(
            "No grades loaded yet. Open a course's Grades page once.",
            ['gradesOverview'],
            'You can get to each course from here:',
          );
    emptyHelp.classList.add('empty-state');
  } else if (!loadError && unloadedCourses.length > 0) {
    moreCourses = await buildCourseGradeLinks('Add another course (opens its grades):', unloadedCourses);
    moreCourses.classList.add('more-courses');
  }

  render();

  function render() {
    root.textContent = '';

    if (loadError) {
      root.appendChild(banner("Couldn't load your grade data. Try reopening the popup."));
      return;
    }

    if (gradesByCourseId.size === 0) {
      root.appendChild(emptyHelp);
      return;
    }

    const course = gradesByCourseId.get(selectedCourseId);

    if (gradesByCourseId.size > 1) {
      root.appendChild(buildCourseField());
    } else {
      const name = document.createElement('div');
      name.className = 'course-name';
      name.textContent = course.courseName;
      root.appendChild(name);
    }

    if (course.isStale) {
      root.appendChild(bannerEl('warning', 'Showing cached data — visit the gradebook page to refresh it.'));
    }

    const currentGrade = calculateCurrentGrade(course.report.categories);
    const currentGradeLabel = document.createElement('div');
    currentGradeLabel.className = 'current-grade-label';
    currentGradeLabel.textContent = 'Current grade';
    root.appendChild(currentGradeLabel);

    const currentGradeEl = document.createElement('div');
    currentGradeEl.className = 'current-grade';
    currentGradeEl.textContent = currentGrade === null ? 'Not enough graded work yet' : `${currentGrade.toFixed(2)}%`;
    root.appendChild(currentGradeEl);

    const solvable = getSolvableCategories(course.report.categories);
    if (solvable.length === 0) {
      root.appendChild(emptyState('Every category already has a grade — nothing left to solve for.'));
      if (moreCourses) root.appendChild(moreCourses);
      return;
    }

    if (selectedCategoryId === null || !solvable.some((c) => c.categoryId === selectedCategoryId)) {
      selectedCategoryId = solvable[0].categoryId;
    }

    root.appendChild(buildCategoryField(solvable));
    root.appendChild(buildTargetField());

    const resultContainer = document.createElement('div');
    resultContainer.id = 'calc-result';
    root.appendChild(resultContainer);
    updateResult(course, resultContainer);

    if (moreCourses) root.appendChild(moreCourses);
  }

  // Only this container is rebuilt while the user types a target grade, so the number
  // input itself is never destroyed/recreated (which would steal focus every keystroke).
  function updateResult(course, resultContainer) {
    resultContainer.textContent = '';
    const target = Number(targetGradeInput);
    if (targetGradeInput === '' || !Number.isFinite(target)) return;

    const result = calculateRequiredScore(course.report.categories, target, selectedCategoryId);
    resultContainer.appendChild(buildResultPanel(result));

    if (result.pendingCategoryIds.length > 0) {
      const names = resolvePendingCategoryNames(course.report.categories, result.pendingCategoryIds);
      resultContainer.appendChild(
        bannerEl(
          'pending',
          `Not counted yet: ${names.join(', ')} — they have no grades entered. Enter a score for them to include them here.`,
        ),
      );
    }
  }

  function buildCourseField() {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.textContent = 'Course';
    label.htmlFor = 'calc-course';
    field.appendChild(label);

    const select = document.createElement('select');
    select.id = 'calc-course';
    for (const [courseId, { courseName }] of gradesByCourseId) {
      const option = document.createElement('option');
      option.value = String(courseId);
      option.textContent = courseName;
      option.selected = courseId === selectedCourseId;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      selectedCourseId = Number(select.value);
      selectedCategoryId = null;
      render();
    });
    field.appendChild(select);
    return field;
  }

  function buildCategoryField(solvable) {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.textContent = 'Solve for';
    label.htmlFor = 'calc-category';
    field.appendChild(label);

    const select = document.createElement('select');
    select.id = 'calc-category';
    for (const category of solvable) {
      const option = document.createElement('option');
      option.value = category.categoryId;
      option.textContent = formatCategoryOptionLabel(category);
      option.selected = category.categoryId === selectedCategoryId;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      selectedCategoryId = select.value;
      render();
    });
    field.appendChild(select);
    return field;
  }

  function buildTargetField() {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.textContent = 'Target overall grade (%)';
    label.htmlFor = 'calc-target';
    field.appendChild(label);

    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'calc-target';
    input.min = '0';
    input.max = '100';
    input.step = '0.1';
    input.value = targetGradeInput;
    input.placeholder = 'e.g. 90';
    input.addEventListener('input', () => {
      targetGradeInput = input.value;
      const resultContainer = root.querySelector('#calc-result');
      if (resultContainer) updateResult(gradesByCourseId.get(selectedCourseId), resultContainer);
    });
    field.appendChild(input);
    return field;
  }

  function buildResultPanel(result) {
    const panel = document.createElement('div');
    panel.className = `result-panel ${result.isPossible ? 'result-panel--success' : 'result-panel--danger'}`;
    panel.textContent = result.message;
    return panel;
  }
}

function banner(message) {
  return bannerEl('error', message);
}

function bannerEl(variant, message) {
  const el = document.createElement('div');
  el.className = variant === 'pending' ? 'pending-note' : `banner banner--${variant}`;
  el.textContent = message;
  return el;
}

function emptyState(message) {
  const el = document.createElement('p');
  el.className = 'empty-state';
  el.textContent = message;
  return el;
}
