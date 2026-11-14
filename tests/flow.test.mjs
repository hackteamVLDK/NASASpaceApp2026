// Keeps src/flow/ equal to SCENARIO.md (sections 2-6). The scenario file is parsed, not copied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FLOW_STATES, INTRO_TEXT, INTRO_SCHEDULE, INTRO_CHAR_INTERVAL, CUTSCENE, TUTORIAL_STEP_1,
  flowStateAt, gameStateAt, introTextAt, cameraYAt, landerAt, shakeAt, droneLedOn,
  openingFrameAt, cuesBetween, skipTarget,
} from '../src/flow/intro.js';
import { ASTRA, createGuide, say, dismiss, guideProps, astraLineFor, hearEvents } from '../src/flow/astra.js';
import {
  WIRE_COLORS, createDroneRepair, wipe, connectWire, isRepaired, repairProgress, panelClean,
} from '../src/flow/drone-repair.js';

const scenario = readFileSync(new URL('../SCENARIO.md', import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('state machine uses the states named in SCENARIO.md', () => {
  assert.deepEqual(FLOW_STATES, ['INTRO_TEXT', 'DESCENT', 'TOUCHDOWN', 'UNDERGROUND_PAN', 'TUTORIAL_HANDOFF']);
  assert.ok(scenario.includes(FLOW_STATES.join('` -> `')));
  const at = [0, 9.99, 10, 13.99, 14, 17.49, 17.5, 23.99, 24, 100].map(flowStateAt);
  assert.deepEqual(at, ['INTRO_TEXT', 'INTRO_TEXT', 'DESCENT', 'DESCENT', 'TOUCHDOWN', 'TOUCHDOWN', 'UNDERGROUND_PAN', 'UNDERGROUND_PAN', 'TUTORIAL_HANDOFF', 'TUTORIAL_HANDOFF']);
  assert.equal(gameStateAt(15), 'CUTSCENE_LANDING');
  assert.equal(gameStateAt(24), 'TUTORIAL_STEP_1');
});

test('intro lines match SCENARIO.md word for word, with the stated pauses', () => {
  for (const line of INTRO_TEXT.lines) assert.ok(scenario.includes(line.text), `missing in scenario: ${line.text}`);
  assert.deepEqual(INTRO_TEXT.lines.map((l) => l.pauseAfter), [0.8, 1.0, 1.0, 1.2, 0]);
  assert.equal(INTRO_TEXT.lines.filter((l) => l.highlight).length, 1);
  assert.equal(INTRO_TEXT.highlightColor, '#FF6B35');
  assert.equal(INTRO_TEXT.background, '#05070A');
  assert.equal(INTRO_TEXT.skipLabel, 'Skip >>');
});

test('the whole text intro finishes before 10.0 s and never overlaps itself', () => {
  assert.ok(INTRO_CHAR_INTERVAL > 0);
  const last = INTRO_SCHEDULE.at(-1);
  assert.ok(last.end <= 10.0 + 1e-9);
  near(last.end + INTRO_TEXT.finalHold, 10.0);
  for (let i = 1; i < INTRO_SCHEDULE.length; i++) {
    near(INTRO_SCHEDULE[i].start - INTRO_SCHEDULE[i - 1].end, INTRO_TEXT.lines[i - 1].pauseAfter);
  }
  assert.equal(introTextAt(0).lines[0].shown, 0);
  assert.equal(introTextAt(9.99).complete, true);
  const mid = introTextAt(INTRO_SCHEDULE[1].start + 5 * INTRO_CHAR_INTERVAL);
  assert.equal(mid.lines[0].visible, INTRO_TEXT.lines[0].text);
  assert.equal(mid.lines[1].shown, 5);
  assert.equal(mid.lines[2].shown, 0);
});

test('cutscene numbers match SCENARIO.md section 4', () => {
  assert.deepEqual(CUTSCENE.phases.map((p) => [p.from, p.to]), [[10, 14], [14, 17.5], [17.5, 24]]);
  assert.equal(CUTSCENE.camera.skyY, 400);
  assert.equal(CUTSCENE.camera.surfaceY, 850);
  assert.equal(CUTSCENE.camera.baseY, 2100);
  assert.equal(CUTSCENE.lander.startY, -150);
  assert.equal(CUTSCENE.lander.parachuteY, 650);
  assert.equal(CUTSCENE.lander.touchdownY, 1050);
  assert.equal(CUTSCENE.lander.parachuteDetachAt, 13.2);
  assert.equal(CUTSCENE.lander.thrusters, 4);
  assert.equal(CUTSCENE.lander.touchdownAt, 16.0);
  assert.deepEqual([CUTSCENE.shake.amplitudePx, CUTSCENE.shake.duration], [4, 0.3]);
  assert.equal(CUTSCENE.astronaut.exitsAirlockAt, 20.0);
  assert.equal(CUTSCENE.drone.blinkFrom, 22.0);
  assert.equal(CUTSCENE.drone.blinkHz, 1);
  assert.equal(CUTSCENE.astraPopup, false);
});

test('camera, lander and shake follow the timeline', () => {
  assert.equal(cameraYAt(10), 400);
  assert.equal(cameraYAt(13.9), 400);
  near(cameraYAt(16), 850);
  near(cameraYAt(17.5), 850);
  assert.equal(cameraYAt(22), 2100);
  assert.equal(cameraYAt(30), 2100);
  let prev = cameraYAt(17.5);
  for (let t = 17.6; t <= 22; t += 0.1) { const y = cameraYAt(t); assert.ok(y >= prev - 1e-9); prev = y; }

  assert.equal(landerAt(5).visible, false);
  near(landerAt(10).y, -150);
  near(landerAt(14).y, 650);
  near(landerAt(16).y, 1050);
  assert.equal(landerAt(13.1).parachute, 'attached');
  assert.equal(landerAt(13.2).parachute, 'drifting-left');
  assert.equal(landerAt(14.5).thrusters, true);
  assert.equal(landerAt(16).landed, true);

  assert.deepEqual(shakeAt(15.9), { x: 0, y: 0 });
  assert.deepEqual(shakeAt(16.3), { x: 0, y: 0 });
  for (let t = 16; t < 16.3; t += 0.01) {
    const s = shakeAt(t);
    assert.ok(Math.abs(s.x) <= 4 && Math.abs(s.y) <= 4);
  }
});

test('Drone #01 blinks red at 1 Hz from 22.0 s', () => {
  assert.equal(droneLedOn(21.9), false);
  assert.equal(droneLedOn(22.0), true);
  assert.equal(droneLedOn(22.6), false);
  assert.equal(droneLedOn(23.0), true);
});

test('opening frames and cues are consistent', () => {
  const f = openingFrameAt(24);
  assert.equal(f.gameState, 'TUTORIAL_STEP_1');
  assert.equal(f.astraOpen, true);
  assert.equal(openingFrameAt(23.9).astraOpen, false);
  assert.equal(openingFrameAt(5).text !== null, true);
  assert.equal(openingFrameAt(12).text, null);

  const cues = cuesBetween(9.99, 24.0);
  const ids = cues.filter((c) => c.type === 'sfx').map((c) => c.id);
  for (const id of ['wind-hum', 'parachute-deploy', 'retro-rocket-roar', 'landing-thud', 'airlock-hiss', 'astra-chime']) assert.ok(ids.includes(id), id);
  assert.ok(cues.some((c) => c.type === 'state' && c.flowState === 'TUTORIAL_HANDOFF'));
  assert.ok(cuesBetween(0, 10).some((c) => c.id === 'bass-boom'));
  assert.ok(cuesBetween(0, 10).filter((c) => c.id === 'type-blip').length > 100);
  // a cue never fires twice across consecutive frames
  const once = cuesBetween(0, 24).length;
  let split = 0;
  for (let t = 0; t < 24; t += 0.25) split += cuesBetween(t, Math.min(24, t + 0.25)).length;
  assert.equal(split, once);

  assert.equal(skipTarget(3), 10);
  assert.equal(skipTarget(15), 24);
  assert.equal(skipTarget(30), 30);
});

test('tutorial dialogue and hand-off match SCENARIO.md section 5', () => {
  const plain = (s) => s.replaceAll('**', '');
  const dialogue = scenario.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, '').trim()).filter(Boolean).map(plain);
  assert.deepEqual(TUTORIAL_STEP_1.astra.dialogue.map(plain), dialogue.map((s) => s.replace(/^"/, '').replace(/"$/, '')));
  assert.equal(TUTORIAL_STEP_1.astra.leftPx, 24);
  assert.equal(TUTORIAL_STEP_1.dimAllModulesExcept, 'drone-01');
  assert.equal(TUTORIAL_STEP_1.marker.icon, 'wrench');
  assert.equal(TUTORIAL_STEP_1.action.opens, 'DroneRepairMiniGame');
});

