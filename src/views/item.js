/** Item detail view: aggregated header, facts, and individual reviews. */

import { el, clear, append, safeUrl } from '../components.js';
import {
  starBar, formatRating, formatValuePer100g, formatDate, initials, factValue, fmt,
} from '../format.js';

function factRow(label, value) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return el('div', { class: 'fact' },
    el('dt', { text: label }),
    el('dd', { text }),
  );
}

function avatar(author) {
  if (author?.avatarUrl) {
    return el('img', {
      class: 'avatar', src: safeUrl(author.avatarUrl), alt: '',
      width: '40', height: '40', loading: 'lazy',
    });
  }
  return el('span', { class: 'avatar avatar-fallback', 'aria-hidden': 'true', text: initials(author?.login) });
}

function reviewCard(review, product) {
  const author = review.author ?? {};
  const meta = product.reviewMeta(review, fmt);
  const date = formatDate(review.submittedAt);

  const who = author.login
    ? el('a', { class: 'author-name', href: safeUrl(author.profileUrl), target: '_blank', rel: 'noopener', text: `@${author.login}` })
    : el('span', { class: 'author-name', text: 'Anonymous' });

  return el('article', { class: 'review' },
    el('header', { class: 'review-head' },
      avatar(author),
      el('div', { class: 'review-who' },
        who,
        date ? el('span', { class: 'muted small', text: date }) : null,
      ),
      el('div', { class: 'review-rating' },
        starBar(review.rating),
        el('span', { class: 'rating-badge small', text: formatRating(review.rating) }),
      ),
    ),
    review.notes ? el('p', { class: 'review-notes', text: review.notes }) : null,
    review.flavours && review.flavours.length
      ? el('div', { class: 'tags' }, review.flavours.map((f) => el('span', { class: 'tag', text: f })))
      : null,
    meta.length ? el('p', { class: 'muted small', text: meta.join(' · ') }) : null,
    review.url
      ? el('a', { class: 'review-link small', href: safeUrl(review.url), target: '_blank', rel: 'noopener', text: `Review #${review.id}` })
      : null,
  );
}

export function renderItem(root, item, product) {
  clear(root);
  const facts = item.facts ?? {};

  const back = el('a', { class: 'back', href: '/', text: `← All ${product.terms.items}` });

  const header = el('section', { class: 'bean-header' },
    el('div', { class: 'bean-title' },
      el('h1', { text: item.name }),
      el('p', { class: 'bean-roaster', text: item.maker }),
    ),
    el('div', { class: 'bean-score' },
      el('span', { class: 'rating-badge big', text: formatRating(item.averageRating) }),
      starBar(item.averageRating, item.reviewCount),
      el('span', { class: 'muted', text: `${item.reviewCount} review${item.reviewCount === 1 ? '' : 's'}` }),
    ),
  );

  const factList = el('dl', { class: 'facts' },
    product.facts.map((entry) => {
      if (entry.special === 'valuePer100g') {
        return item.valuePer100g
          ? factRow(entry.label, `from ${formatValuePer100g(item.valuePer100g)}`)
          : null;
      }
      return factRow(entry.label, factValue(entry, facts));
    }),
  );

  const flavours = item.flavours && item.flavours.length
    ? el('div', { class: 'flavour-block' },
        el('h2', { class: 'section-title', text: 'Flavour profile' }),
        el('div', { class: 'tags' }, item.flavours.map((f) => el('span', { class: 'tag', text: f }))),
      )
    : null;

  const website = facts.website
    ? el('a', { class: 'btn', href: safeUrl(facts.website), target: '_blank', rel: 'noopener', text: product.terms.websiteLink })
    : null;

  const reviews = el('section', { class: 'reviews' },
    el('h2', { class: 'section-title', text: `Reviews (${item.reviewCount})` }),
    ...item.reviews.map((r) => reviewCard(r, product)),
  );

  append(
    root,
    back,
    header,
    el('section', { class: 'panel' }, factList, website),
    flavours,
    reviews,
  );
}
