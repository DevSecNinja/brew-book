import { describe, it, expect } from 'vitest';
import { validateIssue, buildComment } from '../scripts/lib/validate.js';
import { coffee, tea, issue, formBody } from './helpers.js';

const VALID = {
  'Bean name': 'Guji Highlands',
  Roaster: 'Simon Lévelt',
  Rating: '3.50',
};

const validate = (sections, product = coffee) =>
  validateIssue(issue({ body: formBody({ ...VALID, ...sections }) }), product);

describe('validateIssue — required fields', () => {
  it('accepts a minimal, valid review', () => {
    const result = validate({});
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.review.name).toBe('Guji Highlands');
  });

  it('reports every missing required field', () => {
    const result = validateIssue(issue({ body: '' }), coffee);
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.errors.join(' ')).toContain('**Bean name**');
    expect(result.errors.join(' ')).toContain('**Roaster**');
    expect(result.errors.join(' ')).toContain('**Rating**');
  });

  it('asks for the freeform value when "Other" is picked', () => {
    const result = validate({ Roaster: 'Other (not listed)' });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Roaster (if not listed)');
  });

  it('rejects an off-grid rating', () => {
    expect(validate({ Rating: '3.10' }).ok).toBe(false);
  });
});

describe('validateIssue — warnings', () => {
  it('warns about values that will be dropped', () => {
    const result = validate({
      Process: 'Sorcery',
      Cost: 'free',
      'Roast date': '15/06/2026',
      'Bean website': 'javascript:alert(1)',
      'Brew ratio': 'plenty',
    });
    expect(result.ok).toBe(true);
    const joined = result.warnings.join('\n');
    expect(joined).toContain('**Process**');
    expect(joined).toContain('**Cost**');
    expect(joined).toContain('**Roast date**');
    expect(joined).toContain('**Bean website**');
    expect(joined).toContain('**Brew ratio**');
  });

  it('does not warn about enums that have a fallback', () => {
    const result = validate({ 'Roast level': 'Sorcery' });
    expect(result.warnings.join('\n')).not.toContain('Roast level');
  });

  it('warns about unrecognized flavour options', () => {
    const result = validate({ 'Flavour profiles': '- [x] Berry\n- [x] Unicorn' });
    expect(result.warnings.join('\n')).toContain('**Flavour profiles**');
  });

  it('surfaces the product-specific pre-ground warning', () => {
    const result = validate({
      'Pre-ground or ground yourself?': 'Pre-ground',
      Grinder: 'Kingrinder K6',
    });
    expect(result.warnings.join('\n')).toContain('Pre-ground');
  });

  it('stays silent when everything is understood', () => {
    expect(validate({ Process: 'Washed' }).warnings).toEqual([]);
  });
});

describe('validateIssue — tea', () => {
  const teaBody = { 'Tea name': 'Sencha Yabukita', Brand: 'Ippodo Tea', Rating: '4.00' };

  it('validates a tea review against the tea schema', () => {
    const result = validateIssue(issue({ body: formBody(teaBody) }), tea);
    expect(result.ok).toBe(true);
    expect(result.review.maker).toBe('Ippodo Tea');
  });

  it('names tea fields in its errors', () => {
    const result = validateIssue(issue({ body: '' }), tea);
    expect(result.errors.join(' ')).toContain('**Tea name**');
    expect(result.errors.join(' ')).toContain('**Brand**');
  });

  it('warns about an out-of-range water temperature', () => {
    const result = validateIssue(
      issue({ body: formBody({ ...teaBody, 'Water temperature (°C)': '250' }) }),
      tea,
    );
    expect(result.warnings.join('\n')).toContain('**Water temperature (°C)**');
  });
});

describe('buildComment', () => {
  it('renders a friendly success comment', () => {
    const comment = buildComment(validate({}), { login: 'octocat', product: coffee });
    expect(comment).toContain('✅');
    expect(comment).toContain('@octocat');
    expect(comment).toContain('bean review');
    expect(comment).toContain('bean-review validation');
  });

  it('lists the errors on failure', () => {
    const comment = buildComment(validateIssue(issue({ body: '' }), coffee), { product: coffee });
    expect(comment).toContain('❌');
    expect(comment).toContain('**Bean name**');
  });

  it('uses the product vocabulary', () => {
    const result = validateIssue(
      issue({ body: formBody({ 'Tea name': 'X', Brand: 'Ippodo Tea', Rating: '4.00' }) }),
      tea,
    );
    const comment = buildComment(result, { login: 'octocat', product: tea });
    expect(comment).toContain('tea review');
    expect(comment).toContain('tea-review validation');
  });
});
