<?php
// Site-level settings that match what is publicly visible on NC State's Moodle:
// Boost Union theme, US English (en_us) language pack, and Eastern time.
// Run by "./moodle.sh install" inside the webserver container. Safe to re-run.

define('CLI_SCRIPT', true);

require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');

\core\session\manager::set_user(get_admin());

cli_heading('Configuring site');

// Language: NC State pages use lang="en-us". There is no core CLI for language packs, so use
// the same controller as Site administration > Language > Language packs.
if (!get_string_manager()->translation_exists('en_us', false)) {
    mtrace('Installing en_us language pack from download.moodle.org...');
    $controller = new \tool_langimport\controller();
    $controller->install_languagepacks('en_us');
    get_string_manager()->reset_caches();
}
if (get_string_manager()->translation_exists('en_us', false)) {
    set_config('lang', 'en_us');
    mtrace('Default language: en_us');
} else {
    mtrace('WARNING: en_us language pack could not be installed; staying on en.');
}

// Theme: NC State's "ncsu" theme is not public, but it is a child of Boost Union.
if (file_exists($CFG->dirroot . '/theme/boost_union/version.php')) {
    set_config('theme', 'boost_union');
    mtrace('Theme: boost_union');
} else {
    mtrace('WARNING: theme/boost_union is missing; staying on boost.');
}

set_config('timezone', 'America/New_York');
mtrace('Default timezone: America/New_York');

theme_reset_all_caches();
purge_all_caches();
mtrace('Done.');
