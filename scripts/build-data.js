/**
 * Build the static data file for one product (coffee -> data/coffee.json,
 * tea -> data/tea.json).
 *
 * Source of truth: GitHub Issues created from the product's review form that
 * are CLOSED and carry the `published` label (owner-moderated publishing).
 *
 * The same pipeline (parse -> sanitize -> aggregate) runs on either live issues
 * or a committed sample fixture, so builds and tests never require the network.
 *
 * Usage:
 *   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/build-data.js coffee
 *   node scripts/build-data.js tea        # no token -> uses the sample fixture
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getProduct, PRODUCT_IDS } from '../products/index.js';
import { parseIssue } from './lib/parse-issue.js';
import { sanitizeReview } from './lib/sanitize.js';
import { aggregate } from './lib/aggregate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');

const REPO = process.env.GITHUB_REPOSITORY || 'DevSecNinja/brew-book';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

async function fetchPublishedIssues(product) {
  const issues = [];
  const base = `https://api.github.com/repos/${REPO}/issues`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': `${product.id}-book-build`,
    Authorization: `Bearer ${TOKEN}`,
  };
  const labels = `${product.issue.publishLabel},${product.issue.formLabel}`;
  for (let page = 1; page <= 20; page += 1) {
    const url = `${base}?state=closed&labels=${labels}&per_page=100&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    // Exclude pull requests (the issues endpoint includes them).
    for (const item of batch) {
      if (!item.pull_request) issues.push(item);
    }
    if (batch.length < 100) break;
  }
  return issues;
}

/** A closed, published, review issue for this product that isn't a PR. */
export function isPublishable(issue, product) {
  if (!issue || issue.pull_request) return false;
  if (issue.state && issue.state !== 'closed') return false;
  const labels = (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l?.name));
  return labels.includes(product.issue.publishLabel)
    && labels.includes(product.issue.formLabel);
}

async function loadSampleIssues(product) {
  try {
    const text = await readFile(join(ROOT, product.data.sample), 'utf8');
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Run the whole pipeline over a list of raw issues. */
export function buildDataset(issues, product) {
  const reviews = issues
    .filter((issue) => isPublishable(issue, product))
    .map((issue) => parseIssue(issue, product))
    .map((raw) => sanitizeReview(raw, product))
    .filter(Boolean);

  return { reviews, items: aggregate(reviews, product) };
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error(`Usage: node scripts/build-data.js <${PRODUCT_IDS.join('|')}>`);
    process.exit(1);
  }
  const product = getProduct(id);

  let issues;
  let source;
  if (TOKEN) {
    try {
      issues = await fetchPublishedIssues(product);
      source = 'github';
    } catch (err) {
      console.warn(`[build-data] live fetch failed (${err.message}); using sample.`);
      issues = await loadSampleIssues(product);
      source = 'sample-fallback';
    }
  } else {
    console.warn('[build-data] no GITHUB_TOKEN; using sample fixture.');
    issues = await loadSampleIssues(product);
    source = 'sample';
  }

  const { reviews, items } = buildDataset(issues, product);

  const output = {
    generatedAt: new Date().toISOString(),
    buildId: '__BUILD_ID__',
    product: product.id,
    itemCount: items.length,
    reviewCount: reviews.length,
    items,
  };

  const out = join(ROOT, product.data.file);
  await writeFile(out, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(
    `[build-data] wrote ${items.length} ${product.terms.items} / ${reviews.length} reviews `
    + `to ${product.data.file} (source: ${source}).`,
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[build-data] fatal:', err);
    process.exit(1);
  });
}
