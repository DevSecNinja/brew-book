/** Formatting + presentation helpers (pure, no untrusted-HTML). */

import { el } from './components.js';

/** "3.50" */
export function formatRating(n) {
  return Number(n).toFixed(2);
}

/**
 * A fractional star bar. Fill width is a computed number (safe inline style).
 * @param {number} rating 0..5
 * @param {number} [count] optional review count for the aria label
 */
export function starBar(rating, count) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const label = count != null
    ? `Rated ${formatRating(rating)} out of 5 from ${count} review${count === 1 ? '' : 's'}`
    : `Rated ${formatRating(rating)} out of 5`;
  return el('span', { class: 'stars', role: 'img', 'aria-label': label },
    el('span', { class: 'stars-empty', 'aria-hidden': 'true', text: '\u2605\u2605\u2605\u2605\u2605' }),
    el('span', {
      class: 'stars-full', 'aria-hidden': 'true', text: '\u2605\u2605\u2605\u2605\u2605',
      style: { width: `${pct}%` },
    }),
  );
}

const CURRENCY_BEFORE = new Set(['$', '\u00a3', '\u20ac', '\u00a5', 'A$', 'C$']);

/** "€12.90" or "12.90 kr" depending on symbol convention. */
export function formatCost(cost, currency) {
  if (cost == null) return null;
  const amount = Number(cost).toFixed(2);
  const symbol = currency?.symbol ?? currency?.code ?? '';
  if (!symbol) return amount;
  return CURRENCY_BEFORE.has(symbol) ? `${symbol}${amount}` : `${amount} ${symbol}`;
}

export function formatWeight(g) {
  return g == null ? null : `${g} g`;
}

/** "€4.60 / 100g" from a { value, currency } object. */
export function formatValuePer100g(v) {
  if (!v || v.value == null) return null;
  const price = formatCost(v.value, v.currency);
  return price == null ? null : `${price} / 100g`;
}

/** Relative-ish date, e.g. "8 Jul 2026". */
export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * How the beans were ground for this brew, e.g.
 * "Kingrinder K6 @ 100 clicks (Medium)" or "Pre-ground".
 * Returns null when the reviewer told us nothing about the grind.
 */
export function formatGrind(review) {
  if (!review) return null;
  const size = review.grindSize && review.grindSize !== 'Unknown' ? review.grindSize : null;
  if (review.grindSource === 'Pre-ground') {
    return size ? `Pre-ground (${size})` : 'Pre-ground';
  }
  let head = null;
  if (review.grinder) {
    head = review.grindSetting ? `${review.grinder} @ ${review.grindSetting}` : review.grinder;
  } else if (review.grindSetting) {
    head = `Ground at ${review.grindSetting}`;
  } else if (review.grindSource === 'Ground by me') {
    head = 'Ground by me';
  }
  if (!head) return size ? `${size} grind` : null;
  return size ? `${head} (${size})` : head;
}

/** Initials for an avatar fallback. */
export function initials(text) {
  return String(text ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
