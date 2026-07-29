import { describe, it, expect } from 'vitest';
import { formatGrind } from '../src/format.js';

describe('formatGrind', () => {
  it('combines grinder, setting and size', () => {
    expect(formatGrind({
      grindSource: 'Ground by me', grinder: 'Kingrinder K6',
      grindSetting: '100 clicks', grindSize: 'Medium',
    })).toBe('Kingrinder K6 @ 100 clicks (Medium)');
  });

  it('describes pre-ground coffee without a grinder', () => {
    expect(formatGrind({ grindSource: 'Pre-ground', grindSize: 'Medium-Fine' }))
      .toBe('Pre-ground (Medium-Fine)');
    expect(formatGrind({ grindSource: 'Pre-ground' })).toBe('Pre-ground');
  });

  it('falls back gracefully on partial data', () => {
    expect(formatGrind({ grinder: 'Comandante C40' })).toBe('Comandante C40');
    expect(formatGrind({ grindSetting: '18 clicks' })).toBe('Ground at 18 clicks');
    expect(formatGrind({ grindSource: 'Ground by me' })).toBe('Ground by me');
    expect(formatGrind({ grindSize: 'Coarse' })).toBe('Coarse grind');
  });

  it('returns null when nothing is known', () => {
    expect(formatGrind({})).toBeNull();
    expect(formatGrind({ grindSource: 'Unknown', grindSize: 'Unknown' })).toBeNull();
    expect(formatGrind(null)).toBeNull();
  });
});
