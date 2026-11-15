/**
 * Game opening: picture storyboard, landing cutscene, tutorial (SCENARIO.md Section 1).
 *
 * Pure data and pure functions of time. No rendering, no audio: a screen asks "what does
 * second 24.3 look like?" and draws the answer. tests/flow.test.mjs keeps every number here
 * equal to SCENARIO.md. Lines are referenced by ID; the English text comes from strings.js.
 *
 * Time `t` is seconds since the opening started. Y values are world units on the 1920 x 3200
 * canvas (src/data/base-layout.js: WORLD). Where the scenario leaves something open the
 * value is marked PROPOSAL.
 */
import { t as text } from './strings.js';

// ---------------------------------------------------------------- states

/** SCENARIO "Intro & tutorial implementation rules", rule 2. */
export const FLOW_STATES = Object.freeze([
  'INTRO_TEXT', 'DESCENT', 'TOUCHDOWN', 'UNDERGROUND_PAN',
  'TUT_HP', 'TUT_DRONE_CLICK', 'TUT_SOLAR_WIPE', 'TUT_BATTERY', 'TUT_BUILD', 'PLAY',
]);

/** Phase boundaries in seconds. */
export const T = Object.freeze({ introEnd: 19.0, descentEnd: 23.0, touchdownEnd: 26.5, panEnd: 33.0 });

/** The timed part of the flow. Tutorial steps after 33.0 s advance on player actions, not on time. */
export function flowStateAt(sec) {
  if (sec < T.introEnd) return 'INTRO_TEXT';
  if (sec < T.descentEnd) return 'DESCENT';
  if (sec < T.touchdownEnd) return 'TOUCHDOWN';
  if (sec < T.panEnd) return 'UNDERGROUND_PAN';
  return 'TUT_HP';
}

// ---------------------------------------------------------------- picture storyboard (state INTRO_TEXT)

/**
 * SCENARIO "Intro: picture storyboard". The storyboard has its own clock (`st`, seconds since it started):
 * it auto-advances, then waits on the briefing until START MISSION, which jumps the opening clock to T.introEnd.
 * Labels: panel 0 and the briefing are `gameplay`, panels 1-3 are `fiction`.
 */
export const STORYBOARD = Object.freeze({
  background: '#05070A',
  keyColor: '#FF6B35', // Martian Orange for the key word
  fadeSec: 0.4,
  minFontPx: 64, // the big panel lines at 1920 x 1080
  skipLabel: 'Skip >>',
  skipPosition: 'top-right',
  panels: Object.freeze([
    Object.freeze({ id: 'title', label: 'gameplay', dur: 1.5, lines: Object.freeze([Object.freeze({ id: 'intro.00', key: 'Mars' })]), badge: 'intro.badge' }),
    Object.freeze({ id: 'signal', label: 'fiction', dur: 3, lines: Object.freeze([Object.freeze({ id: 'intro.01', key: 'strange' })]), rings: Object.freeze([0.4, 1.3, 2.2]) }),
    Object.freeze({ id: 'storm', label: 'fiction', dur: 3, lines: Object.freeze([Object.freeze({ id: 'intro.02', key: 'silent' })]), barsDropAt: Object.freeze([0.6, 1.1, 1.6, 2.1]) }),
    Object.freeze({ id: 'drones', label: 'fiction', dur: 4, lines: Object.freeze([Object.freeze({ id: 'intro.03', key: 'Robots', until: 2 }), Object.freeze({ id: 'intro.04', key: 'storm', from: 2 })]), sandFrom: 2 }),
    Object.freeze({ id: 'briefing', label: 'gameplay', dur: Infinity, title: 'intro.05',
      tiles: Object.freeze([
        Object.freeze({ goal: 'intro.goal1', learn: 'intro.learn1', icon: 'drone' }),
        Object.freeze({ goal: 'intro.goal2', learn: 'intro.learn2', icon: 'crew' }),
        Object.freeze({ goal: 'intro.goal3', learn: 'intro.learn3', icon: 'rover' }),
      ]),
      facts: 'intro.facts', start: 'intro.start' }),
  ]),
});

/** When panel `i` starts on the storyboard clock. */
export function panelStart(i) {
  let t = 0;
  for (let k = 0; k < i; k++) t += STORYBOARD.panels[k].dur;
  return t;
}

/** The briefing's start: where Skip goes (never past it). */
export const BRIEFING_AT = panelStart(STORYBOARD.panels.length - 1);

