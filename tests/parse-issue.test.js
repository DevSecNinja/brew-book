import { describe, it, expect } from 'vitest';
import {
  splitSections, readText, readChecked, readCheckedList, parseIssue,
} from '../scripts/lib/parse-issue.js';

const body = `### Bean name

Guji Highlands

### Roaster

Other (not listed)

### Roaster (if not listed)

Simon Lévelt

### Roast type

Omni (Filter &amp; Espresso)

### Decaffeinated

- [x] This is a decaf coffee

### Flavour profiles

- [x] Berry
- [ ] Citrus
- [x] Floral

### Roast date

_No response_

### Pre-ground or ground yourself?

Ground by me

### Grinder

Kingrinder K6

### Grind setting

100 clicks

### Grind size

Medium
`;

describe('parse-issue', () => {
  it('splits sections by ### heading', () => {
    const s = splitSections(body);
    expect(s.get('Bean name')).toBe('Guji Highlands');
    expect(s.get('Roaster')).toBe('Other (not listed)');
  });

  it('readText returns null for _No response_ and empty', () => {
    const s = splitSections(body);
    expect(readText(s, 'Roast date')).toBeNull();
    expect(readText(s, 'Bean name')).toBe('Guji Highlands');
    expect(readText(s, 'Nonexistent')).toBeNull();
  });

  it('readChecked detects a ticked checkbox', () => {
    const s = splitSections(body);
    expect(readChecked(s, 'Decaffeinated')).toBe(true);
    expect(readChecked(s, 'Roast date')).toBe(false);
  });

  it('readCheckedList returns only ticked options', () => {
    const s = splitSections(body);
    expect(readCheckedList(s, 'Flavour profiles')).toEqual(['Berry', 'Floral']);
  });

  it('parseIssue maps issue metadata and fields', () => {
    const raw = parseIssue({
      number: 7,
      html_url: 'https://github.com/o/r/issues/7',
      created_at: '2026-01-01T00:00:00Z',
      user: { login: 'octocat', avatar_url: 'https://avatars.githubusercontent.com/u/1', html_url: 'https://github.com/octocat' },
      body,
    });
    expect(raw.id).toBe(7);
    expect(raw.name).toBe('Guji Highlands');
    expect(raw.roasterChoice).toBe('Other (not listed)');
    expect(raw.roasterOther).toBe('Simon Lévelt');
    expect(raw.roastType).toBe('Omni (Filter &amp; Espresso)');
    expect(raw.decaf).toBe(true);
    expect(raw.flavours).toEqual(['Berry', 'Floral']);
    expect(raw.author.login).toBe('octocat');
  });

  it('parseIssue reads the grind fields', () => {
    const raw = parseIssue({ number: 7, body });
    expect(raw.grindSource).toBe('Ground by me');
    expect(raw.grinder).toBe('Kingrinder K6');
    expect(raw.grindSetting).toBe('100 clicks');
    expect(raw.grindSize).toBe('Medium');
  });

  it('handles empty / missing body safely', () => {
    expect(splitSections('').size).toBe(0);
    expect(splitSections(undefined).size).toBe(0);
    const raw = parseIssue({ number: 1 });
    expect(raw.name).toBeNull();
  });
});
