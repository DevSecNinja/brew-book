# Bean Book — Copilot instructions

"Untappd for coffee beans": a static, offline-capable PWA whose entire dataset is
generated at build time from GitHub Issues. No backend, no database, and **zero
runtime JS dependencies**.

## Commands

```bash
mise install                 # provision pinned tooling (Node 24, dprint, actionlint, yamllint, shellcheck, gitleaks)
npm ci                       # dev dependencies
npm run build                # build-data.js (beans.json) + build-site.js (bean/<slug>/index.html + sitemap.xml)
npm start                    # zero-dep static server on http://localhost:8080
npm test                     # vitest run (unit + axe a11y)
npm run test:watch
npx vitest run tests/sanitize.test.js            # single file
npx vitest run tests/format.test.js -t "grind"   # single test by name
```

`npm run build` without `GITHUB_TOKEN` reads `data/beans.sample.json` instead of
the GitHub API, so builds and tests never need the network. In CI the token is
set and live published issues are used. `bean/` and `sitemap.xml` are generated
and git-ignored; `data/beans.json` **is** committed.

There is no npm lint script — the mise-pinned linters (dprint, yamllint,
actionlint, shellcheck, shfmt, gitleaks) are run ad hoc, and CI runs only
`npm test` + `npm run build`.

## Architecture

```
GitHub Issue (bean-review form)
  └─ closed + `published` label      ← the only publishing gate (owner-moderated)
      └─ scripts/lib/parse-issue.js  ← splits `### Heading` blocks; dumb, no validation
          └─ scripts/lib/sanitize.js ← THE trust boundary: enum whitelists, 1–5/0.25 rating
             │                          grid, http(s)-only URLs, tag/control-char stripping,
             │                          length caps; returns null to reject a review
              └─ scripts/lib/aggregate.js ← groups reviews by normalized roaster+name into
                  │                          Beans (slug, averageRating, facts, reviews[])
                   └─ data/beans.json → SPA (src/) + prerendered bean/<slug>/index.html
```

- **Stateless rebuilds.** `.github/workflows/ci-cd.yml` re-fetches *all* closed +
  `published` issues on push, issue events, a daily cron and manual dispatch.
  There is no "already processed" marker; publishing/unpublishing/editing an
  issue is the whole state machine.
- **`.github/workflows/validate-review.yml`** runs `scripts/validate-issue.js` on
  new/edited unpublished `bean-review` issues, comments the result, and
  auto-publishes when the author is the repo `OWNER` and the review is valid.
  `scripts/lib/validate.js` deliberately reuses the *same* parse+sanitize code as
  the build, so "valid" means "survives the build unchanged".
- **Two renderers of the same data.** `scripts/build-site.js` emits SEO HTML
  (JSON-LD, OG tags, no DOM libs available) and `src/views/*.js` renders the SPA
  for the same route. Anything user-visible must be implemented in **both**, and
  helper logic duplicated in `build-site.js` must stay in sync with
  `src/format.js` (see the `grindText` comment there).
- **`__BUILD_ID__`** is a literal placeholder in `service-worker.js`,
  `src/main.js` and `data/beans.json`; CI `sed`s it to `<sha>-<timestamp>` at
  deploy so the SW cache busts and the footer shows the commit.
- **Routing** is path-based (History API) with real crawlable URLs
  (`/`, `/bean/:slug/`); `scripts/serve.js` mirrors GitHub Pages directory-index
  resolution locally.

## Conventions

- **Untrusted input is hostile (non-negotiable).** Never use `innerHTML` for
  issue-derived data in `src/`; build DOM via `el()` in `src/components.js`
  (which sets `textContent` and passes `href`/`src` through `safeUrl()`). In
  `build-site.js` every interpolation goes through `esc()`. New fields must be
  whitelisted/validated in `sanitize.js` — nothing bypasses it.
- **Field labels are the contract.** `parse-issue.js` reads sections by the exact
  label text in `.github/ISSUE_TEMPLATE/bean-review.yml`; enum lists in
  `sanitize.js` must match the form's dropdown/checkbox options verbatim.
  Renaming a form label without updating the parser silently drops data.
- **Adding a review field touches, in order:** issue form → `parse-issue.js` →
  `sanitize.js` → `validate.js` → `src/format.js` + `src/views/bean.js` →
  `scripts/build-site.js` → `specs/001-bean-book-website/data-model.md` → tests
  (`parse-issue`, `sanitize`, `validate`, `format`, `a11y`) → refresh
  `data/beans.sample.json`.
- **Bean facts vs. review fields.** Intrinsic bean properties (roast level,
  process, species, origins…) live in `bean.facts`, taken from the most recent
  non-empty value; purchase- and brew-specific data (cost, weight, currency,
  brew method, grind, ratio) stays on the individual review. Put new fields on
  the side that matches that split.
- **Governance:** `.specify/memory/constitution.md` is binding — static-only, no
  runtime dependencies, sanitized input, offline PWA, accessible (keyboard,
  labelled controls, light/dark), owner-moderated publishing. Features are
  developed through the Spec Kit flow (`specs/`, `.github/prompts/speckit.*`).
- **Commits** follow Conventional Commits; tool versions are pinned in
  `.mise.toml` and GitHub Actions are SHA-pinned, both Renovate-managed.
- Tests live in `tests/*.test.js`, use `// @vitest-environment jsdom` per-file
  when DOM is needed, and build fixtures with local `sampleBean()`/`review()`
  factory helpers. Coverage is scoped to `scripts/lib/**` and `src/**`.
- `index.html` ships a strict CSP (`script-src 'self'`, avatars-only remote
  images) — no inline scripts, no external assets.
