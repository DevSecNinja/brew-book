/**
 * Minimal PNG encoder (zlib only — no dependencies).
 *
 * Used by scripts/make-icons.js to rasterize the flat, geometric product icons
 * so a new product doesn't need an image toolchain to ship a valid PWA.
 */

import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * Encode raw RGBA pixels as a PNG.
 * @param {Uint8Array} rgba width*height*4 bytes
 * @param {number} width
 * @param {number} height
 * @returns {Buffer}
 */
export function encodePng(rgba, width, height) {
  const stride = width * 4;
  // Each scanline is prefixed with filter type 0 (none).
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride)
      .copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A tiny RGBA canvas with the handful of primitives the icons need. */
export class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  /** Blend a colour into a pixel with the given coverage (0..1). */
  blend(x, y, [r, g, b], alpha) {
    if (alpha <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const a = Math.min(1, alpha);
    const i = (y * this.width + x) * 4;
    const dstA = this.data[i + 3] / 255;
    const outA = a + dstA * (1 - a);
    for (let c = 0; c < 3; c += 1) {
      const src = [r, g, b][c];
      const dst = this.data[i + c];
      this.data[i + c] = Math.round((src * a + dst * dstA * (1 - a)) / (outA || 1));
    }
    this.data[i + 3] = Math.round(outA * 255);
  }

  /**
   * Fill every pixel whose (x, y) satisfies `inside`, anti-aliased with a 3x3
   * supersample. `inside` receives canvas coordinates.
   */
  fill(colour, inside, alpha = 1) {
    const samples = 3;
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        let hits = 0;
        for (let sy = 0; sy < samples; sy += 1) {
          for (let sx = 0; sx < samples; sx += 1) {
            const px = x + (sx + 0.5) / samples;
            const py = y + (sy + 0.5) / samples;
            if (inside(px, py)) hits += 1;
          }
        }
        if (hits) this.blend(x, y, colour, alpha * (hits / (samples * samples)));
      }
    }
  }

  /** Linear vertical gradient across the whole canvas. */
  gradient(from, to, inside = () => true) {
    for (let y = 0; y < this.height; y += 1) {
      const t = y / Math.max(1, this.height - 1);
      const colour = from.map((c, i) => Math.round(c + (to[i] - c) * t));
      for (let x = 0; x < this.width; x += 1) {
        if (inside(x + 0.5, y + 0.5)) this.blend(x, y, colour, 1);
      }
    }
  }

  toPng() {
    return encodePng(this.data, this.width, this.height);
  }
}

/** Signed-distance style helper: is (x, y) inside a rounded rectangle? */
export function roundedRect(x0, y0, w, h, r) {
  const x1 = x0 + w;
  const y1 = y0 + h;
  return (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    // Clamp to the corner-circle centres; inside the straight edges the clamped
    // point equals the sample, so the distance test passes trivially.
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
}
