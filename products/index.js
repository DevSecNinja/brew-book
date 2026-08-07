/**
 * Product registry.
 *
 * Bean Book (coffee) and Leaf Book (tea) are two sites built from one shared
 * core. Everything product-specific lives in a config module in this folder;
 * the pipeline (parse → sanitize → aggregate) and both renderers are generic
 * and driven by that config.
 */

import coffee from './coffee.js';
import tea from './tea.js';

export const PRODUCTS = { coffee, tea };

export const PRODUCT_IDS = Object.keys(PRODUCTS);

/**
 * Resolve a product config by id.
 * @param {string} id
 * @returns {object} product config
 */
export function getProduct(id) {
  const product = PRODUCTS[id];
  if (!product) {
    throw new Error(`Unknown product "${id}". Expected one of: ${PRODUCT_IDS.join(', ')}.`);
  }
  return product;
}

/** Resolve a product from the issue form label carried by an issue. */
export function productForLabel(label) {
  return Object.values(PRODUCTS).find((p) => p.issue.formLabel === label) ?? null;
}
