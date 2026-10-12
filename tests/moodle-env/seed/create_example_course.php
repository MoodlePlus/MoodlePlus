<?php
// Creates the example class used to test the grade-calculator browser extension:
// one teacher, three students, and a gradebook with weighted categories, graded and
// ungraded items, a drop-lowest rule and an extra-credit item.
//
// It uses Moodle's own test data generators, the same ones admin/tool/generator
// ("Make test course") uses. Run by "./moodle.sh install" or "./moodle.sh seed".
// Edit the arrays below to change the class; then run "./moodle.sh reset".
//
// Dates are relative to when the seed runs, so "past due" and "upcoming"
// items stay that way no matter when you build the site.

define('CLI_SCRIPT', true);

require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->libdir . '/gradelib.php');
require_once($CFG->libdir . '/phpunit/classes/util.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/mod/assign/locallib.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');

use core_question\local\bank\question_version_status;
use mod_quiz\quiz_attempt;
use mod_quiz\quiz_settings;

$now = time();
$day = DAYSECS;

$course = [
    'fullname' => 'EX 101 (001) FALL 2026: Example Course for Grade Extension Testing',
    'shortname' => 'EX101-001-FA26',
    'category' => 'Fall 2026',
];

// username => [firstname, lastname, role]. Password = username.
$users = [
    'teacher1' => ['Terry', 'Teacher', 'editingteacher'],
    'student1' => ['Sam', 'Student', 'student'],
    'student2' => ['Alex', 'Example', 'student'],
    'student3' => ['Jordan', 'Sample', 'student'],
];

// Top-level gradebook layout. Aggregation is Natural (Moodle's default) with the
// category weights overridden so they add up to 100% (Participation is the remaining 15%).
// Natural only allows "drop lowest" when every item in the category has the same max grade.
$gradecategories = [
    'Homework' => ['weight' => 25, 'droplow' => 1, 'section' => 1],
    'Quizzes'  => ['weight' => 15, 'droplow' => 0, 'section' => 2],
    'Exams'    => ['weight' => 45, 'droplow' => 0, 'section' => 3],
];

// Assignments. 'due' is days relative to now. Grades: null = not graded yet.
$assignments = [
    'Homework 1'   => ['category' => 'Homework', 'max' => 20,  'due' => -35,
        'grades' => ['student1' => 18, 'student2' => 20, 'student3' => 12]],
    'Homework 2'   => ['category' => 'Homework', 'max' => 20,  'due' => -21,
        'grades' => ['student1' => 15, 'student2' => 19, 'student3' => 0]],
    'Homework 3'   => ['category' => 'Homework', 'max' => 20,  'due' => -7,
        'grades' => ['student1' => 20, 'student2' => 17, 'student3' => 14]],
    'Homework 4'   => ['category' => 'Homework', 'max' => 20,  'due' => 7,
        'grades' => []],
    'Midterm Exam' => ['category' => 'Exams',    'max' => 100, 'due' => -14,
        'grades' => ['student1' => 82, 'student2' => 91, 'student3' => 64]],
    'Final Exam'   => ['category' => 'Exams',    'max' => 100, 'due' => 60,
        'grades' => []],
];

// Quizzes with three true/false questions each, worth 10 points.
// 'correct' = how many questions each student answers correctly (real attempts are created).
// 'open' and 'close' are days relative to now. Quiz 3 is open now with no attempts, so you can
// take it as a student and watch the grade appear.
$quizzes = [
    'Quiz 1' => ['open' => -35, 'close' => -28, 'correct' => ['student1' => 2, 'student2' => 3, 'student3' => 1]],
    'Quiz 2' => ['open' => -17, 'close' => -10, 'correct' => ['student1' => 3, 'student2' => 2, 'student3' => 2]],
    'Quiz 3' => ['open' => -1,  'close' => 14,  'correct' => []],
];

// Manual grade items at course level (no activity behind them).
$manualitems = [
    'Participation' => ['max' => 10, 'weight' => 15, 'extracredit' => false,
        'grades' => ['student1' => 9, 'student2' => 10, 'student3' => 7]],
    'Extra Credit: Course Survey' => ['max' => 2, 'weight' => null, 'extracredit' => true,
        'grades' => ['student1' => 2, 'student3' => 1]],
];

$feedback = [
    'Homework 2' => ['student1' => 'Part 3 was missing the units on your final answer.'],
    'Midterm Exam' => ['student1' => 'Solid work. Review question 4 on recursion.'],
];

// ---------------------------------------------------------------------------

\core\session\manager::set_user(get_admin());
$gen = phpunit_util::get_data_generator();

cli_heading('Creating example course');

if ($DB->record_exists('course', ['shortname' => $course['shortname']])) {
    mtrace("Course {$course['shortname']} already exists; nothing to do.");
    mtrace("Run './moodle.sh reset' to rebuild the site and the example data from scratch.");
    exit(0);
}

