/* eslint-env serviceworker */
/**
 * Shared service worker for Bean Book and Leaf Book.
 *
 * Cache strategy:
 *   - Pre-caches the app shell on install.
 *   - Network-first for HTML, the data file, and src/ scripts (so updates ship
 *     fast and the stamped BUILD_ID stays current).
 *   - Cache-first for everything else (styles, icons, manifest).
 *
 * BUILD_ID and PRODUCT_ID are stamped in by scripts/build-site.js. A new
 * BUILD_ID busts the cache and triggers an auto-update in the page; PRODUCT_ID
 * keeps the two sites' caches apart.
 */
const BUILD_ID = '__BUILD_ID__';
const PRODUCT_ID = '__PRODUCT_ID__';
const CACHE_NAME = `${PRODUCT_ID}-book-${BUILD_ID}`;

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/main.js',
  './src/app.js',
  './src/router.js',
  './src/data.js',
  './src/components.js',
  './src/format.js',
  './src/text.js',
  './src/seo.js',
  './src/product.config.js',
  './src/views/home.js',
  './src/views/item.js',
  './data/items.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // cache:'reload' bypasses the browser HTTP cache so each precached file is
      // truly fresh (avoids stale copies on iOS after a redeploy).
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            const res = await fetch(new Request(url, { cache: 'reload' }));
            if (res.ok) await cache.put(url, res);
          } catch {
            /* best-effort precache */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHtml =
    req.mode === 'navigate' ||
    (req.headers.get('accept') ?? '').includes('text/html');
  const isData = url.pathname.endsWith('/items.json');
  const isScript = url.pathname.endsWith('.js') && url.pathname.includes('/src/');

  if (isHtml || isData || isScript) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(new Request(req, { cache: 'no-cache' }));
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    const fallback =
      (await cache.match(new URL('./index.html', self.location.href).href)) ??
      (await cache.match('./index.html')) ??
      (await cache.match('./'));
    if (fallback) return fallback;
    throw new Error('offline-and-not-cached');
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(new Request(req, { cache: 'no-cache' }));
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}
