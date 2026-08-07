import { describe, it, expect } from 'vitest';
import { cleanText, parseRating, sanitizeReview } from '../scripts/lib/sanitize.js';
import { coffee, tea } from './helpers.js';

/** A raw (parsed, unsanitized) coffee review with the required fields filled. */
function raw(overrides = {}) {
  return {
    id: 1,
    url: 'https://github.com/DevSecNinja/brew-book/issues/1',
    submittedAt: '2026-01-01T00:00:00Z',
    author: { login: 'octocat', avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4', profileUrl: 'https://github.com/octocat' },
    name: 'Guji Highlands',
    maker: 'Simon Lévelt',
    makerOther: null,
    rating: '3.50',
    flavours: [],
    decaf: false,
    organic: false,
    buyAgain: false,
    ...overrides,
  };
}

const clean = (overrides) => sanitizeReview(raw(overrides), coffee);

describe('cleanText', () => {
  it('decodes the entities GitHub emits', () => {
    expect(cleanText('Didn&#39;t pop &amp; fizz')).toBe("Didn't pop & fizz");
  });

  it('strips HTML tags and control characters', () => {
    expect(cleanText('<b>bold</b><script>alert(1)</script>')).toBe('boldalert(1)');
    expect(cleanText('a\u0000b')).toBe('ab');
  });

  it('collapses whitespace and caps the length', () => {
    expect(cleanText('a    b')).toBe('a b');
    expect(cleanText('x'.repeat(300)).length).toBe(200);
  });

  it('returns null for empty or non-string values', () => {
    expect(cleanText('   ')).toBeNull();
    expect(cleanText(null)).toBeNull();
    expect(cleanText(42)).toBeNull();
  });
});

describe('parseRating', () => {
  it('accepts values on the 1–5 / 0.25 grid, with or without a label', () => {
    expect(parseRating('3.50')).toBe(3.5);
    expect(parseRating('5.00 – Perfect')).toBe(5);
    expect(parseRating('1.25')).toBe(1.25);
  });

  it('rejects off-grid and out-of-range values', () => {
    expect(parseRating('3.10')).toBeNull();
    expect(parseRating('0.75')).toBeNull();
    expect(parseRating('6')).toBeNull();
    expect(parseRating('lovely')).toBeNull();
  });
});

describe('sanitizeReview — required fields', () => {
  it('returns a review when name, maker and rating are valid', () => {
    const review = clean();
    expect(review.name).toBe('Guji Highlands');
    expect(review.maker).toBe('Simon Lévelt');
    expect(review.rating).toBe(3.5);
  });

  it('rejects a review that is missing a required field', () => {
    expect(clean({ name: null })).toBeNull();
    expect(clean({ maker: null, makerOther: null })).toBeNull();
    expect(clean({ rating: 'unrated' })).toBeNull();
  });

  it('falls back to the freeform value for "Other (not listed)"', () => {
    expect(clean({ maker: 'Other (not listed)', makerOther: 'My Local Roastery' }).maker)
      .toBe('My Local Roastery');
  });

  it('prefers the dropdown choice over a stray freeform value', () => {
    expect(clean({ maker: 'Friedhats', makerOther: 'Ignored' }).maker).toBe('Friedhats');
  });
});

describe('sanitizeReview — whitelists', () => {
  it('keeps whitelisted enum values and drops unknown ones', () => {
    expect(clean({ process: 'Washed' }).process).toBe('Washed');
    expect(clean({ process: 'Sorcery' }).process).toBeNull();
  });

  it('applies the configured fallback for enums that have one', () => {
    expect(clean({ roastLevel: 'Sorcery' }).roastLevel).toBe('Unknown');
    expect(clean({ roastLevel: undefined }).roastLevel).toBe('Unknown');
  });

  it('keeps only whitelisted, de-duplicated flavours', () => {
    expect(clean({ flavours: ['Berry', 'Berry', 'Unicorn', 'Citrus'] }).flavours)
      .toEqual(['Berry', 'Citrus']);
  });

  it('never lets an unlisted field through', () => {
    expect(clean({ evil: 'payload' })).not.toHaveProperty('evil');
  });
});

describe('sanitizeReview — typed values', () => {
  it('parses numbers and rejects nonsense', () => {
    expect(clean({ cost: '12,50' }).cost).toBe(12.5);
    expect(clean({ weightGrams: '250 g' }).weightGrams).toBe(250);
    expect(clean({ cost: 'free' }).cost).toBeNull();
  });

  it('accepts only ISO dates', () => {
    expect(clean({ roastDate: '2026-06-15' }).roastDate).toBe('2026-06-15');
    expect(clean({ roastDate: '15/06/2026' }).roastDate).toBeNull();
  });

  it('accepts only http(s) URLs', () => {
    expect(clean({ website: 'https://example.com/a' }).website).toBe('https://example.com/a');
    expect(clean({ website: 'javascript:alert(1)' }).website).toBeNull();
    expect(clean({ website: 'ftp://example.com' }).website).toBeNull();
  });

  it('normalizes brew ratios and rejects unusable ones', () => {
    expect(clean({ ratio: '1:16.7' }).ratio).toBe('1:16.7');
    expect(clean({ ratio: '16' }).ratio).toBe('1:16');
    expect(clean({ ratio: '1 / 15' }).ratio).toBe('1:15');
    expect(clean({ ratio: 'lots of water' }).ratio).toBeNull();
  });

  it('defaults an unknown currency to EUR', () => {
    expect(clean({ currency: 'GBP (£)' }).currency).toEqual({ code: 'GBP', symbol: '£' });
    expect(clean({ currency: 'DOGE' }).currency).toEqual({ code: 'EUR', symbol: '€' });
    expect(clean({ currency: null }).currency).toEqual({ code: 'EUR', symbol: '€' });
  });

  it('splits origins only for blends', () => {
    expect(clean({ blend: 'Blend', origins: 'Brazil, Ethiopia' }).origins)
      .toEqual(['Brazil', 'Ethiopia']);
    expect(clean({ blend: 'Single Origin', origins: 'Ethiopia, Guji' }).origins)
      .toEqual(['Ethiopia, Guji']);
  });

  it('only trusts GitHub URLs for author and issue links', () => {
    const review = clean({
      url: 'https://evil.example/issues/1',
      author: { login: 'octocat', avatarUrl: 'https://evil.example/a.png', profileUrl: 'https://evil.example' },
    });
    expect(review.url).toBeNull();
    expect(review.author.avatarUrl).toBeNull();
    expect(review.author.profileUrl).toBe('https://github.com/octocat');
  });
});

describe('sanitizeReview — product post-processing', () => {
  it('drops a grinder that contradicts pre-ground coffee', () => {
    const review = clean({ grindSource: 'Pre-ground', grinder: 'Kingrinder K6', grindSetting: '100' });
    expect(review.grinder).toBeNull();
    expect(review.grindSetting).toBeNull();
  });

  it('keeps the grinder when the reviewer ground it themselves', () => {
    const review = clean({ grindSource: 'Ground by me', grinder: 'Kingrinder K6' });
    expect(review.grinder).toBe('Kingrinder K6');
  });
});

describe('sanitizeReview — tea schema', () => {
  const teaRaw = (overrides = {}) => sanitizeReview({
    ...raw({ name: 'Shui Xian', maker: 'Bitterleaf Teas', rating: '4.75' }),
    ...overrides,
  }, tea);

  it('sanitizes tea-only fields', () => {
    const review = teaRaw({ teaType: 'Oolong', oxidation: 'Roasted', waterTemp: '98', steeps: '8' });
    expect(review.teaType).toBe('Oolong');
    expect(review.oxidation).toBe('Roasted');
    expect(review.waterTemp).toBe(98);
    expect(review.steeps).toBe(8);
  });

  it('enforces the numeric bounds declared in the schema', () => {
    expect(teaRaw({ waterTemp: '120' }).waterTemp).toBeNull();
    expect(teaRaw({ harvestYear: '1800' }).harvestYear).toBeNull();
    expect(teaRaw({ harvestYear: '2026' }).harvestYear).toBe(2026);
  });

  it('keeps a blend ingredient list as an item fact', () => {
    const list = 'Rooibos, orange, grapefruit, safflower blossom, mint, orange blossom, flavouring';
    expect(teaRaw({ ingredients: list }).ingredients).toBe(list);
    // Long enough for a real packet, and still capped.
    expect(teaRaw({ ingredients: 'x'.repeat(900) }).ingredients.length).toBe(500);
  });

  it('recognises the herbal flavour notes tisanes actually have', () => {
    expect(teaRaw({ flavours: ['Minty', 'Herbal', 'Citrus'] }).flavours)
      .toEqual(['Minty', 'Herbal', 'Citrus']);
  });

  it('reads a per-cup dose the way packets write it', () => {
    expect(teaRaw({ gramsPerCup: '2' }).gramsPerCup).toBe(2);
    expect(teaRaw({ gramsPerCup: '2,5 gram per kop' }).gramsPerCup).toBe(2.5);
    // A dose stays a dose: not rounded to an integer like the packet weight.
    expect(teaRaw({ gramsPerCup: '1.5' }).gramsPerCup).toBe(1.5);
    expect(teaRaw({ gramsPerCup: 'a spoonful' }).gramsPerCup).toBeNull();
    expect(teaRaw({ gramsPerCup: '500' }).gramsPerCup).toBeNull();
  });

  it('keeps the per-cup dose on the review, not the tea', () => {
    // How much *this reviewer* used, like water temperature and steep time.
    const field = tea.fields.find((f) => f.id === 'gramsPerCup');
    expect(field.scope).toBeUndefined();
  });

  it('has no coffee fields at all', () => {
    const review = teaRaw();
    expect(review).not.toHaveProperty('roastLevel');
    expect(review).not.toHaveProperty('grindSize');
  });
});
