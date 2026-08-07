/**
 * Validate & sanitize a raw review (from parse-issue.js) into a clean review.
 *
 * SECURITY: every input here is untrusted (anyone can open an issue). We
 * whitelist enums, validate numbers/dates/URLs, decode a small set of HTML
 * entities, strip control characters and any HTML tags, and cap lengths.
 * A review that fails a required check is REJECTED (returns null).
 *
 * The sanitizer is generic: what each field means (its type, whitelist, limits)
 * comes from the product config, so coffee and tea share this trust boundary.
 * Nothing may bypass it — a new field must be declared in a product config.
 *
 * The frontend additionally renders all text via textContent, but this module
 * is the primary trust boundary — nothing unsafe should leave here.
 */

const MAX_TEXT = 2000;
const MAX_SHORT = 200;
const MAX_LIST_ITEMS = 20;

export const CURRENCIES = {
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

function parseNumber(value, { integer = false, min = 0, max = Infinity } = {}) {
  const cleaned = cleanText(value, MAX_SHORT);
  if (cleaned == null) return null;
  const m = /(-?\d+(?:[.,]\d+)?)/.exec(cleaned);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) return null;
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
 * Normalize a brew ratio into a `1:N` style string (leaf/coffee : water).
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

function cleanDate(value) {
  const cleaned = cleanText(value, MAX_SHORT);
  return cleaned && /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
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

/**
 * Resolve a "pick from the list, or type your own" field (roaster / brand)
 * from its dropdown + freeform pair.
 */
export function resolveChoiceOther(raw, field) {
  const choice = cleanText(raw[field.id], MAX_SHORT);
  const other = cleanText(raw[`${field.id}Other`], MAX_SHORT);
  if (choice && !/^other\b/i.test(choice)) return choice;
  if (other) return other;
  if (choice) return choice; // "Other (not listed)" with no freeform — keep as-is
  return null;
}

/**
 * Sanitize one field value. `out` is the partially-built review, so fields that
 * depend on an earlier field (e.g. a list split only for blends) can read it.
 */
function sanitizeField(field, raw, out) {
  switch (field.type) {
    case 'text':
      return cleanText(raw[field.id], field.max ?? MAX_SHORT);
    case 'longtext':
      return cleanText(raw[field.id], field.max ?? MAX_TEXT);
    case 'choiceOther':
      return resolveChoiceOther(raw, field);
    case 'enum':
      return matchEnum(raw[field.id], field.options, field.fallback ?? null);
    case 'rating':
      return parseRating(raw[field.id]);
    case 'flag':
      return raw[field.id] === true;
    case 'checklist': {
      const values = Array.isArray(raw[field.id]) ? raw[field.id] : [];
      return values
        .map((v) => matchEnum(v, field.options))
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, field.max ?? MAX_LIST_ITEMS);
    }
    case 'number':
      return parseNumber(raw[field.id], {
        integer: field.integer === true,
        min: field.min ?? 0,
        max: field.max ?? Infinity,
      });
    case 'date':
      return cleanDate(raw[field.id]);
    case 'url':
      return cleanUrl(raw[field.id]);
    case 'currency':
      return cleanCurrency(raw[field.id]);
    case 'ratio':
      return cleanRatio(raw[field.id]);
    case 'list': {
      const text = cleanText(raw[field.id], field.max ?? MAX_TEXT);
      if (!text) return [];
      const split = field.splitWhen
        && out[field.splitWhen.field] === field.splitWhen.equals;
      const parts = split ? text.split(/,\s+/) : [text];
      return parts
        .map((p) => cleanText(p, MAX_SHORT))
        .filter(Boolean)
        .slice(0, field.maxItems ?? MAX_LIST_ITEMS);
    }
    default:
      throw new Error(`Unknown field type "${field.type}" for field "${field.id}".`);
  }
}

/**
 * Sanitize a raw review against a product config. Returns a clean review
 * object, or null if a required field fails its check.
 *
 * @param {object} raw - output of parseIssue()
 * @param {object} product - product config (see products/)
 */
export function sanitizeReview(raw, product) {
  if (!raw || typeof raw !== 'object') return null;

  const review = {
    id: Number.isInteger(raw.id) ? raw.id : null,
    url: cleanIssueUrl(raw.url),
    submittedAt: cleanText(raw.submittedAt, MAX_SHORT),
    author: cleanAuthor(raw.author),
  };

  for (const field of product.fields) {
    const value = sanitizeField(field, raw, review);
    if (field.required && (value == null || value === '')) return null;
    review[field.id] = value;
  }

  return product.postProcess ? product.postProcess(review) : review;
}

/** Look up a field definition by id or by role. */
export function fieldById(product, id) {
  return product.fields.find((f) => f.id === id) ?? null;
}

export function fieldByRole(product, role) {
  return product.fields.find((f) => f.role === role) ?? null;
}
