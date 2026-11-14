// Bodies move through the base by the shaft: never diagonally through floors and walls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT } from '../src/campaign/data.js';
import { SHAFT_X, GROUND_Y, floorFeetY, route, createMover, setGoal, advance, arrived, onSurface, roverPose, place, ROVER } from '../src/render/movers.js';
import { roomRect, anchor, feetY } from '../src/render/geometry.js';

const run = (m, seconds, opts) => { for (let i = 0; i < seconds * 60; i++) advance(m, 1000 / 60, opts); return m; };
const ROOMS = Object.keys(LAYOUT.rooms);

test('floor heights match the rooms of the layout; the Garage stands on the ground', () => {
  for (const id of ROOMS) {
    const rect = roomRect(id);
    assert.equal(feetY(id), LAYOUT.rooms[id].wing === 'surface' ? GROUND_Y : rect.y + rect.h - 16, id);
    assert.equal(anchor(id, 1).y, feetY(id));
  }
  assert.equal(anchor('outside', 1).y, GROUND_Y);
  assert.equal(LAYOUT.rooms.garage.wing, 'surface', 'SCENARIO 1: the Garage airlock is a surface structure');
});

test('same floor: straight along the floor, across the shaft if needed', () => {
  const a = { x: 600, y: floorFeetY(1) };
  const b = { x: 1320, y: floorFeetY(1) };
  assert.deepEqual(route(a, b), [{ x: 1320, y: floorFeetY(1) }]);
});

test('another floor: sideways to the shaft, up or down the shaft, then into the room', () => {
  const a = anchor('bedroom', 1); // floor 1
  const b = anchor('recreation', 1); // floor 3, right wing
  assert.deepEqual(route(a, b), [{ x: SHAFT_X, y: a.y }, { x: SHAFT_X, y: b.y }, { x: b.x, y: b.y }]);
});

test('a walk never leaves a floor line except inside the shaft, between any two places', () => {
  const places = [...ROOMS, 'outside'];
  const lines = [...ROOMS.map(feetY), GROUND_Y];
  for (const from of places) {
    for (const to of places) {
      const m = createMover(anchor(from, 1));
      setGoal(m, anchor(to, 1));
      let guard = 0;
      while (m.path.length && guard++ < 40000) {
        advance(m, 16);
        assert.ok(lines.some((y) => Math.abs(m.pos.y - y) < 0.5) || Math.abs(m.pos.x - SHAFT_X) < 0.5, `${from} -> ${to}: left the floor outside the shaft at (${m.pos.x | 0}, ${m.pos.y | 0})`);
      }
      assert.deepEqual(m.pos, anchor(to, 1), `${from} -> ${to}: arrives`);
    }
  }
});

test('climbing is flagged only in the shaft, walking elsewhere', () => {
  const m = createMover(anchor('bedroom', 1));
  setGoal(m, anchor('recreation', 1));
  const seen = new Set();
  let guard = 0;
  while (m.path.length && guard++ < 8000) { advance(m, 16); seen.add(m.climbing ? 'climb' : 'walk'); if (m.climbing) assert.equal(m.pos.x, SHAFT_X); }
  assert.deepEqual([...seen].sort(), ['climb', 'walk']);
});

test('a new goal in mid-climb re-plans from where the body is', () => {
  const m = createMover({ x: SHAFT_X, y: floorFeetY(1) });
  setGoal(m, { x: 1320, y: floorFeetY(3) });
  run(m, 1.0);
  assert.ok(m.pos.y > floorFeetY(1) && m.pos.y < floorFeetY(3), 'part of the way down the shaft');
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

test('when time is stopped a body freezes exactly: position AND the walking or climbing pose', () => {
  const m = createMover(anchor('bedroom', 1));
  setGoal(m, anchor('lab', 1));
  run(m, 0.5); // walking toward the shaft
  assert.equal(m.moving, true);
  const before = JSON.stringify(m);
  for (let i = 0; i < 100; i++) advance(m, 0); // paused: no world time passes
  assert.equal(JSON.stringify(m), before, 'nothing about the body changes while the world clock is stopped');
  const climber = createMover({ x: SHAFT_X, y: floorFeetY(1) });
  setGoal(climber, { x: SHAFT_X, y: floorFeetY(3) });
  run(climber, 0.5);
  assert.equal(climber.climbing, true);
  advance(climber, 0);
  assert.equal(climber.climbing, true, 'still climbing, not standing in mid-air');
});

test('EVA suit only on the surface', () => {
  assert.equal(onSurface({ x: 400, y: GROUND_Y }), true);
  assert.equal(onSurface({ x: SHAFT_X, y: floorFeetY(1) }), false);
  assert.equal(onSurface(null), false);
  const m = place(createMover(), { x: 1, y: 2 });
  assert.deepEqual(m.pos, { x: 1, y: 2 });
});

test('the Rover is in the surface Garage, drives out of the right edge of the screen and comes back from it', () => {
  const g = roomRect('garage');
  assert.ok(ROVER.parkX - ROVER.width / 2 >= g.x && ROVER.parkX + ROVER.width / 2 <= g.x + g.w, 'parked inside the Garage');
  assert.ok(Math.abs(ROVER.boardX - (ROVER.parkX - ROVER.width / 2)) < 40, 'the Commander boards at the door of the Rover');
  const parked = roverPose('parked');
  assert.equal(parked.visible, true);
  assert.equal(roverPose('out', 0).x, parked.x);
  assert.ok(roverPose('out', 0.5).x > parked.x);
  assert.equal(roverPose('out', 1).visible, false);
  const rightEdge = 1260 + 960 / 0.5; // gameplay view: centre x 1260, zoom 0.5
  assert.ok(ROVER.outX - ROVER.width / 2 > rightEdge, 'it leaves the screen completely before it is hidden');
  assert.ok(roverPose('in', 0.3).x > parked.x);
  assert.equal(roverPose('in', 1).x, parked.x);
  assert.equal(roverPose('boarding').visible, true, 'still parked while the Commander walks to it');
  assert.equal(roverPose('gone').visible, false);
});
