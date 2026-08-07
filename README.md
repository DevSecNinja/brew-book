# ☕ Bean Book & 🍃 Leaf Book

**Untappd, but for coffee beans — and for tea.** Two hand-kept, offline-capable
review logs built from one shared core in this repository, sourced entirely from
GitHub Issues. No backend, no database.

| Site             | What         | Domain                                                 | Cloudflare project |
| ---------------- | ------------ | ------------------------------------------------------ | ------------------ |
| ☕ **Bean Book** | Coffee beans | [coffee.ravensberg.org](https://coffee.ravensberg.org) | `bean-book`        |
| 🍃 **Leaf Book** | Tea          | [tea.ravensberg.org](https://tea.ravensberg.org)       | `leaf-book`        |

## How it works

```text
You (or anyone) open a review issue    ──►  Owner closes it with the
   (a structured GitHub Issue Form:            `published` label
    bean-review.yml / tea-review.yml)                │
                                                     ▼
   CI fetches that product's published issues  ──►  parses + sanitizes +
   (closed + `published` + its form label)           aggregates into data/<product>.json
                                                     │
                                                     ▼
        build-site.js renders dist/<product>/  ──►  Cloudflare Pages project
```

- **Publishing is owner-moderated.** A review only appears once its issue is
  **closed** and carries the **`published`** label. Open or unlabeled
  submissions never reach a site.
- **Untappd-style aggregation.** Reviews of the same item (matched by a
  normalized maker + name) are grouped into one page showing the average rating
  and every individual review, each crediting its GitHub author.
- **Untrusted input is treated as hostile.** Everything from an issue is
  validated and sanitized at build time (enums checked, ratings snapped to the
  1–5 / 0.25 grid, `http(s)`-only URLs, HTML/entities stripped). The frontend
  only ever renders text via `textContent`.

## Submit a review

- ☕ [Bean Review issue](../../issues/new?template=bean-review.yml)
- 🍃 [Tea Review issue](../../issues/new?template=tea-review.yml)

Fill in the form. Once it's reviewed and published by the maintainer, it shows
up on the matching site.

## Publishing, updating & removing reviews

The build is **stateless**: every relevant event re-fetches _all_ reviews that
are **closed** and carry the **`published`** label, regenerates
`data/<product>.json` and redeploys. There is no "processed" marker to manage —
`published` is simply the on/off gate.

| I want to…                    | Do this                                                                                                                         | What happens                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Publish** a review          | Close the issue with the `published` label (the maintainer does this; valid submissions from the repo owner are auto-published) | The `closed`/`labeled` event triggers a rebuild and the item appears                                       |
| **Update** a published review | **Just edit the issue** (title or body). No need to reopen or touch labels                                                      | The `edited` event triggers a rebuild; the new content replaces the old on the next deploy                 |
| **Unpublish** a review        | Remove the `published` label, **or** reopen the issue                                                                           | The `unlabeled`/`reopened` event rebuilds; the item disappears (it no longer matches "closed + published") |

Changes go live once the **Pages** run finishes (~1–2 min) and the CDN
refreshes. A daily scheduled run and the manual **Run workflow** button are
backstops if an event is ever missed.

> Editing a published (closed) issue does **not** re-run the validation bot —
> that only runs on review issues that aren't published yet.

## One core, two products

Everything product-specific lives in a single config module:

```text
products/coffee.js   # Bean Book: identity, palette, terminology, field schema
products/tea.js      # Leaf Book: same shape, different vocabulary
```

The config drives the whole pipeline — the issue parser reads sections by the
`label` of each field, the sanitizer enforces its type and whitelist, the
aggregator decides from `scope: 'item'` what is a fact about the item versus the
individual review, and both renderers build the page from `facts`, `badges`,
`filters` and `reviewMeta()`. **Adding a product means adding a config, an issue
form and an icon set — not touching the shared core.**

## Tech

- Vanilla HTML + CSS + ES modules. **Zero runtime dependencies.**
- Offline **PWA** per site: web manifest + service worker (network-first for
  HTML/data, cache-first for assets, `BUILD_ID` cache-busting; commit hash shown
  in the footer).
- Data pipeline & tests in Node; **vitest** for unit + a11y tests.
- Deployed to **Cloudflare Pages** (one project per site). Both sites are tested
  and built once in this repo's own job — which is where the `GITHUB_TOKEN` for
  reading published issues lives — then handed to the shared
  [`DevSecNinja/.github`](https://github.com/DevSecNinja/.github) `pages.yml`
  reusable workflow as artifacts, which only deploys them.

## Local development

```bash
mise install          # provisions Node (and lint tooling)
npm ci                # install dev dependencies

npm run build         # build both sites into dist/coffee and dist/tea
npm run build:tea     # …or just one

npm start             # build + serve Bean Book at http://localhost:8080
npm run start:tea     # build + serve Leaf Book

npm test              # unit + accessibility tests (covers both products)
npx vitest run tests/sanitize.test.js            # one file
npx vitest run tests/format.test.js -t "grind"   # one test
```

`data/<product>.sample.json` holds a small fixture of raw issues so each site
renders locally without hitting the GitHub API. Set `GITHUB_TOKEN` to build from
the live published issues instead. `dist/` is generated and git-ignored;
`data/<product>.json` is committed.

Icons are drawn with a dependency-free PNG encoder — re-run
`node scripts/make-icons.js tea` only when the artwork changes.

## Adding a review field

The field schema is the contract, so a new field touches, in order:

1. the issue form (`.github/ISSUE_TEMPLATE/<product>-review.yml`)
2. the product config (`products/<product>.js`) — the `label` must match the
   form **verbatim**, and enum `options` must match the dropdown exactly
3. `facts` / `badges` / `filters` / `reviewMeta()` in that config, if it should
   be visible
4. `specs/001-bean-book-website/data-model.md`
5. tests, and the sample fixture in `data/<product>.sample.json`

`tests/products.test.js` enforces most of this automatically, including that
every field label and enum option exists in the issue form.

## Deployment setup

Both sites deploy to Cloudflare Pages. Repository secrets
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` must be set; the projects are
created automatically on first deploy. Custom domains
(`coffee.ravensberg.org`, `tea.ravensberg.org`) are attached in the Cloudflare
dashboard, so there is no `CNAME` file in the repo.

`.github/workflows/pages.yml` builds both sites in one job and uploads
`dist/coffee` and `dist/tea` as artifacts; two calls to the shared `pages.yml`
deploy them. **Pull requests build without a `GITHUB_TOKEN`**, so previews
render the committed sample fixtures rather than live issues — unreviewed code
never runs against the GitHub API.

## Project layout

```text
products/       # per-product config: identity, palette, field schema, display
src/            # shared frontend ES modules (views, router, safe DOM helpers)
scripts/        # build-data.js, build-site.js + pure lib/ (parse, sanitize, aggregate)
data/           # generated <product>.json + raw-issue sample fixtures
assets/icons/   # per-product PWA icons
styles.css      # shared structural CSS (palette is generated per product)
tests/          # vitest unit + a11y tests
specs/          # Spec Kit spec, plan, data model, tasks
.specify/       # Spec Kit constitution & templates
```

## License

MIT — see [LICENSE](./LICENSE).
