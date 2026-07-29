import { describe, it, expect } from 'vitest';
import {
  sanitizeReview, cleanText, parseRating,
} from '../scripts/lib/sanitize.js';

function raw(overrides = {}) {
  return {
    id: 1,
    url: 'https://github.com/DevSecNinja/bean-book/issues/1',
    submittedAt: '2026-01-01T00:00:00Z',
    author: {
      login: 'DevSecNinja',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      profileUrl: 'https://github.com/DevSecNinja',
    },
    name: 'Guji Highlands',
    roasterChoice: 'Wakuli',
    roasterOther: null,
    roastType: 'Filter',
    roastLevel: 'Light',
    blend: 'Blend',
    rating: '3.50',
    decaf: false,
    organic: true,
    roastDate: null,
    origin: 'Guatemala, Honduras, Brazil',
    process: 'Natural',
    species: 'Arabica',
    variety: null,
    currency: 'EUR (€)',
    cost: '12.90',
    weight: '250',
    flavours: ['Berry', 'Citrus'],
    brewMethod: 'V60 / Pour-over',
    grindSource: 'Ground by me',
    grinder: 'Kingrinder K6',
    grindSetting: '100 clicks',
    grindSize: 'Medium',
    ratio: '1:16',
    website: 'https://example.com/bean',
    notes: 'Nice and juicy',
    buyAgain: true,
    ...overrides,
  };
}

describe('cleanText', () => {
  it('decodes entities and strips control chars', () => {
    expect(cleanText('a &amp; b')).toBe('a & b');
    expect(cleanText("it&#39;s")).toBe("it's");
    expect(cleanText('x\u0000\u0007y')).toBe('xy');
  });

  it('strips HTML tags (XSS defence)', () => {
    expect(cleanText('<script>alert(1)</script>hi')).toBe('alert(1)hi');
    expect(cleanText('<img src=x onerror=alert(1)>')).toBeNull(); // empty after strip
    expect(cleanText('<b>bold</b>')).toBe('bold');
  });

  it('caps length', () => {
    expect(cleanText('a'.repeat(5000), 10).length).toBe(10);
  });
});

describe('parseRating', () => {
  it('accepts values on the 0.25 grid', () => {
    expect(parseRating('3.50')).toBe(3.5);
    expect(parseRating('5.00 – Perfect')).toBe(5);
    expect(parseRating('1.25')).toBe(1.25);
  });
  it('rejects off-grid and out-of-range', () => {
    expect(parseRating('3.31')).toBeNull();
    expect(parseRating('0.5')).toBeNull();
    expect(parseRating('6')).toBeNull();
    expect(parseRating('not a number')).toBeNull();
  });
});

