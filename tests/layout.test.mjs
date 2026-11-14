// The base is three floors deep; the Garage is on the surface; everything fits the screen and nothing overlaps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT, MODULES } from '../src/campaign/data.js';
import { GAMEPLAY_VIEW } from '../src/flow/intro.js';
import { roomRect, anchor, feetY, bedroomSpots, garageSpots, baseBottom, PERSON_H, DRONE_H, SURFACE, SHAFT_X, GROUND_Y } from '../src/render/geometry.js';
import { ROVER } from '../src/render/movers.js';

const ids = Object.keys(LAYOUT.rooms);
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const screen = (x, y) => ({ x: 960 + (x - GAMEPLAY_VIEW.centerX) * GAMEPLAY_VIEW.zoom, y: 540 + (y - GAMEPLAY_VIEW.centerY) * GAMEPLAY_VIEW.zoom });

test('three floors; nine distinct rooms; no two rooms overlap; every module has a place', () => {
  assert.equal(LAYOUT.floors, 3);
  assert.equal(ids.length, 9);
  for (const id of ids) if (LAYOUT.rooms[id].wing !== 'surface') assert.ok(LAYOUT.rooms[id].floor >= 1 && LAYOUT.rooms[id].floor <= 3, `${id} is on a floor of the base`);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) assert.equal(overlap(roomRect(ids[i]), roomRect(ids[j])), false, `${ids[i]} and ${ids[j]} overlap`);
  for (const id of Object.keys(MODULES)) if (!['solar', 'roof'].includes(id)) assert.ok(LAYOUT.rooms[id], `${id} has a place in the layout`);
});

test('the Garage & Airlock is a surface building on the ground line (SCENARIO 1: a surface structure)', () => {
  const g = roomRect('garage');
  assert.equal(g.y + g.h, LAYOUT.groundY);
  assert.equal(feetY('garage'), GROUND_Y);
  assert.ok(g.x > SURFACE.lander.x + SURFACE.lander.w / 2, 'beyond the lander, so the two do not overlap');
  assert.ok(g.x > SURFACE.antenna.x, 'and beyond the antenna');
});

test('the left wing is one room wide, the right wing two; the base is 1920 wide and 810 deep', () => {
  const underground = ids.filter((id) => LAYOUT.rooms[id].wing !== 'surface').map(roomRect);
  const x0 = Math.min(...underground.map((r) => r.x));
  const x1 = Math.max(...underground.map((r) => r.x + r.w));
  assert.deepEqual([x0, x1], [300, 2220]);
  assert.equal(baseBottom, LAYOUT.firstFloorY + 3 * LAYOUT.floorHeight);
  assert.equal(baseBottom - LAYOUT.firstFloorY, 810);
  assert.equal(SHAFT_X, 960);
});

test('the gameplay camera shows the whole base between the side panels and a surface strip under the top bar', () => {
  const left = screen(300, 0).x;
  const right = screen(2220, 0).x;
  assert.ok(left >= 470 && right <= 1452, `the base spans screen x ${left | 0} to ${right | 0}, between the left tracker (to 482) and the right panel (from 1450)`);
  const ground = screen(0, LAYOUT.groundY).y;
  assert.ok(ground - 98 >= 200, `${Math.round(ground - 98)} px of surface under the 98 px top bar`);
  assert.ok(screen(0, baseBottom).y <= 1080, 'the lowest floor is on the screen');
  // the panels start at screen y 352, below the ground line, so the Garage and the Rover on the surface are never covered
  const g = roomRect('garage');
  assert.ok(screen(g.x, g.y + g.h).y < 352);
  assert.ok(screen(g.x + g.w, 0).x <= 1920, 'the whole Garage is on the screen');
  // the camera centre is the centre of the base
  assert.equal(GAMEPLAY_VIEW.centerX, (300 + 2220) / 2);
});

test('bodies are drawn at a human size next to doors and beds (half of the first version)', () => {
  assert.equal(PERSON_H, 92);
  assert.ok(DRONE_H < PERSON_H);
  assert.ok(PERSON_H < LAYOUT.floorHeight / 2, 'a person is less than half the height of a room');
  assert.ok(ROVER.width < 2.5 * PERSON_H);
});

test('the Commander sleeps inside the Bedroom, in the lower-left bunk, and stands beside it', () => {
  const r = roomRect('bedroom');
  const { lie, stand } = bedroomSpots();
  for (const p of [lie, stand]) assert.ok(p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y <= r.y + r.h, 'inside the room');
  assert.ok(lie.x < r.x + r.w / 2, 'the left bunk bed');
  assert.ok(lie.y > r.y + r.h * 0.6, 'the lower bunk, not the upper one');
  assert.deepEqual(anchor('bedroom', 1), stand);
  assert.ok(stand.x - lie.x < 100, 'the bunk is within a few steps');
});

test('two bodies never share a place in the Garage: drones rest side by side and the Rover has its own spot', () => {
  const g = roomRect('garage');
  const { rest, park, board } = garageSpots();
  const spots = [rest(0), rest(1), rest(2)];
  for (const p of spots) assert.ok(p.x > g.x && p.x < g.x + g.w, 'inside the Garage');
  for (let i = 1; i < spots.length; i++) assert.ok(spots[i].x - spots[i - 1].x >= 80, 'a drone is about 78 units wide');
  assert.ok(board.x - spots[2].x >= 60, 'the boarding place is not on top of a resting drone');
  assert.ok(Math.abs(board.x - (park.x - ROVER.width / 2)) < 40, 'the Commander boards at the door of the Rover');
  assert.ok(park.x - ROVER.width / 2 - spots[2].x >= 45, 'the Rover does not overlap the drones (half a drone plus a gap)');
});

test('no place a body works at is inside the soil: every module is worked on from the ground or from the floor of its room', () => {
  const underground = ids.filter((id) => LAYOUT.rooms[id].wing !== 'surface');
  for (const id of Object.keys(MODULES)) {
    const a = anchor(id, 0.35); // where a drone stands to build or upgrade it
    const onGround = a.y === GROUND_Y;
    const onAFloor = underground.some((rid) => { const r = roomRect(rid); return a.x >= r.x && a.x <= r.x + r.w && Math.abs(a.y - feetY(rid)) < 0.5; });
    assert.ok(onGround || onAFloor, `${id}: a drone would stand at (${Math.round(a.x)}, ${Math.round(a.y)}), inside the soil`);
  }
  assert.equal(anchor('roof', 0.35).y, GROUND_Y, 'the Regolith Roof Layer is piled from the ground above the right wing');
  const roof = anchor('roof', 0.35);
  assert.ok(roof.x > LAYOUT.rightX && roof.x < LAYOUT.rightX + 2 * LAYOUT.roomWidth, 'above the right wing');
});
