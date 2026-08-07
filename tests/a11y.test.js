// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import axe from 'axe-core';
import { renderHome, emptyState } from '../src/views/home.js';
import { renderItem } from '../src/views/item.js';
import { coffee, tea, sampleItem } from './helpers.js';

const data = { generatedAt: '2026-01-01T00:00:00Z', buildId: 'abc123', items: [sampleItem()] };

let main;
beforeEach(() => {
  document.body.innerHTML = '';
  main = document.createElement('main');
  document.body.append(main);
});

async function noSeriousViolations(context) {
  const results = await axe.run(context, {
    rules: { 'color-contrast': { enabled: false } }, // needs real layout
  });
  const serious = results.violations.filter((v) => ['critical', 'serious'].includes(v.impact));
  return serious.map((v) => `${v.id}: ${v.help}`);
}

describe('home view', () => {
  it('renders every item with a link and rating', () => {
    renderHome(main, data, coffee);
    expect(main.querySelectorAll('.card').length).toBe(1);
    expect(main.textContent).toContain('Test Bean');
    expect(main.querySelector('a.card').getAttribute('href')).toContain('/bean/');
  });

  it('renders one control per configured filter', () => {
    renderHome(main, data, coffee);
    for (const filter of coffee.filters) {
      if (filter.kind === 'flags') continue;
      expect(main.querySelector(`#${filter.id}`)).toBeTruthy();
    }
  });

  it('uses the product route base and vocabulary', () => {
    const teaData = {
      ...data,
      items: [sampleItem({
        slug: 'ippodo-sencha',
        name: 'Sencha',
        maker: 'Ippodo Tea',
        facts: { teaType: 'Green', form: 'Loose leaf', blend: 'Single Origin', origins: ['Japan'] },
      })],
    };
    renderHome(main, teaData, tea);
    expect(main.querySelector('a.card').getAttribute('href')).toContain('/tea/');
    expect(main.textContent).toContain('Leaf Book');
    expect(main.textContent).toContain('1 of 1 tea');
  });

  it('has no serious accessibility violations', async () => {
    renderHome(main, data, coffee);
    expect(await noSeriousViolations(main)).toEqual([]);
  });
});

describe('empty log', () => {
  const empty = { generatedAt: '2026-01-01T00:00:00Z', buildId: 'abc123', items: [] };

  it('invites the first review instead of showing filters over an empty grid', () => {
    renderHome(main, empty, tea);
    expect(main.querySelector('.empty')).toBeTruthy();
    expect(main.textContent).toContain(tea.site.emptyTitle);
    // The search box and filter controls would only be confusing here.
    expect(main.querySelector('#search')).toBeNull();
    expect(main.querySelector('.controls')).toBeNull();
    expect(main.textContent).not.toContain('match your filters');
  });

  it('still shows the hero so the site is identifiable', () => {
    renderHome(main, empty, tea);
    expect(main.querySelector('.hero')).toBeTruthy();
    expect(main.textContent).toContain('Leaf Book');
  });

  it('links the call to action at the product\u2019s own issue form', () => {
    renderHome(main, empty, tea);
    const cta = main.querySelector('.empty a.btn');
    expect(cta.getAttribute('href')).toContain('template=tea-review.yml');
    expect(cta.textContent).toBe(tea.terms.firstReview);
  });

  it('renders the same block the load-failure path uses', () => {
    main.append(emptyState(coffee));
    const cta = main.querySelector('.empty a.btn');
    expect(cta.getAttribute('href')).toContain('template=bean-review.yml');
    expect(main.textContent).toContain(coffee.site.emptyTitle);
  });

  it('has no serious accessibility violations', async () => {
    renderHome(main, empty, tea);
    expect(await noSeriousViolations(main)).toEqual([]);
  });
});

describe('item view', () => {
  it('renders reviews with author identity', () => {
    renderItem(main, sampleItem(), coffee);
    expect(main.textContent).toContain('@octocat');
    expect(main.textContent).toContain('Lovely cup');
    expect(main.querySelector('.avatar')).toBeTruthy();
  });

  it('shows price & weight on the review, and value-per-100g on the item', () => {
    renderItem(main, sampleItem(), coffee);
    const review = main.querySelector('.review');
    expect(review.textContent).toContain('€12.50');
    expect(review.textContent).toContain('250 g');
    // Derived value shown in the facts panel, not the raw price.
    expect(main.querySelector('.facts').textContent).toContain('€5.00 / 100g');
    expect(main.querySelector('.facts').textContent).not.toContain('€12.50');
  });

  it('shows the grind on the review, never in the item facts', () => {
    renderItem(main, sampleItem(), coffee);
    expect(main.querySelector('.review').textContent).toContain('Kingrinder K6 @ 100 clicks (Medium)');
    expect(main.querySelector('.facts').textContent).not.toContain('Kingrinder');
  });

  it('hides "Unknown" enum facts', () => {
    const item = sampleItem();
    item.facts.roastLevel = 'Unknown';
    renderItem(main, item, coffee);
    expect(main.querySelector('.facts').textContent).not.toContain('Unknown');
  });

  it('never renders untrusted notes as markup (XSS-safe)', () => {
    const item = sampleItem();
    item.reviews[0].notes = 'evil <script>alert(1)</script>';
    item.name = '<img src=x onerror=alert(1)>';
    renderItem(main, item, coffee);
    // The literal text is present, but no script/img element was created from it.
    expect(main.innerHTML).not.toContain('<script');
    expect(main.querySelectorAll('script').length).toBe(0);
    expect(main.querySelector('h1').textContent).toContain('<img');
  });

  it('renders nothing at all for an item without flavour profiles', () => {
    const item = sampleItem({ flavours: [] });
    item.reviews[0].flavours = [];
    renderItem(main, item, coffee);
    expect(main.querySelector('.flavour-block')).toBeNull();
    // A skipped block must never leak as the literal text "null".
    expect(main.textContent).not.toContain('null');
  });

  it('renders tea facts with the tea vocabulary', () => {
    const item = sampleItem({
      name: 'Shui Xian',
      maker: 'Bitterleaf Teas',
      facts: {
        teaType: 'Oolong', form: 'Loose leaf', blend: 'Single Origin', origins: ['China'],
        oxidation: 'Roasted', cultivar: 'Shui Xian', harvest: 'Autumn flush',
        harvestYear: 2025, caffeineFree: false, organic: false, website: null,
      },
      reviews: [{
        id: 9, url: null, submittedAt: '2026-01-01T00:00:00Z', author: { login: 'octocat' },
        rating: 4.75, currency: { code: 'EUR', symbol: '€' }, cost: 18, weightGrams: 50,
        flavours: ['Mineral'], brewMethod: 'Gongfu (gaiwan / small pot)',
        waterTemp: 98, steepTime: '15 s', steeps: 8, ratio: '1:15',
        notes: 'Cocoa and wet stone.', buyAgain: true,
      }],
    });
    renderItem(main, item, tea);
    const facts = main.querySelector('.facts').textContent;
    expect(facts).toContain('Oolong');
    expect(facts).toContain('Harvest year');
    expect(facts).not.toContain('Roast level');
    expect(main.querySelector('.review').textContent).toContain('98 °C · 15 s · 8 infusions');
    expect(main.querySelector('.back').textContent).toContain('All teas');
  });

  it('has no serious accessibility violations', async () => {
    renderItem(main, sampleItem(), coffee);
    expect(await noSeriousViolations(main)).toEqual([]);
  });
});
