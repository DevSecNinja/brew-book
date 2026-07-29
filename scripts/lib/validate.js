/**
 * Validate a bean-review issue body against the review "schema".
 *
 * Reuses the exact same parse + sanitize logic as the build pipeline, so a
 * review that validates here is guaranteed to survive the build unchanged.
 * Returns friendly, human-readable errors (hard failures) and warnings
 * (optional values that will be tidied away).
 */

import { parseIssue } from './parse-issue.js';
import { sanitizeReview, parseRating, cleanText } from './sanitize.js';

/**
 * @param {object} issue - a GitHub issue payload ({ number, user, body, ... })
 * @returns {{ ok: boolean, errors: string[], warnings: string[], review: object|null }}
 */
export function validateIssue(issue) {
  const raw = parseIssue(issue);
  const errors = [];
  const warnings = [];

  // --- Required fields ---
  if (!cleanText(raw.name)) {
    errors.push('**Bean name** is required.');
  }

  const choice = cleanText(raw.roasterChoice);
  const other = cleanText(raw.roasterOther);
  if (!choice && !other) {
    errors.push('**Roaster** is required.');
  } else if (choice && /^other\b/i.test(choice) && !other) {
    errors.push('You picked **“Other (not listed)”** for the roaster — please also fill in the **“Roaster (if not listed)”** field.');
  }

  if (parseRating(raw.rating) == null) {
    errors.push('**Rating** must be a value from **1.00 to 5.00 in 0.25 steps** (e.g. `3.25`).');
  }

  // --- Optional fields that would be dropped as unrecognized ---
  const review = sanitizeReview(raw);
  if (review) {
    if (raw.process && !review.process) warnings.push('**Process** wasn’t recognized and will be omitted.');
    if (raw.species && !review.species) warnings.push('**Species** wasn’t recognized and will be omitted.');
    if (raw.brewMethod && !review.brewMethod) warnings.push('**How did you brew it?** wasn’t recognized and will be omitted.');
    if (raw.grindSource && !review.grindSource) warnings.push('**Pre-ground or ground yourself?** wasn’t recognized and will be omitted.');
    if (raw.grindSize && !review.grindSize) warnings.push('**Grind size** wasn’t recognized and will be omitted.');
    if (review.grindSource === 'Pre-ground' && (cleanText(raw.grinder) || cleanText(raw.grindSetting))) {
      warnings.push('You marked the coffee as **Pre-ground**, so the **Grinder** and **Grind setting** will be omitted.');
    }
    if (raw.ratio && !review.ratio) warnings.push('**Brew ratio** couldn’t be read as a `1:N` ratio; it will be omitted.');
    if (raw.website && !review.website) warnings.push('**Bean website** must be an `http(s)` URL; it will be omitted.');
    if (raw.cost && review.cost == null) warnings.push('**Cost** couldn’t be read as a number; it will be omitted.');
    if (raw.weight && review.weightGrams == null) warnings.push('**Weight (grams)** couldn’t be read as a number; it will be omitted.');
    if (raw.roastDate && !review.roastDate) warnings.push('**Roast date** should be in `YYYY-MM-DD` format; it will be omitted.');
    const rawFlavours = Array.isArray(raw.flavours) ? raw.flavours.length : 0;
    if (rawFlavours > review.flavours.length) {
      warnings.push('Some **Flavour profiles** weren’t recognized and will be omitted.');
    }
  }

  return { ok: errors.length === 0 && review != null, errors, warnings, review };
}

/** Build a Markdown comment body from a validation result. */
export function buildComment(result, { login } = {}) {
  const who = login ? `@${login}` : 'there';
  const lines = [];

  if (result.ok) {
    lines.push('## ✅ Review looks good!');
    lines.push('');
    lines.push(`Thanks ${who} — your bean review passed validation and is ready to be published.`);
    if (result.warnings.length) {
      lines.push('');
      lines.push('A few optional fields will be tidied up when it goes live:');
      lines.push('');
      for (const w of result.warnings) lines.push(`- ${w}`);
    }
  } else {
    lines.push('## ❌ This review needs a couple of fixes');
    lines.push('');
    lines.push(`Thanks for submitting, ${who}! Please **edit the issue** to address the following, and it will be re-checked automatically:`);
    lines.push('');
    for (const e of result.errors) lines.push(`- ${e}`);
    if (result.warnings.length) {
      lines.push('');
      lines.push('_Also note:_');
      lines.push('');
      for (const w of result.warnings) lines.push(`- ${w}`);
    }
  }

  lines.push('');
  lines.push('<sub>🤖 Automated bean-review validation.</sub>');
  return lines.join('\n');
}
