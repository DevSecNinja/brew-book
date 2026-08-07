# Bean Book & Leaf Book — Copilot instructions

Two "Untappd for X" sites built from **one shared core** in this repository:
**Bean Book** (coffee, `coffee.ravensberg.org`) and **Leaf Book** (tea,
`tea.ravensberg.org`). Both are static, offline-capable PWAs whose entire
dataset is generated at build time from GitHub Issues. No backend, no database,
and **zero runtime JS dependencies**.

## Commands

```bash
mise install                 # provision pinned tooling (Node 24, dprint, actionlint, yamllint, shellcheck, gitleaks)
npm ci                       # dev dependencies
npm run build                # both sites -> dist/coffee + dist/tea
npm run build:coffee         # one product (build-data.js <id> then build-site.js <id>)
npm start                    # build + serve Bean Book on http://localhost:8080
npm run start:tea            # build + serve Leaf Book
npm test                     # vitest run (unit + axe a11y, both products)
npm run test:watch
npx vitest run tests/sanitize.test.js            # single file
npx vitest run tests/format.test.js -t "grind"   # single test by name
node scripts/make-icons.js tea                   # regenerate tea PNG icons (rarely)
```

`npm run build` without `GITHUB_TOKEN` reads `data/<product>.sample.json`
(raw issue fixtures) instead of the GitHub API, so builds and tests never need
the network. CI sets the token only on non-`pull_request` events, so **pull
request previews build from the sample fixtures**. `dist/` is generated and
git-ignored; `data/<product>.json` **is** committed.

There is no npm lint script — the mise-pinned linters (dprint, yamllint,
actionlint, shellcheck, shfmt, gitleaks) are run ad hoc, and CI runs only
`npm test` + the build.

## Architecture

```
GitHub Issue (bean-review / tea-review form)
  └─ closed + `published` + the form label   ← the only publishing gate (owner-moderated)
      └─ products/<id>.js                    ← THE product config: identity, palette,
         │                                     terminology, field schema, presentation
         └─ scripts/lib/parse-issue.js       ← splits `### <field.label>` blocks; dumb, no validation
             └─ scripts/lib/sanitize.js      ← THE trust boundary: per-field-type enum whitelists,
                │                              1–5/0.25 rating grid, http(s)-only URLs, tag/control-char
                │                              stripping, length caps; returns null to reject a review
                 └─ scripts/lib/aggregate.js ← groups reviews by normalized maker+name into
                     │                          Items (slug, averageRating, facts, reviews[])
                      └─ data/<id>.json → scripts/build-site.js → dist/<id>/ (SPA + prerendered HTML)
