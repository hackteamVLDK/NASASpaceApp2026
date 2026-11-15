// The entry scene: the astronaut walks to the dome, climbs down the shaft and steps into the Bedroom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setStrings } from '../src/flow/strings.js';
import { ENTRY, CUTSCENE, GAMEPLAY_VIEW, astronautPathAt, entryDoorsAt, cameraXAt, cameraYAt, cameraZoomAt, openingFrameAt, SFX_CUES } from '../src/flow/intro.js';
import { entryGeometry, anchor, GROUND_Y, SHAFT_X, feetY } from '../src/render/geometry.js';

setStrings(JSON.parse(readFileSync(new URL('../content/data/strings.en.json', import.meta.url), 'utf8')));
const geo = entryGeometry();
const at = (t) => astronautPathAt(t, geo);

test('SCENARIO fixed times are kept: touchdown 28.0 s, exit from the shaft 33.5 s, helmet 35.0 s', () => {
  assert.equal(CUTSCENE.lander.touchdownAt, 28.0);
  assert.equal(ENTRY.exitsShaftAt, 33.5);
  assert.equal(ENTRY.helmetOffAt, 35.0);
  assert.ok(ENTRY.leavesLanderAt >= 28.0, 'nobody leaves the lander before it lands');
  assert.ok(ENTRY.atBedroomAt <= ENTRY.helmetOffAt);
});

test('he is not seen in the lander, is seen walking, is hidden in the airlock, and is seen again in the shaft', () => {
  assert.equal(at(24).visible, false);
  assert.equal(at(28.1).visible, false);
  assert.equal(at(28.3).visible, true);
  assert.equal(at(29.5).phase, 'walks to the dome');
  assert.equal(at(30.8).phase, 'at the hatch');
  assert.equal(at(31.3).visible, false, 'the airlock cycles');
  assert.equal(at(32.2).phase, 'climbs down');
  assert.equal(at(32.2).x, SHAFT_X, 'only in the shaft');
});

test('the path is continuous and never faster than a walk (480 units/s) or a climb (320 units/s)', () => {
  let prev = null;
  for (let t = 28.0; t <= 39.0; t += 0.01) {
    const p = at(t);
    if (p.visible && prev?.visible) {
      const d = Math.hypot(p.x - prev.x, p.y - prev.y);
      const climbing = p.phase === 'climbs down';
      assert.ok(d <= (climbing ? 320 : 480) * 0.01 + 1e-6, `t ${t.toFixed(2)}: moved ${d.toFixed(2)} units in 10 ms (${p.phase})`);
    }
    prev = p;
  }
});

test('the hatch is where he stops and where the climb starts; the climb ends on the Bedroom floor', () => {
  const stop = at(30.7);
  assert.deepEqual([stop.x, stop.y], [SHAFT_X, GROUND_Y]);
  const top = at(ENTRY.insideUntil + 0.001);
  assert.ok(Math.abs(top.x - SHAFT_X) < 1e-6 && Math.abs(top.y - GROUND_Y) < 2);
  const bottom = at(ENTRY.shaftBottomAt - 0.001);
  assert.ok(Math.abs(bottom.y - feetY('bedroom')) < 2);
});

test('he leaves the shaft into the left wing at 33.5 s and stands in the Bedroom with the helmet on', () => {
  assert.ok(at(33.5).x <= SHAFT_X && at(33.5).y === feetY('bedroom'));
  assert.ok(at(34.3).x < 900, 'in the left wing');
  const stand = anchor('bedroom', 1);
  assert.deepEqual([at(34.99).x, at(34.99).y], [stand.x, stand.y]);
  assert.equal(at(34.99).phase, 'stands, helmet on');
});

test('the helmet comes off at 35.0 s: lifting, holding, then standing; the suit changes to the indoor sprite', () => {
  assert.deepEqual([at(35.3).sheet, at(35.3).frame], ['crewIndoor', 22]);
  assert.deepEqual([at(36.2).sheet, at(36.2).frame], ['crewIndoor', 23]);
  assert.equal(at(37).phase, 'stands');
  assert.equal(at(33.5).sheet, 'crewEva');
});

test('where the scene ends is where the tutorial begins: the Commander stands at the Bedroom anchor at 39.0 s', () => {
  const end = at(39.0);
  const stand = anchor('bedroom', 1);
  assert.deepEqual([end.x, end.y], [stand.x, stand.y]);
  assert.equal(end.visible, true);
});

test('it is a pure function of time: asking in any order, or twice, gives the same answer', () => {
  const times = [36.3, 25.5, 29.2, 32.2, 26.1, 39, 28, 25.5];
  const first = times.map(at);
  const again = [...times].reverse().map(at).reverse();
  assert.deepEqual(again, first);
});

test('the dome hatch is open from the airlock hiss (29.2 s) until the astronaut is inside', () => {
  const hiss = SFX_CUES.find((c) => c.id === 'airlock-hiss').at;
  assert.equal(hiss, 29.2);
  assert.equal(entryDoorsAt(29.19).airlockOpen, false);
  assert.equal(entryDoorsAt(29.2).airlockOpen, true);
  assert.equal(entryDoorsAt(31.0).airlockOpen, true);
  assert.equal(entryDoorsAt(ENTRY.hatchClosesAt).airlockOpen, false);
  assert.equal(entryDoorsAt(34).airlockOpen, false, 'closed while he is underground');
});

test('the camera slides sideways to the middle of the whole base while it pans down', () => {
  assert.equal(cameraXAt(20), 960);
  assert.equal(cameraXAt(30.0), 960);
  assert.equal(cameraXAt(36.3), GAMEPLAY_VIEW.centerX);
  assert.equal(cameraXAt(40), GAMEPLAY_VIEW.centerX);
  let prev = 960;
  for (let t = 30.0; t <= 36.3; t += 0.1) { const x = cameraXAt(t); assert.ok(x >= prev - 1e-9); prev = x; }
  assert.equal(cameraYAt(36.3), GAMEPLAY_VIEW.centerY);
  assert.equal(cameraZoomAt(39), GAMEPLAY_VIEW.zoom);
  assert.equal(openingFrameAt(30).cameraX, cameraXAt(30));
});
