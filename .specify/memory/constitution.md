# Bean Book Constitution

<!-- Governing principles for the Bean Book (coffee) and Leaf Book (tea)
     review websites, which share one core in this repository. -->

## Core Principles

### I. No Backend, Static-First

Every site MUST be a fully static site deployable to a static host (Cloudflare
Pages) with no runtime server, database, or third-party hosted service. All
dynamic data is produced at build time from GitHub Issues and shipped as static
JSON. If a feature appears to require a backend, it MUST be redesigned as a
build-time or client-only capability.

### II. Minimal, Trusted Dependencies

The runtime ships **zero** third-party JavaScript dependencies: vanilla HTML, CSS
and ES modules only. Build/test tooling MUST be kept minimal and limited to
well-trusted packages (e.g. vitest). Adding any dependency requires a written
justification in the plan and pinning to the latest stable version.

### III. Untrusted Input Is Hostile (NON-NEGOTIABLE)

Every field sourced from a GitHub Issue is untrusted, because anyone can submit a
review. The build pipeline MUST validate and sanitize all issue-derived data:
whitelist fields, validate enums/numbers against the issue form's allowed values,
allow only `http(s)` URLs, strip control characters, and never emit raw HTML. The
frontend MUST render user text via DOM text nodes (`textContent`), never
`innerHTML`. No unsanitized value ever reaches the DOM or the data file.

### IV. Offline-First PWA

The site MUST be installable and work offline as a PWA: a web app manifest, a
service worker that pre-caches the app shell, network-first for HTML/data and
cache-first for static assets, and a `__BUILD_ID__` cache-buster stamped at deploy
so every commit auto-updates clients. The current build's commit hash MUST be
visible in the footer.

### V. Accessible & Responsive

The UI MUST be usable with a keyboard and screen reader: semantic HTML, labelled
controls, sufficient colour contrast, and visible focus. It MUST support light and
dark themes (respecting the system preference) and work on mobile and desktop.

### VI. One Core, Many Products

The repository serves more than one review site (Bean Book for coffee, Leaf Book
for tea). The pipeline, the SPA and the prerenderer MUST stay generic and be
driven by a product config in `products/`; nothing product-specific may be
hard-coded in `scripts/lib/`, `src/` or the build scripts. Adding a product MUST
NOT require changing the shared core, and every user-visible feature MUST be
implemented once and work for all products.

### VII. Owner-Moderated Publishing

Only issues that are **closed** and carry both the `published` label and their
product's review-form label are built into that product's site. Open, unlabeled, or spam submissions never appear. Publication is an explicit
owner action; the pipeline enforces this gate.

## Development Workflow

- Follow the GitHub Spec Kit flow: constitution → specify → clarify → plan → tasks
  → analyze → implement.
- Commits follow Conventional Commits.
- Tooling is pinned and managed with **mise**; dependencies are Renovate-managed.
- Automated tests (vitest) cover the issue parser, sanitizer, and aggregator, plus
  an accessibility smoke check. Tests MUST pass before deploy.
- CI/CD tests and builds every product in this repository's own job, then hands
  each site to the shared `DevSecNinja/.github` `pages.yml` workflow as an
  artifact to deploy to its own Cloudflare Pages project. No credential is
  passed into the shared workflow. Pull request builds run without a GitHub
  token and therefore render the committed sample fixtures.

## Governance

This constitution supersedes ad-hoc practice. Amendments are made via pull request
that updates this file, states the rationale, and bumps the version below. Any
change that relaxes Principle III (input safety) or Principle I (no backend)
requires explicit maintainer approval and a documented threat/impact assessment.
All plans and reviews MUST verify compliance with these principles.

**Version**: 2.0.0 | **Ratified**: 2026-07-08 | **Last Amended**: 2026-08-06
