// Keeps src/flow/ equal to SCENARIO.md (v2). The scenario file is parsed, not copied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FLOW_STATES, INTRO_TEXT, CUTSCENE, TUTORIAL, T, CRAWL_CHARS_PER_SECOND, GAMEPLAY_VIEW,
  flowStateAt, introTextAt, crawlLineEnd, cameraYAt, cameraZoomAt, landerAt, shakeAt, droneLedOn,
  openingFrameAt, cuesBetween, skipTarget,
} from '../src/flow/intro.js';
import { setStrings, t, hasString } from '../src/flow/strings.js';
import { ASTRA, createGuide, say, dismiss, guideProps, currentMessage, astraLineFor, hearEvents } from '../src/flow/astra.js';
import { createGame, applyCommand } from '../src/sim/index.js';
import { LAYOUT } from '../src/campaign/data.js';

const scenario = readFileSync(new URL('../SCENARIO.md', import.meta.url), 'utf8');
const strings = JSON.parse(readFileSync(new URL('../content/data/strings.en.json', import.meta.url), 'utf8'));
setStrings(strings);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const row = (id) => {
  const line = scenario.split(/\r?\n/).find((l) => l.startsWith(`| ${id} |`));
  assert.ok(line, `no table row for ${id} in SCENARIO.md`);
  return line.split('|').map((c) => c.trim()).slice(1, -1);
};

test('state machine uses the states named in SCENARIO.md', () => {
  assert.ok(scenario.includes(FLOW_STATES.join(' -> ')), 'state chain differs from the scenario');
  const at = [0, 18.99, 19, 22.99, 23, 26.49, 26.5, 32.99, 33, 100].map(flowStateAt);
  assert.deepEqual(at, ['INTRO_TEXT', 'INTRO_TEXT', 'DESCENT', 'DESCENT', 'TOUCHDOWN', 'TOUCHDOWN', 'UNDERGROUND_PAN', 'UNDERGROUND_PAN', 'TUT_HP', 'TUT_HP']);
  assert.deepEqual(TUTORIAL.steps.map((s) => s.state), FLOW_STATES.slice(4));
});

test('crawl lines, start times and pauses match the scenario table', () => {
  assert.equal(INTRO_TEXT.lines.length, 8);
  for (const line of INTRO_TEXT.lines) {
    const [id, textCell, start, pause] = row(line.id);
    assert.equal(t(line.id), textCell, `${id} text`);
    near(line.start, parseFloat(start));
    near(line.pauseAfter, parseFloat(pause));
  }
  assert.equal(INTRO_TEXT.lines.filter((l) => l.highlight).length, 1);
  assert.ok(INTRO_TEXT.lines.at(-1).highlight && INTRO_TEXT.lines.at(-1).bassBoom);
  assert.equal(INTRO_TEXT.highlightColor, '#FF6B35');
  assert.equal(INTRO_TEXT.background, '#05070A');
  assert.equal(CRAWL_CHARS_PER_SECOND, 37);
  assert.equal(INTRO_TEXT.skipLabel, 'Skip >>');
});

test('the crawl finishes before 19.0 s and lines never overlap', () => {
  for (let i = 0; i < INTRO_TEXT.lines.length - 1; i++) assert.ok(crawlLineEnd(i) <= INTRO_TEXT.lines[i + 1].start + 1e-9, `line ${i + 1} overlaps the next`);
  assert.ok(crawlLineEnd(7) + INTRO_TEXT.lines[7].pauseAfter <= T.introEnd + 0.2);
  assert.equal(introTextAt(0).lines[0].shown, 0);
  assert.equal(introTextAt(18.9).complete, true);
  const mid = introTextAt(1.1 + 5 / 37 + 1e-6);
  assert.equal(mid.lines[0].visible, 'YEAR 2038.');
  assert.equal(mid.lines[1].shown, 5);
  assert.equal(mid.lines[2].shown, 0);
});

