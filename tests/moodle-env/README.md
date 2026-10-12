# Local Moodle matching NC State (WolfWare) — Moodle 4.5.7+

A local Moodle site, run with [moodlehq/moodle-docker](https://github.com/moodlehq/moodle-docker), on the
**same Moodle build NC State runs**. It comes with an example class and students for testing a
browser extension that reads the grade pages and calculates grades.

This folder holds only hand-written files. Run this from inside it (for example `test/moodle-env/`):

```bash
./moodle.sh init
```

The first run downloads Moodle, moodle-docker and the theme into this folder, then builds the site.
Then open <http://localhost:8000> and log in as `student1` / `student1`.

---

## 1. What NC State runs, and what this setup uses

NC State does not publish its version anywhere obvious, so it was worked out on **2026-10-08** from files
that any Moodle site serves to the public (no login needed).

| Component | NC State (moodle-courses2527 / moodle-projects) | This setup | How it was identified |
|---|---|---|---|
| Moodle core | **4.5.7+ (Build: 20251030)** | Same commit: `d2cf28d3` on `MOODLE_405_STABLE` | NC State's `/UPGRADING.md` is byte-identical to the weekly builds of 2025-10-24 and 2025-10-30 only. `/lib/templates/loginform.mustache` matches the 2025-10-30 build, not 2025-10-24. |
| PHP | 8.3 (`X-Powered-By: PHP/8.3.35`) | 8.3 (`moodlehq/moodle-php-apache:8.3`) | HTTP response header |
| Theme | `ncsu`, a private child theme of **Boost Union v4.5-r29** | Boost Union v4.5-r29 | `<body class="… theme_boost-union-…">` and `/theme/boost_union/CHANGES.md` |
| Language | US English (`en_us`) | `en_us` language pack, set as the default | `<body class="… lang-en_us …">` |
| Time zone | Eastern | `America/New_York` | NC State is in Raleigh |
| Database | Not visible publicly | PostgreSQL 17 (moodle-docker default) | Doesn't change the HTML Moodle sends to the browser |

**What can't be copied** (it isn't public), and how close this setup gets:

- **NC State's `ncsu` child theme.** It adds their header, footer and colors on top of Boost Union. Navigation, drawers and other page chrome follow Boost Union. The **grade report pages use core Moodle templates**, so the grade tables your extension reads should have the same structure as NC State's. Visual styling will differ.
- **NC State's extra plugins and patches**, such as Brickfield, Rubric Export, the Canvas migration report and a breadcrumb fix backported from MDL-85755.
- **Login.** NC State uses Unity ID single sign-on. Here you log in with a plain Moodle username and password.

> **Heads-up:** NC State's 2026 WolfWare notices mention a "Canvas Course Migration Report" and "modules not migrating to Canvas".
> NC State appears to be moving to Canvas, which matters for how long a Moodle-specific extension will be useful.

## 2. Requirements

- Windows with WSL 2. This was built on Fedora 43 under WSL. Any Linux or macOS machine also works.
- Docker Desktop with WSL integration turned on, or Docker Engine. `docker compose` must work. Tested with Docker 29.8 and Compose v5.5.
- `git` and `bash`.
- About 3 GB of disk (2.3 GB of Docker images + 0.5 GB of Moodle code), and an internet connection the first time.

Clone the repo onto the **Linux (WSL) filesystem** (`/home/...`), not under `/mnt/c/...`. Moodle is
much slower on the Windows filesystem.

## 3. How to run it

