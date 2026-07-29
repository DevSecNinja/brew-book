import { describe, it, expect } from 'vitest';
import { validateIssue, buildComment } from '../scripts/lib/validate.js';

function issueWith(fields) {
  const body = Object.entries(fields)
    .map(([label, value]) => `### ${label}\n\n${value}`)
    .join('\n\n');
  return { number: 5, user: { login: 'someone' }, body };
}

const validFields = {
  'Bean name': 'Guji Highlands',
  Roaster: 'Wakuli',
  'Roaster (if not listed)': '_No response_',
  Rating: '3.50',
  'Single origin or blend?': 'Blend',
};

describe('validateIssue', () => {
  it('accepts a valid review', () => {
    const r = validateIssue(issueWith(validFields));
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('flags a missing bean name', () => {
    const r = validateIssue(issueWith({ ...validFields, 'Bean name': '_No response_' }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Bean name/);
  });

  it('flags an off-grid rating', () => {
    const r = validateIssue(issueWith({ ...validFields, Rating: '3.31' }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Rating/);
  });

  it('flags "Other" roaster with no freeform value', () => {
    const r = validateIssue(issueWith({
      ...validFields, Roaster: 'Other (not listed)', 'Roaster (if not listed)': '_No response_',
    }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Other/);
  });

  it('warns about unrecognized optional fields but still validates', () => {
    const r = validateIssue(issueWith({
      ...validFields, Process: 'Sorcery', 'Bean website': 'javascript:alert(1)',
    }));
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('warns when pre-ground coffee also names a grinder', () => {
    const r = validateIssue(issueWith({
      ...validFields,
      'Pre-ground or ground yourself?': 'Pre-ground',
      Grinder: 'Kingrinder K6',
      'Grind setting': '100 clicks',
    }));
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/Pre-ground/);
    expect(r.review.grinder).toBeNull();
  });
});

describe('buildComment', () => {
  it('renders a success comment', () => {
    const c = buildComment({ ok: true, errors: [], warnings: [] }, { login: 'octocat' });
    expect(c).toMatch(/✅/);
    expect(c).toMatch(/@octocat/);
  });

  it('renders a failure comment listing errors', () => {
    const c = buildComment({ ok: false, errors: ['**Rating** is bad.'], warnings: [] }, { login: 'octocat' });
    expect(c).toMatch(/❌/);
    expect(c).toMatch(/Rating/);
  });
});