test('cutscene numbers match the scenario (Section 1, landing cutscene)', () => {
  assert.deepEqual(CUTSCENE.phases.map((p) => [p.state, p.from, p.to]), [['DESCENT', 19, 23], ['TOUCHDOWN', 23, 26.5], ['UNDERGROUND_PAN', 26.5, 33]]);
  assert.equal(CUTSCENE.camera.skyY, 400);
  assert.equal(CUTSCENE.camera.surfaceY, 850);
  assert.equal(CUTSCENE.lander.startY, -150);
  assert.equal(CUTSCENE.lander.parachuteY, 650);
  assert.equal(CUTSCENE.lander.touchdownY, 1050);
  assert.equal(CUTSCENE.lander.parachuteDetachAt, 22.2);
  assert.equal(CUTSCENE.lander.thrusters, 4);
  assert.equal(CUTSCENE.lander.thrustersAt, 23.0);
  assert.equal(CUTSCENE.lander.touchdownAt, 25.0);
  assert.deepEqual([CUTSCENE.shake.amplitudePx, CUTSCENE.shake.duration], [4, 0.3]);
  assert.equal(CUTSCENE.astra.landingAt, 25.0);
  assert.equal(CUTSCENE.astra.landingLine, 'astra.intro.landing');
  assert.equal(CUTSCENE.astra.whyUndergroundLine, 'astra.intro.why_underground');
  assert.equal(CUTSCENE.astronaut.exitsShaftAt, 29.0);
  assert.equal(CUTSCENE.drone.blinkFrom, 31.0);
  assert.equal(CUTSCENE.drone.blinkHz, 1);
  assert.equal(CUTSCENE.camera.gameplaySettleAt, 31.0);
});

test('camera, lander and shake follow the timeline', () => {
  assert.equal(cameraYAt(19), 400);
  assert.equal(cameraYAt(22.9), 400);
  near(cameraYAt(25), 850);
  near(cameraYAt(26.5), 850);
  assert.equal(cameraYAt(31), GAMEPLAY_VIEW.centerY);
  assert.equal(cameraYAt(40), GAMEPLAY_VIEW.centerY);
  let prev = cameraYAt(26.5);
  for (let s = 26.6; s <= 31; s += 0.1) { const y = cameraYAt(s); assert.ok(y >= prev - 1e-9); prev = y; }
  assert.equal(cameraZoomAt(20), 1);
  assert.equal(cameraZoomAt(33), GAMEPLAY_VIEW.zoom);
  // a strip of surface stays visible above the base, and the whole base fits (SCENARIO framing rule)
  const halfView = 1080 / GAMEPLAY_VIEW.zoom / 2;
  assert.ok(GAMEPLAY_VIEW.centerY - halfView <= 900 && GAMEPLAY_VIEW.centerY + halfView >= LAYOUT.firstFloorY + LAYOUT.floors * LAYOUT.floorHeight);
  // the surface strip (SCENARIO: about 15% of the screen) must be visible BELOW the interface's top bar (about 98 px), not hidden under it
  const groundOnScreen = (LAYOUT.groundY - (GAMEPLAY_VIEW.centerY - halfView)) * GAMEPLAY_VIEW.zoom;
  assert.ok(groundOnScreen - 98 >= 120, `only ${Math.round(groundOnScreen - 98)} px of surface are visible under the top bar`);
  assert.equal(GAMEPLAY_VIEW.surfaceStripTopY, Math.round(GAMEPLAY_VIEW.centerY - halfView));

  assert.equal(landerAt(5).visible, false);
  near(landerAt(19).y, -150);
  near(landerAt(23).y, 650);
  near(landerAt(25).y, 1050);
  assert.equal(landerAt(22.1).parachute, 'attached');
  assert.equal(landerAt(22.2).parachute, 'drifting-left');
  assert.equal(landerAt(24).thrusters, true);
  assert.equal(landerAt(25).landed, true);

  assert.deepEqual(shakeAt(24.9), { x: 0, y: 0 });
  assert.deepEqual(shakeAt(25.3), { x: 0, y: 0 });
  for (let s = 25; s < 25.3; s += 0.01) { const k = shakeAt(s); assert.ok(Math.abs(k.x) <= 4 && Math.abs(k.y) <= 4); }
});

test('Drone #01 blinks red at 1 Hz from 31.0 s', () => {
  assert.equal(droneLedOn(30.9), false);
  assert.equal(droneLedOn(31.0), true);
  assert.equal(droneLedOn(31.6), false);
  assert.equal(droneLedOn(32.0), true);
});

