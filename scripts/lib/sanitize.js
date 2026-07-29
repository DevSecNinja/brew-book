/**
 * Validate & sanitize a raw review (from parse-issue.js) into a clean review.
 *
 * SECURITY: every input here is untrusted (anyone can open an issue). We
 * whitelist enums, validate numbers/dates/URLs, decode a small set of HTML
 * entities, strip control characters and any HTML tags, and cap lengths.
 * A review that fails a required check is REJECTED (returns null).
 *
 * The frontend additionally renders all text via textContent, but this module
 * is the primary trust boundary — nothing unsafe should leave here.
 */

const MAX_TEXT = 2000;
const MAX_SHORT = 200;
const MAX_ORIGINS = 20;
const MAX_FLAVOURS = 10;

const ROAST_TYPES = ['Filter', 'Espresso', 'Omni (Filter & Espresso)', 'Unknown'];
const ROAST_LEVELS = ['Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark', 'Unknown'];
const BLENDS = ['Single Origin', 'Blend', 'Unknown'];
const PROCESSES = ['Washed', 'Natural', 'Honey', 'Anaerobic', 'Carbonic Maceration', 'Other', 'Unknown'];
const SPECIES = ['Arabica', 'Robusta', 'Arabica / Robusta blend', 'Liberica', 'Excelsa', 'Other', 'Unknown'];
const BREW_METHODS = [
  'Espresso', 'V60 / Pour-over', 'AeroPress', 'French Press',
  'Moka Pot', 'Filter (batch / drip)', 'Cold Brew', 'Other',
];
const GRIND_SOURCES = ['Ground by me', 'Pre-ground', 'Unknown'];
const GRIND_SIZES = [
  'Extra Fine', 'Fine', 'Medium-Fine', 'Medium',
  'Medium-Coarse', 'Coarse', 'Extra Coarse', 'Unknown',
];
const FLAVOURS = [
  'Chocolate / Cocoa', 'Nutty', 'Caramel / Toffee', 'Fruity (stone / tropical)',
  'Berry', 'Citrus', 'Floral', 'Spicy', 'Sweet / Sugary', 'Earthy / Herbal',
];
const CURRENCIES = {
  EUR: '\u20ac', USD: '$', GBP: '\u00a3', CHF: 'CHF', SEK: 'kr',
  DKK: 'kr', NOK: 'kr', JPY: '\u00a5', AUD: 'A$', CAD: 'C$',
};

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&#x27;': "'", '&apos;': "'", '&nbsp;': ' ',
};

