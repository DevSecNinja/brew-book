/**
 * Aggregate sanitized reviews into items (beans / teas).
 *
 * Identity: reviews are grouped by a normalized maker+name key so the same item
 * reviewed by multiple people (or with minor casing/whitespace/diacritic
 * differences) collapses into one Item with an averaged rating and the list of
 * individual reviews (Untappd-style).
 *
 * Which fields are intrinsic to the item (and therefore merged into `facts`)
 * and which stay on the individual review is declared per field in the product
 * config via `scope: 'item'`.
 */

import { fieldByRole } from './sanitize.js';

/** Normalize a string for identity matching (not for display). */
export function normalize(str) {
  if (typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build a URL-safe slug from maker + name. */
export function slugify(maker, name, fallback = 'item') {
  const base = `${maker} ${name}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || fallback;
}

const SEP = '\u241f';
const key = (maker, name) => `${normalize(maker)}${SEP}${normalize(name)}`;

/** Most recent first; falls back to issue id. */
function byRecency(a, b) {
  const ta = Date.parse(a.submittedAt ?? '') || 0;
  const tb = Date.parse(b.submittedAt ?? '') || 0;
  if (tb !== ta) return tb - ta;
  return (b.id ?? 0) - (a.id ?? 0);
}

function isEmpty(v) {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

/**
 * Item-level facts: intrinsic properties, taken from the most-recent non-empty
 * value across reviews. Purchase- and brew-specific data (cost, weight,
 * currency, brew method) deliberately lives on each Review, not here.
 */
function mergeFacts(sortedReviews, factFields) {
  const facts = {};
  for (const field of factFields) {
    let value = null;
    for (const review of sortedReviews) {
      if (!isEmpty(review[field.id])) {
        value = review[field.id];
        break;
      }
    }
    facts[field.id] = value;
  }
  return facts;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Cheapest observed price per 100g across an item's reviews.
 * Returns { value, currency } or null. Currencies aren't converted; we report
 * the lowest per-100g figure together with the currency it was paid in.
 */
function bestValuePer100g(reviews, costKey, weightKey) {
  let best = null;
  for (const r of reviews) {
    if (r[costKey] != null && r[weightKey] > 0) {
      const per = (r[costKey] / r[weightKey]) * 100;
      if (best === null || per < best.value) best = { value: round2(per), currency: r.currency };
    }
  }
  return best;
}

/**
 * @param {object[]} reviews - sanitized reviews (non-null)
 * @param {object} product - product config (see products/)
 * @returns {object[]} items, best-rated first
 */
export function aggregate(reviews, product) {
  const factFields = product.fields.filter((f) => f.scope === 'item');
  const flavoursField = fieldByRole(product, 'flavours');
  const costField = fieldByRole(product, 'cost');
  const weightField = fieldByRole(product, 'weight');

  const groups = new Map();
  for (const review of reviews) {
    if (!review) continue;
    const k = key(review.maker, review.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(review);
  }

  const usedSlugs = new Set();
  const items = [];

  for (const [k, group] of groups) {
    const sorted = [...group].sort(byRecency);
    const primary = sorted[0];

    const slug = slugify(primary.maker, primary.name, product.terms.item);
    let unique = slug;
    let n = 2;
    while (usedSlugs.has(unique)) unique = `${slug}-${n++}`;
    usedSlugs.add(unique);

    const averageRating = round2(
      sorted.reduce((sum, r) => sum + r.rating, 0) / sorted.length,
    );

    const flavours = [];
    if (flavoursField) {
      for (const r of sorted) {
        for (const f of r[flavoursField.id] ?? []) {
          if (!flavours.includes(f)) flavours.push(f);
        }
      }
    }

    items.push({
      slug: unique,
      key: k,
      name: primary.name,
      maker: primary.maker,
      averageRating,
      reviewCount: sorted.length,
      valuePer100g: product.pricePer100g && costField && weightField
        ? bestValuePer100g(sorted, costField.id, weightField.id)
        : null,
      facts: mergeFacts(sorted, factFields),
      flavours,
      reviews: sorted,
    });
  }

  items.sort((a, b) => {
    if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
    if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
    return a.name.localeCompare(b.name);
  });

  return items;
}
