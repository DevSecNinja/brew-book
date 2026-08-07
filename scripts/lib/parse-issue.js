/**
 * Parse a GitHub Issue Form body into a raw review object.
 *
 * GitHub renders issue forms as markdown with each field under a
 * `### <Field label>` heading, followed by the value (or `_No response_`).
 * Checkbox fields render as `- [x]` / `- [ ]` lists.
 *
 * This module is intentionally dumb: it only slices the body into
 * label -> raw-string / checked-items, driven by the field labels declared in
 * the product config. All validation and sanitization happens later in
 * sanitize.js. Treat every value here as untrusted.
 */

const NO_RESPONSE = '_No response_';

/**
 * Split an issue body into a map of `heading -> raw block text`.
 * @param {string} body
 * @returns {Map<string, string>}
 */
export function splitSections(body) {
  const sections = new Map();
  if (typeof body !== 'string' || body.length === 0) return sections;

  // Normalise line endings and split on level-3 headings.
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  let currentHeading = null;
  let buffer = [];

  const flush = () => {
    if (currentHeading !== null) {
      sections.set(currentHeading, buffer.join('\n').trim());
    }
    buffer = [];
  };

  for (const line of lines) {
    const match = /^###\s+(.*\S)\s*$/.exec(line);
    if (match) {
      flush();
      currentHeading = match[1].trim();
    } else if (currentHeading !== null) {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * Read a plain text field. Returns null for empty / "_No response_".
 * @param {Map<string,string>} sections
 * @param {string} label
 * @returns {string|null}
 */
export function readText(sections, label) {
  const raw = sections.get(label);
  if (raw == null) return null;
  const value = raw.trim();
  if (value === '' || value === NO_RESPONSE) return null;
  return value;
}

/**
 * Read a checkbox field: true when any option is checked (`- [x]`).
 * @param {Map<string,string>} sections
 * @param {string} label
 * @returns {boolean}
 */
export function readChecked(sections, label) {
  const raw = sections.get(label);
  if (raw == null) return false;
  return /^- \[[xX]\]/m.test(raw);
}

/**
 * Read the labels of every checked option in a multi-checkbox field.
 * @param {Map<string,string>} sections
 * @param {string} label
 * @returns {string[]}
 */
export function readCheckedList(sections, label) {
  const raw = sections.get(label);
  if (raw == null) return [];
  const out = [];
  for (const line of raw.split('\n')) {
    const m = /^- \[[xX]\]\s+(.*\S)\s*$/.exec(line.trim());
    if (m) out.push(m[1].trim());
  }
  return out;
}

/**
 * Parse an issue (body + metadata) into a raw, unsanitized review object keyed
 * by field id. Field labels come from the product config and must mirror the
 * matching issue form verbatim.
 *
 * @param {object} issue - { number, html_url, created_at, user, body }
 * @param {object} product - product config (see products/)
 * @returns {object} raw review (all values untrusted)
 */
export function parseIssue(issue, product) {
  const sections = splitSections(issue?.body ?? '');

  const raw = {
    id: issue?.number ?? null,
    url: issue?.html_url ?? null,
    submittedAt: issue?.created_at ?? null,
    author: {
      login: issue?.user?.login ?? null,
      avatarUrl: issue?.user?.avatar_url ?? null,
      profileUrl: issue?.user?.html_url ?? issue?.user?.profile_url ?? null,
    },
  };

  for (const field of product.fields) {
    switch (field.type) {
      case 'flag':
        raw[field.id] = readChecked(sections, field.label);
        break;
      case 'checklist':
        raw[field.id] = readCheckedList(sections, field.label);
        break;
      case 'choiceOther':
        raw[field.id] = readText(sections, field.label);
        raw[`${field.id}Other`] = readText(sections, field.otherLabel);
        break;
      default:
        raw[field.id] = readText(sections, field.label);
    }
  }

  return raw;
}
