import { describe, it, expect } from 'vitest';
import { formatCost, formatWeight, formatValuePer100g, formatRating, fmt } from '../src/text.js';
import { coffee, tea } from './helpers.js';

const grind = (review) => coffee.grindText(review);

describe('formatters', () => {
  it('places the currency symbol by convention', () => {
    expect(formatCost(12.5, { code: 'EUR', symbol: '€' })).toBe('€12.50');
    expect(formatCost(12.5, { code: 'SEK', symbol: 'kr' })).toBe('12.50 kr');
    expect(formatCost(null, { symbol: '€' })).toBeNull();
  });

  it('formats weights, ratings and derived value', () => {
    expect(formatWeight(250)).toBe('250 g');
    expect(formatWeight(null)).toBeNull();
    expect(formatRating(3.5)).toBe('3.50');
    expect(formatValuePer100g({ value: 5, currency: { symbol: '€' } })).toBe('€5.00 / 100g');
    expect(formatValuePer100g(null)).toBeNull();
  });
});

describe('coffee grindText', () => {
  it('combines grinder, setting and size', () => {
    expect(grind({
      grindSource: 'Ground by me', grinder: 'Kingrinder K6',
      grindSetting: '100 clicks', grindSize: 'Medium',
    })).toBe('Kingrinder K6 @ 100 clicks (Medium)');
  });

  it('describes pre-ground coffee without a grinder', () => {
    expect(grind({ grindSource: 'Pre-ground', grindSize: 'Medium-Fine' }))
      .toBe('Pre-ground (Medium-Fine)');
    expect(grind({ grindSource: 'Pre-ground' })).toBe('Pre-ground');
  });

  it('falls back gracefully on partial data', () => {
    expect(grind({ grinder: 'Comandante C40' })).toBe('Comandante C40');
    expect(grind({ grindSetting: '18 clicks' })).toBe('Ground at 18 clicks');
    expect(grind({ grindSource: 'Ground by me' })).toBe('Ground by me');
    expect(grind({ grindSize: 'Coarse' })).toBe('Coarse grind');
  });

  it('returns null when nothing is known', () => {
    expect(grind({})).toBeNull();
    expect(grind({ grindSource: 'Unknown', grindSize: 'Unknown' })).toBeNull();
    expect(grind(null)).toBeNull();
  });
});

describe('tea steepText', () => {
  it('joins temperature, time and infusion count', () => {
    expect(tea.steepText({ waterTemp: 98, steepTime: '15 s', steeps: 8 }))
      .toBe('98 °C · 15 s · 8 infusions');
  });

  it('singularises a single infusion and skips missing parts', () => {
    expect(tea.steepText({ steeps: 1 })).toBe('1 infusion');
    expect(tea.steepText({ waterTemp: 80 })).toBe('80 °C');
  });

  it('returns null when nothing is known', () => {
    expect(tea.steepText({})).toBeNull();
  });
});

describe('reviewMeta', () => {
  it('builds the coffee metadata line', () => {
    const meta = coffee.reviewMeta({
      cost: 12.5, currency: { code: 'EUR', symbol: '€' }, weightGrams: 250,
      brewMethod: 'AeroPress', grindSource: 'Pre-ground', ratio: '1:16', buyAgain: true,
    }, fmt);
    expect(meta).toEqual(['€12.50', '250 g', 'AeroPress', 'Pre-ground', 'Ratio 1:16', 'Would buy again']);
  });

  it('builds the tea metadata line', () => {
    const meta = tea.reviewMeta({
      cost: 18, currency: { code: 'EUR', symbol: '€' }, weightGrams: 50,
      brewMethod: 'Gongfu (gaiwan / small pot)', waterTemp: 98, steepTime: '15 s',
      steeps: 8, ratio: '1:15', buyAgain: false,
    }, fmt);
    expect(meta).toEqual([
      '€18.00', '50 g', 'Gongfu (gaiwan / small pot)', '98 °C · 15 s · 8 infusions', 'Ratio 1:15',
    ]);
  });
});