/** What the storyboard shows at `st`: panel index, time inside it, its fade-in (0..1) and the visible line. */
export function storyAt(st) {
  const P = STORYBOARD.panels;
  let i = 0;
  while (i < P.length - 1 && st >= panelStart(i + 1)) i++;
  const local = st - panelStart(i);
  const line = P[i].lines?.find((l) => (l.from ?? 0) <= local && local < (l.until ?? Infinity)) ?? null;
  return { index: i, panel: P[i], local, fade: Math.min(1, local / STORYBOARD.fadeSec), line, briefing: i === P.length - 1 };
}

/** Tap, click, Space or Enter: the start of the next panel (the briefing stays). */
export function nextPanelAt(st) {
  const { index } = storyAt(st);
  return index >= STORYBOARD.panels.length - 1 ? st : panelStart(index + 1);
}

/** Storyboard sounds in (t0, t1]: a soft thump per seismic ring, radio static when the last bar drops. */
export function storyCuesBetween(t0, t1) {
  const cues = [];
  STORYBOARD.panels.forEach((p, i) => {
    const s0 = panelStart(i);
    for (const r of p.rings ?? []) if (s0 + r > t0 && s0 + r <= t1) cues.push({ at: s0 + r, type: 'sfx', id: 'canyonSeismicThump' });
    const last = p.barsDropAt?.at(-1);
    if (last != null && s0 + last > t0 && s0 + last <= t1) cues.push({ at: s0 + last, type: 'sfx', id: 'staticZap' });
  });
  return cues.sort((x, y) => x.at - y.at);
}

// ---------------------------------------------------------------- landing cutscene (19.0 s - 33.0 s)

export const CUTSCENE = Object.freeze({
  from: T.introEnd,
  to: T.panEnd,
  phases: Object.freeze([
    Object.freeze({ state: 'DESCENT', name: 'Atmospheric descent', from: 19.0, to: 23.0 }),
    Object.freeze({ state: 'TOUCHDOWN', name: 'Retro-rocket touchdown', from: 23.0, to: 26.5 }),
    Object.freeze({ state: 'UNDERGROUND_PAN', name: 'Underground X-ray pan', from: 26.5, to: 33.0 }),
  ]),
  camera: Object.freeze({ skyY: 400, surfaceY: 850, panFrom: 26.5, gameplaySettleAt: 31.0, panEasing: 'ease-in-out' }),
  lander: Object.freeze({
    startY: -150,
    parachuteY: 650,
    touchdownY: 1050,
    parachute: 'red-and-white',
    parachuteDetachAt: 22.2,
    parachuteDrift: 'left',
    thrusters: 4,
    thrustersAt: 23.0,
    touchdownAt: 25.0,
  }),
  shake: Object.freeze({ at: 25.0, amplitudePx: 4, duration: 0.3 }),
  dustBurstAt: 25.0,
  /** ASTRA slides in at touchdown (first appearance, chime) and later during the pan. */
  astra: Object.freeze({ landingAt: 25.0, landingLine: 'astra.intro.landing', whyUndergroundAt: 26.5, whyUndergroundLine: 'astra.intro.why_underground' }),
  astronaut: Object.freeze({ exitsShaftAt: 29.0, into: 'left wing', removesHelmet: true }),
  drone: Object.freeze({ id: 'drone-01', label: 'Drone #01', blinkFrom: 31.0, blinkHz: 1, ledColor: 'red' }),
  // PROPOSALS: timings inside a phase that the scenario does not pin down.
  proposals: Object.freeze({ helmetOffAt: 30.0, airlockHissAt: 25.8, parachuteGoneAfter: 3.0, cameraTracksUntil: 25.0 }),
});

/** Sound cues. `proposal: true` marks a time chosen inside a phase where only the order is given. */
export const SFX_CUES = Object.freeze([
  Object.freeze({ at: 19.0, id: 'wind-hum', loop: true, what: 'Martian wind hum' }),
  Object.freeze({ at: 19.0, id: 'parachute-deploy', what: 'Parachute deploy' }),
  Object.freeze({ at: 23.0, id: 'retro-rocket-roar', what: 'Retro-rocket roar' }),
  Object.freeze({ at: 25.0, id: 'landing-thud', what: 'Metallic landing thud' }),
  Object.freeze({ at: CUTSCENE.proposals.airlockHissAt, id: 'airlock-hiss', what: 'Airlock hiss', proposal: true }),
  Object.freeze({ at: 25.0, id: 'astra-chime', what: 'Energetic chime as ASTRA slides in for the first time' }),
]);

const lerp = (a, b, u) => a + (b - a) * u;
const unit = (sec, from, to) => Math.min(1, Math.max(0, (sec - from) / (to - from)));
const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
const easeOut = (u) => 1 - (1 - u) * (1 - u);

