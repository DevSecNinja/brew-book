import { describe, it, expect } from 'vitest';
import { splitSections, readText, readChecked, readCheckedList, parseIssue } from '../scripts/lib/parse-issue.js';
import { coffee, tea, issue, formBody } from './helpers.js';

const BODY = formBody({
  'Bean name': 'Guji Highlands',
  Roaster: 'Other (not listed)',
  'Roaster (if not listed)': 'Simon Lévelt',
  'Roast type': 'Filter',
  Rating: '3.50',
  Decaffeinated: '- [ ] This is a decaf coffee',
  Organic: '- [x] This is a certified organic coffee',
  'Roast date': '_No response_',
  'Flavour profiles': '- [x] Berry\n- [ ] Citrus\n- [x] Floral',
  'Review notes': 'Nice and bright.',
});

describe('splitSections', () => {
  it('maps every heading to its block', () => {
    const sections = splitSections(BODY);
    expect(sections.get('Bean name')).toBe('Guji Highlands');
    expect(sections.get('Review notes')).toBe('Nice and bright.');
  });

  it('handles CRLF line endings and an empty body', () => {
    expect(splitSections('### A\r\n\r\nvalue').get('A')).toBe('value');
    expect(splitSections('').size).toBe(0);
    expect(splitSections(null).size).toBe(0);
  });

  it('ignores content before the first heading', () => {
    expect(splitSections('preamble\n### A\n\nvalue').size).toBe(1);
  });
});

describe('field readers', () => {
  const sections = splitSections(BODY);

  it('reads text and treats _No response_ as empty', () => {
    expect(readText(sections, 'Bean name')).toBe('Guji Highlands');
    expect(readText(sections, 'Roast date')).toBeNull();
    expect(readText(sections, 'Nope')).toBeNull();
  });

  it('reads single checkboxes', () => {
    expect(readChecked(sections, 'Organic')).toBe(true);
    expect(readChecked(sections, 'Decaffeinated')).toBe(false);
    expect(readChecked(sections, 'Nope')).toBe(false);
  });

  it('reads only the ticked options of a checkbox list', () => {
    expect(readCheckedList(sections, 'Flavour profiles')).toEqual(['Berry', 'Floral']);
    expect(readCheckedList(sections, 'Nope')).toEqual([]);
  });
});

describe('parseIssue', () => {
  it('keys raw values by field id and carries issue metadata', () => {
    const raw = parseIssue(issue({ body: BODY }), coffee);
    expect(raw.id).toBe(7);
    expect(raw.url).toBe('https://github.com/DevSecNinja/brew-book/issues/7');
    expect(raw.author.login).toBe('octocat');
    expect(raw.name).toBe('Guji Highlands');
    expect(raw.roastType).toBe('Filter');
    expect(raw.organic).toBe(true);
    expect(raw.flavours).toEqual(['Berry', 'Floral']);
  });

  it('reads a choiceOther field into both its parts', () => {
    const raw = parseIssue(issue({ body: BODY }), coffee);
    expect(raw.maker).toBe('Other (not listed)');
    expect(raw.makerOther).toBe('Simon Lévelt');
  });

  it('does not validate — unknown values pass straight through', () => {
    const raw = parseIssue(issue({ body: formBody({ 'Roast type': 'Nonsense' }) }), coffee);
    expect(raw.roastType).toBe('Nonsense');
  });

  it('survives an issue with no body at all', () => {
    const raw = parseIssue({}, coffee);
    expect(raw.name).toBeNull();
    expect(raw.flavours).toEqual([]);
  });

  it('reads the tea form with the tea schema', () => {
    const raw = parseIssue(issue({
      body: formBody({
        'Tea name': 'Sencha Yabukita',
        Brand: 'Ippodo Tea',
        'Water temperature (°C)': '70',
        'Number of infusions': '3',
      }),
    }), tea);
    expect(raw.name).toBe('Sencha Yabukita');
    expect(raw.maker).toBe('Ippodo Tea');
    expect(raw.waterTemp).toBe('70');
    expect(raw.steeps).toBe('3');
  });
});
