import { describe, it, expect } from 'vitest';
import { matches, priceBands } from '../src/views/home.js';
import { coffee, tea } from './helpers.js';

function item(overrides = {}) {
  return {
    name: 'Test Bean',
    maker: 'Test Roaster',
    averageRating: 3.5,
    valuePer100g: { value: 6, currency: { code: 'EUR', symbol: '€' } },
    facts: { roastType: 'Filter', blend: 'Blend', decaf: false, organic: false, origins: ['Ethiopia'] },
    flavours: ['Berry'],
    ...overrides,
  };
}

const none = { q: '', maker: '', minRating: 0, priceBand: '', facts: {} };
const hit = (i, f) => matches(i, { ...none, ...f }, coffee);

describe('home filters', () => {
  it('matches everything with no filters', () => {
    expect(hit(item(), {})).toBe(true);
  });

  it('search matches name, maker, facts and flavours', () => {
    expect(hit(item(), { q: 'ethiopia' })).toBe(true);
    expect(hit(item(), { q: 'test roaster' })).toBe(true);
    expect(hit(item(), { q: 'berry' })).toBe(true);
    expect(hit(item(), { q: 'nope' })).toBe(false);
  });

  it('filters by rating, flags and maker', () => {
    expect(hit(item({ averageRating: 2 }), { minRating: 3 })).toBe(false);
    expect(hit(item(), { facts: { decaf: true } })).toBe(false);
    expect(hit(item({ facts: { decaf: true } }), { facts: { decaf: true } })).toBe(true);
    expect(hit(item(), { maker: 'Other' })).toBe(false);
  });

  it('filters by an enum fact', () => {
    expect(hit(item(), { facts: { roastType: 'Filter' } })).toBe(true);
    expect(hit(item(), { facts: { roastType: 'Espresso' } })).toBe(false);
    // An empty selection means "All".
    expect(hit(item(), { facts: { roastType: '' } })).toBe(true);
  });

  it('filters by price-per-100g band', () => {
    expect(hit(item({ valuePer100g: { value: 4 } }), { priceBand: 'lt5' })).toBe(true);
    expect(hit(item({ valuePer100g: { value: 6 } }), { priceBand: 'lt5' })).toBe(false);
    expect(hit(item({ valuePer100g: { value: 6 } }), { priceBand: '5-7.5' })).toBe(true);
    expect(hit(item({ valuePer100g: { value: 12 } }), { priceBand: 'gt10' })).toBe(true);
  });

  it('excludes items without a price when a price band is selected', () => {
    expect(hit(item({ valuePer100g: null }), { priceBand: 'lt5' })).toBe(false);
    expect(hit(item({ valuePer100g: null }), {})).toBe(true);
  });

  it('has band boundaries that do not overlap, for every product', () => {
    for (const product of [coffee, tea]) {
      const bands = priceBands(product);
      const boundaries = [...new Set(bands.flatMap((b) => [b.min, b.max]))]
        .filter((v) => Number.isFinite(v));
      for (const value of boundaries) {
        const candidate = item({ valuePer100g: { value } });
        const hits = bands.filter((b) => matches(candidate, { ...none, priceBand: b.id }, product));
        expect(hits).toHaveLength(1);
      }
    }
  });
});
