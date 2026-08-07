// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { footer } from '../src/app.js';
import { coffee, tea } from './helpers.js';

describe.each([
  ['coffee', coffee, tea],
  ['tea', tea, coffee],
])('%s footer', (_id, product, relatedProduct) => {
  it('links to the other review site', () => {
    const element = footer(null, 'dev', product);
    const link = [...element.querySelectorAll('a')]
      .find((candidate) => candidate.textContent === relatedProduct.site.name);

    expect(link?.href).toBe(`${relatedProduct.site.url}/`);
  });
});