```

- **One core, many products (non-negotiable).** `scripts/lib/**`, `src/**` and
  the build scripts must stay generic. Anything coffee- or tea-specific belongs
  in `products/<id>.js`. Adding a product = a config + an issue form + an icon
  set in `assets/icons/<id>/`, with no core changes.
- **The config drives everything.** `fields[]` declares `label` (the issue-form
  heading, verbatim), `type` (which sanitizer runs), `role` (what the core needs:
  `name`/`maker`/`rating`/`cost`/`weight`/`flavours`/`website`/`notes`) and
  `scope: 'item'` (merged into `facts` vs. kept on the review). `facts`,
  `badges`, `filters` and `reviewMeta()` drive both renderers.
- **Stateless rebuilds.** `.github/workflows/pages.yml` re-fetches _all_ closed +
  `published` issues for each product on push, issue events, a daily cron and
  manual dispatch. There is no "already processed" marker; publishing /
  unpublishing / editing an issue is the whole state machine.
- **`.github/workflows/validate-review.yml`** runs `scripts/validate-issue.js` on
  new/edited unpublished review issues, resolves the product from the form label,
  comments the result, and auto-publishes when the author is the repo `OWNER` and
  the review is valid. `scripts/lib/validate.js` deliberately reuses the _same_
  parse+sanitize code as the build, so "valid" means "survives the build
  unchanged".
- **Two renderers of the same data.** `scripts/build-site.js` emits SEO HTML
  (JSON-LD, OG tags, no DOM libs available) and `src/views/*.js` renders the SPA
  for the same route. Anything user-visible must be implemented in **both** —
  which is why shared logic lives in `src/text.js` (pure formatters), `src/seo.js`
  (titles/descriptions/paths) and the config's `reviewMeta()`, all importable
  from Node _and_ the browser.
- **`dist/<id>/` is the whole deploy artifact**: generated `index.html`,
  `404.html`, `manifest.webmanifest`, `theme.css`, `robots.txt`, `sitemap.xml`,
  `<routeBase>/<slug>/index.html`, plus copies of `src/`, `styles.css`,
  `service-worker.js` and `assets/icons/<id>/`. `products/<id>.js` is copied to
  `dist/<id>/src/product.config.js`, which is the _only_ thing `src/main.js`
  imports to pick a product — every other `src/` module takes `product` as a
  parameter (which is also how the tests supply it).
- **`__BUILD_ID__`** is a literal placeholder in `service-worker.js`,
  `src/main.js` and `data/<id>.json`; `build-site.js` stamps it from
  `BUILD_ID`/`APP_COMMIT_SHA`/`GITHUB_SHA` (or `dev` locally) so the SW cache
  busts and the footer shows the commit. `__PRODUCT_ID__` in the service worker
  keeps the two sites' caches apart.
- **Routing** is path-based (History API) with real crawlable URLs
  (`/`, `/<routeBase>/:slug/` — `bean` for coffee, `tea` for tea);
  `scripts/serve.js <id>` mirrors Cloudflare Pages directory-index resolution
  locally against `dist/<id>`.

## Conventions

- **Untrusted input is hostile (non-negotiable).** Never use `innerHTML` for
  issue-derived data in `src/`; build DOM via `el()` in `src/components.js`
  (which sets `textContent` and passes `href`/`src` through `safeUrl()`). In
  `build-site.js` every interpolation goes through `esc()`. New fields must be
  declared in a product config so `sanitize.js` validates them — nothing
  bypasses it, and the sanitizer only ever copies declared field ids.
- **Field labels are the contract.** `parse-issue.js` reads sections by the exact
  `field.label`, and enum `options` must match the form's dropdown/checkbox
  options verbatim. `tests/products.test.js` enforces both against the issue
  form, so renaming a form label fails the suite instead of silently dropping
  data.
- **Adding a review field touches, in order:** issue form → `fields[]` in
  `products/<id>.js` → its `facts`/`badges`/`filters`/`reviewMeta()` if visible →
  `specs/001-bean-book-website/data-model.md` → tests → refresh
  `data/<id>.sample.json`. `sanitize.js`/`validate.js` usually need **no**
  change; only a genuinely new _field type_ touches the core.
- **Item facts vs. review fields.** Intrinsic properties (roast level, process,
  species, tea type, oxidation, harvest…) get `scope: 'item'` and land in
  `item.facts` from the most recent non-empty value; purchase- and brew-specific
  data (cost, weight, currency, brew method, grind, water temp, steep time,
  ratio) stays on the individual review. Put new fields on the side that matches
  that split.
- **Styling.** `styles.css` is shared and structural only; the palette lives in
  `theme` in each product config and is generated into `dist/<id>/theme.css`.
  Never hard-code a colour in `styles.css`.
- **Governance:** `.specify/memory/constitution.md` is binding — static-only, no
  runtime dependencies, sanitized input, offline PWA, accessible (keyboard,
  labelled controls, light/dark), one core / many products, owner-moderated
  publishing. Features are developed through the Spec Kit flow (`specs/`,
  `.github/prompts/speckit.*`).
- **Deployment:** Cloudflare Pages, one project per site (`bean-book`,
  `leaf-book`). `.github/workflows/pages.yml` tests and builds both sites in its
  own job (where `GITHUB_TOKEN` is available to read published issues), uploads
  `dist/coffee` and `dist/tea` as artifacts, and calls the shared
  `DevSecNinja/.github` `pages.yml` twice in `artifact-name` mode to deploy
  them. The shared workflow never runs this repo's build, so no credential is
  handed to it. Custom domains are attached in the Cloudflare dashboard (no
  `CNAME` file).
- **Commits** follow Conventional Commits; tool versions are pinned in
  `.mise.toml` and GitHub Actions are SHA-pinned, both Renovate-managed.
- Tests live in `tests/*.test.js`, use `// @vitest-environment jsdom` per-file
  when DOM is needed, and build fixtures with the factories in
  `tests/helpers.js`. Coverage is scoped to `scripts/lib/**`, `src/**` and
  `products/**`.
- The generated pages ship a strict CSP (`script-src 'self'`, avatars-only remote
  images) — no inline scripts, no external assets.
