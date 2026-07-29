/** Bean detail view: aggregated header, facts, and individual reviews. */

import { el, clear, safeUrl } from '../components.js';
import {
  starBar, formatRating, formatCost, formatWeight, formatValuePer100g,
  formatDate, formatGrind, initials,
} from '../format.js';

function factRow(label, value) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return el('div', { class: 'fact' },
    el('dt', { text: label }),
    el('dd', { text: text }),
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

function reviewCard(review) {
  const author = review.author ?? {};
  const meta = [];
  const price = formatCost(review.cost, review.currency);
  if (price) meta.push(price);
  const weight = formatWeight(review.weightGrams);
  if (weight) meta.push(weight);
  if (review.brewMethod) meta.push(review.brewMethod);
  const grind = formatGrind(review);
  if (grind) meta.push(grind);
  if (review.ratio) meta.push(`Ratio ${review.ratio}`);
  if (review.buyAgain) meta.push('Would buy again');
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

export function renderBean(root, bean) {
  clear(root);
  const facts = bean.facts ?? {};

  const back = el('a', { class: 'back', href: '/', text: '← All beans' });

  const header = el('section', { class: 'bean-header' },
    el('div', { class: 'bean-title' },
      el('h1', { text: bean.name }),
      el('p', { class: 'bean-roaster', text: bean.roaster }),
    ),
    el('div', { class: 'bean-score' },
      el('span', { class: 'rating-badge big', text: formatRating(bean.averageRating) }),
      starBar(bean.averageRating, bean.reviewCount),
      el('span', { class: 'muted', text: `${bean.reviewCount} review${bean.reviewCount === 1 ? '' : 's'}` }),
    ),
  );

  const factList = el('dl', { class: 'facts' },
    factRow('Roast type', facts.roastType !== 'Unknown' ? facts.roastType : null),
    factRow('Roast level', facts.roastLevel !== 'Unknown' ? facts.roastLevel : null),
    factRow('Origin type', facts.blend !== 'Unknown' ? facts.blend : null),
    factRow('Origin', facts.origins),
    factRow('Process', facts.process),
    factRow('Species', facts.species),
    factRow('Variety', facts.variety),
    factRow('Decaf', facts.decaf ? 'Yes' : null),
    factRow('Organic', facts.organic ? 'Yes' : null),
    factRow('Roast date', facts.roastDate),
    factRow('Value', bean.valuePer100g ? `from ${formatValuePer100g(bean.valuePer100g)}` : null),
  );

  const flavours = bean.flavours && bean.flavours.length
    ? el('div', { class: 'flavour-block' },
        el('h2', { class: 'section-title', text: 'Flavour profile' }),
        el('div', { class: 'tags' }, bean.flavours.map((f) => el('span', { class: 'tag', text: f }))),
      )
    : null;

  const website = facts.website
    ? el('a', { class: 'btn', href: safeUrl(facts.website), target: '_blank', rel: 'noopener', text: 'Visit bean page ↗' })
    : null;

  const reviews = el('section', { class: 'reviews' },
    el('h2', { class: 'section-title', text: `Reviews (${bean.reviewCount})` }),
    ...bean.reviews.map(reviewCard),
  );

  root.append(
    back,
    header,
    el('section', { class: 'panel' }, factList, website),
    flavours,
    reviews,
  );
}
