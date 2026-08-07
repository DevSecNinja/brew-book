/**
 * Pure text formatters — no DOM, no imports.
 *
 * Shared by the SPA (src/views/*), the prerenderer (scripts/build-site.js) and
 * the product configs, so a value is never formatted two different ways.
 */

/** "3.50" */
export function formatRating(n) {
  return Number(n).toFixed(2);
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

/** "250 g" */
export function formatWeight(g) {
  return g == null ? null : `${g} g`;
}

/** "€4.60 / 100g" from a { value, currency } object. */
export function formatValuePer100g(v) {
  if (!v || v.value == null) return null;
  const price = formatCost(v.value, v.currency);
  return price == null ? null : `${price} / 100g`;
}

/** "8 Jul 2026" */
export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "1 review" / "3 reviews" */
export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Where a visitor goes to submit a review for this product. */
export function newReviewUrl(product) {
  return `${product.site.repoUrl}/issues/new?template=${product.issue.template}`;
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

/**
 * The formatter bundle handed to product config hooks (`reviewMeta`), so the
 * configs stay import-free and can be copied verbatim into the deployed site.
 */
export const fmt = {
  rating: formatRating,
  cost: formatCost,
  weight: formatWeight,
  valuePer100g: formatValuePer100g,
  date: formatDate,
};
