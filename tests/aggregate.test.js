import { describe, it, expect } from 'vitest';
import { normalize, slugify, aggregate } from '../scripts/lib/aggregate.js';
import { coffee, tea, review } from './helpers.js';

const agg = (reviews) => aggregate(reviews, coffee);

describe('normalize', () => {
  it('lowercases, trims, collapses whitespace and strips diacritics', () => {
    expect(normalize('  Simon   Lévelt ')).toBe('simon levelt');
    expect(normalize('CAFÉ')).toBe('cafe');
  });
});

describe('slugify', () => {
  it('creates url-safe slugs', () => {
    expect(slugify('Simon Lévelt', 'Guji Highlands')).toBe('simon-levelt-guji-highlands');
  });

  it('falls back when nothing sluggable is left', () => {
    expect(slugify('***', '///', 'bean')).toBe('bean');
  });
});

describe('aggregate', () => {
  it('groups reviews of the same item despite casing/diacritics', () => {
    const items = agg([
      review({ id: 1, maker: 'Simon Lévelt', name: 'Guji Highlands', rating: 4 }),
      review({ id: 2, maker: 'simon levelt', name: 'guji  highlands', rating: 2 }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].reviewCount).toBe(2);
    expect(items[0].averageRating).toBe(3);
  });

  it('keeps distinct items separate and sorts by rating', () => {
    const items = agg([
      review({ id: 1, maker: 'A', name: 'Low', rating: 2 }),
      review({ id: 2, maker: 'B', name: 'High', rating: 5 }),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('High');
  });

  it('gives every item a unique slug', () => {
    const items = agg([
      review({ id: 1, maker: 'A B', name: 'C', rating: 3 }),
      review({ id: 2, maker: 'A', name: 'B C', rating: 4 }),
    ]);
    const slugs = items.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('merges facts taking the most recent non-empty value', () => {
    const items = agg([
      review({ id: 2, submittedAt: '2026-02-01T00:00:00Z', process: 'Washed', variety: null }),
      review({ id: 1, submittedAt: '2026-01-01T00:00:00Z', process: 'Natural', variety: 'Bourbon' }),
    ]);
    expect(items[0].facts.process).toBe('Washed'); // newest wins
    expect(items[0].facts.variety).toBe('Bourbon'); // newest was null -> fall back
  });

  it('unions flavours across reviews', () => {
    const items = agg([
      review({ id: 1, flavours: ['Berry'] }),
      review({ id: 2, flavours: ['Berry', 'Citrus'] }),
    ]);
    expect(items[0].flavours.sort()).toEqual(['Berry', 'Citrus']);
  });

  it('does not put purchase or brew data in item facts', () => {
    const items = agg([review({ id: 1, cost: 12, weightGrams: 250 })]);
    expect(items[0].facts).not.toHaveProperty('cost');
    expect(items[0].facts).not.toHaveProperty('weightGrams');
    expect(items[0].facts).not.toHaveProperty('currency');
    expect(items[0].facts).not.toHaveProperty('grindSize');
  });

  it('computes the cheapest value per 100g across reviews', () => {
    const eur = { code: 'EUR', symbol: '€' };
    const items = agg([
      review({ id: 1, cost: 12, weightGrams: 250, currency: eur }), // 4.80 / 100g
      review({ id: 2, cost: 10, weightGrams: 250, currency: eur }), // 4.00 / 100g
    ]);
    expect(items[0].valuePer100g).toEqual({ value: 4, currency: eur });
  });

  it('has a null value per 100g when no review has cost + weight', () => {
    const items = agg([review({ id: 1, cost: null, weightGrams: null })]);
    expect(items[0].valuePer100g).toBeNull();
  });

  it('derives the fact set from the product schema', () => {
    const teaReview = {
      id: 1, submittedAt: '2026-01-01T00:00:00Z', author: { login: 'a' },
      name: 'Shui Xian', maker: 'Bitterleaf Teas', rating: 4.75,
      teaType: 'Oolong', form: 'Loose leaf', blend: 'Single Origin', oxidation: 'Roasted',
      cultivar: 'Shui Xian', harvest: 'Second flush (summer)', harvestYear: 2025,
      caffeineFree: false, organic: false, origins: ['China'], website: null,
      currency: { code: 'EUR', symbol: '€' }, cost: 18, weightGrams: 50,
      flavours: ['Mineral'], brewMethod: 'Gongfu (gaiwan / small pot)',
      waterTemp: 98, steepTime: '15 s', steeps: 8, ratio: '1:15',
      notes: null, buyAgain: true,
    };
    const [item] = aggregate([teaReview], tea);
    expect(Object.keys(item.facts).sort()).toEqual([
      'blend', 'caffeineFree', 'cultivar', 'form', 'harvest', 'harvestYear',
      'organic', 'origins', 'oxidation', 'teaType', 'website',
    ]);
    expect(item.facts).not.toHaveProperty('waterTemp');
    expect(item.slug).toBe('bitterleaf-teas-shui-xian');
  });
});