describe('sanitizeReview', () => {
  it('sanitizes a valid review', () => {
    const r = sanitizeReview(raw());
    expect(r).not.toBeNull();
    expect(r.name).toBe('Guji Highlands');
    expect(r.roaster).toBe('Wakuli');
    expect(r.rating).toBe(3.5);
    expect(r.origins).toEqual(['Guatemala', 'Honduras', 'Brazil']);
    expect(r.cost).toBe(12.9);
    expect(r.weightGrams).toBe(250);
    expect(r.currency).toEqual({ code: 'EUR', symbol: '€' });
  });

  it('rejects reviews missing required fields', () => {
    expect(sanitizeReview(raw({ name: null }))).toBeNull();
    expect(sanitizeReview(raw({ roasterChoice: null, roasterOther: null }))).toBeNull();
    expect(sanitizeReview(raw({ rating: '3.31' }))).toBeNull();
    expect(sanitizeReview(null)).toBeNull();
  });

  it('resolves the freeform roaster when "Other" is chosen', () => {
    const r = sanitizeReview(raw({ roasterChoice: 'Other (not listed)', roasterOther: 'My Local Roastery' }));
    expect(r.roaster).toBe('My Local Roastery');
  });

  it('decodes and matches enum values with entities', () => {
    const r = sanitizeReview(raw({ roastType: 'Omni (Filter &amp; Espresso)' }));
    expect(r.roastType).toBe('Omni (Filter & Espresso)');
  });

  it('drops invalid enums to null / Unknown', () => {
    const r = sanitizeReview(raw({ process: 'None', species: 'Martian', blend: 'bogus' }));
    expect(r.process).toBeNull();
    expect(r.species).toBeNull();
    expect(r.blend).toBe('Unknown');
  });

  it('only keeps single origin whole when not a blend', () => {
    const r = sanitizeReview(raw({ blend: 'Single Origin', origin: 'Ethiopia, Guji, Shakiso' }));
    expect(r.origins).toEqual(['Ethiopia, Guji, Shakiso']);
  });

  it('rejects unsafe URLs, keeps http(s)', () => {
    expect(sanitizeReview(raw({ website: 'javascript:alert(1)' })).website).toBeNull();
    expect(sanitizeReview(raw({ website: 'http://ok.test' })).website).toBe('http://ok.test/');
  });

  it('neutralizes malicious text in name and notes', () => {
    const r = sanitizeReview(raw({
      name: '<img src=x onerror=alert(1)>Evil Bean',
      notes: 'good <script>steal()</script> coffee',
    }));
    expect(r.name).toBe('Evil Bean');
    expect(r.name).not.toContain('<');
    expect(r.notes).not.toContain('<script');
  });

  it('validates the author and rejects non-GitHub urls', () => {
    const r = sanitizeReview(raw({
      author: { login: 'bad login!', avatarUrl: 'https://evil.test/x.png', profileUrl: 'javascript:1' },
    }));
    expect(r.author.login).toBeNull();
    expect(r.author.avatarUrl).toBeNull();
    expect(r.author.profileUrl).toBeNull();
  });

  it('filters flavours to the allowed set and caps count', () => {
    const r = sanitizeReview(raw({ flavours: ['Berry', 'Berry', 'Unicorn', 'Citrus'] }));
    expect(r.flavours).toEqual(['Berry', 'Citrus']);
  });

  it('accepts a valid roast date and rejects a malformed one', () => {
    expect(sanitizeReview(raw({ roastDate: '2026-06-15' })).roastDate).toBe('2026-06-15');
    expect(sanitizeReview(raw({ roastDate: 'yesterday' })).roastDate).toBeNull();
  });

  it('normalizes brew ratios and rejects nonsense', () => {
    expect(sanitizeReview(raw({ ratio: '1:16' })).ratio).toBe('1:16');
    expect(sanitizeReview(raw({ ratio: '1 : 15.5' })).ratio).toBe('1:15.5');
    expect(sanitizeReview(raw({ ratio: '1/2' })).ratio).toBe('1:2');
    expect(sanitizeReview(raw({ ratio: '16' })).ratio).toBe('1:16');
    expect(sanitizeReview(raw({ ratio: 'a lot of water' })).ratio).toBeNull();
    expect(sanitizeReview(raw({ ratio: null })).ratio).toBeNull();
  });

  it('keeps the grind details on the review', () => {
    const r = sanitizeReview(raw());
    expect(r.grindSource).toBe('Ground by me');
    expect(r.grinder).toBe('Kingrinder K6');
    expect(r.grindSetting).toBe('100 clicks');
    expect(r.grindSize).toBe('Medium');
  });

  it('drops grinder details for pre-ground coffee', () => {
    const r = sanitizeReview(raw({ grindSource: 'Pre-ground', grindSize: 'Medium-Fine' }));
    expect(r.grindSource).toBe('Pre-ground');
    expect(r.grinder).toBeNull();
    expect(r.grindSetting).toBeNull();
    expect(r.grindSize).toBe('Medium-Fine');
  });

  it('drops unrecognized grind enums and sanitizes the free-text grinder', () => {
    const r = sanitizeReview(raw({
      grindSource: 'By hand somehow', grindSize: 'Gravel', grinder: '<b>Kingrinder</b> K6',
    }));
    expect(r.grindSource).toBeNull();
    expect(r.grindSize).toBeNull();
    expect(r.grinder).toBe('Kingrinder K6');
  });
});