test('ASTRA panel contract matches SCENARIO.md', () => {
  assert.equal(ASTRA.badge, 'ASTRA 6.7 // STATION AI');
  assert.deepEqual(ASTRA.props, ['isOpen', 'message', 'mood', 'onClose']);
  assert.equal(ASTRA.panel.widthPx, 360);
  assert.equal(ASTRA.panel.leftPx, 24);
  assert.equal(ASTRA.panel.bottomPx, 24);

  const g = createGuide();
  assert.equal(guideProps(g).isOpen, false);
  say(g, { id: 'a', message: 'First', mood: 'cheerful' });
  say(g, { id: 'b', message: 'Second', mood: 'nonsense' });
  assert.deepEqual(Object.keys(guideProps(g)), ASTRA.props);
  assert.equal(guideProps(g).message, 'First');
  dismiss(g);
  assert.equal(guideProps(g).message, 'Second');
  assert.equal(guideProps(g).mood, 'calm'); // unknown mood falls back
  dismiss(g);
  assert.equal(guideProps(g).isOpen, false);
});

test('ASTRA does not repeat once-only lines and answers simulation events', () => {
  const g = createGuide();
  const events = [{ type: 'module-built', module: 'garage' }, { type: 'module-built', module: 'garage' }];
  hearEvents(g, events);
  assert.equal(g.queue.length + (g.current ? 1 : 0), 1);
  assert.equal(astraLineFor({ type: 'unknown-event' }), null);
  assert.equal(astraLineFor(undefined), null);
  assert.equal(astraLineFor({ type: 'storm-warning', storm: 's1' }).mood, 'alert');
  const line = astraLineFor({ type: 'module-built', module: 'constructor' }); // inherited key must not crash
  assert.ok(line.message.length > 0);
  assert.ok(!/deadly/i.test(astraLineFor({ type: 'storm-warning', storm: 's1' }).message));
});

test('drone repair: wipe the panel, plug two wires, drone is repaired', () => {
  assert.equal(WIRE_COLORS.length, 2);
  const game = createDroneRepair();
  assert.equal(isRepaired(game), false);
  assert.equal(repairProgress(game), 0);

  wipe(game, 0.5);
  wipe(game, -1); // ignored
  assert.equal(panelClean(game), false);
  wipe(game, 0.5);
  assert.equal(panelClean(game), true);
  assert.equal(isRepaired(game), false);

  const [first, second] = game.sockets.map((s) => s.color);
  const wrong = WIRE_COLORS.find((c) => c !== first);
  assert.equal(connectWire(game, wrong, 0), false); // wrong plug does not stick
  assert.equal(game.wrongTries, 1);
  assert.equal(connectWire(game, first, 0), true);
  assert.equal(connectWire(game, first, 0), false); // already connected
  assert.equal(isRepaired(game), false);
  assert.equal(connectWire(game, second, 1), true);
  assert.equal(isRepaired(game), true);
  assert.equal(repairProgress(game), 1);
});

test('drone repair rejects a bad socket order', () => {
  assert.throws(() => createDroneRepair({ socketOrder: ['orange', 'orange'] }));
});
