/**
 * Zero-dependency static file server for local development.
 * Serves a built site directory.
 *
 * Usage: npm start            (coffee)
 *        npm run start:tea
 *        node scripts/serve.js tea
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, sep } from 'node:path';
import { getProduct, PRODUCT_IDS } from '../products/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

const product = getProduct(process.argv[2] || PRODUCT_IDS[0]);
const ROOT = join(__dirname, '..', 'dist', product.id);

if (!existsSync(ROOT)) {
  console.error(`No build found at dist/${product.id}. Run: npm run build:${product.id}`);
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    // Prevent path traversal: filePath must be ROOT itself or strictly inside
    // it (guard against sibling dirs like `<root>-secret` matching a prefix).
    let filePath = normalize(join(ROOT, pathname));
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    // Directory-index resolution (mirrors Cloudflare Pages / GitHub Pages):
    // /bean/x/ -> /bean/x/index.html
    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info || !info.isFile()) {
      const notFound = join(ROOT, '404.html');
      if (existsSync(notFound)) {
        res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(await readFile(notFound));
        return;
      }
      res.writeHead(404).end('Not found');
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end(`Server error: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`${product.site.name} dev server: http://localhost:${PORT}`);
});
