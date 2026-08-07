/**
 * Assemble the complete static site for one product into `dist/<product>/`.
 *
 * Everything the deploy needs is produced here — there is no separate copy step
 * in CI, so `dist/<product>` can be handed straight to Cloudflare Pages:
 *
 *   index.html                  home shell (SEO + JSON-LD)
 *   404.html
 *   <routeBase>/<slug>/index.html   prerendered detail pages
 *   sitemap.xml, robots.txt, manifest.webmanifest, theme.css
 *   styles.css, service-worker.js, src/**, icons/**
 *   src/product.config.js       verbatim copy of products/<product>.js
 *   data/items.json             the generated data, product-agnostic path
 *
 * Each detail page returns 200 with a unique <title>, meta description,
 * canonical, Open Graph/Twitter tags, JSON-LD (Product + AggregateRating +
 * Review), and the item's content rendered into the markup so crawlers (and
 * no-JS visitors) see it. On load the SPA re-renders the same route.
 */

import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getProduct, PRODUCT_IDS } from '../products/index.js';
import { fmt, formatValuePer100g } from '../src/text.js';
import { itemTitle, itemDescription, itemPath } from '../src/seo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** HTML-escape every interpolation of issue-derived data. */
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const rating2 = (n) => Number(n).toFixed(2);

/** A stable-ish build id: `<sha>-<timestamp>` in CI, `dev` locally. */
export function buildId() {
  if (process.env.BUILD_ID) return process.env.BUILD_ID;
  const sha = process.env.APP_COMMIT_SHA || process.env.GITHUB_SHA;
  if (!sha) return 'dev';
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `${sha.slice(0, 12)}-${stamp}`;
}

/** Same visibility rules as src/format.js `factValue`. */
function displayFact(entry, facts, trueText = 'Yes') {
  const value = facts?.[entry.field];
  if (value == null || value === '' || value === 'Unknown') return null;
  if (value === true) return trueText;
  if (value === false) return null;
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  return String(value);
}

