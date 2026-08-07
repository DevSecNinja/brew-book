/** Load and lightly shape the generated item data. */

let cache = null;

/**
 * Fetch the generated data file. The build writes it to a product-agnostic
 * path so the shared SPA needs no per-product wiring.
 * @returns {Promise<{generatedAt:string, buildId:string, items:object[]}>}
 */
export async function loadData() {
  if (cache) return cache;
  const res = await fetch('/data/items.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load data: ${res.status}`);
  const data = await res.json();
  if (!data || !Array.isArray(data.items)) {
    throw new Error('Malformed data file');
  }
  cache = data;
  return data;
}

/** Find an item by slug. */
export function findItem(data, slug) {
  return data.items.find((i) => i.slug === slug) ?? null;
}

/** Distinct sorted maker names, for the filter control. */
export function makers(data) {
  return [...new Set(data.items.map((i) => i.maker))].sort((a, b) => a.localeCompare(b));
}
