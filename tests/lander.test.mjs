// A41: one flame under the middle of each nozzle of the flying lander; both flame frames share one scale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { LANDER_ART, FLAME_ART, FLAME_SCALE, FLAME_TUCK, nozzleOffsets, flames } from '../src/render/lander.js';
import { SURFACE, LANDER_FLIGHT_W } from '../src/render/geometry.js';

const W = LANDER_FLIGHT_W;
const at = (tick = 0, over = {}) => flames({ x: 1650, y: 900, w: W, tick, ...over });

test('four flames, one under each nozzle: the top of every flame is on the middle of its nozzle', () => {
  const f = at(0);
  assert.equal(f.length, 4);
  const off = nozzleOffsets(W);
  f.forEach((fl, i) => {
    const topCentre = fl.x + FLAME_ART[fl.frame].topShift * fl.k; // the flame's own top middle
    assert.ok(Math.abs(topCentre - (1650 + off[i])) < 0.01, `flame ${i}: ${topCentre} vs nozzle ${1650 + off[i]}`);
  });
});

test('the flames are in a row like the nozzles: symmetric about the middle and evenly spaced', () => {
  const off = nozzleOffsets(W);
  assert.ok(Math.abs(off[0] + off[3]) < 1 && Math.abs(off[1] + off[2]) < 1, 'symmetric within a unit');
  const gaps = [off[1] - off[0], off[2] - off[1], off[3] - off[2]];
  for (const g of gaps) assert.ok(Math.abs(g - gaps[1]) < 1, `gaps ${gaps.map((x) => x.toFixed(1))}`);
  // the old grid was 52 units apart, the nozzles are about 42: the outer flames were 12 units off
  assert.ok(gaps[1] > 40 && gaps[1] < 45, `nozzle spacing ${gaps[1]}`);
});

test('both flame frames are drawn at one scale, so the short frame stays short', () => {
  const f = at(0);
  assert.ok(f.every((x) => x.k === f[0].k));
  const [a, b] = [FLAME_ART[2], FLAME_ART[3]];
  assert.ok(b.h < a.h * 0.8, 'frame B is the shorter one in the art');
  assert.ok(Math.abs(a.w * f[0].k - b.w * f[0].k) < 3, 'and about as wide as frame A');
});

test('neighbours use different frames and swap on every tick', () => {
  const frames = (t) => at(t).map((x) => x.frame);
  assert.deepEqual(frames(0), [2, 3, 2, 3]);
  assert.deepEqual(frames(1), [3, 2, 3, 2]);
  assert.deepEqual(frames(2), frames(0));
});

test('flames do not overlap their neighbours, and a flame top is about as wide as its nozzle', () => {
  const kLander = W / LANDER_ART.bodyW;
  const spacing = nozzleOffsets(W)[2] - nozzleOffsets(W)[1];
  for (const t of [0, 1]) {
    const f = at(t);
    for (let i = 0; i < 3; i++) {
      const wi = FLAME_ART[f[i].frame].w * f[i].k;
      const wj = FLAME_ART[f[i + 1].frame].w * f[i + 1].k;
      assert.ok((wi + wj) / 2 < spacing, `flames ${i} and ${i + 1}: ${((wi + wj) / 2).toFixed(1)} wide on average, spacing ${spacing.toFixed(1)}`);
    }
    for (const fl of f) assert.ok(Math.abs(FLAME_ART[fl.frame].topW * fl.k - LANDER_ART.nozzleW * kLander) < 4, 'top of the flame vs the nozzle');
  }
});

test('a flame starts a little up inside its nozzle (the lander is drawn over it) and everything scales with the lander', () => {
  for (const fl of at(0)) assert.ok(fl.y < 900 && fl.y > 900 - 10, `y ${fl.y}`);
  assert.equal(FLAME_TUCK > 0 && FLAME_SCALE > 0 && FLAME_SCALE < 1, true);
  const half = flames({ x: 0, y: 0, w: W / 2 });
  const full = flames({ x: 0, y: 0, w: W });
  half.forEach((h, i) => { assert.ok(Math.abs(h.x * 2 - full[i].x) < 1e-9); assert.ok(Math.abs(h.k * 2 - full[i].k) < 1e-12); });
  assert.equal(W, SURFACE.lander.w - 20);
});

