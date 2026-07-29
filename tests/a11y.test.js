// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import axe from 'axe-core';
import { renderHome } from '../src/views/home.js';
import { renderBean } from '../src/views/bean.js';

function sampleBean(overrides = {}) {
  return {
    slug: 'roaster-bean',
    key: 'roaster\u241fbean',
    name: 'Test Bean',
    roaster: 'Test Roaster',
    averageRating: 3.5,
    reviewCount: 1,
    facts: {
      roastType: 'Filter', roastLevel: 'Light', blend: 'Blend', decaf: false,
      organic: true, species: 'Arabica', process: 'Natural', variety: null,
      origins: ['Ethiopia'], website: 'https://example.com/bean', roastDate: null,
    },
    valuePer100g: { value: 5, currency: { code: 'EUR', symbol: '€' } },
    flavours: ['Berry', 'Citrus'],
    reviews: [{
      id: 1, url: 'https://github.com/o/r/issues/1', submittedAt: '2026-01-01T00:00:00Z',
      author: { login: 'octocat', avatarUrl: 'https://avatars.githubusercontent.com/u/1', profileUrl: 'https://github.com/octocat' },
      name: 'Test Bean', roaster: 'Test Roaster', rating: 3.5,
      currency: { code: 'EUR', symbol: '€' }, cost: 12.5, weightGrams: 250,
      flavours: ['Berry'], brewMethod: 'V60 / Pour-over', grindSource: 'Ground by me',
      grinder: 'Kingrinder K6', grindSetting: '100 clicks', grindSize: 'Medium',
      notes: 'Lovely cup', buyAgain: true,
    }],
    ...overrides,
  };
}

const data = { generatedAt: '2026-01-01T00:00:00Z', buildId: 'abc123', beans: [sampleBean()] };

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
  it('renders every bean with a link and rating', () => {
    renderHome(main, data);
    expect(main.querySelectorAll('.card').length).toBe(1);
    expect(main.textContent).toContain('Test Bean');
    expect(main.querySelector('a.card').getAttribute('href')).toContain('/bean/');
  });

  it('has no serious accessibility violations', async () => {
    renderHome(main, data);
    expect(await noSeriousViolations(main)).toEqual([]);
  });
});

describe('bean view', () => {
  it('renders reviews with author identity', () => {
    renderBean(main, sampleBean());
    expect(main.textContent).toContain('@octocat');
    expect(main.textContent).toContain('Lovely cup');
    expect(main.querySelector('.avatar')).toBeTruthy();
  });

  it('shows price & weight on the review, and value-per-100g on the bean', () => {
    renderBean(main, sampleBean());
    const review = main.querySelector('.review');
    expect(review.textContent).toContain('€12.50');
    expect(review.textContent).toContain('250 g');
    // Derived value shown in the facts panel, not the raw price.
    expect(main.querySelector('.facts').textContent).toContain('€5.00 / 100g');
    expect(main.querySelector('.facts').textContent).not.toContain('€12.50');
  });

  it('shows the grind on the review, never on the bean facts', () => {
    renderBean(main, sampleBean());
    expect(main.querySelector('.review').textContent).toContain('Kingrinder K6 @ 100 clicks (Medium)');
    expect(main.querySelector('.facts').textContent).not.toContain('Kingrinder');
  });

  it('never renders untrusted notes as markup (XSS-safe)', () => {
    const bean = sampleBean();
    bean.reviews[0].notes = 'evil <script>alert(1)</script>';
    bean.name = '<img src=x onerror=alert(1)>';
    renderBean(main, bean);
    // The literal text is present, but no script/img element was created from it.
    expect(main.innerHTML).not.toContain('<script');
    expect(main.querySelectorAll('script').length).toBe(0);
    expect(main.querySelector('h1').textContent).toContain('<img');
  });

  it('has no serious accessibility violations', async () => {
    renderBean(main, sampleBean());
    expect(await noSeriousViolations(main)).toEqual([]);
  });
});
