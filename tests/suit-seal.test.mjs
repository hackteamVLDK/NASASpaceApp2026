// A37: the Spacesuit Radiation & Pressure Seal Check (SCENARIO 4.8): random seals, the badge, the liner, the pressure gauge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEALS, STAGE, PRESSURE, createSuit, steps, complete, nextStep, onSuit, pressureAt, verdictFor, pointerDown, pointerMove, pointerUp,
} from '../src/ui/suit-seal.js';

/** A tiny seeded generator, so a game can be replayed. */
const seeded = (seed) => { let s = (seed * 2654435761) % 4294967296; const next = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; for (let i = 0; i < 5; i++) next(); return next; };
const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const sealAll = (g) => g.leaks.forEach((l) => pointerDown(g, { x: l.x, y: l.y }, 0));
const dragTo = (g, item, to) => { pointerDown(g, { x: item.x, y: item.y }, 0); pointerMove(g, to); return pointerUp(g, to, 0); };

test('3 leaks at random seals: distinct, from the six seals, the same for the same seed', () => {
  const a = createSuit({ rand: seeded(7) });
  assert.equal(a.leaks.length, 3);
  assert.equal(new Set(a.leaks.map((l) => l.id)).size, 3);
  for (const l of a.leaks) assert.ok(SEALS[l.id], l.id);
  assert.deepEqual(createSuit({ rand: seeded(7) }).leaks.map((l) => l.id), a.leaks.map((l) => l.id));
  const seen = new Set();
  for (let s = 1; s <= 40; s++) createSuit({ rand: seeded(s) }).leaks.forEach((l) => seen.add(l.id));
  assert.equal(seen.size, Object.keys(SEALS).length, 'over many games every seal gets its turn');
  assert.equal(createSuit({ leaks: 2 }).leaks.length, 2, 'a Pilot would have 2');
  assert.equal(createSuit({ leaks: 4 }).leaks.length, 4, 'a Botanist would have 4');
  assert.equal(createSuit({ leaks: 99 }).leaks.length, Object.keys(SEALS).length);
});

test('every seal is on the suit, and one tap seals at most one leak', () => {
  for (const [id, s] of Object.entries(SEALS)) {
    assert.ok(s.x > 380 && s.x < 720 && s.y > 80 && s.y < 600, `${id} is on the suit`);
  }
  const g = createSuit({ rand: seeded(3), leaks: 6 });
  const l = g.leaks[0];
  assert.equal(pointerDown(g, { x: l.x, y: l.y }, 0), 'clamp');
  assert.equal(g.leaks.filter((x) => x.sealed).length, 1, 'only the leak that was tapped');
  assert.equal(pointerDown(g, { x: l.x, y: l.y }, 0), null, 'a sealed leak is not tapped again');
});

test('a tap that misses every puff does nothing; a tap near a puff seals it', () => {
  const g = createSuit({ rand: seeded(1) });
  assert.equal(pointerDown(g, { x: 5, y: 5 }, 0), null);
  const l = g.leaks[0];
  assert.equal(pointerDown(g, { x: l.x + STAGE.leakHit - 2, y: l.y }, 0), 'clamp');
});

test('the badge: grab it, drop it anywhere on the suit and it sits on the chest; drop it elsewhere and it goes back', () => {
  const g = createSuit({ rand: seeded(2) });
  const home = { ...g.badge.home };
  assert.deepEqual(dragTo(g, g.badge, { x: 100, y: 500 }), { kind: 'back' });
  assert.deepEqual([g.badge.x, g.badge.y, g.badge.on], [home.x, home.y, false]);
  assert.equal(pointerDown(g, { x: home.x, y: home.y }, 0), 'grab');
  pointerMove(g, { x: 560, y: 410 });
  assert.deepEqual([g.badge.x, g.badge.y], [560, 410], 'it follows the pointer');
  assert.deepEqual(pointerUp(g, { x: 560, y: 410 }, 0), { kind: 'badge' });
  assert.deepEqual([g.badge.on, g.badge.x, g.badge.y], [true, STAGE.chest.x, STAGE.chest.y]);
  assert.equal(pointerDown(g, { x: STAGE.chest.x, y: STAGE.chest.y }, 0), null, 'a badge that is on stays on');
  // the visor, the belly, the arms, the chest and the boots all count as "on the suit"
  for (const p of [{ x: 550, y: 150 }, { x: 550, y: 330 }, { x: 449, y: 300 }, { x: 651, y: 260 }, { x: 513, y: 560 }]) assert.ok(onSuit(p), JSON.stringify(p));
  for (const p of [{ x: 100, y: 100 }, { x: 900, y: 300 }, { x: 550, y: 610 }, { x: 380, y: 330 }]) assert.ok(!onSuit(p), JSON.stringify(p));
});