/** Decode the small set of HTML entities GitHub emits in issue bodies. */
function decodeEntities(str) {
  return str.replace(/&(amp|lt|gt|quot|apos|#39|#x27|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

/**
 * Clean an arbitrary untrusted string: decode entities, drop control chars,
 * strip HTML tags, collapse whitespace, cap length. Returns null when empty.
 */
export function cleanText(value, max = MAX_SHORT) {
  if (typeof value !== 'string') return null;
  let s = decodeEntities(value);
  // Remove HTML/XML tags outright (defence in depth beyond textContent).
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  // Strip ASCII control chars except tab/newline.
  s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  // Collapse runs of spaces/tabs; trim each line; cap blank lines.
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (s.length === 0) return null;
  return s.length > max ? s.slice(0, max).trim() : s;
}

function matchEnum(value, allowed, fallback = null) {
  const cleaned = cleanText(value, MAX_SHORT);
  if (cleaned == null) return fallback;
  const hit = allowed.find((opt) => opt.toLowerCase() === cleaned.toLowerCase());
  return hit ?? fallback;
}

/** Parse a rating string like "3.50" or "5.00 - Perfect" to a valid number. */
export function parseRating(value) {
  const cleaned = cleanText(value, MAX_SHORT);
  if (cleaned == null) return null;
  const m = /(\d+(?:\.\d+)?)/.exec(cleaned);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  // Must sit on the 0.25 grid.
  if (Math.abs(n * 4 - Math.round(n * 4)) > 1e-9) return null;
  return Math.round(n * 4) / 4;
}

function parseNumber(value, { integer = false, min = 0 } = {}) {
  const cleaned = cleanText(value, MAX_SHORT);
  if (cleaned == null) return null;
  const m = /(-?\d+(?:[.,]\d+)?)/.exec(cleaned);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n < min) return null;
  return integer ? Math.round(n) : n;
}

function cleanUrl(value) {
  const cleaned = cleanText(value, 500);
  if (cleaned == null) return null;
  let url;
  try {
    url = new URL(cleaned);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url.href;
}

function cleanCurrency(value) {
  const cleaned = cleanText(value, MAX_SHORT);
  if (cleaned == null) return { code: 'EUR', symbol: CURRENCIES.EUR };
  const code = cleaned.slice(0, 3).toUpperCase();
  if (Object.prototype.hasOwnProperty.call(CURRENCIES, code)) {
    return { code, symbol: CURRENCIES[code] };
  }
  return { code: 'EUR', symbol: CURRENCIES.EUR };
}

/**
 * Normalize a brew ratio into a `1:N` style string (coffee:water).
 * Accepts "1:16", "1 : 16", "1/16", "1-16", or a bare "16" (read as "1:16").
 * Each side must be a positive number up to 1000. Returns null when unusable.
 */
function cleanRatio(value) {
  const cleaned = cleanText(value, MAX_SHORT);
  if (cleaned == null) return null;
  const toNum = (s) => Number(s.replace(',', '.'));
  const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
  const inRange = (n) => Number.isFinite(n) && n > 0 && n <= 1000;

  let a;
  let b;
  const pair = /(\d+(?:[.,]\d+)?)\s*[:/x\-]\s*(\d+(?:[.,]\d+)?)/i.exec(cleaned);
  if (pair) {
    a = toNum(pair[1]);
    b = toNum(pair[2]);
  } else {
    const single = /(\d+(?:[.,]\d+)?)/.exec(cleaned);
    if (!single) return null;
    a = 1;
    b = toNum(single[1]);
  }
  if (!inRange(a) || !inRange(b)) return null;
  return `${fmt(a)}:${fmt(b)}`;
}

function cleanAuthor(author) {
  const login = typeof author?.login === 'string'
    && /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/.test(author.login)
    ? author.login
    : null;
  const isGithubHttps = (u) => {
    if (typeof u !== 'string') return null;
    try {
      const url = new URL(u);
      const okHost = url.hostname === 'github.com'
        || url.hostname.endsWith('.githubusercontent.com')
        || url.hostname.endsWith('.github.com');
      return url.protocol === 'https:' && okHost ? url.href : null;
    } catch {
      return null;
    }
  };
  return {
    login,
    avatarUrl: isGithubHttps(author?.avatarUrl),
    profileUrl: isGithubHttps(author?.profileUrl)
      ?? (login ? `https://github.com/${login}` : null),
  };
}

function cleanIssueUrl(value) {
  const cleaned = cleanText(value, 500);
  if (cleaned == null) return null;
  try {
    const url = new URL(cleaned);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : null;
  } catch {
    return null;
  }
}

/** Resolve the roaster identity from the dropdown + freeform fields. */
function resolveRoaster(raw) {
  const choice = cleanText(raw.roasterChoice, MAX_SHORT);
  const other = cleanText(raw.roasterOther, MAX_SHORT);
  if (choice && !/^other\b/i.test(choice)) return choice;
  if (other) return other;
  if (choice) return choice; // "Other (not listed)" with no freeform — keep as-is
  return null;
}

/**
 * Sanitize a raw review. Returns a clean review object, or null if it fails a
 * required check (name, roaster, valid rating).
 */
export function sanitizeReview(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const name = cleanText(raw.name, MAX_SHORT);
  const roaster = resolveRoaster(raw);
  const rating = parseRating(raw.rating);
  if (!name || !roaster || rating == null) return null;

  const blend = matchEnum(raw.blend, BLENDS, 'Unknown');

  // Origins: split blends on ", "; keep single strings whole.
  let origins = [];
  const originText = cleanText(raw.origin, MAX_TEXT);
  if (originText) {
    const parts = blend === 'Blend' ? originText.split(/,\s+/) : [originText];
    origins = parts
      .map((p) => cleanText(p, MAX_SHORT))
      .filter(Boolean)
      .slice(0, MAX_ORIGINS);
  }

  const flavours = Array.isArray(raw.flavours)
    ? raw.flavours
        .map((f) => matchEnum(f, FLAVOURS))
        .filter(Boolean)
        .filter((f, i, arr) => arr.indexOf(f) === i)
        .slice(0, MAX_FLAVOURS)
    : [];

  const currency = cleanCurrency(raw.currency);
  const cost = parseNumber(raw.cost, { min: 0 });
  const weightGrams = parseNumber(raw.weight, { integer: true, min: 1 });

  const roastDateRaw = cleanText(raw.roastDate, MAX_SHORT);
  const roastDate = roastDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(roastDateRaw)
    ? roastDateRaw
    : null;

  // Grind is a property of the brew, not of the bean: it stays on the review.
  // Pre-ground coffee was never ground by the reviewer, so any grinder or
  // setting they typed anyway is dropped as contradictory.
  const grindSource = matchEnum(raw.grindSource, GRIND_SOURCES);
  const preGround = grindSource === 'Pre-ground';
  const grinder = preGround ? null : cleanText(raw.grinder, MAX_SHORT);
  const grindSetting = preGround ? null : cleanText(raw.grindSetting, MAX_SHORT);

  return {
    id: Number.isInteger(raw.id) ? raw.id : null,
    url: cleanIssueUrl(raw.url),
    submittedAt: cleanText(raw.submittedAt, MAX_SHORT),
    author: cleanAuthor(raw.author),
    name,
    roaster,
    roastType: matchEnum(raw.roastType, ROAST_TYPES, 'Unknown'),
    roastLevel: matchEnum(raw.roastLevel, ROAST_LEVELS, 'Unknown'),
    blend,
    rating,
    decaf: raw.decaf === true,
    organic: raw.organic === true,
    roastDate,
    origins,
    process: matchEnum(raw.process, PROCESSES),
    species: matchEnum(raw.species, SPECIES),
    variety: cleanText(raw.variety, MAX_SHORT),
    currency,
    cost,
    weightGrams,
    flavours,
    brewMethod: matchEnum(raw.brewMethod, BREW_METHODS),
    grindSource,
    grinder,
    grindSetting,
    grindSize: matchEnum(raw.grindSize, GRIND_SIZES),
    ratio: cleanRatio(raw.ratio),
    website: cleanUrl(raw.website),
    notes: cleanText(raw.notes, MAX_TEXT),
    buyAgain: raw.buyAgain === true,
  };
}

export const ALLOWED = {
  ROAST_TYPES, ROAST_LEVELS, BLENDS, PROCESSES, SPECIES, BREW_METHODS,
  GRIND_SOURCES, GRIND_SIZES, FLAVOURS, CURRENCIES,
};