// Users (reused if they already exist).
$userids = [];
foreach ($users as $username => [$firstname, $lastname]) {
    $existing = $DB->get_record('user', ['username' => $username, 'deleted' => 0]);
    $userids[$username] = $existing ? $existing->id : $gen->create_user([
        'username' => $username,
        'password' => $username,
        'firstname' => $firstname,
        'lastname' => $lastname,
        'email' => "{$username}@example.com",
        'lang' => get_config('core', 'lang'),
    ])->id;
}
mtrace('Users: ' . implode(', ', array_keys($userids)));

// Course category and course.
$category = $DB->get_record('course_categories', ['name' => $course['category']])
    ?: $gen->create_category(['name' => $course['category']]);
$courserecord = $gen->create_course([
    'fullname' => $course['fullname'],
    'shortname' => $course['shortname'],
    'category' => $category->id,
    'format' => 'topics',
    'numsections' => 3,
    'startdate' => $now - 50 * $day,
    'enddate' => $now + 70 * $day,
    'summary' => 'Example course with a weighted gradebook for testing a grade-calculator browser extension.',
], ['createsections' => true]);
$courseid = $courserecord->id;
mtrace("Course: {$course['fullname']} (id {$courseid})");

foreach ($gradecategories as $name => $info) {
    $section = $DB->get_record('course_sections', ['course' => $courseid, 'section' => $info['section']]);
    course_update_section($courserecord, $section, ['name' => $name]);
}

foreach ($users as $username => [, , $role]) {
    $gen->enrol_user($userids[$username], $courseid, $role);
}

// Gradebook structure.
$coursegradecat = grade_category::fetch_course_category($courseid);
$coursegradecat->aggregation = GRADE_AGGREGATE_SUM; // "Natural".
$coursegradecat->update();

$gradecatids = [];
foreach ($gradecategories as $name => $info) {
    $gradecatids[$name] = $gen->create_grade_category([
        'courseid' => $courseid,
        'fullname' => $name,
        'aggregation' => GRADE_AGGREGATE_SUM,
        'droplow' => $info['droplow'],
    ])->id;
}

// Assignments.
foreach ($assignments as $name => $info) {
    $instance = $gen->create_module('assign', [
        'course' => $courseid,
        'section' => $gradecategories[$info['category']]['section'],
        'name' => $name,
        'intro' => "Submit your answers for {$name} as online text.",
        'grade' => $info['max'],
        'allowsubmissionsfromdate' => $now + ($info['due'] - 14) * $day,
        'duedate' => $now + $info['due'] * $day,
        'gradecat' => $gradecatids[$info['category']],
        'submissiondrafts' => 0,
        'assignsubmission_onlinetext_enabled' => 1,
        'assignsubmission_file_enabled' => 0,
        'assignfeedback_comments_enabled' => 1,
    ]);
    $cm = get_coursemodule_from_instance('assign', $instance->id, $courseid, false, MUST_EXIST);
    $assign = new assign(context_module::instance($cm->id), $cm, $courserecord);

    foreach ($info['grades'] as $username => $grade) {
        $gen->get_plugin_generator('mod_assign')->create_submission([
            'cmid' => $cm->id,
            'userid' => $userids[$username],
            'onlinetext' => "My answers for {$name}.",
            'status' => ASSIGN_SUBMISSION_STATUS_SUBMITTED,
        ]);
        $assign->save_grade($userids[$username], (object) [
            'grade' => $grade,
            'attemptnumber' => 0,
            'assignfeedbackcomments_editor' => [
                'text' => $feedback[$name][$username] ?? '',
                'format' => FORMAT_HTML,
            ],
        ]);
    }
    mtrace("Assignment: {$name} ({$info['max']} pts, " . count($info['grades']) . ' graded)');
}

