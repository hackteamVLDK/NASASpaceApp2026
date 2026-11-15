// A36: the climbing frames were painted with their own ladder; it is cut out so the climber hangs on the shaft's ladder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setStrings } from '../src/flow/strings.js';
import { eraseLadder, hsv, BAKED_LADDERS, CLIMB_FRAMES } from '../src/render/ladders.js';
import { ENTRY, astronautPathAt } from '../src/flow/intro.js';
import { entryGeometry, LADDER, SHAFT_X } from '../src/render/geometry.js';
import { LAYOUT } from '../src/campaign/data.js';

setStrings(JSON.parse(readFileSync(new URL('../content/data/strings.en.json', import.meta.url), 'utf8')));

/** A small RGBA cell: `paint(x0, y0, w, h, [r, g, b])` fills a rectangle. */
function cell(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  const paint = (x0, y0, ww, hh, [r, g, b]) => { for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) data.set([r, g, b, 255], (y * w + x) * 4); };
  const alpha = (x, y) => data[(y * w + x) * 4 + 3];
  const rgb = (x, y) => [...data.subarray((y * w + x) * 4, (y * w + x) * 4 + 3)];
  return { data, paint, alpha, rgb, w, h };
}

const OUTLINE = [47, 18, 10];
const CREAM = [233, 198, 162];
const GLOVE = [186, 137, 102];
const ORANGE = [228, 136, 2];
const GREY = [144, 128, 128];

/** A climber on the left, a ladder on the right, and a hand that reaches over the left rail. */
function climberWithLadder(kind) {
  const c = cell(200, 200);
  const fill = kind === 'orange' ? ORANGE : GREY;
  // the ladder: two rails with an outline round them and three rungs
  for (const rx of [110, 160]) { c.paint(rx - 4, 10, 24, 180, OUTLINE); c.paint(rx, 14, 16, 172, fill); }
  for (const ry of [40, 100, 160]) { c.paint(114, ry - 4, 58, 20, OUTLINE); c.paint(116, ry, 54, 12, fill); }
  // the climber: a body with an outline, and a glove on the left rail
  c.paint(20, 30, 70, 140, OUTLINE); c.paint(26, 36, 58, 128, CREAM);
  c.paint(84, 90, 40, 26, OUTLINE); c.paint(88, 94, 32, 18, GLOVE);
  return c;
}

for (const kind of ['orange', 'grey']) {
  test(`eraseLadder (${kind}): the ladder goes, the climber and his hand stay`, () => {
    const c = climberWithLadder(kind);
    const before = c.data.slice();
    const erased = eraseLadder(c.data, c.w, c.h, { kind, from: [[104, 0]] });
    assert.ok(erased > 1000, `erased ${erased} pixels`);
    // the far rail and every rung end are gone, outline included
    for (let y = 0; y < c.h; y++) for (let x = 136; x < c.w; x++) assert.equal(c.alpha(x, y), 0, `pixel ${x},${y} should be gone`);
    // the climber is untouched: every pixel left of the ladder area keeps its colour and alpha
    for (let y = 0; y < c.h; y++) for (let x = 0; x < 104; x++) for (let i = 0; i < 4; i++) assert.equal(c.data[(y * c.w + x) * 4 + i], before[(y * c.w + x) * 4 + i], `climber pixel ${x},${y}`);
    // the glove that reaches over the left rail is still there, with its outline
    assert.deepEqual(c.rgb(100, 100), GLOVE);
    assert.equal(c.alpha(116, 100), 255, 'the outline of the glove stays');
    // nothing that looks like the ladder is left
    for (let y = 0; y < c.h; y++) for (let x = 104; x < c.w; x++) {
      if (!c.alpha(x, y)) continue;
      const [r, g, b] = c.rgb(x, y);
      const [h, s] = hsv(r, g, b);
      assert.ok(!(kind === 'orange' ? h >= 12 && h <= 50 && s >= 0.8 : s <= 0.2), `ladder-coloured pixel left at ${x},${y}: ${[r, g, b]}`);
    }
  });
}

