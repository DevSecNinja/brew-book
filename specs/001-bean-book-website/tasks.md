# Tasks: Bean Book Website

**Feature**: 001-bean-book-website | **Spec**: ./spec.md | **Plan**: ./plan.md

Tasks are grouped by user story. `[P]` = parallelizable. Each story is an
independently testable slice.

## Phase 1: Foundational (blocks all stories)

- [x] T001 Add repo config: `package.json` (scripts, dev deps), `.mise.toml`,
      `renovate.json5`, `.gitignore`, merge `.vscode/settings.json`.
- [x] T002 Add `scripts/lib/parse-issue.js` — parse issue-form body into a raw
      review object keyed by the template's `### <label>` sections. [P]
- [x] T003 Add `scripts/lib/sanitize.js` — validate/sanitize a raw review:
      enums, rating grid, numbers, `http(s)` URLs, control/HTML stripping, drop
      unknowns; reject invalid reviews. [P]
- [x] T004 Add `scripts/lib/aggregate.js` — normalize identity and aggregate
      reviews into beans (average rating, merged facts, slug). [P]
- [x] T005 Add `scripts/build-data.js` — fetch closed+`published` bean-review
      issues via GitHub API (token), pipe through parse→sanitize→aggregate, write
      `data/beans.json`; fall back to `data/beans.sample.json` without network.

## Phase 2: User Story 1 — Browse beans (P1)

- [x] T010 `index.html` app shell + `styles.css` (modern light/dark, responsive).
- [x] T011 `src/data.js` load & shape `beans.json`.
- [x] T012 `src/components.js` + `src/format.js` safe DOM builders + formatting.
- [x] T013 `src/views/home.js` bean gallery with search + filters.
- [x] T014 `src/main.js` + `src/app.js` + `src/router.js` boot + hash routing.
- [x] T015 Seed `data/beans.sample.json` and `data/beans.json` from real issues.

**Checkpoint**: Home gallery renders and filters from `beans.json`.

## Phase 3: User Story 2 — Bean detail (P1)

- [x] T020 `src/views/bean.js` detail page: header with average rating + facts.
- [x] T021 Individual review cards with GitHub username + avatar, rating, notes,
      flavour tags, safe website link.

**Checkpoint**: `#/bean/:slug` shows aggregated rating + all reviews.

## Phase 4: User Story 3 — Offline PWA (P2)

- [x] T030 `manifest.webmanifest` + `icons/` (SVG + 192/512 PNG + apple-touch).
- [x] T031 `service-worker.js` (app-shell precache, network-first HTML/data,
      cache-first assets, `__BUILD_ID__`).
- [x] T032 SW registration + auto-update + build-hash footer in `src/main.js`.

**Checkpoint**: Works offline on repeat visit; updates on new build.

## Phase 5: User Story 4 — Submit CTA + publish gate (P3)

- [x] T040 "Add a review" CTA linking to the issue form; empty-state.
- [x] T041 Confirm publish gate in `build-data.js` (closed + `published`).

## Phase 6: CI/CD + Tests + Polish

- [x] T050 `scripts/serve.js` zero-dep dev server; `npm start`.
- [x] T051 vitest: `tests/parse-issue.test.js`, `tests/sanitize.test.js`
      (incl. malicious inputs), `tests/aggregate.test.js`. [P]
- [x] T052 `tests/a11y.test.js` jsdom + axe smoke test. [P]
- [x] T053 `.github/workflows/ci-cd.yml` single pipeline: test → build data →
      stamp BUILD_ID → assemble `_site` → deploy to GitHub Pages; rebuild on issues.
- [x] T054 `README.md` (how it works, how to submit, local dev).
- [x] T055 Validate: run build on fixtures, `npm test`, serve + smoke check.

## Phase 7: Issue validation & auto-publish (added post-plan)

- [x] T060 `scripts/lib/validate.js` — validate an issue body against the review
      schema (reusing parse + sanitize); return friendly errors + warnings and a
      Markdown comment builder.
- [x] T061 `scripts/validate-issue.js` — read the GitHub event, validate, write
      the comment and a `valid` output. [P]
- [x] T062 `.github/workflows/validate-review.yml` — on issue opened/edited:
      validate, comment the result, and (owner + valid) add `published` + close.
- [x] T063 `tests/validate.test.js` — validator + comment builder tests. [P]

## Phase 8: UI polish (added post-plan)

- [x] T070 Keep a single "Add a review" CTA in the header (removed the duplicate
      hero button); fix its dark-theme contrast.
- [x] T071 Make the footer build hash a link to the commit on GitHub.
- [x] T072 Drive link/badge/tag colour from a per-theme `--link` variable so the
      `auto` theme matches `light`/`dark` exactly (fixes an auto↔light mismatch).

## Status

All tasks complete. Site is deployed to GitHub Pages and validated end-to-end
(41 vitest tests passing; workflows lint-clean).

## Phase 9: SEO & custom domain (added post-plan)

- [x] T080 Add `CNAME` (coffee.ravensberg.org) and copy it into the deploy
      artifact so the custom domain persists across deploys.
- [x] T081 SEO head in `index.html`: canonical, robots, Open Graph, Twitter card,
      JSON-LD WebSite; generate a 1200×630 `icons/og-image.png`; add `robots.txt`.
- [x] T082 Switch to real path-based routing (History API + link interception)
      so bean pages are crawlable URLs; absolute asset paths; SW scope `/`.
- [x] T083 `scripts/build-site.js` — prerender `/bean/<slug>/index.html` (unique
      title/description/canonical/OG + JSON-LD Product/AggregateRating/Review +
      crawlable content) and generate `sitemap.xml`.
- [x] T084 Dynamic per-route `<title>`/meta/canonical updates on client nav;
      `parseRoute` tests; dev server directory-index resolution.