// Quizzes.
$questiongen = $gen->get_plugin_generator('core_question');
$quizgen = $gen->get_plugin_generator('mod_quiz');
$questioncat = $questiongen->create_question_category([
    'contextid' => context_course::instance($courseid)->id,
    'name' => 'EX 101 quiz questions',
]);
$statements = [
    ['Moodle is written mainly in PHP.', 1],
    ['A weighted average always equals the plain average.', 0],
    ['Dropping the lowest score can raise a category grade.', 1],
];
foreach ($quizzes as $name => $info) {
    // Create the quiz without dates first, because attempts can't start on a closed quiz.
    $quiz = $gen->create_module('quiz', [
        'course' => $courseid,
        'section' => $gradecategories['Quizzes']['section'],
        'name' => $name,
        'intro' => "{$name}: three true/false questions.",
        'grade' => 10,
        'sumgrades' => count($statements),
        'questionsperpage' => 0,
        'preferredbehaviour' => 'deferredfeedback',
        'gradecat' => $gradecatids['Quizzes'],
    ]);
    foreach ($statements as $i => [$text, $correct]) {
        // Saved through the question type directly: core_question's generator->create_question()
        // loads PHPUnit test helpers, which are not installed outside a PHPUnit environment.
        $question = question_bank::get_qtype('truefalse')->save_question((object) [
            'qtype' => 'truefalse',
            'idnumber' => null,
            'status' => question_version_status::QUESTION_STATUS_READY,
        ], (object) [
            'category' => $questioncat->id,
            'name' => "{$name} Q" . ($i + 1),
            'questiontext' => ['text' => $text, 'format' => FORMAT_HTML],
            'generalfeedback' => ['text' => '', 'format' => FORMAT_HTML],
            'defaultmark' => 1,
            'penalty' => 1,
            'correctanswer' => $correct,
            'feedbacktrue' => ['text' => '', 'format' => FORMAT_HTML],
            'feedbackfalse' => ['text' => '', 'format' => FORMAT_HTML],
            'status' => question_version_status::QUESTION_STATUS_READY,
        ]);
        quiz_add_quiz_question($question->id, $quiz, 0, 1);
    }
    quiz_settings::create($quiz->id)->get_grade_calculator()->recompute_quiz_sumgrades();

    $timeclose = $now + $info['close'] * $day;
    foreach ($info['correct'] as $username => $numcorrect) {
        \core\session\manager::set_user(core_user::get_user($userids[$username]));
        $attempt = $quizgen->create_attempt($quiz->id, $userids[$username]);

        // Build the same POST data the quiz page sends. (mod_quiz's generator->submit_responses()
        // can't be used here, because it calls a method that only works inside unit tests.)
        // The first $numcorrect answers are right.
        $attemptobj = quiz_attempt::create($attempt->id);
        $postdata = [];
        foreach ($attemptobj->get_slots() as $i => $slot) {
            $qa = $attemptobj->get_question_attempt($slot);
            $correct = $statements[$i][1];
            $postdata[$qa->get_control_field_name('sequencecheck')] = (string) $qa->get_sequence_check_count();
            $postdata[$qa->get_flag_field_name()] = '0';
            $postdata[$qa->get_qt_field_name('answer')] = (string) ($i < $numcorrect ? $correct : 1 - $correct);
        }
        $timefinish = $timeclose - $day;
        $attemptobj->process_submitted_actions($timefinish, false, $postdata);
        $attemptobj->process_finish($timefinish, false);
        $DB->set_field('quiz_attempts', 'timestart', $timefinish - 20 * MINSECS, ['id' => $attempt->id]);
    }
    \core\session\manager::set_user(get_admin());

    $quiz->timeopen = $now + $info['open'] * $day;
    $quiz->timeclose = $timeclose;
    $DB->update_record('quiz', ['id' => $quiz->id, 'timeopen' => $quiz->timeopen, 'timeclose' => $quiz->timeclose]);
    quiz_update_events($quiz);
    mtrace("Quiz: {$name} (10 pts, " . count($info['correct']) . ' attempts)');
}
rebuild_course_cache($courseid, true);

// Manual grade items.
$manualitemids = [];
foreach ($manualitems as $name => $info) {
    $item = new grade_item($gen->create_grade_item([
        'courseid' => $courseid,
        'itemname' => $name,
        'grademax' => $info['max'],
        'categoryid' => $coursegradecat->id,
        // In Natural aggregation, aggregationcoef = 1 marks an item as extra credit.
        'aggregationcoef' => $info['extracredit'] ? 1 : 0,
    ]), false);
    foreach ($info['grades'] as $username => $grade) {
        $item->update_final_grade($userids[$username], $grade, 'manual');
    }
    $manualitemids[$name] = $item->id;
    mtrace("Manual grade item: {$name} ({$info['max']} pts" . ($info['extracredit'] ? ', extra credit' : '') . ')');
}

// Override the top-level weights.
$weights = [];
foreach ($gradecategories as $name => $info) {
    $weights[] = [grade_item::fetch(['itemtype' => 'category', 'iteminstance' => $gradecatids[$name]]), $info['weight']];
}
foreach ($manualitems as $name => $info) {
    if ($info['weight'] !== null) {
        $weights[] = [grade_item::fetch(['id' => $manualitemids[$name]]), $info['weight']];
    }
}
foreach ($weights as [$item, $weight]) {
    $item->aggregationcoef2 = $weight / 100;
    $item->weightoverride = 1;
    $item->update();
}

grade_regrade_final_grades($courseid);

// Print Moodle's own calculation as a reference for checking the extension.
cli_heading('Gradebook (as calculated by Moodle)');
$courseitem = grade_item::fetch_course_item($courseid);
foreach (array_keys(array_filter($users, fn($u) => $u[2] === 'student')) as $username) {
    $grade = new grade_grade(['itemid' => $courseitem->id, 'userid' => $userids[$username]]);
    // Like the user report: with Natural aggregation, ungraded items are left out of each
    // student's maximum, so the percentage uses the student's own max, not the course max.
    $item = clone $courseitem;
    $item->grademax = $grade->get_grade_max();
    $item->grademin = $grade->get_grade_min();
    mtrace(sprintf('%-10s course total %s (%s / %s)', $username,
        grade_format_gradevalue($grade->finalgrade, $item, true, GRADE_DISPLAY_TYPE_PERCENTAGE),
        grade_format_gradevalue($grade->finalgrade, $item, true, GRADE_DISPLAY_TYPE_REAL),
        format_float($item->grademax, 2)));
}

mtrace("\nCourse URL:  {$CFG->wwwroot}/course/view.php?id={$courseid}");
mtrace("User report: {$CFG->wwwroot}/grade/report/user/index.php?id={$courseid}");
