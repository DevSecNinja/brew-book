/** Presentation helpers that need the DOM. Pure formatters live in text.js. */

import { el } from './components.js';
import { formatRating } from './text.js';

export * from './text.js';

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

/**
 * Resolve a displayable value for a fact/badge entry.
 * Flags render `trueText` when true; enums hide the "Unknown" placeholder;
 * arrays are returned as-is for the caller to join.
 * @returns {string|string[]|null}
 */
export function factValue(entry, facts, trueText = 'Yes') {
  const value = facts?.[entry.field];
  if (value == null || value === '' || value === 'Unknown') return null;
  if (value === true) return trueText;
  if (value === false) return null;
  if (Array.isArray(value)) return value.length ? value : null;
  return String(value);
}