/**
 * Gameplay framing (PROPOSAL; the scenario leaves the zoom to the layout work): the whole base fits, three
 * floors and the two-room-wide right wing (x 300 to 2220, so the camera centres on x 1260), and a strip of
 * surface about 230 px tall stays visible BELOW the top bar of the interface (about 98 px): the solar panels,
 * the dome, the Garage and the Rover, and the Commander at work outside. Zoom is screen pixels per world unit;
 * the top of the view is world y 390 and the ground line lands at screen y 330.
 */
export const GAMEPLAY_VIEW = Object.freeze({ zoom: 0.5, centerX: 1260, centerY: 1470, surfaceStripTopY: 390 });

/** Camera centre Y at time `sec`. Locked on the sky, follows the lander, then pans underground. */
export function cameraYAt(sec) {
  const c = CUTSCENE.camera;
  if (sec < CUTSCENE.lander.thrustersAt) return c.skyY;
  if (sec < c.panFrom) return lerp(c.skyY, c.surfaceY, unit(sec, CUTSCENE.lander.thrustersAt, CUTSCENE.proposals.cameraTracksUntil));
  if (sec < c.gameplaySettleAt) return lerp(c.surfaceY, GAMEPLAY_VIEW.centerY, easeInOut(unit(sec, c.panFrom, c.gameplaySettleAt)));
  return GAMEPLAY_VIEW.centerY;
}

/** Camera centre X at time `sec`: the cutscene is centred on x 960, then it eases to the centre of the whole base. */
export function cameraXAt(sec) {
  const c = CUTSCENE.camera;
  if (sec < c.panFrom) return 960;
  if (sec < c.gameplaySettleAt) return lerp(960, GAMEPLAY_VIEW.centerX, easeInOut(unit(sec, c.panFrom, c.gameplaySettleAt)));
  return GAMEPLAY_VIEW.centerX;
}

/** Camera zoom at time `sec`: 1 in the cutscene, then eases to the gameplay framing. */
export function cameraZoomAt(sec) {
  const c = CUTSCENE.camera;
  if (sec < c.panFrom) return 1;
  if (sec < c.gameplaySettleAt) return lerp(1, GAMEPLAY_VIEW.zoom, easeInOut(unit(sec, c.panFrom, c.gameplaySettleAt)));
  return GAMEPLAY_VIEW.zoom;
}

/** The lander: where it is and what it is doing. */
export function landerAt(sec) {
  const l = CUTSCENE.lander;
  if (sec < CUTSCENE.from) return { visible: false, y: l.startY, parachute: 'none', thrusters: false, landed: false };
  let y;
  if (sec < l.thrustersAt) y = lerp(l.startY, l.parachuteY, unit(sec, CUTSCENE.from, l.thrustersAt));
  else if (sec < l.touchdownAt) y = lerp(l.parachuteY, l.touchdownY, easeOut(unit(sec, l.thrustersAt, l.touchdownAt))); // thrusters slow the descent
  else y = l.touchdownY;
  let parachute = 'attached';
  if (sec >= l.parachuteDetachAt) parachute = sec < l.parachuteDetachAt + CUTSCENE.proposals.parachuteGoneAfter ? 'drifting-left' : 'none';
  return { visible: true, y, parachute, thrusters: sec >= l.thrustersAt && sec < l.touchdownAt, landed: sec >= l.touchdownAt };
}

/** Camera shake offset in pixels at touchdown: within +/-4 px, fading out over 0.3 s. */
export function shakeAt(sec) {
  const s = CUTSCENE.shake;
  const u = (sec - s.at) / s.duration;
  if (u < 0 || u >= 1) return { x: 0, y: 0 };
  const fade = 1 - u;
  return { x: s.amplitudePx * fade * Math.sin(u * Math.PI * 8), y: s.amplitudePx * fade * Math.cos(u * Math.PI * 6) };
}

/** The astronaut in the cutscene. */
export function astronautAt(sec) {
  return { visible: sec >= CUTSCENE.astronaut.exitsShaftAt, helmetOn: sec < CUTSCENE.proposals.helmetOffAt };
}

// ---------------------------------------------------------------- the astronaut comes in (25.0 s - 31.2 s)

/**
 * How the astronaut gets into the base. The scenario fixes only: touchdown 25.0 s, the airlock hiss (25.8 s here),
 * "29.0 s: the astronaut exits the crew airlock shaft into the left wing", helmet off (30.0 s here). Everything
 * between is PROPOSAL, chosen so the walking speed stays under 480 units/s and the climb under 320 units/s.
 */
