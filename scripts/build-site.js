/**
 * Prerender a static, SEO-rich HTML page per bean, plus sitemap.xml.
 *
 * Each /bean/<slug>/index.html returns 200 with a unique <title>, meta
 * description, canonical, Open Graph/Twitter tags, JSON-LD (Product +
 * AggregateRating + Review), and the bean's content rendered into the markup so
 * crawlers (and no-JS visitors) see it. On load the SPA re-renders the same
 * route for full interactivity.
 *
 * Output (git-ignored, copied into the deploy artifact by CI):
 *   bean/<slug>/index.html
 *   sitemap.xml
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE_URL = 'https://coffee.ravensberg.org';
const OG_IMAGE = `${SITE_URL}/icons/og-image.png`;
const NEW_REVIEW_URL = 'https://github.com/DevSecNinja/bean-book/issues/new?template=bean-review.yml';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const rating2 = (n) => Number(n).toFixed(2);

const CURRENCY_BEFORE = new Set(['$', '\u00a3', '\u20ac', '\u00a5', 'A$', 'C$']);
function money(value, currency) {
  if (value == null) return null;
  const amount = Number(value).toFixed(2);
  const symbol = currency?.symbol ?? currency?.code ?? '';
  if (!symbol) return amount;
  return CURRENCY_BEFORE.has(symbol) ? `${symbol}${amount}` : `${amount} ${symbol}`;
}

function factRow(label, value) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return '';
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return `<div class="fact"><dt>${esc(label)}</dt><dd>${esc(text)}</dd></div>`;
}

/** Mirrors formatGrind() in src/format.js (this script has no DOM deps). */
function grindText(r) {
  const size = r.grindSize && r.grindSize !== 'Unknown' ? r.grindSize : null;
  if (r.grindSource === 'Pre-ground') return size ? `Pre-ground (${size})` : 'Pre-ground';
  let head = null;
  if (r.grinder) head = r.grindSetting ? `${r.grinder} @ ${r.grindSetting}` : r.grinder;
  else if (r.grindSetting) head = `Ground at ${r.grindSetting}`;
  else if (r.grindSource === 'Ground by me') head = 'Ground by me';
  if (!head) return size ? `${size} grind` : null;
  return size ? `${head} (${size})` : head;
}

function reviewHtml(r) {
  const author = r.author ?? {};
  const meta = [
    money(r.cost, r.currency), r.weightGrams != null ? `${r.weightGrams} g` : null,
    r.brewMethod, grindText(r), r.ratio ? `Ratio ${r.ratio}` : null,
    r.buyAgain ? 'Would buy again' : null,
  ].filter(Boolean).map(esc).join(' · ');
  const who = author.login
    ? `<a class="author-name" href="${esc(author.profileUrl || `https://github.com/${author.login}`)}" target="_blank" rel="noopener">@${esc(author.login)}</a>`
    : '<span class="author-name">Anonymous</span>';
  const flavours = (r.flavours ?? []).map((f) => `<span class="tag">${esc(f)}</span>`).join('');
  return `<article class="review">
      <header class="review-head">
        <div class="review-who">${who}</div>
        <div class="review-rating"><span class="rating-badge small">${rating2(r.rating)}</span></div>
      </header>
      ${r.notes ? `<p class="review-notes">${esc(r.notes)}</p>` : ''}
      ${flavours ? `<div class="tags">${flavours}</div>` : ''}
      ${meta ? `<p class="muted small">${meta}</p>` : ''}
    </article>`;
}