test('eraseLadder: a bright speck on a rail does not keep the rail outline alive', () => {
  const c = climberWithLadder('grey');
  c.paint(166, 30, 3, 3, [255, 245, 235]); // a tiny bright highlight on the far rail
  eraseLadder(c.data, c.w, c.h, { kind: 'grey', from: [[104, 0]] });
  for (let y = 0; y < c.h; y++) for (let x = 136; x < c.w; x++) assert.equal(c.alpha(x, y), 0);
});

test('eraseLadder: a second corner clears the rail that hangs below the climber', () => {
  const c = climberWithLadder('orange');
  c.paint(0, 0, 200, 200, [0, 0, 0]); // start again with a clear cell
  for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) c.data[(y * 200 + x) * 4 + 3] = 0;
  c.paint(20, 20, 60, 120, OUTLINE); c.paint(26, 26, 48, 108, CREAM); // the climber stops at y = 140
  c.paint(66, 130, 28, 70, OUTLINE); c.paint(72, 134, 16, 64, ORANGE); // a rail below him, left of the main ladder area
  eraseLadder(c.data, 200, 200, { kind: 'orange', from: [[104, 0], [60, 150]] });
  for (let y = 150; y < 200; y++) for (let x = 60; x < 120; x++) assert.equal(c.alpha(x, y), 0, `${x},${y}`);
  assert.deepEqual(c.rgb(40, 60), CREAM);
});

test('the frames that are cleaned are exactly the frames the game climbs with', () => {
  assert.deepEqual(Object.keys(BAKED_LADDERS.crewEva.frames).map(Number), [...CLIMB_FRAMES.crewEva]);
  assert.deepEqual(Object.keys(BAKED_LADDERS.crewIndoor.frames).map(Number), [...CLIMB_FRAMES.crewIndoor]);
  // the entry scene climbs with the EVA climbing frames
  const geo = entryGeometry();
  const frames = new Set();
  for (let t = ENTRY.insideUntil + 0.01; t < ENTRY.shaftBottomAt; t += 0.05) frames.add(astronautPathAt(t, geo).frame);
  assert.deepEqual([...frames].sort(), [...CLIMB_FRAMES.crewEva]);
});

test('the entry scene: he hangs on the ladder all the way down and lets go over the last 0.2 s', () => {
  const geo = entryGeometry();
  const at = (t) => astronautPathAt(t, geo);
  assert.equal(at(ENTRY.insideUntil + 0.01).grip, 1, 'he appears already on the ladder');
  assert.equal(at((ENTRY.insideUntil + ENTRY.shaftBottomAt) / 2).grip, 1);
  const g1 = at(ENTRY.shaftBottomAt - ENTRY.gripEaseS / 2).grip;
  assert.ok(g1 > 0.4 && g1 < 0.6, `half way off: ${g1}`);
  assert.ok(at(ENTRY.shaftBottomAt - 0.001).grip < 0.01);
  for (const t of [28.5, 29.5, 31.0, 34.0, 35.5, 39]) assert.equal(at(t).grip, undefined, `no grip at ${t} s`);
  // nothing else about the path changed: he still climbs straight down the middle of the shaft
  assert.equal(at((ENTRY.insideUntil + ENTRY.shaftBottomAt) / 2).x, SHAFT_X);
});

test('the ladder constants sit inside the shaft', () => {
  const half = LAYOUT.shaftWidth / 2;
  assert.ok(LADDER.rail > 0 && LADDER.rail < half, 'the rails are inside the shaft');
  assert.ok(LADDER.gripX > SHAFT_X + LADDER.rail - 4, 'the hands reach at least to the right rail');
  assert.ok(LADDER.gripX < SHAFT_X + half, 'and not through the wall');
  assert.ok(LADDER.easeMs > 0 && LADDER.easeMs < 400);
});