// ---- the measured numbers must still match the pictures (a new picture means: measure again) ----

/** A tiny PNG reader for the 8-bit RGBA, not interlaced pictures of assets/incoming. */
function readPng(path) {
  const b = readFileSync(new URL(path, import.meta.url));
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  assert.deepEqual([b[24], b[25], b[28]], [8, 6, 0], `${path}: expected 8-bit RGBA without interlace`);
  const idat = [];
  for (let p = 8; p < b.length;) { const len = b.readUInt32BE(p); if (b.toString('latin1', p + 4, p + 8) === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len)); p += 12 + len; }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[y * stride + x - 4] : 0;
      const up = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y ? out[(y - 1) * stride + x - 4] : 0;
      let v = raw[y * (stride + 1) + 1 + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (a + up) >> 1;
      else if (filter === 4) { const p = a + up - c; const pa = Math.abs(p - a); const pb = Math.abs(p - up); const pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, data: out };
}

/** Visible pixels as the atlas sees them: alpha below 110 is cut away. A cell is { x, y, w, h } in source pixels. */
const visible = (png, x, y) => png.data[(y * png.w + x) * 4 + 3] >= 110;
function boxOf(png, cell) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = cell.y; y < cell.y + cell.h; y++) for (let x = cell.x; x < cell.x + cell.w; x++) if (visible(png, x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0: x0 - cell.x, x1: x1 - cell.x, y0: y0 - cell.y, y1: y1 - cell.y, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function runsAt(png, cell, y, minLen = 20) {
  const out = [];
  let start = -1;
  for (let x = 0; x <= cell.w; x++) {
    const on = x < cell.w && visible(png, cell.x + x, cell.y + y);
    if (on && start < 0) start = x;
    if (!on && start >= 0) { if (x - start >= minLen) out.push([start, x - 1]); start = -1; }
  }
  return out;
}
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: measured ${a}, in lander.js ${b} (±${tol}); measure the picture again`);

test('LANDER_ART matches lander.craft.png (flying lander, cell 0)', () => {
  const png = readPng('../assets/incoming/lander.craft.png');
  const cell = { x: 0, y: 0, w: png.w, h: Math.floor(png.h / 2) };
  const box = boxOf(png, cell);
  close(box.w, LANDER_ART.bodyW, 3, 'body width');
  close((box.x0 + box.x1) / 2, LANDER_ART.centerX, 3, 'body middle');
  const runs = runsAt(png, cell, box.y1 - 25);
  assert.equal(runs.length, 4, 'four nozzles');
  runs.forEach(([a, b], i) => close((a + b) / 2, LANDER_ART.nozzleX[i], 3, `nozzle ${i} middle`));
  const low = runsAt(png, cell, box.y1 - 10);
  assert.equal(low.length, 4);
  low.forEach(([a, b]) => close(b - a + 1, LANDER_ART.nozzleW, 6, 'nozzle width at its lowest'));
});

test('FLAME_ART matches lander.parachute.png (flame frames A and B, cells 2 and 3)', () => {
  const png = readPng('../assets/incoming/lander.parachute.png');
  const half = Math.floor(png.w / 2);
  for (const frame of [2, 3]) {
    const cell = { x: (frame % 2) * half, y: Math.floor(frame / 2) * half, w: half, h: half };
    const box = boxOf(png, cell);
    const art = FLAME_ART[frame];
    close(box.w, art.w, 3, `frame ${frame} width`);
    close(box.h, art.h, 3, `frame ${frame} height`);
    const top = runsAt(png, cell, box.y0 + Math.round(box.h * 0.02), 5);
    const [a, b] = [top[0][0], top[top.length - 1][1]];
    close(b - a + 1, art.topW, 8, `frame ${frame} width of the flat top`);
    close((a + b) / 2 - (box.x0 + box.x1) / 2, art.topShift, 4, `frame ${frame} top middle against the box middle`);
  }
});
