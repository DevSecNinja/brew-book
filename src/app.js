/** App orchestration: layout, theme, routing, rendering. */

import { el, clear } from './components.js';
import { loadData, findItem } from './data.js';
import { parseRoute, onRouteChange, interceptLinks } from './router.js';
import { renderHome, emptyState } from './views/home.js';
import { renderItem } from './views/item.js';
import { itemTitle, itemDescription, itemPath } from './seo.js';
import { newReviewUrl } from './text.js';

const THEMES = ['auto', 'light', 'dark'];

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function themeToggle(themeKey) {
  let current = localStorage.getItem(themeKey) || 'auto';
  applyTheme(current);
  const labels = { auto: '🌗 Auto', light: '☀️ Light', dark: '🌙 Dark' };
  const btn = el('button', {
    class: 'theme-toggle', type: 'button', 'aria-label': 'Change colour theme',
    text: labels[current],
  });
  btn.addEventListener('click', () => {
    current = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    localStorage.setItem(themeKey, current);
    applyTheme(current);
    btn.textContent = labels[current];
  });
  return btn;
}

function header(product, reviewUrl) {
  return el('header', { class: 'site-header' },
    el('a', { class: 'brand', href: '/' },
      el('span', { class: 'brand-mark', 'aria-hidden': 'true', text: product.site.mark }),
      el('span', { class: 'brand-name', text: product.site.name }),
    ),
    el('nav', { class: 'site-nav' },
      el('a', { class: 'btn ghost', href: reviewUrl, target: '_blank', rel: 'noopener', text: product.terms.addReview }),
      themeToggle(`${product.id}-book-theme`),
    ),
  );
}

/** Keep <title> and social/canonical meta in sync during client navigation. */
function setMeta(name, attr, value) {
  let tag = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', value);
}

function updateHead(route, item, product) {
  const path = route.name === 'item' && item ? itemPath(item, product) : '/';
  const url = `${product.site.url}${path}`;
  const title = route.name === 'item' && item ? itemTitle(item, product) : product.site.title;
  const description = route.name === 'item' && item
    ? itemDescription(item, product)
    : product.site.description;

  document.title = title;
  setMeta('description', 'name', description);
  setMeta('og:title', 'property', title);
  setMeta('og:description', 'property', description);
  setMeta('og:url', 'property', url);
  setMeta('twitter:title', 'name', title);
  setMeta('twitter:description', 'name', description);
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', url);
}

function footer(data, buildId, product) {
  const repoUrl = product.site.repoUrl;
  const shortHash = (buildId || '').split('-')[0] || 'dev';
  const isRealHash = /^[0-9a-f]{7,40}$/i.test(shortHash);
  const generated = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const build = isRealHash
    ? el('a', {
        class: 'build', href: `${repoUrl}/commit/${shortHash}`,
        target: '_blank', rel: 'noopener', title: 'View this build’s commit', text: shortHash,
      })
    : el('code', { class: 'build', title: 'Build commit', text: shortHash });
  return el('footer', { class: 'site-footer' },
    el('p', {},
      el('a', { href: repoUrl, target: '_blank', rel: 'noopener', text: `${product.site.name} on GitHub` }),
      ' · reviews sourced from GitHub Issues',
    ),
    el('p', { class: 'muted small' },
      generated ? `Data updated ${generated} · ` : '',
      build,
    ),
  );
}

/**
 * @param {HTMLElement} root
 * @param {{buildId?:string, product:object}} options
 */
export async function initApp(root, { buildId, product } = {}) {
  clear(root);
  const reviewUrl = newReviewUrl(product);
  const content = el('main', { class: 'content', id: 'content', tabindex: '-1' });

  let data;
  try {
    data = await loadData();
  } catch {
    root.append(
      header(product, reviewUrl),
      el('main', { class: 'content' }, emptyState(product)),
      footer(null, buildId, product),
    );
    return;
  }

  root.append(header(product, reviewUrl), content, footer(data, buildId, product));

  const render = (route) => {
    let item = null;
    if (route.name === 'item') {
      item = findItem(data, route.slug);
      if (item) {
        renderItem(content, item, product);
      } else {
        clear(content);
        content.append(el('div', { class: 'empty' },
          el('h1', { text: `${product.terms.Item} not found` }),
          el('a', { class: 'btn', href: '/', text: `← Back to all ${product.terms.items}` }),
        ));
      }
    } else {
      renderHome(content, data, product);
    }
    updateHead(route, item, product);
    content.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  };

  const base = product.terms.routeBase;
  onRouteChange(base, render);
  interceptLinks();
  render(parseRoute(base));
}