test('the liner shows up only when it is crafted, and then it is one more step', () => {
  const plain = createSuit({ rand: seeded(4) });
  assert.equal(plain.liner, null);
  assert.deepEqual(steps(plain).map((s) => s.id), ['leaks', 'badge', 'pressure']);
  const g = createSuit({ rand: seeded(4), liner: true });
  assert.deepEqual(steps(g).map((s) => s.id), ['leaks', 'badge', 'liner', 'pressure']);
  sealAll(g);
  dragTo(g, g.badge, { x: 550, y: 300 });
  g.hold = 0;
  pointerUp(g, { x: 0, y: 0 }, PRESSURE.sweepMs * 0.7); // the gauge is green
  assert.equal(g.pressed, true);
  assert.equal(complete(g), false, 'the liner is still missing');
  assert.deepEqual(dragTo(g, g.liner, { x: 560, y: 320 }), { kind: 'liner' });
  assert.equal(complete(g), true);
});

test('PRESSURIZE waits for the leaks; then the needle moves while the button is held', () => {
  const g = createSuit({ rand: seeded(5) });
  const btn = center(STAGE.button);
  assert.equal(pointerDown(g, btn, 100), 'locked');
  assert.equal(g.hold, null, 'nothing is held while a leak is open');
  sealAll(g);
  assert.equal(pointerDown(g, btn, 100), 'press');
  assert.equal(pressureAt(g, 100), 0);
  assert.equal(pressureAt(g, 100 + PRESSURE.sweepMs / 2), 0.5);
  assert.equal(pressureAt(g, 100 + PRESSURE.sweepMs * 3), 1, 'the needle stops at the end');
  assert.equal(pressureAt(createSuit(), 5000), 0, 'not held: it rests at 0');
});

test('the gauge: too early is low, the green band is good, too late is high; a quick tap is low', () => {
  const press = (heldMs) => { const g = createSuit({ rand: seeded(6) }); sealAll(g); pointerDown(g, center(STAGE.button), 1000); return { g, r: pointerUp(g, { x: 0, y: 0 }, 1000 + heldMs) }; };
  assert.equal(press(PRESSURE.sweepMs * 0.3).r.verdict, 'low');
  assert.equal(press(PRESSURE.sweepMs * 0.7).r.verdict, 'good');
  assert.equal(press(PRESSURE.sweepMs * 0.95).r.verdict, 'high');
  const quick = press(60);
  assert.equal(quick.r.verdict, 'low');
  assert.equal(quick.g.pressed, false);
  const good = press(PRESSURE.sweepMs * 0.7);
  assert.equal(good.g.pressed, true);
  assert.equal(good.g.hold, null, 'the button is let go');
  // a miss does not undo a hit that already happened
  pointerDown(good.g, center(STAGE.button), 5000);
  pointerUp(good.g, { x: 0, y: 0 }, 5000 + 100);
  assert.equal(good.g.pressed, true);
  // the band edges
  assert.equal(verdictFor(PRESSURE.from - 0.001), 'low');
  assert.equal(verdictFor(PRESSURE.from), 'good');
  assert.equal(verdictFor(PRESSURE.to), 'good');
  assert.equal(verdictFor(PRESSURE.to + 0.001), 'high');
});

test('the green band is wide enough for a child: at least half a second to let go in', () => {
  const windowMs = (PRESSURE.to - PRESSURE.from) * PRESSURE.sweepMs;
  assert.ok(windowMs >= 500, `${Math.round(windowMs)} ms`);
  assert.ok(PRESSURE.sweepMs * PRESSURE.to < 2500, 'and the needle gets there quickly');
});

test('the whole check, in order, ends in a win; the next step always points at something', () => {
  const g = createSuit({ rand: seeded(9), liner: true });
  const order = [];
  while (nextStep(g)) {
    const n = nextStep(g);
    order.push(n.kind);
    if (n.kind === 'leak') pointerDown(g, n, 0);
    else if (n.kind === 'badge') dragTo(g, g.badge, { x: 550, y: 300 });
    else if (n.kind === 'liner') dragTo(g, g.liner, { x: 550, y: 300 });
    else { pointerDown(g, n, 0); pointerUp(g, n, PRESSURE.sweepMs * 0.7); }
    assert.ok(order.length < 12, 'it must finish');
  }
  assert.deepEqual(order, ['leak', 'leak', 'leak', 'badge', 'liner', 'pressure']);
  assert.equal(complete(g), true);
  assert.ok(steps(g).every((s) => s.done));
});
