/**
 * Validate a review issue body against the product's review "schema".
 *
 * Reuses the exact same parse + sanitize logic as the build pipeline, so a
 * review that validates here is guaranteed to survive the build unchanged.
 * Returns friendly, human-readable errors (hard failures) and warnings
 * (optional values that will be tidied away).
 */

import { parseIssue } from './parse-issue.js';
import { sanitizeReview, parseRating, cleanText } from './sanitize.js';

/** Message used when an optional value can't be understood and gets dropped. */
const DROPPED = {
  enum: (label) => `**${label}** wasn’t recognized and will be omitted.`,
  number: (label) => `**${label}** couldn’t be read as a number; it will be omitted.`,
  date: (label) => `**${label}** should be in \`YYYY-MM-DD\` format; it will be omitted.`,
  url: (label) => `**${label}** must be an \`http(s)\` URL; it will be omitted.`,
  ratio: (label) => `**${label}** couldn’t be read as a \`1:N\` ratio; it will be omitted.`,
  checklist: (label) => `Some **${label}** weren’t recognized and will be omitted.`,
};

/**
 * @param {object} issue - a GitHub issue payload ({ number, user, body, ... })
 * @param {object} product - product config (see products/)
 * @returns {{ ok: boolean, errors: string[], warnings: string[], review: object|null }}
 */
export function validateIssue(issue, product) {
  const raw = parseIssue(issue, product);
  const errors = [];
  const warnings = [];

  // --- Required fields ---
  for (const field of product.fields.filter((f) => f.required)) {
    if (field.type === 'choiceOther') {
      const choice = cleanText(raw[field.id]);
      const other = cleanText(raw[`${field.id}Other`]);
      if (!choice && !other) {
        errors.push(`**${field.label}** is required.`);
      } else if (choice && /^other\b/i.test(choice) && !other) {
        errors.push(
          `You picked **“${choice}”** for the ${field.label.toLowerCase()} — please also fill in `
          + `the **“${field.otherLabel}”** field.`,
        );
      }
    } else if (field.type === 'rating') {
      if (parseRating(raw[field.id]) == null) {
        errors.push(`**${field.label}** must be a value from **1.00 to 5.00 in 0.25 steps** (e.g. \`3.25\`).`);
      }
    } else if (!cleanText(raw[field.id])) {
      errors.push(`**${field.label}** is required.`);
    }
  }

  // --- Optional fields that would be dropped as unrecognized ---
  const review = sanitizeReview(raw, product);
  if (review) {
    for (const field of product.fields) {
      const given = raw[field.id];
      switch (field.type) {
        case 'enum':
          // Enums with a fallback ("Unknown") never drop a value silently.
          if (given && field.fallback == null && !review[field.id]) {
            warnings.push(DROPPED.enum(field.label));
          }
          break;
        case 'number':
          if (given && review[field.id] == null) warnings.push(DROPPED.number(field.label));
          break;
        case 'date':
          if (given && !review[field.id]) warnings.push(DROPPED.date(field.label));
          break;
        case 'url':
          if (given && !review[field.id]) warnings.push(DROPPED.url(field.label));
          break;
        case 'ratio':
          if (given && !review[field.id]) warnings.push(DROPPED.ratio(field.label));
          break;
        case 'checklist':
          if ((given?.length ?? 0) > (review[field.id]?.length ?? 0)) {
            warnings.push(DROPPED.checklist(field.label));
          }
          break;
        default:
          break;
      }
    }
    warnings.push(...(product.extraWarnings?.(raw, review) ?? []));
  }

  return { ok: errors.length === 0 && review != null, errors, warnings, review };
}

/** Build a Markdown comment body from a validation result. */
export function buildComment(result, { login, product } = {}) {
  const who = login ? `@${login}` : 'there';
  const item = product?.terms?.item ?? 'item';
  const formLabel = product?.issue?.formLabel ?? 'review';
  const lines = [];

  if (result.ok) {
    lines.push('## ✅ Review looks good!');
    lines.push('');
    lines.push(`Thanks ${who} — your ${item} review passed validation and is ready to be published.`);
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
  lines.push(`<sub>🤖 Automated ${formLabel} validation.</sub>`);
  return lines.join('\n');
}
