/**
 * SEO strings shared by the SPA (client-side navigation) and the prerenderer,
 * so a page's title/description never differ between the two renderers.
 * Pure: no DOM, no imports.
 */

/** "Rated 4.5/5 from 2 reviews. Ethiopia. Berry, Citrus." */
export function itemDescription(item) {
  const facts = item.facts ?? {};
  const bits = [
    `Rated ${item.averageRating}/5 from ${item.reviewCount} review${item.reviewCount === 1 ? '' : 's'}`,
    Array.isArray(facts.origins) && facts.origins.length ? facts.origins.join(', ') : null,
    item.flavours?.length ? item.flavours.join(', ') : null,
  ].filter(Boolean);
  return `${item.name} by ${item.maker}. ${bits.join('. ')}.`;
}

/** "Guji Highlands — Simon Lévelt | Bean Book" */
export function itemTitle(item, product) {
  return `${item.name} — ${item.maker} | ${product.site.name}`;
}

/** Canonical path for an item, e.g. "/bean/simon-levelt-guji-highlands/". */
export function itemPath(item, product) {
  return `/${product.terms.routeBase}/${item.slug}/`;
}
