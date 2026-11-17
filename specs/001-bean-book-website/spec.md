# Feature Specification: Bean Book Website

**Feature Branch**: `001-bean-book-website`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Build a website (like Untappd for coffee beans) that
showcases coffee bean reviews submitted as GitHub Issues. No backend, minimal
dependencies, good looking, offline PWA, deployed to GitHub Pages by pipeline."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse reviewed beans (Priority: P1)

A visitor opens the site and sees a gallery of coffee beans that have been
reviewed, each showing the bean name, roaster, average rating, roast level and
key facts. They can search and filter (by roaster, roast type, single-origin vs
blend, decaf, rating) to find beans of interest.

**Why this priority**: This is the core value — a browsable, attractive catalogue
of beans. Without it there is no product.

**Independent Test**: Load the built site with a known `beans.json`; verify every
published bean appears with its aggregated rating and that search/filter narrow
the list correctly.

**Acceptance Scenarios**:

1. **Given** a set of published reviews, **When** the visitor opens the home page,
   **Then** each distinct bean is shown once with its average rating and review
   count.
2. **Given** the bean list, **When** the visitor types a roaster name into search,
   **Then** only matching beans remain visible.
3. **Given** the bean list, **When** the visitor selects the "Decaf" filter,
   **Then** only decaf beans remain.

---

### User Story 2 - View a bean's detail page (Priority: P1)

A visitor selects a bean and sees a dedicated page with the aggregated rating,
all its facts (origin, process, species, variety, roaster, cost, weight, flavour
profiles, website) and every individual review, each crediting the submitter's
GitHub username and avatar with their rating and notes.

**Why this priority**: The Untappd-style per-bean page with individual reviews is
the heart of the experience and the agreed data model.

**Independent Test**: Navigate to a bean's URL; verify the average rating, all
individual reviews, reviewer identities and flavour tags render from `beans.json`.

**Acceptance Scenarios**:

1. **Given** a bean reviewed by two people, **When** the visitor opens its page,
   **Then** both reviews appear with each reviewer's username, avatar, rating and
   notes, and the header shows the average of the two ratings.
2. **Given** a review with a website link, **When** the page renders, **Then** the
   link is shown and points only to an `http(s)` URL.

---

### User Story 3 - Install and use offline (Priority: P2)

A visitor installs the site as a PWA on phone or desktop and can browse
previously loaded beans without a network connection. After a new deploy, the app
updates itself automatically.

**Why this priority**: Offline PWA is an explicit requirement and differentiator.

**Independent Test**: Load the site, go offline, reload; verify the app shell and
last-fetched data still render. Deploy a new build; verify the client updates.

**Acceptance Scenarios**:

1. **Given** the site was visited online, **When** the device goes offline and the
   app is reopened, **Then** the app shell and cached beans still display.
2. **Given** a new build is deployed, **When** the client next opens, **Then** it
   picks up the new version (cache busted by build id).

---

### User Story 4 - Submit a new review (Priority: P3)

A visitor (the owner or anyone) follows a clear call-to-action to submit a new
review, which opens the pre-filled GitHub Issue Form. The review appears on the
site only after the owner closes the issue with the `published` label.

**Why this priority**: Growth/contribution path; the intake form already exists,
so this is mostly a CTA plus the publish gate in the pipeline.

**Independent Test**: Click "Add a review"; verify it links to the issue form.
Confirm an unpublished issue does not appear in the built data.

**Acceptance Scenarios**:

1. **Given** the site, **When** the visitor clicks "Add a review", **Then** the
   GitHub bean-review issue form opens.
2. **Given** an open or unlabeled issue, **When** the site is built, **Then** that
   review is absent; **When** the issue is closed with `published`, **Then** it
   appears.
3. **Given** a newly opened bean-review issue, **When** the validation workflow
   runs, **Then** a comment reports whether it passed the schema (with fixes or
   tidy-up warnings), and if the owner submitted a valid review it is
   auto-published (labeled `published` and closed).

### Edge Cases

- Roaster is "Other (not listed)": the freeform roaster field is used as the
  roaster identity.
- Two beans differ only by casing/whitespace/diacritics in roaster+name: they are
  treated as the same bean.
- A field contains HTML/script or a `javascript:` URL: it is sanitized/dropped and
  never rendered as markup.
