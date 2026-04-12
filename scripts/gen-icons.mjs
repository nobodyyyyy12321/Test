/**
 * 產生 PWA 圖示：192x192 和 512x512
 * 樣式：深色圓角底 + 白色 "S" 字
 * 用法：node scripts/gen-icons.mjs
 */

import zlib from "zlib";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/icons");

// ── CRC32 ──────────────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ── PNG builder ────────────────────────────────────────────────────────────
function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcVal]);
}

function makePNG(pixels, size) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  // bytes 10-12 already 0 (compression, filter, interlace)

  // raw scanlines: 1 filter byte + RGBA per pixel
  const stride = 1 + size * 4;
  const raw = Buffer.alloc(size * stride, 0);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const si = (y * size + x) * 4;
      const di = y * stride + 1 + x * 4;
      raw[di]     = pixels[si];
      raw[di + 1] = pixels[si + 1];
      raw[di + 2] = pixels[si + 2];
      raw[di + 3] = pixels[si + 3];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Draw icon ──────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  const BG = [30, 30, 30];   // #1e1e1e
  const FG = [255, 255, 255]; // white

  // rounded-rect radius: ~22% of size
  const r = Math.round(size * 0.22);
  const cx = size / 2;
  const cy = size / 2;

  function setPixel(x, y, rgb, a = 255) {
    const idx = (y * size + x) * 4;
    // blend over transparent
    const alpha = a / 255;
    pixels[idx]     = Math.round(rgb[0] * alpha);
    pixels[idx + 1] = Math.round(rgb[1] * alpha);
    pixels[idx + 2] = Math.round(rgb[2] * alpha);
    pixels[idx + 3] = a;
  }

  // ── background (rounded rectangle with anti-aliasing) ──
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // distance from rounded rect edge (SDF approach)
      const qx = Math.abs(x - cx) - (cx - r);
      const qy = Math.abs(y - cy) - (cy - r);
      const dist = Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) - r;
      // dist < 0 → inside, 0..1 → edge, >1 → outside
      if (dist <= -1) {
        setPixel(x, y, BG, 255);
      } else if (dist < 1) {
        const a = Math.round((1 - (dist + 1) / 2) * 255);
        setPixel(x, y, BG, a);
      }
    }
  }

  // ── draw "S" using Bezier-sampled strokes ──────────────────────────────
  // We use a thick stroke drawn as filled circles along a path.
  const sw = size * 0.065; // stroke width

  function fillCircle(fx, fy, rad, rgb) {
    const ir = Math.ceil(rad + 1);
    for (let dy = -ir; dy <= ir; dy++) {
      for (let dx = -ir; dx <= ir; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > rad + 1) continue;
        const px = Math.round(fx + dx);
        const py = Math.round(fy + dy);
        if (px < 0 || py < 0 || px >= size || py >= size) continue;
        const a = Math.min(255, Math.round((1 - Math.max(0, d - rad)) * 255));
        // blend onto existing pixel
        const idx = (py * size + px) * 4;
        const alpha = a / 255;
        pixels[idx]     = Math.round(lerp(pixels[idx],     rgb[0], alpha));
        pixels[idx + 1] = Math.round(lerp(pixels[idx + 1], rgb[1], alpha));
        pixels[idx + 2] = Math.round(lerp(pixels[idx + 2], rgb[2], alpha));
        pixels[idx + 3] = Math.min(255, pixels[idx + 3] + a);
      }
    }
  }

  // Quadratic Bezier sampler
  function strokeBezier(p0, p1, p2, steps = 80) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0];
      const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1];
      fillCircle(x, y, sw, FG);
    }
  }
  function strokeLine(p0, p1, steps = 40) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      fillCircle(lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t), sw, FG);
    }
  }

  // "S" glyph — defined in normalised coords [0,1], centred, then scaled
  // The "S" spans roughly x: 0.3..0.7, y: 0.2..0.8
  const S = (nx, ny) => [cx + (nx - 0.5) * size * 0.52, cy + (ny - 0.5) * size * 0.60];

  // Upper arc  (top-right → top-left → middle-left)
  strokeBezier(S(0.68, 0.25), S(0.68, 0.18), S(0.50, 0.18));
  strokeBezier(S(0.50, 0.18), S(0.30, 0.18), S(0.30, 0.32));
  strokeBezier(S(0.30, 0.32), S(0.30, 0.44), S(0.50, 0.50));

  // Middle crossbar area
  strokeLine(S(0.50, 0.50), S(0.50, 0.50));

  // Lower arc  (middle-right → bottom-right → bottom-left)
  strokeBezier(S(0.50, 0.50), S(0.70, 0.56), S(0.70, 0.68));
  strokeBezier(S(0.70, 0.68), S(0.70, 0.82), S(0.50, 0.82));
  strokeBezier(S(0.50, 0.82), S(0.30, 0.82), S(0.30, 0.75));

  return pixels;
}

// ── Output ─────────────────────────────────────────────────────────────────
for (const size of [192, 512]) {
  const pixels = drawIcon(size);
  const png = makePNG(pixels, size);
  const outPath = path.join(outDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✓ ${outPath} (${(png.length / 1024).toFixed(1)} KB)`);
}