export const ENTRY = Object.freeze({
  leavesLanderAt: 25.1, // steps out of the lander hatch
  walksToDomeAt: 25.3, // then crosses the ground to the dome
  atDomeAt: 26.7, // stops at the hatch of the dome
  hatchClosesAt: 27.1, // the hatch is open from the hiss (25.8) to here
  insideUntil: 27.3, // the airlock cycles, the astronaut is not seen
  shaftBottomAt: 28.96, // down the ladder in the shaft (the camera is panning), then out of the shaft...
  exitsShaftAt: CUTSCENE.astronaut.exitsShaftAt, // ...into the left wing at 29.0 s
  atBedroomAt: 29.98, // stands in the Bedroom
  helmetOffAt: CUTSCENE.proposals.helmetOffAt, // lifts the helmet off
  helmetHeldAt: 30.6, // holds it under the arm
  standsAt: 31.2, // then stands about
  walkFps: 6.25, // walking and climbing frames per second
  gripEaseS: 0.2, // at the bottom of the shaft he lets go of the ladder over this long (the renderer slides him off its rail)
});

/** The open or closed hatch of the dome. */
export function entryDoorsAt(sec) {
  return { airlockOpen: sec >= CUTSCENE.proposals.airlockHissAt && sec < ENTRY.hatchClosesAt };
}

/**
 * Where the astronaut is and what he looks like at time `sec`, for any time, in any order (it is a pure function).
 * `geo` comes from src/render/geometry.js: { landerHatch, landerExit, domeHatch, shaftTop, shaftBottom, bedroomStand },
 * each { x, y } feet. Returns { visible, x, y, sheet ('crewEva' | 'crewIndoor'), frame, flip, phase }, and `grip` (0-1) while he is on the
 * ladder: how far he hangs on its rail instead of the middle of the shaft (1 all the way down, easing to 0 as he steps off).
 */
export function astronautPathAt(sec, geo) {
  const E = ENTRY;
  const lerpPt = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });
  const walkFrame = (from) => 2 + (Math.floor(Math.max(0, sec - from) * E.walkFps) % 6);
  const none = { visible: false, x: geo.domeHatch.x, y: geo.domeHatch.y, sheet: 'crewEva', frame: 0, flip: false, phase: 'inside' };
  if (sec < E.leavesLanderAt) return { ...none, x: geo.landerHatch.x, y: geo.landerHatch.y, phase: 'in the lander' };
  if (sec < E.walksToDomeAt) { const p = lerpPt(geo.landerHatch, geo.landerExit, unit(sec, E.leavesLanderAt, E.walksToDomeAt)); return { visible: true, ...p, sheet: 'crewEva', frame: walkFrame(E.leavesLanderAt), flip: true, phase: 'leaves the lander' }; }
  if (sec < E.atDomeAt) { const p = lerpPt(geo.landerExit, geo.domeHatch, unit(sec, E.walksToDomeAt, E.atDomeAt)); return { visible: true, ...p, sheet: 'crewEva', frame: walkFrame(E.walksToDomeAt), flip: true, phase: 'walks to the dome' }; }
  if (sec < E.hatchClosesAt) return { visible: true, ...geo.domeHatch, sheet: 'crewEva', frame: Math.floor(sec * 2) % 2, flip: true, phase: 'at the hatch' };
  if (sec < E.insideUntil) return { ...none, phase: 'inside' };
  if (sec < E.shaftBottomAt) { const p = lerpPt(geo.shaftTop, geo.shaftBottom, unit(sec, E.insideUntil, E.shaftBottomAt)); return { visible: true, ...p, sheet: 'crewEva', frame: 16 + (Math.floor((sec - E.insideUntil) * E.walkFps) % 2), flip: false, grip: Math.min(1, (E.shaftBottomAt - sec) / E.gripEaseS), phase: 'climbs down' }; }
  if (sec < E.atBedroomAt) { const p = lerpPt(geo.shaftBottom, geo.bedroomStand, unit(sec, E.shaftBottomAt, E.atBedroomAt)); return { visible: true, ...p, sheet: 'crewEva', frame: walkFrame(E.shaftBottomAt), flip: true, phase: 'walks into the Bedroom' }; }
  const at = { visible: true, ...geo.bedroomStand, flip: false };
  if (sec < E.helmetOffAt) return { ...at, sheet: 'crewEva', frame: 0, phase: 'stands, helmet on' };
  if (sec < E.helmetHeldAt) return { ...at, sheet: 'crewIndoor', frame: 22, phase: 'lifts the helmet' };
  if (sec < E.standsAt) return { ...at, sheet: 'crewIndoor', frame: 23, phase: 'holds the helmet' };
  return { ...at, sheet: 'crewIndoor', frame: Math.floor(sec * 1.4) % 2, phase: 'stands' };
}

