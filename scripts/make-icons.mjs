// Draws the Bragboard icon (a podium with a star) into PNGs with no image libraries.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG = [0xff, 0x6b, 0x2c], INK = [0x14, 0x16, 0x26], CREAM = [0xff, 0xf4, 0xe8], GOLD = [0xff, 0xd1, 0x4a];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
function inStar(x, y, cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Shapes in a 0..1 unit square, painted in order.
function sample(u, v, maskable) {
  const s = maskable ? 0.78 : 1, o = (1 - s) / 2; // shrink artwork into the maskable safe zone
  const x = (u - o) / s, y = (v - o) / s;
  let c = null;
  if (maskable || inRoundRect(u, v, 0, 0, 1, 1, 0.22)) c = BG;
  if (!c) return null;
  if (inRoundRect(x, y, 0.16, 0.56, 0.38, 0.82, 0.03)) c = CREAM;  // 2nd
  if (inRoundRect(x, y, 0.39, 0.44, 0.61, 0.82, 0.03)) c = INK;    // 1st
  if (inRoundRect(x, y, 0.62, 0.64, 0.84, 0.82, 0.03)) c = CREAM;  // 3rd
  if (inStar(x, y, 0.5, 0.29, 0.13, 0.055)) c = GOLD;
  return c;
}

function render(size, maskable = false) {
  const px = Buffer.alloc(size * size * 4), SS = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const c = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, maskable);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
    }
    const n = SS * SS, i = (y * size + x) * 4, cov = a / 255 || 1;
    px[i] = r / cov; px[i + 1] = g / cov; px[i + 2] = b / cov; px[i + 3] = a / n;
  }
  return png(size, px);
}

writeFileSync('public/pwa-192.png', render(192));
writeFileSync('public/pwa-512.png', render(512));
writeFileSync('public/pwa-512-maskable.png', render(512, true));
writeFileSync('public/apple-touch-icon.png', render(180, true));
writeFileSync('public/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#FF6B2C"/><rect x="16" y="56" width="22" height="26" rx="3" fill="#FFF4E8"/><rect x="39" y="44" width="22" height="38" rx="3" fill="#141626"/><rect x="62" y="64" width="22" height="18" rx="3" fill="#FFF4E8"/><path d="M50 16l3.8 7.7 8.5 1.2-6.1 6 1.4 8.4L50 35.3l-7.6 4 1.4-8.4-6.1-6 8.5-1.2z" fill="#FFD14A"/></svg>`);
console.log('icons written');