function factRow(label, value) {
  if (value == null || value === '') return '';
  return `<div class="fact"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

function reviewHtml(review, product) {
  const author = review.author ?? {};
  const meta = product.reviewMeta(review, fmt).map(esc).join(' · ');
  const who = author.login
    ? `<a class="author-name" href="${esc(author.profileUrl || `https://github.com/${author.login}`)}" target="_blank" rel="noopener">@${esc(author.login)}</a>`
    : '<span class="author-name">Anonymous</span>';
  const flavours = (review.flavours ?? []).map((f) => `<span class="tag">${esc(f)}</span>`).join('');
  return `<article class="review">
      <header class="review-head">
        <div class="review-who">${who}</div>
        <div class="review-rating"><span class="rating-badge small">${rating2(review.rating)}</span></div>
      </header>
      ${review.notes ? `<p class="review-notes">${esc(review.notes)}</p>` : ''}
      ${flavours ? `<div class="tags">${flavours}</div>` : ''}
      ${meta ? `<p class="muted small">${meta}</p>` : ''}
    </article>`;
}

function jsonLd(data) {
  // Escape "<" so the JSON can't break out of the <script> element.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function itemJsonLd(item, product, url) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.name,
    category: product.site.schemaCategory,
    brand: { '@type': 'Brand', name: item.maker },
    url,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: item.averageRating,
      bestRating: 5,
      worstRating: 1,
      reviewCount: item.reviewCount,
    },
    review: item.reviews.map((r) => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      author: { '@type': 'Person', name: r.author?.login || 'Anonymous' },
      reviewBody: r.notes || '',
    })),
  });
}

const CSP = "default-src 'self'; base-uri 'self'; object-src 'none'; "
  + "img-src 'self' https://avatars.githubusercontent.com data:; style-src 'self' 'unsafe-inline'; "
  + "script-src 'self'; connect-src 'self'; manifest-src 'self'; font-src 'self'; form-action 'self'";

/**
 * The shared <head>. `extraHead` carries page-specific tags (JSON-LD).
 */
function page({ product, title, description, url, ogType, body, extraHead = '', robots = 'index, follow' }) {
  const ogImage = `${product.site.url}/icons/og-image.png`;
  return `<!doctype html>
<html lang="en" data-theme="auto">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="${product.theme.light.bg}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${product.theme.dark.bg}" media="(prefers-color-scheme: dark)" />

    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta name="robots" content="${robots}" />

    <!-- Open Graph -->
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="${esc(product.site.name)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="${product.site.locale}" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${ogImage}" />

    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="${esc(product.site.name)}" />
    <link rel="stylesheet" href="/styles.css" />
    <link rel="stylesheet" href="/theme.css" />
${extraHead}  </head>
  <body>
${body}
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`;
}

function homePage(product) {
  const extraHead = `    <script type="application/ld+json">${jsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: product.site.name,
    description: product.site.schemaDescription,
    url: `${product.site.url}/`,
  })}</script>\n`;
  const body = `    <div id="app" class="app"></div>
    <noscript>
      <p style="padding: 2rem; text-align: center">
        ${esc(product.site.noScript)}
      </p>
    </noscript>`;
  return page({
    product,
    title: product.site.title,
    description: product.site.description,
    url: `${product.site.url}/`,
    ogType: 'website',
    body,
    extraHead,
  });
}

function notFoundPage(product) {
  const body = `    <div id="app" class="app">
      <main class="content">
        <div class="empty">
          <h1>Page not found</h1>
          <p>That page doesn’t exist (or the review was unpublished).</p>
          <a class="btn primary" href="/">← Back to all ${esc(product.terms.items)}</a>
        </div>
      </main>
    </div>`;
  return page({
    product,
    title: `Page not found | ${product.site.name}`,
    description: `That page doesn’t exist on ${product.site.name}.`,
    url: `${product.site.url}/404.html`,
    ogType: 'website',
    body,
    robots: 'noindex, follow',
  });
}

function itemPage(item, product) {
  const facts = item.facts ?? {};
  const url = `${product.site.url}${itemPath(item, product)}`;
  const newReviewUrl = `${product.site.repoUrl}/issues/new?template=${product.issue.template}`;

  const factList = product.facts.map((entry) => {
    if (entry.special === 'valuePer100g') {
      return item.valuePer100g
        ? factRow(entry.label, `from ${formatValuePer100g(item.valuePer100g)}`)
        : '';
    }
    return factRow(entry.label, displayFact(entry, facts));
  }).join('');

  const flavourBlock = item.flavours?.length
    ? `<div class="flavour-block"><h2 class="section-title">Flavour profile</h2><div class="tags">${item.flavours.map((f) => `<span class="tag">${esc(f)}</span>`).join('')}</div></div>`
    : '';

  const body = `    <div id="app" class="app">
      <header class="site-header">
        <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">${product.site.mark}</span><span class="brand-name">${esc(product.site.name)}</span></a>
        <nav class="site-nav"><a class="btn ghost" href="${esc(newReviewUrl)}" target="_blank" rel="noopener">${esc(product.terms.addReview)}</a></nav>
      </header>
      <main class="content">
        <a class="back" href="/">← All ${esc(product.terms.items)}</a>
        <section class="bean-header">
          <div class="bean-title"><h1>${esc(item.name)}</h1><p class="bean-roaster">${esc(item.maker)}</p></div>
          <div class="bean-score"><span class="rating-badge big">${rating2(item.averageRating)}</span><span class="muted">${item.reviewCount} review${item.reviewCount === 1 ? '' : 's'}</span></div>
        </section>
        <section class="panel"><dl class="facts">${factList}</dl>${facts.website ? `<a class="btn" href="${esc(facts.website)}" target="_blank" rel="noopener">${esc(product.terms.websiteLink)}</a>` : ''}</section>
        ${flavourBlock}
        <section class="reviews"><h2 class="section-title">Reviews (${item.reviewCount})</h2>${item.reviews.map((r) => reviewHtml(r, product)).join('')}</section>
      </main>
    </div>`;

  return page({
    product,
    title: itemTitle(item, product),
    description: itemDescription(item, product),
    url,
    ogType: 'product',
    body,
    extraHead: `    <script type="application/ld+json">${itemJsonLd(item, product, url)}</script>\n`,
  });
}

function sitemap(items, product, lastmod) {
  const urls = [
    `${product.site.url}/`,
    ...items.map((i) => `${product.site.url}${itemPath(i, product)}`),
  ];
  const entries = urls
    .map((u) => `  <url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

