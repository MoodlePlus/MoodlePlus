#!/usr/bin/env bash
# Single entry point for the local NC State-version Moodle replica.
# Wraps the moodle-docker steps from https://github.com/moodlehq/moodle-docker#quick-start
# Run "./moodle.sh help" for the commands.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=moodle.env
source "$ROOT/moodle.env"
export MOODLE_DOCKER_WWWROOT="$ROOT/moodle"

SITE_URL="http://${MOODLE_DOCKER_WEB_HOST}:${MOODLE_DOCKER_WEB_PORT##*:}"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mError: %s\033[0m\n' "$*" >&2; exit 1; }

# moodle-docker's docker compose wrapper, with this project's environment.
mdc() { "$ROOT/moodle-docker/bin/moodle-docker-compose" "$@"; }

# Run a PHP CLI command in the webserver container as the web server user.
mphp() { mdc exec -T -u www-data webserver php "$@"; }

confirm() {
    [[ "${ASSUME_YES:-0}" == 1 ]] && return 0
    read -r -p "$1 [y/N] " reply
    [[ "$reply" =~ ^[Yy]$ ]]
}

# Shallow-fetch one exact ref (commit, tag or branch) into a directory.
checkout_pinned() {
    local dir="$1" repo="$2" ref="$3"
    if [[ ! -d "$dir/.git" ]]; then
        git init -q "$dir"
        git -C "$dir" remote add origin "$repo"
    fi
    if [[ "$(git -C "$dir" rev-parse -q --verify HEAD 2>/dev/null)" == "$ref" ]]; then
        echo "$dir already at $ref"
        return
    fi
    git -C "$dir" fetch -q --depth 1 origin "$ref"
    git -C "$dir" checkout -q --detach FETCH_HEAD
    echo "$dir now at $(git -C "$dir" log -1 --format='%h %s')"
}

cmd_setup() {
    command -v git >/dev/null || die "git is not installed"
    command -v docker >/dev/null || die "docker is not installed"

    log "Fetching moodle-docker @ $MOODLE_DOCKER_REF"
    checkout_pinned "$ROOT/moodle-docker" "$MOODLE_DOCKER_REPO" "$MOODLE_DOCKER_REF"

    log "Fetching Moodle @ $MOODLE_REF (this is ~300 MB the first time)"
    checkout_pinned "$ROOT/moodle" "$MOODLE_REPO" "$MOODLE_REF"

    log "Fetching Boost Union theme @ $BOOST_UNION_REF"
    checkout_pinned "$ROOT/moodle/theme/boost_union" "$BOOST_UNION_REPO" "$BOOST_UNION_REF"

    log "Installing config.php"
    cp "$ROOT/config/config.php" "$ROOT/moodle/config.php"
    grep -E '^\$release' "$ROOT/moodle/version.php"
}

cmd_up() {
    [[ -f "$ROOT/moodle/config.php" ]] || die "run './moodle.sh setup' first"
    docker info >/dev/null 2>&1 || die "Docker isn't running. Start Docker Desktop (on WSL, also enable
       Settings > Resources > WSL integration for this distro), then try again."
    log "Starting containers (webserver, db, mailpit)"
    # Starting only the webserver (plus the db and mailpit it depends on) skips the
    # selenium/exttests containers, which are only used for automated Behat/PHPUnit runs.
    mdc up -d webserver
    "$ROOT/moodle-docker/bin/moodle-docker-wait-for-db"
}

is_installed() {
    mphp admin/cli/cfg.php --name=version >/dev/null 2>&1
}

cmd_install() {
    if is_installed; then
        log "Moodle is already installed; skipping the database install"
    else
        log "Installing the Moodle database"
        mphp admin/cli/install_database.php --agree-license \
            --fullname="Local Moodle 4.5 (NC State version replica)" \
            --shortname="localmoodle" \
            --summary="Local test site running the same Moodle build as NC State WolfWare." \
            --adminuser="$MOODLE_ADMIN_USER" --adminpass="$MOODLE_ADMIN_PASS" \
            --adminemail="$MOODLE_ADMIN_EMAIL"
    fi
    run_seed configure_site.php
    run_seed create_example_course.php
    cmd_info
}

# Copy the seed scripts into the container and run one of them.
run_seed() {
    mdc exec -T webserver mkdir -p /opt/seed
    mdc cp "$ROOT/seed/." webserver:/opt/seed/
    log "Running seed/$1"
    mphp "/opt/seed/$1"
}

cmd_seed() {
    is_installed || die "Moodle is not installed yet; run './moodle.sh install'"
    run_seed create_example_course.php
}

cmd_down() {
    confirm "This deletes the containers and ALL Moodle data (database + moodledata). Continue?" || exit 1
    mdc down
}

cmd_reset() {
    confirm "Reset wipes all Moodle data and re-creates the site from scratch. Continue?" || exit 1
    mdc down
    cmd_up
    cmd_install
}

cmd_info() {
    cat <<EOF

Moodle is running at:  $SITE_URL
Mail viewer (Mailpit): $SITE_URL/_/mail

Accounts (username / password):
  $MOODLE_ADMIN_USER / $MOODLE_ADMIN_PASS      site administrator
  teacher1 / teacher1  editing teacher in the example course
  student1 / student1  main test student (Sam Student)
  student2 / student2, student3 / student3

Example course grade report for the student: log in as student1, then
  $SITE_URL/grade/report/overview/index.php  (all courses)
EOF
}

cmd_help() {
    cat <<EOF
Usage: ./moodle.sh <command>

  init       First run: setup + up + install
  setup      Download pinned Moodle, moodle-docker and Boost Union; copy config.php
  up         Create and start the containers, then wait for the database
  install    Install Moodle (if needed), configure the site, create the example course
  seed       Re-run only the example-course seed (skips if the course already exists)
  stop       Stop containers, keeping all data
  start      Start stopped containers
  down       Remove containers and ALL Moodle data (asks first)
  reset      down + up + install: a fresh site with fresh seed data (asks first)
  status     Show container status
  logs       Follow container logs (Ctrl+C to quit)
  shell      Open a bash shell in the webserver container
  php ...    Run a PHP CLI command in the webserver container, e.g. ./moodle.sh php admin/cli/purge_caches.php
  mdc ...    Run any moodle-docker-compose command, e.g. ./moodle.sh mdc ps
  info       Print the URL and test accounts
EOF
}

case "${1:-help}" in
    init)    cmd_setup; cmd_up; cmd_install ;;
    setup)   cmd_setup ;;
    up)      cmd_up ;;
    install) cmd_install ;;
    seed)    cmd_seed ;;
    stop)    mdc stop ;;
    start)   mdc start ;;
    down)    cmd_down ;;
    reset)   cmd_reset ;;
    status)  mdc ps ;;
    logs)    mdc logs -f ;;
    shell)   mdc exec -u www-data webserver bash ;;
    php)     shift; mphp "$@" ;;
    mdc)     shift; mdc "$@" ;;
    info)    cmd_info ;;
    help|-h|--help) cmd_help ;;
    *) cmd_help; exit 1 ;;
esac