Everything goes through `./moodle.sh`. It wraps the steps in the
[moodle-docker Quick start](https://github.com/moodlehq/moodle-docker#quick-start), and every setting it uses is in `moodle.env`.

| Command | What it does |
|---|---|
| `./moodle.sh init` | First run: `setup` + `up` + `install`. Takes about 5 minutes. |
| `./moodle.sh setup` | Downloads the pinned moodle-docker, Moodle and Boost Union, and copies `config/config.php` into `moodle/` |
| `./moodle.sh up` | Creates and starts the containers, then waits for the database |
| `./moodle.sh install` | Installs Moodle if needed, then runs both seed scripts |
| `./moodle.sh stop` / `start` | Pauses or resumes the containers. **Keeps all data.** |
| `./moodle.sh down` | Deletes the containers **and all Moodle data** (asks first) |
| `./moodle.sh reset` | `down` + `up` + `install`: a clean site with fresh example data (asks first) |
| `./moodle.sh seed` | Re-runs only the example-course seed, for example after you delete the course in Moodle. Skips if the course exists. |
| `./moodle.sh status` / `logs` / `shell` | `docker compose ps` / follow the logs / bash shell in the web container |
| `./moodle.sh php <script>` | Runs a Moodle CLI script, e.g. `./moodle.sh php admin/cli/purge_caches.php` |
| `./moodle.sh mdc <args>` | Any `moodle-docker-compose` command, e.g. `./moodle.sh mdc ps` |

**Day-to-day use:** `./moodle.sh start` when you begin, `./moodle.sh stop` when you're done.
Use `./moodle.sh reset` when you want the example data back exactly as it was at the start. It takes about 2 minutes.
To skip the "are you sure" prompt, for example in a script, run `ASSUME_YES=1 ./moodle.sh reset`.
Re-running `./moodle.sh init` is safe: it skips the steps that are already done.

**Data persistence:** moodle-docker doesn't use named volumes. The database and moodledata live inside the containers,
so `stop`/`start` keep everything, and `down`/`reset` wipe everything. Restarting Docker Desktop or Windows is fine;
start the stopped containers again with `./moodle.sh start`.

### Accounts

| Username / password | Role |
|---|---|
| `admin` / `test` | Site administrator |
| `teacher1` / `teacher1` | Editing teacher in the example course |
| `student1` / `student1` | **Main test student** (Sam Student) |
| `student2` / `student2`, `student3` / `student3` | Other students, so the class has more than one grade |

Other URLs: Mailpit, which catches every email Moodle sends, is at <http://localhost:8000/_/mail>.

## 4. The example class

**EX 101 (001) FALL 2026: Example Course for Grade Extension Testing**, in course category "Fall 2026".
Dates are relative to when you run the seed, so "past due" and "upcoming" items stay that way.

The gradebook uses **Natural** aggregation (Moodle's default) with **overridden category weights**. It also
includes the cases a grade calculator usually gets wrong:

| Grade item | Type | Category (weight) | Max | student1 | student2 | student3 |
|---|---|---|---|---|---|---|
| Homework 1 | Assignment | Homework (25%), **drop lowest 1** | 20 | 18 | 20 | 12 |
| Homework 2 | Assignment | Homework | 20 | 15 (with feedback) | 19 | 0 |
| Homework 3 | Assignment | Homework | 20 | 20 | 17 | 14 |
| Homework 4 | Assignment, due in 7 days | Homework | 20 | – (ungraded) | – | – |
| Quiz 1 | Quiz, real attempt | Quizzes (15%) | 10 | 6.67 (2/3) | 10 | 3.33 |
| Quiz 2 | Quiz, real attempt | Quizzes | 10 | 10 | 6.67 | 6.67 |
| Quiz 3 | Quiz, **open now, no attempts** | Quizzes | 10 | – | – | – |
| Midterm Exam | Assignment | Exams (45%) | 100 | 82 (with feedback) | 91 | 64 |
| Final Exam | Assignment, due in 60 days | Exams | 100 | – | – | – |
| Participation | Manual item | course level (15%) | 10 | 9 | 10 | 7 |
| Extra Credit: Course Survey | Manual item, **extra credit** | course level | 2 | 2 | – | 1 |

Moodle's own course totals, printed at the end of `./moodle.sh install` and shown on each student's user report.
Use these to check your extension's math:

| Student | Course total | Points (student's own max) |
|---|---|---|
| student1 | **87.83 %** | 149.31 / 170 |
| student2 | **92.83 %** | 157.80 / 170 |
| student3 | **63.64 %** | 108.19 / 170 |

How Moodle reaches 87.83% for student1:

- Homework: Homework 2 (15) is dropped, so the score is (18 + 20) / 40 = 95%.
- Quizzes: (6.67 + 10) / 20 = 83.33%.
- Exams: 82%.
- Participation: 90%.
- Weighted: 0.25 × 95 + 0.15 × 83.33 + 0.45 × 82 + 0.15 × 90 = 86.65%.
- Extra credit adds 2 points on top of that: 147.31 + 2 = 149.31 out of 170, which is 87.83%.

Ungraded items (`–`) don't count, neither their points nor their max. This is Moodle's default "Only count non-empty grades" setting,
and it's why student1's max is 170 rather than the course's full 300.

To watch a grade change live, log in as `student1` and take **Quiz 3**. It's open now and has no attempts.

To change the class (more students, other weights, other grades), edit the arrays at the top of
`seed/create_example_course.php` and run `./moodle.sh reset`.

### Pages your extension will care about

Log in as `student1` first. The course id is printed by the seed; it is `2` on a fresh site.

- Grades overview, all courses: <http://localhost:8000/grade/report/overview/index.php>
- User report, one course: <http://localhost:8000/grade/report/user/index.php?id=2>
- Course page: <http://localhost:8000/course/view.php?id=2>

In the extension's `manifest.json`, add `http://localhost:8000/*` next to the NC State match pattern in
`content_scripts[].matches` and/or `host_permissions`, e.g. `https://*.wolfware.ncsu.edu/*`.
Your Windows browser reaches `localhost:8000` directly, because Docker Desktop forwards the port.

## 5. Folder layout

```
moodle-env/
├── README.md                     this file
├── moodle.sh                     the only script you run
├── moodle.env                    pinned versions + moodle-docker settings (edit here)
├── config/config.php             Moodle config; copied to moodle/config.php by "setup"
├── seed/
│   ├── configure_site.php        en_us language pack, Boost Union theme, time zone
│   └── create_example_course.php the example class, students and grades
├── .gitignore                    keeps the two downloaded folders out of git
├── .gitattributes                keeps Unix line endings when cloned on Windows
├── moodle-docker/                (downloaded, git-ignored) moodlehq/moodle-docker @ f4c2324
└── moodle/                       (downloaded, git-ignored) Moodle 4.5.7+ @ d2cf28d3, mounted into the web container
    └── theme/boost_union/        (downloaded) Boost Union v4.5-r29
```

`moodle-docker/`, `moodle/` and `moodle/config.php` are all created by `./moodle.sh setup`.
To rebuild everything from just the hand-written files, delete those two folders and run `./moodle.sh init`.

**Sharing through git:** commit the whole folder as is. Its own `.gitignore` already keeps the downloads out.
Each person runs `./moodle.sh init` and gets their own copy of the site and example class. No other config is needed.
If the script loses its executable bit along the way, run `bash moodle.sh init` instead.

The downloaded `moodle/` folder contains about 3,900 JavaScript files plus Moodle's own `package.json` and
`.eslintrc`. If the repo runs ESLint, TypeScript, Jest or a packaging step over the whole tree, add this folder to
their ignore or exclude lists.

`config/config.php` is moodle-docker's `config.docker-template.php` with **one change**: developer
debugging is off by default. With it on, Moodle adds performance info, page info and debug notices to every page,
and that would change the page structure your extension reads. To get the debug output back, set
`$developerdebug = true;` in `config/config.php` and run `./moodle.sh setup`.

## 6. Things stored outside this folder

| What | Where | How to remove |
|---|---|---|
| Docker images: `moodlehq/moodle-php-apache:8.3` (1.6 GB), `postgres:17` (650 MB), `axllent/mailpit:v1.10` (40 MB) | Docker Desktop's image store (its WSL VM disk) | `docker image rm <name>` |
| Containers `ncsumoodle-webserver-1`, `ncsumoodle-db-1`, `ncsumoodle-mailpit-1`, plus their anonymous volumes (database + moodledata) and the `ncsumoodle_default` network | Docker Desktop | `./moodle.sh down`, then `docker volume prune` |
| Seed scripts copied into the container | `/opt/seed` inside `ncsumoodle-webserver-1` | Removed with the container |
| en_us language pack (downloaded from download.moodle.org) | `/var/www/moodledata/lang` inside the container | Removed with the container |

Nothing is installed on the host itself: no global packages, no system settings, no files outside this folder.
Docker keeps the images after `down`, so later rebuilds skip the 2.3 GB download.

## 7. Doing it by hand (what `moodle.sh` runs)

These are the moodle-docker Quick-start steps with this project's choices filled in. Run them from this folder:

```bash
# 1. Settings (moodle.sh sources moodle.env)
source moodle.env
export MOODLE_DOCKER_WWWROOT="$PWD/moodle"

# 2. Code at the pinned versions (moodle.sh uses a shallow fetch of the exact commit)
git clone https://github.com/moodlehq/moodle-docker.git && git -C moodle-docker checkout "$MOODLE_DOCKER_REF"
git init moodle && git -C moodle fetch --depth 1 "$MOODLE_REPO" "$MOODLE_REF" && git -C moodle checkout FETCH_HEAD
git clone --depth 1 -b "$BOOST_UNION_REF" "$BOOST_UNION_REPO" moodle/theme/boost_union
cp config/config.php moodle/config.php

# 3. Containers (only the webserver and what it needs: db + mailpit)
moodle-docker/bin/moodle-docker-compose up -d webserver
moodle-docker/bin/moodle-docker-wait-for-db

# 4. Install Moodle
moodle-docker/bin/moodle-docker-compose exec -u www-data webserver php admin/cli/install_database.php \
  --agree-license --fullname="Local Moodle 4.5 (NC State version replica)" --shortname=localmoodle \
  --adminuser=admin --adminpass=test --adminemail=admin@example.com

# 5. Site settings + example class
moodle-docker/bin/moodle-docker-compose exec webserver mkdir -p /opt/seed
moodle-docker/bin/moodle-docker-compose cp seed/. webserver:/opt/seed/
moodle-docker/bin/moodle-docker-compose exec -u www-data webserver php /opt/seed/configure_site.php
moodle-docker/bin/moodle-docker-compose exec -u www-data webserver php /opt/seed/create_example_course.php
```

## 8. Changing versions

- **Newest Moodle 4.5 LTS instead of NC State's build:** set `MOODLE_REF=MOODLE_405_STABLE` in `moodle.env`, then
  run `./moodle.sh setup` and `./moodle.sh reset`.
- **Check whether NC State has upgraded.** Look at the first version heading of their public upgrade notes:
  ```bash
  curl -s https://moodle-courses2527.wolfware.ncsu.edu/UPGRADING.md | grep -m1 '^## '
  ```
  Today this prints `## 4.5.7+`. The course-site hostname changes every few academic years (`courses2527` = 2025–2027),
  and <https://wolfware.ncsu.edu/rss.php> announces upgrades.
- **Security:** 4.5.7+ is from October 2025, and later 4.5.x releases contain security fixes. That's fine for a local test site
  that only listens on `127.0.0.1`, which is the default here. Don't expose this site to the internet.

## 9. Troubleshooting

- **Port 8000 already in use:** change `MOODLE_DOCKER_WEB_PORT` in `moodle.env`, then `./moodle.sh reset`.
  The URL is saved in the database, so changing the port means a fresh install.
- **You keep getting logged out:** clear the cookies for `localhost` (see the moodle-docker README).
- **`Course EX101-001-FA26 already exists; nothing to do`:** the seed only builds the course once. Use `./moodle.sh reset` to rebuild it.
- **Something failed half-way through `init`:** fix the cause, then run `./moodle.sh reset`.
- **Seeing a PHP error in Moodle:** set `$developerdebug = true;` in `config/config.php`, run `./moodle.sh setup`, and reload the page.
