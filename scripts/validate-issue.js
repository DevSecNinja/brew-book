/**
 * Validate the review issue from the current GitHub event.
 *
 * The product is resolved from the issue's form label (`bean-review` ->
 * coffee, `tea-review` -> tea), so one workflow covers both sites.
 *
 * Reads the issue from $GITHUB_EVENT_PATH, validates it, writes the comment
 * body to `.issue-comment.md`, and exposes `valid=true|false` via $GITHUB_OUTPUT
 * for later workflow steps. Prints the comment to the log for visibility.
 */

import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { productForLabel, PRODUCT_IDS } from '../products/index.js';
import { validateIssue, buildComment } from './lib/validate.js';

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) {
  console.error('GITHUB_EVENT_PATH is not set — run this inside GitHub Actions.');
  process.exit(1);
}

const event = JSON.parse(readFileSync(eventPath, 'utf8'));
const issue = event.issue;
if (!issue) {
  console.error('No issue found in the event payload.');
  process.exit(1);
}

const labels = (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l?.name));
const product = labels.map(productForLabel).find(Boolean);
if (!product) {
  console.error(
    `Issue #${issue.number} carries no review form label `
    + `(expected one of: ${PRODUCT_IDS.join(', ')}).`,
  );
  process.exit(1);
}

const result = validateIssue(issue, product);
const comment = buildComment(result, { login: issue.user?.login, product });

writeFileSync('.issue-comment.md', `${comment}\n`, 'utf8');
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `valid=${result.ok}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `product=${product.id}\n`);
}

console.log(comment);
console.log(`\nproduct=${product.id}\nvalid=${result.ok}`);