function jsonLd(bean, url) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: bean.name,
    category: 'Coffee',
    brand: { '@type': 'Brand', name: bean.roaster },
    url,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: bean.averageRating,
      bestRating: 5,
      worstRating: 1,
      reviewCount: bean.reviewCount,
    },
    review: bean.reviews.map((r) => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      author: { '@type': 'Person', name: r.author?.login || 'Anonymous' },
      reviewBody: r.notes || '',
    })),
  };
  // Escape "<" so the JSON can't break out of the <script> element.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function beanPage(bean) {
  const facts = bean.facts ?? {};
  const url = `${SITE_URL}/bean/${bean.slug}/`;
  const summaryBits = [
    `Rated ${bean.averageRating}/5 from ${bean.reviewCount} review${bean.reviewCount === 1 ? '' : 's'}`,
    facts.origins?.length ? facts.origins.join(', ') : null,
    bean.flavours?.length ? bean.flavours.join(', ') : null,
  ].filter(Boolean);
  const title = `${bean.name} — ${bean.roaster} | Bean Book`;
  const description = `${bean.name} by ${bean.roaster}. ${summaryBits.join('. ')}.`;

  const factList = [
    factRow('Roast type', facts.roastType !== 'Unknown' ? facts.roastType : null),
    factRow('Roast level', facts.roastLevel !== 'Unknown' ? facts.roastLevel : null),
    factRow('Origin type', facts.blend !== 'Unknown' ? facts.blend : null),
    factRow('Origin', facts.origins),
    factRow('Process', facts.process),
    factRow('Species', facts.species),
    factRow('Variety', facts.variety),
    factRow('Decaf', facts.decaf ? 'Yes' : null),
    factRow('Organic', facts.organic ? 'Yes' : null),
    factRow('Roast date', facts.roastDate),
    factRow('Value', bean.valuePer100g ? `from ${money(bean.valuePer100g.value, bean.valuePer100g.currency)} / 100g` : null),
  ].join('');

  const flavourBlock = bean.flavours?.length
    ? `<div class="flavour-block"><h2 class="section-title">Flavour profile</h2><div class="tags">${bean.flavours.map((f) => `<span class="tag">${esc(f)}</span>`).join('')}</div></div>`
    : '';

  const body = `<div id="app" class="app">
    <header class="site-header">
      <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">☕</span><span class="brand-name">Bean Book</span></a>
      <nav class="site-nav"><a class="btn ghost" href="${esc(NEW_REVIEW_URL)}" target="_blank" rel="noopener">Add a review</a></nav>
    </header>
    <main class="content">
      <a class="back" href="/">← All beans</a>
      <section class="bean-header">
        <div class="bean-title"><h1>${esc(bean.name)}</h1><p class="bean-roaster">${esc(bean.roaster)}</p></div>
        <div class="bean-score"><span class="rating-badge big">${rating2(bean.averageRating)}</span><span class="muted">${bean.reviewCount} review${bean.reviewCount === 1 ? '' : 's'}</span></div>
      </section>
      <section class="panel"><dl class="facts">${factList}</dl>${facts.website ? `<a class="btn" href="${esc(facts.website)}" target="_blank" rel="noopener">Visit bean page ↗</a>` : ''}</section>
      ${flavourBlock}
      <section class="reviews"><h2 class="section-title">Reviews (${bean.reviewCount})</h2>${bean.reviews.map(reviewHtml).join('')}</section>
    </main>
  </div>`;

  return `<!doctype html>
<html lang="en" data-theme="auto">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; object-src 'none'; img-src 'self' https://avatars.githubusercontent.com data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; manifest-src 'self'; font-src 'self'; form-action 'self'" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#f7f3ee" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#1a1410" media="(prefers-color-scheme: dark)" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Bean Book" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <link rel="stylesheet" href="/styles.css" />
    <script type="application/ld+json">${jsonLd(bean, url)}</script>
  </head>
  <body>
    ${body}
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`;
}

function sitemap(beans, lastmod) {
  const urls = [`${SITE_URL}/`, ...beans.map((b) => `${SITE_URL}/bean/${b.slug}/`)];
  const entries = urls
    .map((u) => `  <url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

async function main() {
  const data = JSON.parse(await readFile(join(ROOT, 'data', 'beans.json'), 'utf8'));
  const beans = Array.isArray(data.beans) ? data.beans : [];
  const lastmod = (data.generatedAt || new Date().toISOString()).slice(0, 10);

  await mkdir(join(ROOT, 'bean'), { recursive: true });
  for (const bean of beans) {
    const dir = join(ROOT, 'bean', bean.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), beanPage(bean), 'utf8');
  }
  await writeFile(join(ROOT, 'sitemap.xml'), sitemap(beans, lastmod), 'utf8');

  console.log(`[build-site] prerendered ${beans.length} bean page(s) + sitemap.xml`);
}

main().catch((err) => {
  console.error('[build-site] fatal:', err);
  process.exit(1);
});
