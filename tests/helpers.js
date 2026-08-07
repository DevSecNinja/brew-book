/**
 * Shared test fixtures.
 *
 * `sampleItem()` / `review()` build data in the shape the pipeline emits, so
 * the view and filter tests don't have to re-declare it per file.
 */

import coffee from '../products/coffee.js';
import tea from '../products/tea.js';

export { coffee, tea };

const EUR = { code: 'EUR', symbol: '€' };

export function review(overrides = {}) {
  return {
    id: 1,
    url: 'https://github.com/o/r/issues/1',
    submittedAt: '2026-01-01T00:00:00Z',
    author: {
      login: 'octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1',
      profileUrl: 'https://github.com/octocat',
    },
    name: 'Test Bean',
    maker: 'Test Roaster',
    rating: 3.5,
    roastType: 'Filter',
    roastLevel: 'Light',
    blend: 'Blend',
    decaf: false,
    organic: false,
    roastDate: null,
    origins: ['Ethiopia'],
    process: null,
    species: 'Arabica',
    variety: null,
    currency: EUR,
    cost: 12.5,
    weightGrams: 250,
    flavours: ['Berry'],
    brewMethod: 'V60 / Pour-over',
    grindSource: 'Ground by me',
    grinder: 'Kingrinder K6',
    grindSetting: '100 clicks',
    grindSize: 'Medium',
    ratio: null,
    website: null,
    notes: 'Lovely cup',
    buyAgain: true,
    ...overrides,
  };
}

export function sampleItem(overrides = {}) {
  return {
    slug: 'roaster-bean',
    key: 'roaster\u241fbean',
    name: 'Test Bean',
    maker: 'Test Roaster',
    averageRating: 3.5,
    reviewCount: 1,
    facts: {
      roastType: 'Filter', roastLevel: 'Light', blend: 'Blend', decaf: false,
      organic: true, species: 'Arabica', process: 'Natural', variety: null,
      origins: ['Ethiopia'], website: 'https://example.com/bean', roastDate: null,
    },
    valuePer100g: { value: 5, currency: EUR },
    flavours: ['Berry', 'Citrus'],
    reviews: [review()],
    ...overrides,
  };
}

/** A minimal issue payload for the parse/sanitize/validate tests. */
export function issue({ body, ...overrides } = {}) {
  return {
    number: 7,
    html_url: 'https://github.com/DevSecNinja/brew-book/issues/7',
    created_at: '2026-01-01T00:00:00Z',
    state: 'closed',
    user: {
      login: 'octocat',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      html_url: 'https://github.com/octocat',
    },
    labels: [{ name: 'bean-review' }, { name: 'published' }],
    body: body ?? '',
    ...overrides,
  };
}

/** Build an issue-form body from a `{ '### heading': value }` map. */
export function formBody(sections) {
  return Object.entries(sections)
    .map(([heading, value]) => `### ${heading}\n\n${value}`)
    .join('\n\n');
}
