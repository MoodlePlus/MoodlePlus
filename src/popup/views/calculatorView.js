// Grade calculator tab: lets the student pick a course, then a still-ungraded category,
// and see what score they need in it to hit a target overall grade. DOM/storage glue
// only - the math lives in src/utils/gradeCalculator.js and the pure
// filtering/labelling helpers live in src/utils/gradeCalculatorOptions.js.
//
// Many real courses hide their category weights, so the student can type them in from the
// syllabus ("Category weights"); those are saved per course and win over scraped values
// (Design doc 3.3). The solver stays hidden until every category has a weight.

import {
  COURSE_DATA_KINDS,
  getCourseData,
  getCourseList,
  getWeightOverrides,
  saveWeightOverrides,
} from '../../storage/courseCache.js';
import { buildCourseGradeLinks, buildEmptyStateWithLinks } from './pageLinks.js';
import { calculateCurrentGrade, calculateRequiredScore } from '../../utils/gradeCalculator.js';
import {
  applyWeightOverrides,
  formatCategoryOptionLabel,
  getSolvableCategories,
  resolvePendingCategoryNames,
  summarizeWeights,
} from '../../utils/gradeCalculatorOptions.js';

/** @param {HTMLElement} root */
export async function initCalculatorView(root) {
  /**
   * @type {Map<number, { courseName: string, report: object, isStale: boolean,
   *   overrides: Record<string, number> }>}
   */
  let gradesByCourseId = new Map();
  let loadError = false;

  let selectedCourseId = null;
  let selectedCategoryId = null;
  let targetGradeInput = '';
  /** Whether the weights section is expanded, per course (defaults to open when weights are missing). */
  const weightsOpenByCourse = new Map();

  let knownCourses = [];

  try {
    const courseList = await getCourseList();
    knownCourses = courseList?.data ?? [];
    if (courseList) {
      const entries = await Promise.all(
        courseList.data.map(async (course) => {
          const entry = await getCourseData(course.courseId, COURSE_DATA_KINDS.GRADES);
          if (!entry) return null;
          return { course, entry, overrides: await getWeightOverrides(course.courseId) };
        }),
      );
      for (const item of entries) {
        if (!item) continue;
        gradesByCourseId.set(item.course.courseId, {
          courseName: item.course.courseName,
          report: item.entry.data,
          isStale: item.entry.isStale,
          overrides: item.overrides,
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

    const categories = categoriesFor(course);
    const weights = summarizeWeights(categories);
    root.appendChild(buildCurrentGrade(course, categories, weights));

    if (course.report.hasEstimatedGrades) {
      const note = document.createElement('p');
      note.className = 'estimate-note';
      note.textContent =
        "Some grades show only as letters on WolfWare, so they're estimated at the bottom of each letter's range (e.g. A+ = 97%).";
      root.appendChild(note);
    }

    root.appendChild(buildWeightsSection(course, categories, weights));

    if (weights.missing.length > 0) {
      root.appendChild(emptyState('Add the missing weights from your syllabus to use the calculator.'));
      if (moreCourses) root.appendChild(moreCourses);
      return;
    }
    if (Math.abs(weights.total - 100) > 0.5) {
      root.appendChild(bannerEl('warning', `Your weights add up to ${weights.total}%, not 100% — double-check them.`));
    }

    const solvable = getSolvableCategories(categories);
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

  /** The course's categories with the student's own weights applied. */
  function categoriesFor(course) {
    return applyWeightOverrides(course.report.categories, course.overrides);
  }

  /**
   * WolfWare's own course total when the page shows one - it's authoritative (it includes
   * things we can't see, like hidden items and extra credit). Otherwise our calculation,
   * once every category has a weight.
   */
  function buildCurrentGrade(course, categories, weights) {
    const wrapper = document.createElement('div');

    const label = document.createElement('div');
    label.className = 'current-grade-label';
    label.textContent = 'Current grade';
    wrapper.appendChild(label);

    const value = document.createElement('div');
    value.className = 'current-grade';
    const source = document.createElement('div');
    source.className = 'current-grade-source';

    const fromWolfware = course.report.courseTotalPercent;
    const calculated = weights.missing.length === 0 ? calculateCurrentGrade(categories) : null;
    if (fromWolfware !== null && fromWolfware !== undefined) {
      value.textContent = `${fromWolfware.toFixed(2)}%`;
      source.textContent = 'As shown on WolfWare';
    } else if (calculated !== null) {
      value.textContent = `${calculated.toFixed(2)}%`;
      source.textContent = 'Calculated from your graded work';
    } else {
      value.textContent = weights.missing.length > 0 ? '—' : 'Not enough graded work yet';
      if (weights.missing.length > 0) source.textContent = 'Needs category weights';
    }
    wrapper.appendChild(value);
    if (source.textContent) wrapper.appendChild(source);
    return wrapper;
  }

  function buildWeightsSection(course, categories, weights) {
    const details = document.createElement('details');
    details.className = 'weights';
    details.open = weightsOpenByCourse.get(selectedCourseId) ?? weights.missing.length > 0;

    const summary = document.createElement('summary');
    // Remember only the student's own clicks. (Not the "toggle" event: it also fires when
    // the section is first rendered open, which would pin it open after the weights are
    // complete and push the answer out of view.)
    summary.addEventListener('click', () => weightsOpenByCourse.set(selectedCourseId, !details.open));
    summary.textContent =
      weights.missing.length > 0 ? `Category weights · ${weights.missing.length} missing` : 'Category weights';
    details.appendChild(summary);

    const hint = document.createElement('p');
    hint.className = 'weights-hint';
    hint.textContent = "From your syllabus. Leave a box empty to use the weight WolfWare shows, if it shows one.";
    details.appendChild(hint);

    course.report.categories.forEach((scraped, index) => {
      const row = document.createElement('div');
      row.className = 'weight-row';

      const label = document.createElement('label');
      label.htmlFor = `calc-weight-${index}`;
      label.textContent = scraped.name;
      row.appendChild(label);

      const input = document.createElement('input');
      input.type = 'number';
      input.id = `calc-weight-${index}`;
      input.min = '0';
      input.max = '100';
      input.step = '0.1';
      const override = course.overrides[scraped.categoryId];
      input.value = Number.isFinite(override) ? String(override) : '';
      input.placeholder = scraped.weightPercent === null ? '?' : String(scraped.weightPercent);
      input.addEventListener('change', () => onWeightChange(course, scraped.categoryId, input));
      row.appendChild(input);

      const unit = document.createElement('span');
      unit.textContent = '%';
      row.appendChild(unit);

      details.appendChild(row);
    });

    const total = document.createElement('div');
    total.className = 'weights-total';
    total.textContent = `Total: ${weights.total}%`;
    details.appendChild(total);
    return details;
  }

  async function onWeightChange(course, categoryId, input) {
    const previous = { ...course.overrides };
    const next = { ...course.overrides };
    if (input.value.trim() === '') {
      delete next[categoryId];
    } else {
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        input.value = Number.isFinite(previous[categoryId]) ? String(previous[categoryId]) : '';
        return;
      }
      next[categoryId] = value;
    }

    course.overrides = next;
    render();
    try {
      await saveWeightOverrides(selectedCourseId, next);
    } catch (err) {
      // Revert so the calculator never uses weights that weren't saved.
      console.error('[Moodle+] Could not save category weights.', err);
      course.overrides = previous;
      render();
    }
  }

  // Only this container is rebuilt while the user types a target grade, so the number
  // input itself is never destroyed/recreated (which would steal focus every keystroke).
  function updateResult(course, resultContainer) {
    resultContainer.textContent = '';
    const target = Number(targetGradeInput);
    if (targetGradeInput === '' || !Number.isFinite(target)) return;

    const categories = categoriesFor(course);
    const result = calculateRequiredScore(categories, target, selectedCategoryId);
    resultContainer.appendChild(buildResultPanel(result));

    if (result.pendingCategoryIds.length > 0) {
      const names = resolvePendingCategoryNames(categories, result.pendingCategoryIds);
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
