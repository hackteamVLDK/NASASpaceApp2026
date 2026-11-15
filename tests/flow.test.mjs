// Keeps src/flow/ equal to SCENARIO.md (v2). The scenario file is parsed, not copied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FLOW_STATES, STORYBOARD, BRIEFING_AT, CUTSCENE, TUTORIAL, T, GAMEPLAY_VIEW,
  flowStateAt, storyAt, nextPanelAt, storyCuesBetween, panelStart, cameraYAt, cameraZoomAt, landerAt, shakeAt, droneLedOn,
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

test('storyboard lines match the scenario table and keep the panel rules', () => {
  const ids = ['intro.badge', 'intro.00', 'intro.01', 'intro.02', 'intro.03', 'intro.04', 'intro.05',
    'intro.goal1', 'intro.learn1', 'intro.goal2', 'intro.learn2', 'intro.goal3', 'intro.learn3', 'intro.facts', 'intro.start'];
  for (const id of ids) assert.equal(t(id), row(id)[1], `${id} text`);
  const P = STORYBOARD.panels;
  assert.equal(P.length, 5);
  assert.deepEqual(P.map((p) => p.label), ['gameplay', 'fiction', 'fiction', 'fiction', 'gameplay']);
  assert.equal(P[0].dur, 1.5);
  for (const p of P.slice(1, 4)) {
    for (const l of p.lines) {
      assert.ok(t(l.id).split(/\s+/).length <= 8, `${l.id}: at most 8 words`);
      assert.ok(t(l.id).includes(l.key), `${l.id}: key word "${l.key}" is in the line`);
    }
  }
  assert.ok(STORYBOARD.minFontPx >= 64);
  assert.equal(STORYBOARD.keyColor, '#FF6B35');
  assert.equal(STORYBOARD.skipLabel, 'Skip >>');
  const total = panelStart(4);
  assert.ok(total >= 9 && total <= 15, `about 15 s with the briefing (${total} s before it)`);
  assert.equal(P[4].tiles.length, 3);
});

test('the storyboard advances on time and on tap, and Skip stops at the briefing', () => {
  assert.equal(storyAt(0).index, 0);
  assert.equal(storyAt(1.49).index, 0);
  assert.equal(storyAt(1.5).index, 1);
  assert.equal(storyAt(BRIEFING_AT + 100).index, 4); // the briefing waits for START MISSION
  assert.equal(storyAt(BRIEFING_AT + 100).briefing, true);
  assert.equal(nextPanelAt(0.2), 1.5);
  assert.equal(nextPanelAt(BRIEFING_AT + 1), BRIEFING_AT + 1); // a tap on the briefing does not start the mission
  const p3 = panelStart(3);
  assert.equal(storyAt(p3 + 0.5).line.id, 'intro.03');
  assert.equal(storyAt(p3 + 2.5).line.id, 'intro.04');
  const cues = storyCuesBetween(0, BRIEFING_AT);
  assert.equal(cues.filter((c) => c.id === 'canyonSeismicThump').length, STORYBOARD.panels[1].rings.length);
  assert.equal(cues.filter((c) => c.id === 'staticZap').length, 1);
  let split = 0;
  for (let x = 0; x < BRIEFING_AT; x += 0.1) split += storyCuesBetween(x, Math.min(BRIEFING_AT, x + 0.1)).length;
  assert.equal(split, cues.length);
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
  assert.equal(openingFrameAt(25.5).dustBurst, true);
  const cues = cuesBetween(18.99, 33);
  const sfx = cues.filter((c) => c.type === 'sfx').map((c) => c.id);
  for (const id of ['wind-hum', 'parachute-deploy', 'retro-rocket-roar', 'landing-thud', 'airlock-hiss', 'astra-chime']) assert.ok(sfx.includes(id), id);
  assert.deepEqual(cues.filter((c) => c.type === 'astra').map((c) => c.lineId), ['astra.intro.landing', 'astra.intro.why_underground']);
  assert.equal(cuesBetween(0, 18.99).filter((c) => c.type === 'sfx').length, 0); // the storyboard has its own cues
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

test('the old crawl story lives on, word for word, in the Mission file story card', async () => {
  const { STORY_CARDS, CARDS } = await import('../src/campaign/logbook.js');
  assert.deepEqual(STORY_CARDS.map((c) => c.id), ['mission_file']);
  assert.ok(!CARDS.some((c) => c.id === 'mission_file'), 'not counted among the science cards');
  const text = t('card.mission_file.text');
  for (const part of ['YEAR 2038.', 'PATHFINDER-X', 'every 37 minutes', 'puff of methane gas', 'goes silent', 'YEAR 2042. MISSION ARES-KIDS.', 'buried them too', 'Find the signal.']) assert.ok(text.includes(part), part);
  assert.equal(t('card.mission_file.title'), 'Mission file');
});
