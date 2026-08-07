/** Home view: searchable, filterable gallery of items. */

import { el, clear } from '../components.js';
import { starBar, formatRating, formatValuePer100g, factValue, newReviewUrl } from '../format.js';
import { makers } from '../data.js';

/**
 * The "nothing published yet" state, with the call to action.
 *
 * Shown both when the data file can't be loaded and when it loads fine but is
 * empty — a brand-new site should invite the first review, not present a wall
 * of filters over an empty grid.
 */
export function emptyState(product) {
  return el('div', { class: 'empty' },
    el('h1', { text: product.site.emptyTitle }),
    el('p', { text: 'No reviews have been published yet. Check back soon!' }),
    el('a', {
      class: 'btn primary', href: newReviewUrl(product),
      target: '_blank', rel: 'noopener', text: product.terms.firstReview,
    }),
  );
}

function badgeText(entry, facts) {
  const value = factValue(entry, facts, entry.label);
  if (value == null) return null;
  return Array.isArray(value) ? value.join(', ') : value;
}

function itemCard(item, product) {
  const facts = item.facts ?? {};
  const badges = product.badges.map((b) => badgeText(b, facts)).filter(Boolean);
  const origins = facts.origins;

  return el('a', { class: 'card', href: `/${product.terms.routeBase}/${encodeURIComponent(item.slug)}/` },
    el('div', { class: 'card-top' },
      el('span', { class: 'rating-badge', text: formatRating(item.averageRating) }),
      starBar(item.averageRating, item.reviewCount),
    ),
    el('h2', { class: 'card-title', text: item.name }),
    el('p', { class: 'card-roaster', text: item.maker }),
    Array.isArray(origins) && origins.length
      ? el('p', { class: 'card-origin', text: origins.join(', ') })
      : null,
    badges.length
      ? el('div', { class: 'badges' }, badges.map((b) => el('span', { class: 'badge', text: b })))
      : null,
    el('div', { class: 'card-foot' },
      el('span', { class: 'muted', text: `${item.reviewCount} review${item.reviewCount === 1 ? '' : 's'}` }),
      item.valuePer100g
        ? el('span', { class: 'muted value-hint', text: `from ${formatValuePer100g(item.valuePer100g)}` })
        : null,
    ),
  );
}

/** The price bands configured for a product, or [] when it has no price filter. */
export function priceBands(product) {
  return product.filters.find((f) => f.kind === 'price')?.bands ?? [];
}

/** Free-text haystack: name, maker and every string-ish fact plus flavours. */
function haystack(item) {
  const factValues = Object.values(item.facts ?? {})
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter((v) => typeof v === 'string');
  return [item.name, item.maker, ...factValues, ...(item.flavours ?? [])]
    .join(' ')
    .toLowerCase();
}

/**
 * Does an item pass the current filter state?
 * @param {object} item
 * @param {object} f filter state: { q, maker, minRating, priceBand, facts: {} }
 * @param {object} product
 */
export function matches(item, f, product) {
  if (f.q && !haystack(item).includes(f.q)) return false;
  if (f.maker && item.maker !== f.maker) return false;
  for (const [field, value] of Object.entries(f.facts ?? {})) {
    if (value === true && !item.facts?.[field]) return false;
    if (typeof value === 'string' && value && item.facts?.[field] !== value) return false;
  }
  if (f.minRating && item.averageRating < f.minRating) return false;
  if (f.priceBand) {
    const band = priceBands(product).find((b) => b.id === f.priceBand);
    const value = item.valuePer100g?.value;
    if (band == null || value == null || value < band.min || value >= band.max) return false;
  }
  return true;
}

export function renderHome(root, data, product) {
  clear(root);

  const hero = el('section', { class: 'hero' },
    el('h1', { text: product.site.name }),
    el('p', { class: 'tagline', text: product.site.tagline }),
  );

  // Nothing published yet: skip the search and filter controls entirely, they
  // would only be a confusing way to look at an empty grid.
  if (data.items.length === 0) {
    root.append(hero, emptyState(product));
    return;
  }

  const filters = { q: '', maker: '', minRating: 0, priceBand: '', facts: {} };

  const grid = el('div', { class: 'grid', id: 'item-grid' });
  const count = el('p', { class: 'result-count muted', 'aria-live': 'polite' });

  const draw = () => {
    const visible = data.items.filter((i) => matches(i, filters, product));
    clear(grid);
    if (visible.length === 0) {
      grid.append(el('div', { class: 'empty' },
        el('p', { text: `No ${product.terms.items} match your filters yet.` }),
      ));
    } else {
      grid.append(...visible.map((i) => itemCard(i, product)));
    }
    count.textContent = `${visible.length} of ${data.items.length} `
      + `${data.items.length === 1 ? product.terms.item : product.terms.items}`;
  };

  const search = el('input', {
    type: 'search', id: 'search', class: 'search', placeholder: product.terms.searchPlaceholder,
    'aria-label': `Search ${product.terms.items}`,
    onInput: (e) => { filters.q = e.target.value.trim().toLowerCase(); draw(); },
  });

  const select = (label, id, options, onChange) => el('label', { class: 'field' },
    el('span', { class: 'field-label', text: label }),
    el('select', { id, onChange: (e) => { onChange(e.target.value); draw(); } },
      el('option', { value: '', text: 'All' }),
      options.map((o) => el('option', { value: o, text: o })),
    ),
  );

  const checkbox = (label, onChange) => el('label', { class: 'check' },
    el('input', { type: 'checkbox', onChange: (e) => { onChange(e.target.checked); draw(); } }),
    el('span', { text: label }),
  );

  const control = (filter) => {
    switch (filter.kind) {
      case 'maker':
        return select(filter.label, filter.id, makers(data), (v) => { filters.maker = v; });
      case 'enum':
        return select(filter.label, filter.id, filter.options, (v) => { filters.facts[filter.field] = v; });
      case 'rating':
        return el('label', { class: 'field' },
          el('span', { class: 'field-label', text: filter.label }),
          el('select', { id: filter.id, onChange: (e) => { filters.minRating = Number(e.target.value); draw(); } },
            el('option', { value: '0', text: 'Any' }),
            [4, 3, 2].map((r) => el('option', { value: String(r), text: `${r}+ ★` })),
          ),
        );
      case 'price':
        return el('label', { class: 'field' },
          el('span', { class: 'field-label', text: filter.label }),
          el('select', { id: filter.id, onChange: (e) => { filters.priceBand = e.target.value; draw(); } },
            el('option', { value: '', text: 'Any' }),
            filter.bands.map((b) => el('option', { value: b.id, text: b.label })),
          ),
        );
      case 'flags':
        return el('div', { class: 'checks' },
          filter.items.map((item) => checkbox(item.label, (v) => { filters.facts[item.field] = v; })),
        );
      default:
        return null;
    }
  };

  const controls = el('div', { class: 'controls' }, product.filters.map(control));

  root.append(
    hero,
    el('div', { class: 'toolbar' }, search, controls),
    count,
    grid,
  );

  draw();
}
