/**
 * Path-based router (History API).
 *
 * Real, crawlable URLs (`base` comes from the product config — `bean` for
 * Bean Book, `tea` for Leaf Book):
 *   /              -> home (gallery)
 *   /<base>/:slug/ -> item detail
 *
 * Clicks on internal links are intercepted for snappy in-app navigation, but
 * the links remain real paths so each page is a prerendered, indexable URL.
 */

/**
 * @param {string} base route base segment, e.g. "bean"
 * @param {Location|{pathname:string}} [loc]
 */
export function parseRoute(base, loc = window.location) {
  const re = new RegExp(`/${String(base).replace(/[^a-z0-9-]/gi, '')}/([^/]+)/?$`);
  const m = re.exec(loc.pathname);
  if (m) return { name: 'item', slug: decodeURIComponent(m[1]) };
  return { name: 'home' };
}

export function onRouteChange(base, handler) {
  window.addEventListener('popstate', () => handler(parseRoute(base)));
}

export function navigate(path) {
  if (path === window.location.pathname + window.location.search) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Intercept same-origin left-clicks on links so navigation stays client-side.
 * External links, new-tab clicks and downloads fall through to the browser.
 */
export function interceptLinks() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = e.target.closest && e.target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    e.preventDefault();
    navigate(url.pathname + url.search);
  });
}
