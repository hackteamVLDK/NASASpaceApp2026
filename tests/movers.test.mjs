// Bodies move through the base by the shaft: never diagonally through floors and walls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT } from '../src/campaign/data.js';
import { SHAFT_X, GROUND_Y, floorFeetY, route, createMover, setGoal, advance, arrived, onSurface, roverPose, place } from '../src/render/movers.js';
import { roomRect, anchor } from '../src/render/campaign-world.js';

const run = (m, seconds, opts) => { for (let i = 0; i < seconds * 60; i++) advance(m, 1000 / 60, opts); return m; };

test('floor heights match the rooms of the layout', () => {
  for (const [id, r] of Object.entries(LAYOUT.rooms)) {
    const rect = roomRect(id);
    assert.equal(floorFeetY(r.floor), rect.y + rect.h - 16, id);
    assert.equal(anchor(id, 1).y, floorFeetY(r.floor));
  }
  assert.equal(anchor('outside', 1).y, GROUND_Y);
});

test('same floor: straight along the floor, across the shaft if needed', () => {
  const a = { x: 600, y: floorFeetY(1) };
  const b = { x: 1320, y: floorFeetY(1) };
  assert.deepEqual(route(a, b), [{ x: 1320, y: floorFeetY(1) }]);
});

test('another floor: sideways to the shaft, up or down the shaft, then into the room', () => {
  const a = { x: 600, y: floorFeetY(1) }; // Bedroom
  const b = { x: 1320, y: floorFeetY(5) }; // Greenhouse
  assert.deepEqual(route(a, b), [{ x: SHAFT_X, y: floorFeetY(1) }, { x: SHAFT_X, y: floorFeetY(5) }, { x: 1320, y: floorFeetY(5) }]);
});

test('a walk never leaves a floor line except inside the shaft', () => {
  const places = ['bedroom', 'kitchen', 'lifesupport', 'workshop', 'lab', 'battery', 'garage', 'greenhouse', 'recreation', 'outside'];
  for (const from of places) {
    for (const to of places) {
      const m = createMover(anchor(from, 1));
      setGoal(m, anchor(to, 1));
      let guard = 0;
      while (m.path.length && guard++ < 20000) {
        advance(m, 16);
        const onAFloor = [...Object.values(LAYOUT.rooms).map((r) => floorFeetY(r.floor)), GROUND_Y].some((y) => Math.abs(m.pos.y - y) < 0.5);
        assert.ok(onAFloor || Math.abs(m.pos.x - SHAFT_X) < 0.5, `${from} -> ${to}: left the floor outside the shaft at (${m.pos.x | 0}, ${m.pos.y | 0})`);
      }
      assert.deepEqual(m.pos, anchor(to, 1), `${from} -> ${to}: arrives`);
      assert.ok(arrived(m) || !m.path.length);
    }
  }
});

test('climbing is flagged only in the shaft, walking elsewhere', () => {
  const m = createMover({ x: 600, y: floorFeetY(1) });
  setGoal(m, { x: 1320, y: floorFeetY(3) });
  const seen = new Set();
  let guard = 0;
  while (m.path.length && guard++ < 5000) { advance(m, 16); seen.add(m.climbing ? 'climb' : 'walk'); if (m.climbing) assert.equal(m.pos.x, SHAFT_X); }
  assert.deepEqual([...seen].sort(), ['climb', 'walk']);
});

test('a new goal in mid-climb re-plans from where the body is', () => {
  const m = createMover({ x: SHAFT_X, y: floorFeetY(1) });
  setGoal(m, { x: 1320, y: floorFeetY(5) });
  run(m, 1.2);
  assert.ok(m.pos.y > floorFeetY(1) && m.pos.y < floorFeetY(5), 'part of the way down the shaft');
  const mid = { ...m.pos };
  setGoal(m, { x: 600, y: floorFeetY(1) });
  assert.deepEqual(m.path[0], { x: SHAFT_X, y: floorFeetY(1) }, 'turns around inside the shaft');
  run(m, 6);
  assert.deepEqual(m.pos, { x: 600, y: floorFeetY(1) });
  assert.ok(mid.y > floorFeetY(1));
});

test('the same goal does not restart the walk; no goal makes the body disappear', () => {
  const m = createMover({ x: 600, y: floorFeetY(1) });
  setGoal(m, { x: 1320, y: floorFeetY(1) });
  advance(m, 200);
  const x = m.pos.x;
  setGoal(m, { x: 1320, y: floorFeetY(1) });
  assert.equal(m.pos.x, x);
  assert.equal(m.path.length, 1);
  setGoal(m, null);
  assert.equal(m.pos, null);
  setGoal(m, { x: 700, y: floorFeetY(2) });
  assert.deepEqual(m.pos, { x: 700, y: floorFeetY(2) }, 'a body with no position appears at its goal');
});

test('pace makes bodies arrive sooner; frame time never makes them overshoot', () => {
  const slow = createMover({ x: 600, y: floorFeetY(1) });
  const fast = createMover({ x: 600, y: floorFeetY(1) });
  setGoal(slow, { x: 1300, y: floorFeetY(1) }); setGoal(fast, { x: 1300, y: floorFeetY(1) });
  advance(slow, 500); advance(fast, 500, { pace: 3 });
  assert.ok(fast.pos.x > slow.pos.x);
  advance(fast, 100000);
  assert.equal(fast.pos.x, 1300);
});

test('EVA suit only on the surface', () => {
  assert.equal(onSurface({ x: 400, y: GROUND_Y }), true);
  assert.equal(onSurface({ x: SHAFT_X, y: floorFeetY(1) }), false);
  assert.equal(onSurface(null), false);
  const m = place(createMover(), { x: 1, y: 2 });
  assert.deepEqual(m.pos, { x: 1, y: 2 });
});

test('the Rover drives out to the right, fading, and comes back from the right', () => {
  const parked = roverPose('parked');
  assert.equal(parked.visible, true);
  assert.equal(roverPose('out', 0).x, parked.x);
  assert.ok(roverPose('out', 0.5).x > parked.x);
  assert.equal(roverPose('out', 1).visible, false);
  assert.ok(roverPose('out', 0.95).alpha < 0.3);
  assert.ok(roverPose('in', 0.3).x > parked.x);
  assert.equal(roverPose('in', 1).x, parked.x);
  assert.equal(roverPose('gone').visible, false);
});
