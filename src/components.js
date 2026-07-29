/**
 * Tiny, safe DOM builders. All text is set via textContent — never innerHTML —
 * so untrusted, issue-derived content can never become markup.
 */

/**
 * Create an element.
 * @param {string} tag
 * @param {object} [attrs] - attributes; `class`, `text`, `html` (forbidden),
 *   `dataset`, `aria*`, and event handlers (`onClick`) are handled.
 * @param {...(Node|string|null|undefined)} children
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'text') {
      node.textContent = String(value);
    } else if (key === 'class' || key === 'className') {
      node.className = String(value);
    } else if (key === 'dataset') {
      for (const [d, v] of Object.entries(value)) node.dataset[d] = String(v);
    } else if (key === 'style' && typeof value === 'object') {
      for (const [p, v] of Object.entries(value)) node.style.setProperty(p, String(v));
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'href' || key === 'src') {
      // Only allow safe URL schemes for navigable/loadable attributes.
      node.setAttribute(key, safeUrl(value));
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Return a URL only if it uses http(s); otherwise a harmless placeholder. */
export function safeUrl(value) {
  try {
    const url = new URL(String(value), window.location.href);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch {
    /* fall through */
  }
  return '#';
}

/** Remove all children of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Append children to a node, skipping the nullish/false ones.
 * Native `append()` would stringify them into literal "null" text, so always
 * use this when a child is conditionally rendered.
 */
export function append(parent, ...children) {
  parent.append(frag(children.flat()));
  return parent;
}

/** A document fragment from a list of children. */
export function frag(children) {
  const f = document.createDocumentFragment();
  for (const child of children) {
    if (child == null || child === false) continue;
    f.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return f;
}
