#!/usr/bin/env node
/**
 * Checks a generated image against its entry in the asset manifest.
 *
 *   node tools/assets/check-image.mjs <asset-id> [path-to-png]
 *
 * Default path: assets/incoming/<id>.png. Prints PASS/WARN/FAIL lines and, when something is
 * wrong, a "--fix" sentence to give to generate.mjs. Exit code 1 if any FAIL.
 * It checks what a program can check (size, background, border crossings, colour count,
 * recolour marker). Whether the picture is pretty, in style and free of lettering must
 * still be judged by eye.
 */
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, generationPlan } from './build-prompts.mjs';

/** Minimal PNG decoder: 8-bit, non-interlaced, colour types 0, 2, 3, 4, 6. Returns RGBA. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG file');
  let pos = 8, width = 0, height = 0, depth = 0, ctype = 0, interlace = 0, palette = null, trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG (bit depth ${depth}, interlace ${interlace}); re-save as 8-bit non-interlaced`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!channels) throw new Error(`unsupported PNG colour type ${ctype}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels, d = i * 4;
    if (ctype === 6) { rgba[d] = px[s]; rgba[d + 1] = px[s + 1]; rgba[d + 2] = px[s + 2]; rgba[d + 3] = px[s + 3]; }
    else if (ctype === 2) { rgba[d] = px[s]; rgba[d + 1] = px[s + 1]; rgba[d + 2] = px[s + 2]; rgba[d + 3] = 255; }
    else if (ctype === 0 || ctype === 4) { rgba[d] = rgba[d + 1] = rgba[d + 2] = px[s]; rgba[d + 3] = ctype === 4 ? px[s + 1] : 255; }
    else { const k = px[s]; rgba[d] = palette[k * 3]; rgba[d + 1] = palette[k * 3 + 1]; rgba[d + 2] = palette[k * 3 + 2]; rgba[d + 3] = trns && k < trns.length ? trns[k] : 255; }
  }
  return { width, height, rgba };
}

const nearMagenta = (r, g, b) => r > 190 && b > 190 && g < 90;
const nearCyan = (r, g, b) => r < 80 && g > 200 && b > 200;

/** Run all checks. Returns { results: [{level, text}], fixes: [string] }. */
export function checkImage(asset, img) {
  const results = [];
  const fixes = [];
  const add = (level, text, fix) => { results.push({ level, text }); if (fix && level !== 'PASS') fixes.push(fix); };
  const { width: W, height: H, rgba } = img;

  // 1. proportions: must be one of the formats the tool can make, matching the plan
  const plan = generationPlan(asset);
  const got = W / H;
  if (Math.abs(Math.log(got / plan.format.ratio)) < 0.04) add('PASS', `format ${W}x${H} is the requested ${plan.format.text}`);
  else add('FAIL', `format ${W}x${H} (${got.toFixed(2)}) is not the requested ${plan.format.text}`, `Make the image ${plan.format.text}, ${plan.format.size}.`);

  // 2. background
  const wantsMagenta = /FF00FF/i.test(asset.background);
  const isBg = (i) => (wantsMagenta ? nearMagenta(rgba[i], rgba[i + 1], rgba[i + 2]) || rgba[i + 3] < 16 : rgba[i + 3] < 16);
  if (wantsMagenta) {
    let bg = 0, transparent = 0;
    for (let i = 0; i < rgba.length; i += 4) { if (rgba[i + 3] < 16) transparent++; if (isBg(i)) bg++; }
    const frac = bg / (W * H);
    const corners = [0, (W - 1) * 4, (H - 1) * W * 4, ((H - 1) * W + W - 1) * 4];
    const cornersOk = corners.every(isBg);
    if (frac > 0.1 && cornersOk) add('PASS', `background removable: ${(frac * 100).toFixed(0)}% flat magenta/transparent, corners clean${transparent ? ' (has real transparency)' : ''}`);
    else add('FAIL', `no clean #FF00FF/transparent background (corners ${cornersOk ? 'ok' : 'not magenta'}, ${(frac * 100).toFixed(0)}% background)`, 'Use a perfectly flat, solid #FF00FF background everywhere, with no gradient, shadow or scenery.');
  } else {
    let tr = 0;
    for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 255) tr++;
    if (tr === 0) add('PASS', 'opaque, as required');
    else add('WARN', `${((tr / (W * H)) * 100).toFixed(1)}% of pixels are transparent but the asset should be opaque`, 'The image must be fully opaque, with no transparent areas.');
  }

  // 3. sheet grid: near every expected cell boundary there must be a clean empty gap
  //    (sprites need not sit on exact thirds; processing slices through the middle of the gap)
  const f = plan.sheet ? { columns: plan.columns, rows: plan.rows } : null;
  if (f && wantsMagenta) {
    const colEmpty = (x) => { let hit = 0; for (let y = 0; y < H; y++) if (!isBg((y * W + x) * 4)) hit++; return hit / H <= 0.01; };
    const rowEmpty = (y) => { let hit = 0; for (let x = 0; x < W; x++) if (!isBg((y * W + x) * 4)) hit++; return hit / W <= 0.01; };
    const missing = [];
    const hasGap = (center, span, empty, max) => {
      const lo = Math.max(1, Math.round(center - span * 0.15));
      const hi = Math.min(max - 2, Math.round(center + span * 0.15));
      for (let t = lo; t <= hi; t++) if (empty(t)) return true;
      return false;
    };
    for (let c = 1; c < f.columns; c++) if (!hasGap((W * c) / f.columns, W / f.columns, colEmpty, W)) missing.push(`column boundary ${c}`);
    for (let r = 1; r < f.rows; r++) if (!hasGap((H * r) / f.rows, H / f.rows, rowEmpty, H)) missing.push(`row boundary ${r}`);
    if (!missing.length) add('PASS', `sheet grid ${f.columns}x${f.rows}: a clean gap at every cell boundary`);
    else add('FAIL', `no clean empty gap at ${missing.slice(0, 4).join(', ')}: sprites run into each other`, `Lay the sprites out on a strict grid of ${f.columns} columns by ${f.rows} rows of equal cells; every sprite must sit fully inside its own cell with plain empty background all around it, with a clear gap between neighbouring cells.`);
  }

  // 4. colour count (pixel art should be flat)
  const seen = new Set();
  const step = Math.max(1, Math.floor((W * H) / 400000));
  for (let p = 0; p < W * H; p += step) { const i = p * 4; if (rgba[i + 3] > 16) seen.add(((rgba[i] >> 4) << 8) | ((rgba[i + 1] >> 4) << 4) | (rgba[i + 2] >> 4)); }
  if (asset.kind === 'illustration' || asset.kind === 'background' || asset.kind === 'room' || asset.kind === 'room-sheet') {
    if (seen.size < 600) add('PASS', `${seen.size} distinct colours (4-bit): flat enough`);
    else add('WARN', `${seen.size} distinct colours (4-bit): looks painted rather than pixel art`, 'Use a strict limited palette of about 24 flat colours, hard pixel edges, no gradients, no soft shading, no texture noise.');
  } else if (seen.size < 600) add('PASS', `${seen.size} distinct colours (4-bit): flat enough`);
  else add('WARN', `${seen.size} distinct colours (4-bit): too many for crisp sprites`, 'Use a strict limited palette of about 24 flat colours, hard pixel edges, no gradients, no soft shading.');

  // 5. recolour marker on crew sprites
  if (/00FFFF/i.test(asset.subject)) {
    let cyan = 0;
    for (let i = 0; i < rgba.length; i += 4) if (nearCyan(rgba[i], rgba[i + 1], rgba[i + 2]) && rgba[i + 3] > 16) cyan++;
    if (cyan > 20) add('PASS', `recolour marker #00FFFF present (${cyan} px)`);
    else add('FAIL', 'no flat cyan #00FFFF recolour marker found', 'The collar, shoulder stripe and belt must be flat pure cyan #00FFFF, used nowhere else.');
  }
  return { results, fixes };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [id, pathArg] = process.argv.slice(2);
  const manifest = loadManifest();
  const asset = manifest.assets.find((a) => a.id === id);
  if (!asset) { console.error('usage: check-image.mjs <asset-id> [png]'); process.exit(2); }
  const root = join(fileURLToPath(import.meta.url), '..', '..', '..');
  const file = pathArg ? resolve(pathArg) : join(root, asset.incoming);
  if (!existsSync(file)) { console.error(`no image at ${file}`); process.exit(2); }
  const { results, fixes } = checkImage(asset, decodePng(readFileSync(file)));
  for (const r of results) console.log(`${r.level.padEnd(4)}  ${r.text}`);
  if (fixes.length) console.log(`\nFIX: ${fixes.join(' ')}`);
  console.log('\nStill to judge by eye: style match with the anchor, no letters in the image, content matches the brief.');
  process.exit(results.some((r) => r.level === 'FAIL') ? 1 : 0);
}
