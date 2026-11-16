# Implementation Plan: Bean Book Website

**Branch**: `001-bean-book-website` | **Date**: 2026-07-08 | **Spec**: ./spec.md

## Summary

Build a static, offline-capable PWA that showcases coffee-bean reviews sourced
from GitHub Issues. A build-time Node script fetches closed+`published`
bean-review issues, parses/sanitizes them, aggregates reviews into beans keyed by
normalized roaster+name, and emits `data/beans.json`. A vanilla HTML/CSS/ES-module
frontend renders a searchable bean gallery and Untappd-style per-bean pages with
individual reviews (crediting each submitter's GitHub identity). A single combined
CI/CD workflow tests, generates the data, stamps `__BUILD_ID__`, and deploys to
GitHub Pages.

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), Node 20+ for build/test.

**Primary Dependencies**: Runtime = none. Dev = vitest (+ jsdom, axe-core for a11y).

**Storage**: Static `data/beans.json` generated at build time. No database.

**Testing**: vitest unit tests (parser, sanitizer, aggregator) + jsdom/axe a11y
smoke test.

**Target Platform**: Modern browsers; installable PWA on iOS/Android/desktop.

**Project Type**: Static web app (single project).

**Performance Goals**: Instant load; app shell + data cached; no blocking JS deps.

**Constraints**: No backend; offline-first; zero runtime deps; all issue input
treated as hostile; relative asset paths for GitHub Pages project hosting.

**Scale/Scope**: Tens–hundreds of beans; single-page client with hash routing.

## Constitution Check

_GATE: must pass before and after design._

- **I. No Backend, Static-First** — PASS. Data is build-time JSON; hosting is Pages.
- **II. Minimal, Trusted Dependencies** — PASS. Zero runtime deps; dev = vitest.
- **III. Untrusted Input Is Hostile** — PASS. Dedicated sanitizer module with
  whitelisting/validation; frontend uses `textContent` only.
- **IV. Offline-First PWA** — PASS. Manifest + service worker + build-id footer.
- **V. Accessible & Responsive** — PASS. Semantic HTML, light/dark, a11y test.
- **VI. Owner-Moderated Publishing** — PASS. Pipeline filters closed+`published`.

No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-bean-book-website/
├── spec.md
├── plan.md          # this file
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
index.html               # app shell
styles.css               # modern light/dark styling
manifest.webmanifest     # PWA manifest
service-worker.js        # offline caching, __BUILD_ID__ cache-buster
src/
├── main.js              # entry: boot app + register service worker
├── app.js               # app orchestration, state, routing glue
├── router.js            # hash-based routing (#/ and #/bean/:slug)
├── data.js              # load & shape beans.json
├── views/
│   ├── home.js          # bean gallery + search/filter
│   └── bean.js          # bean detail + reviews
├── components.js        # small DOM builders (safe, textContent-based)
└── format.js            # formatting + escaping/URL-safety helpers
data/
├── beans.json           # generated (seeded from real issues for dev)
└── beans.sample.json    # fixture used by build fallback + demo
scripts/
├── lib/
│   ├── parse-issue.js   # issue-form body -> raw review (pure)
│   ├── sanitize.js      # validation/sanitization (pure)
│   ├── aggregate.js     # reviews -> beans (pure)
│   └── validate.js      # schema validation + comment builder (pure)
├── build-data.js        # fetch published issues -> data/beans.json
├── validate-issue.js    # validate the current issue event -> comment + output
└── serve.js             # zero-dep local dev server
icons/                   # SVG + PNG PWA icons
tests/
├── parse-issue.test.js
├── sanitize.test.js
├── aggregate.test.js
├── validate.test.js
└── a11y.test.js
.github/workflows/
├── ci-cd.yml            # single combined test+build+deploy pipeline
└── validate-review.yml  # validate issue, comment, auto-publish owner reviews
```

**Structure Decision**: Single static project. Pure, testable logic lives in
`scripts/lib/` (shared by the build script and tests). The frontend consumes only
the generated JSON, keeping untrusted-data handling entirely at build time.

## Approach Notes

- **Parsing contract**: `.github/ISSUE_TEMPLATE/bean-review.yml` field labels are
  the contract; `parse-issue.js` splits the issue body on `### <label>` headings.
- **Sanitization**: enums validated against the form's option lists; rating snapped
  to the 1.00–5.00 / 0.25 grid or rejected; cost/weight parsed as numbers; URLs
  must be `http(s)`; text stripped of controls and HTML-escaped defensively; the
  frontend still never uses innerHTML for data.
- **Identity/aggregation**: key = normalize(roaster)+"\u241f"+normalize(name),
  where normalize lowercases, trims, collapses whitespace and strips diacritics.
- **Data source**: build script uses the GitHub REST API with `GITHUB_TOKEN`
  (`gh`/fetch). On PRs or when unavailable, it falls back to the committed sample
  so builds/tests never require network.
- **Deploy/PWA**: workflow stamps `BUILD_ID=${GITHUB_SHA::12}-<timestamp>` into
  `service-worker.js` and `src/main.js`, assembles `_site`, uploads the Pages
  artifact, and deploys. Rebuild triggers include `issues` events.
- **Validation/auto-publish**: `validate-review.yml` runs on issue opened/edited,
  reusing `validate.js` (parse + sanitize) so "valid" guarantees a clean build;
  it comments the result and, for a valid owner submission, adds `published` +
  closes the issue — which in turn triggers the deploy pipeline.

## Complexity Tracking

None. No constitution violations.
