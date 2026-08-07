/**
 * Guards on the product configs themselves: a new product (or a new field)
 * must satisfy the contract the generic pipeline relies on.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PRODUCTS, getProduct, productForLabel } from '../products/index.js';
import { fieldByRole } from '../scripts/lib/sanitize.js';

const products = Object.values(PRODUCTS);

describe('product registry', () => {
  it('resolves products by id and by issue form label', () => {
    expect(getProduct('coffee').site.name).toBe('Bean Book');
    expect(getProduct('tea').site.name).toBe('Leaf Book');
    expect(() => getProduct('cocoa')).toThrow(/Unknown product/);
    expect(productForLabel('tea-review').id).toBe('tea');
    expect(productForLabel('nope')).toBeNull();
  });

  it('keeps the two sites fully distinct', () => {
    const unique = (fn) => new Set(products.map(fn)).size === products.length;
    expect(unique((p) => p.site.url)).toBe(true);
    expect(unique((p) => p.terms.routeBase)).toBe(true);
    expect(unique((p) => p.issue.formLabel)).toBe(true);
    expect(unique((p) => p.issue.template)).toBe(true);
    expect(unique((p) => p.data.file)).toBe(true);
  });
});

describe.each(products)('$id config', (product) => {
  it('declares the roles the pipeline needs', () => {
    for (const role of ['name', 'maker', 'rating', 'flavours', 'notes']) {
      expect(fieldByRole(product, role), `missing role "${role}"`).toBeTruthy();
    }
    if (product.pricePer100g) {
      expect(fieldByRole(product, 'cost')).toBeTruthy();
      expect(fieldByRole(product, 'weight')).toBeTruthy();
    }
  });

  it('has unique field ids and no reserved names', () => {
    const ids = product.fields.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The sanitizer writes these itself.
    for (const reserved of ['id', 'url', 'submittedAt', 'author']) {
      expect(ids).not.toContain(reserved);
    }
  });

  it('gives every enum/checklist field a whitelist', () => {
    for (const field of product.fields) {
      if (['enum', 'checklist'].includes(field.type)) {
        expect(Array.isArray(field.options), `${field.id} has no options`).toBe(true);
        expect(field.options.length).toBeGreaterThan(0);
      }
      if (field.type === 'choiceOther') expect(field.otherLabel).toBeTruthy();
    }
  });

  it('only references real fields from facts, badges and filters', () => {
    const ids = new Set(product.fields.map((f) => f.id));
    const itemScoped = new Set(product.fields.filter((f) => f.scope === 'item').map((f) => f.id));
    for (const entry of product.facts) {
      if (entry.special) continue;
      expect(ids.has(entry.field), `fact "${entry.field}" is not a field`).toBe(true);
      expect(itemScoped.has(entry.field), `fact "${entry.field}" is not item-scoped`).toBe(true);
    }
    for (const entry of product.badges) {
      expect(itemScoped.has(entry.field), `badge "${entry.field}" is not an item fact`).toBe(true);
    }
    for (const filter of product.filters) {
      if (filter.kind === 'enum') expect(itemScoped.has(filter.field)).toBe(true);
      if (filter.kind === 'flags') {
        for (const f of filter.items) expect(itemScoped.has(f.field)).toBe(true);
      }
    }
  });

  it('matches the labels in its issue form verbatim', () => {
    const form = readFileSync(`.github/ISSUE_TEMPLATE/${product.issue.template}`, 'utf8');
    const labels = [...form.matchAll(/^\s*label: (.+)$/gm)].map((m) => m[1].trim());
    for (const field of product.fields) {
      expect(labels, `"${field.label}" is not a label in ${product.issue.template}`)
        .toContain(field.label);
      if (field.otherLabel) expect(labels).toContain(field.otherLabel);
      // Enum whitelists must offer exactly what the form offers.
      if (field.type === 'enum') {
        const block = new RegExp(`label: ${field.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?options:\\n((?:\\s+- .+\\n)+)`);
        const match = block.exec(form);
        if (match) {
          const options = match[1].split('\n')
            .map((l) => l.replace(/^\s*- /, '').trim())
            .filter(Boolean);
          expect(options.sort()).toEqual([...field.options].sort());
        }
      }
    }
  });

  it('has a palette with matching light and dark keys', () => {
    expect(Object.keys(product.theme.light).sort())
      .toEqual(Object.keys(product.theme.dark).sort());
  });
});
