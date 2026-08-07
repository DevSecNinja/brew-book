import { describe, it, expect } from 'vitest';
import { parseRoute } from '../src/router.js';

describe('parseRoute', () => {
  it('routes / to home', () => {
    expect(parseRoute('bean', { pathname: '/' })).toEqual({ name: 'home' });
  });

  it('routes /bean/:slug/ to the item', () => {
    expect(parseRoute('bean', { pathname: '/bean/simon-levelt-guji-highlands/' }))
      .toEqual({ name: 'item', slug: 'simon-levelt-guji-highlands' });
  });

  it('handles a path without a trailing slash', () => {
    expect(parseRoute('bean', { pathname: '/bean/wakuli-blend' }))
      .toEqual({ name: 'item', slug: 'wakuli-blend' });
  });

  it('decodes the slug', () => {
    expect(parseRoute('bean', { pathname: '/bean/a%20b/' }).slug).toBe('a b');
  });

  it('falls back to home for unknown paths', () => {
    expect(parseRoute('bean', { pathname: '/about/' })).toEqual({ name: 'home' });
  });

  it('uses the product route base', () => {
    expect(parseRoute('tea', { pathname: '/tea/ippodo-tea-sencha/' }))
      .toEqual({ name: 'item', slug: 'ippodo-tea-sencha' });
    // Bean Book's base must not match on the tea site and vice versa.
    expect(parseRoute('tea', { pathname: '/bean/x/' })).toEqual({ name: 'home' });
    expect(parseRoute('bean', { pathname: '/tea/x/' })).toEqual({ name: 'home' });
  });
});