function robots(product) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${product.site.url}/sitemap.xml\n`;
}

function manifest(product) {
  const m = product.site.manifest;
  const data = {
    name: `${product.site.name} — ${product.site.title.split('—').pop().trim()}`,
    short_name: m.shortName,
    description: product.site.tagline,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: product.theme.light.bg,
    theme_color: product.theme.light.accent,
    categories: m.categories,
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  if (m.hasScreenshots) {
    data.screenshots = [
      { src: '/icons/screenshot-wide.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: m.screenshotLabel },
      { src: '/icons/screenshot-narrow.png', sizes: '720x1280', type: 'image/png', form_factor: 'narrow', label: m.screenshotLabel },
    ];
  }
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Per-product palette, layered on top of the shared styles.css defaults. */
function themeCss(product) {
  const vars = (palette) => Object.entries(palette)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n');
  return `/* Generated by scripts/build-site.js — palette for ${product.site.name}. */
:root {
${vars(product.theme.light)}
}

:root[data-theme="dark"] {
${vars(product.theme.dark)}
}

@media (prefers-color-scheme: dark) {
  :root[data-theme="auto"] {
${vars(product.theme.dark).replace(/^ {2}/gm, '    ')}
  }
}
`;
}

const stamp = (text, id) => text.replaceAll('__BUILD_ID__', id);

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error(`Usage: node scripts/build-site.js <${PRODUCT_IDS.join('|')}>`);
    process.exit(1);
  }
  const product = getProduct(id);
  const dist = join(ROOT, 'dist', product.id);
  const build = buildId();

  const data = JSON.parse(await readFile(join(ROOT, product.data.file), 'utf8'));
  const items = Array.isArray(data.items) ? data.items : [];
  const lastmod = (data.generatedAt || new Date().toISOString()).slice(0, 10);

  await rm(dist, { recursive: true, force: true });
  await mkdir(join(dist, 'data'), { recursive: true });

  // --- shared static assets -------------------------------------------------
  await cp(join(ROOT, 'src'), join(dist, 'src'), { recursive: true });
  await cp(join(ROOT, 'styles.css'), join(dist, 'styles.css'));
  await cp(join(ROOT, `products/${product.id}.js`), join(dist, 'src', 'product.config.js'));

  const icons = join(ROOT, 'assets', 'icons', product.id);
  if (!existsSync(icons)) throw new Error(`Missing icons for "${product.id}" at assets/icons/${product.id}`);
  await cp(icons, join(dist, 'icons'), { recursive: true });

  // --- build-id stamped files ----------------------------------------------
  const sw = await readFile(join(ROOT, 'service-worker.js'), 'utf8');
  await writeFile(
    join(dist, 'service-worker.js'),
    stamp(sw, build).replaceAll('__PRODUCT_ID__', product.id),
    'utf8',
  );
  await writeFile(join(dist, 'src', 'main.js'), stamp(await readFile(join(dist, 'src', 'main.js'), 'utf8'), build), 'utf8');
  await writeFile(join(dist, 'data', 'items.json'), stamp(JSON.stringify(data, null, 2), build) + '\n', 'utf8');

  // --- generated documents --------------------------------------------------
  await writeFile(join(dist, 'index.html'), homePage(product), 'utf8');
  await writeFile(join(dist, '404.html'), notFoundPage(product), 'utf8');
  await writeFile(join(dist, 'manifest.webmanifest'), manifest(product), 'utf8');
  await writeFile(join(dist, 'theme.css'), themeCss(product), 'utf8');
  await writeFile(join(dist, 'robots.txt'), robots(product), 'utf8');
  await writeFile(join(dist, 'sitemap.xml'), sitemap(items, product, lastmod), 'utf8');

  for (const item of items) {
    const dir = join(dist, product.terms.routeBase, item.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), itemPage(item, product), 'utf8');
  }

  console.log(
    `[build-site] ${product.site.name}: prerendered ${items.length} page(s) `
    + `into dist/${product.id} (build ${build}).`,
  );
}

main().catch((err) => {
  console.error('[build-site] fatal:', err);
  process.exit(1);
});