- A rating or enum value is outside the allowed set: the review is rejected (or the
  offending field dropped) rather than trusted.
- No published reviews yet: the site shows a friendly empty state with a CTA.
- A review omits all optional fields: the card still renders with required fields.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The build pipeline MUST collect only issues that are closed AND
  labeled `published` AND created from the bean-review form.
- **FR-002**: The pipeline MUST parse each issue's form body into structured fields
  matching the issue template (name, roaster, roast type, roast level, blend,
  rating, decaf, organic, roast date, origin, process, species, variety, currency,
  cost, weight, flavour profiles, brew method, brew ratio, website, notes,
  buy-again).
- **FR-003**: The pipeline MUST validate and sanitize every field: enums checked
  against allowed values, rating restricted to 1.00–5.00 in 0.25 steps, numbers
  coerced/validated, URLs restricted to `http(s)`, text stripped of control
  characters and HTML, and unknown fields ignored.
- **FR-004**: The pipeline MUST aggregate reviews into beans keyed by normalized
  roaster+name (case/whitespace/diacritics-insensitive), computing an average
  rating and review count per bean.
- **FR-005**: Each review MUST retain its submitter's GitHub username and avatar
  URL and the issue number/URL.
- **FR-006**: The site MUST render a browsable list of beans with search and
  filters, and a detail page per bean with all individual reviews.
- **FR-007**: The frontend MUST render all user-derived text via DOM text nodes,
  never as HTML markup.
- **FR-008**: The site MUST be an installable, offline-capable PWA with a manifest
  and service worker, and MUST show the build commit hash in the footer.
- **FR-009**: The site MUST support light and dark themes and be responsive and
  accessible (keyboard + screen reader).
- **FR-010**: The site MUST provide a clear call-to-action linking to the GitHub
  issue form for submitting a new review.
- **FR-011**: The pipeline MUST be a single combined CI/CD workflow that tests,
  builds the data artifact, stamps the build id, and deploys to GitHub Pages, and
  MUST rebuild when relevant issue events occur.
- **FR-012**: When a bean-review issue is opened or edited, the system MUST
  validate its body against the review schema (reusing the build's parse +
  sanitize logic) and comment the result on the issue (success with any tidy-up
  warnings, or the list of required fixes).
- **FR-013**: When a valid bean-review issue was submitted by the repository
  owner, the system MUST publish it automatically by adding the `published` label
  and closing it (which triggers the deploy pipeline).
- **FR-014**: Each bean MUST have its own crawlable, indexable URL
  (`/bean/<slug>/`) served as a prerendered page with a unique title, meta
  description, canonical link, Open Graph/Twitter tags and JSON-LD
  (Product + AggregateRating + Review). The build MUST emit `sitemap.xml`,
  `robots.txt` and a social preview image.

### Key Entities

- **Review**: One submitted review = one published issue. Attributes: all beacon
  fields above, plus submitter (username, avatar), issue number/URL, submitted
  date, rating (number).
- **Bean**: A distinct coffee identified by normalized roaster+name. Attributes:
  display roaster, display name, shared facts, average rating, review count, list
  of Reviews. Facts that can vary between reviews are taken from the most complete
  / most recent review.
- **Roaster**: The producer/brand; may come from the dropdown or the freeform
  "Other" field.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of closed+`published` bean-review issues appear on the site
  after a deploy, and 0% of non-published issues appear.
- **SC-002**: A visitor can find a specific bean via search/filter in under 10
  seconds on the home page.
- **SC-003**: The site loads and is interactive with no network on a repeat visit
  (offline PWA), and updates within one visit after a new deploy.
- **SC-004**: No user-supplied content is ever executed or rendered as markup
  (verified by tests with malicious inputs).
- **SC-005**: The site ships zero runtime third-party JS dependencies.
- **SC-006**: Accessibility smoke test reports no critical violations.

## Assumptions

- Reviews are authored via the existing `.github/ISSUE_TEMPLATE/bean-review.yml`
  form; its field labels are the parsing contract.
- The owner applies the `published` label and closes issues to publish.
- GitHub Pages hosts the site at a project path (relative asset paths required).
- Bean facts are consistent enough that roaster+name is a reliable identity key.
- English UI for v1 (i18n structure optional/nice-to-have).
- A committed sample `beans.json` seeds local/dev and demo rendering; production
  data is regenerated from live published issues at deploy.