/** Is Drone #01's red LED lit right now? (1 Hz from 31.0 s.) */
export function droneLedOn(sec) {
  const d = CUTSCENE.drone;
  if (sec < d.blinkFrom) return false;
  return ((sec - d.blinkFrom) * d.blinkHz) % 1 < 0.5;
}

/** Everything a renderer needs for one frame of the opening. */
export function openingFrameAt(sec) {
  return {
    t: sec,
    flowState: flowStateAt(sec),
    cameraX: cameraXAt(sec),
    cameraY: cameraYAt(sec),
    zoom: cameraZoomAt(sec),
    lander: landerAt(sec),
    shake: shakeAt(sec),
    dustBurst: sec >= CUTSCENE.dustBurstAt && sec < CUTSCENE.dustBurstAt + 1,
    astronaut: astronautAt(sec),
    droneLedOn: droneLedOn(sec),
  };
}

/**
 * Cues of the landing cutscene that fire in the half-open interval (t0, t1]: sound effects, state changes and
 * ASTRA lines. The storyboard before it has its own cues (storyCuesBetween).
 * Call once per frame with the previous and current time.
 */
export function cuesBetween(t0, t1) {
  const cues = [];
  for (const cue of SFX_CUES) if (cue.at > t0 && cue.at <= t1) cues.push({ at: cue.at, type: 'sfx', id: cue.id });
  for (const at of [T.introEnd, T.descentEnd, T.touchdownEnd, T.panEnd]) {
    if (at > t0 && at <= t1) cues.push({ at, type: 'state', flowState: flowStateAt(at) });
  }
  const a = CUTSCENE.astra;
  if (a.landingAt > t0 && a.landingAt <= t1) cues.push({ at: a.landingAt, type: 'astra', lineId: a.landingLine });
  if (a.whyUndergroundAt > t0 && a.whyUndergroundAt <= t1) cues.push({ at: a.whyUndergroundAt, type: 'astra', lineId: a.whyUndergroundLine });
  return cues.sort((x, y) => x.at - y.at);
}

/**
 * Where "Skip >>" jumps to on the opening clock (the storyboard's own Skip goes to the briefing, BRIEFING_AT). PROPOSAL: pressing
 * it again during the cutscene jumps to the end of the pan.
 */
export function skipTarget(sec) {
  if (sec < T.introEnd) return T.introEnd;
  if (sec < T.panEnd) return T.panEnd;
  return sec;
}

// ---------------------------------------------------------------- tutorial (33.0 s+)

/**
 * The tutorial steps, in order. Each step lists the ASTRA lines it plays (line IDs) and what
 * the player does to advance. The screen runs the steps; see src/main.js.
 */
export const TUTORIAL = Object.freeze({
  from: T.panEnd,
  steps: Object.freeze([
    Object.freeze({ state: 'TUT_HP', lines: Object.freeze(['astra.intro.status', 'astra.tut.hp_intro']), highlight: 'hp-bar', advance: 'both lines dismissed' }),
    Object.freeze({ state: 'TUT_DRONE_CLICK', lines: Object.freeze([]), dimAllModulesExcept: 'drone-01', marker: Object.freeze({ target: 'drone-01', icon: 'wrench', color: 'yellow', pulsing: true, position: 'above' }), advance: 'click Drone #01', afterAdvance: 'astra.tut.drone01_click' }),
    Object.freeze({ state: 'TUT_SOLAR_WIPE', lines: Object.freeze(['astra.tut.solar_prompt']), minigame: 'solar_wipe', advance: 'win Solar Panel Static Wipe', afterAdvance: 'astra.tut.solar_done' }),
    Object.freeze({ state: 'TUT_BATTERY', lines: Object.freeze(['astra.tut.drone01_prompt']), advance: 'drag the charged battery into the back hatch, snap 1 cable', afterAdvance: 'astra.tut.drone01_wake', then: 'astra.char.pip' }),
    Object.freeze({ state: 'TUT_BUILD', lines: Object.freeze(['astra.tut.build_prompt']), highlight: 'power', advance: 'tap the Battery & Heating frame, then Build', afterAdvance: 'astra.tut.done' }),
    Object.freeze({ state: 'PLAY', lines: Object.freeze([]) }),
  ]),
});