test('cues and frames are consistent and fire exactly once', () => {
  assert.equal(openingFrameAt(5).text !== null, true);
  assert.equal(openingFrameAt(25).text, null);
  assert.equal(openingFrameAt(25.5).dustBurst, true);
  const cues = cuesBetween(18.99, 33);
  const sfx = cues.filter((c) => c.type === 'sfx').map((c) => c.id);
  for (const id of ['wind-hum', 'parachute-deploy', 'retro-rocket-roar', 'landing-thud', 'airlock-hiss', 'astra-chime']) assert.ok(sfx.includes(id), id);
  assert.deepEqual(cues.filter((c) => c.type === 'astra').map((c) => c.lineId), ['astra.intro.landing', 'astra.intro.why_underground']);
  assert.ok(cuesBetween(0, 19).some((c) => c.id === 'bass-boom'));
  assert.ok(cuesBetween(0, 19).filter((c) => c.id === 'type-blip').length > 150);
  const once = cuesBetween(0, 33).length;
  let split = 0;
  for (let s = 0; s < 33; s += 0.25) split += cuesBetween(s, Math.min(33, s + 0.25)).length;
  assert.equal(split, once);
  assert.equal(skipTarget(3), 19);
  assert.equal(skipTarget(25), 33);
  assert.equal(skipTarget(40), 40);
});

test('tutorial steps use line IDs that exist in the scenario and the strings file', () => {
  const ids = new Set();
  for (const step of TUTORIAL.steps) for (const k of [...step.lines, step.afterAdvance, step.then]) if (k) ids.add(k);
  for (const id of [...ids, CUTSCENE.astra.landingLine, CUTSCENE.astra.whyUndergroundLine]) {
    assert.ok(hasString(id), `${id} missing from strings.en.json`);
    assert.ok(scenario.includes(`| ${id} |`), `${id} missing from SCENARIO.md`);
  }
  const [, , lineText] = row('astra.intro.landing');
  assert.equal(t('astra.intro.landing').startsWith('Touchdown confirmed!'), true);
  assert.ok(lineText.length > 20);
  assert.deepEqual(TUTORIAL.steps[0].lines, ['astra.intro.status', 'astra.tut.hp_intro']);
});

test('ASTRA panel contract: lineId, not raw text', () => {
  assert.equal(ASTRA.badge, 'ASTRA 6.7 // STATION AI');
  assert.deepEqual(ASTRA.props, ['isOpen', 'lineId', 'mood', 'onClose']);
  assert.equal(ASTRA.panel.widthPx, 360);
  assert.equal(ASTRA.panel.leftPx, 24);
  const g = createGuide();
  assert.equal(guideProps(g).isOpen, false);
  say(g, { lineId: 'astra.intro.landing', mood: 'cheerful' });
  say(g, { lineId: 'astra.intro.status', mood: 'nonsense' });
  assert.deepEqual(Object.keys(guideProps(g)), ASTRA.props);
  assert.equal(guideProps(g).lineId, 'astra.intro.landing');
  assert.equal(currentMessage(g), t('astra.intro.landing'));
  dismiss(g);
  assert.equal(guideProps(g).lineId, 'astra.intro.status');
  assert.equal(guideProps(g).mood, 'calm');
  dismiss(g);
  assert.equal(guideProps(g).isOpen, false);
});

test('ASTRA does not repeat once-only lines and answers simulation events', () => {
  const g = createGuide();
  hearEvents(g, [{ type: 'module-built', module: 'garage' }, { type: 'module-built', module: 'garage' }]);
  assert.equal(g.queue.length + (g.current ? 1 : 0), 1);
  assert.equal(astraLineFor({ type: 'unknown-event' }), null);
  assert.equal(astraLineFor(undefined), null);
  assert.equal(astraLineFor({ type: 'storm-warning', storm: 's1' }).mood, 'alert');
  assert.ok(astraLineFor({ type: 'module-built', module: 'constructor' }).message.length > 0); // inherited key must not crash
  assert.ok(!/deadly/i.test(astraLineFor({ type: 'storm-warning', storm: 's1' }).message));
});

test('a won mini-game repairs a system, never worsens it, and bad input is rejected', () => {
  const game = createGame('L1-wake-the-station');
  const before = game.systems.solarClean;
  assert.equal(applyCommand(game, { type: 'repairSystem', system: 'solarClean', value: 0.95 }).ok, true);
  assert.ok(game.systems.solarClean > before);
  applyCommand(game, { type: 'repairSystem', system: 'solarClean', value: 0.1 });
  assert.equal(game.systems.solarClean, 0.95, 'a repair never lowers the value');
  assert.equal(applyCommand(game, { type: 'repairSystem', system: 'solarClean', value: 2 }).ok, false);
  assert.equal(applyCommand(game, { type: 'repairSystem', system: 'toString', value: 1 }).ok, false);
});
