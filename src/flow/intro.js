/**
 * Game opening: text intro, landing cutscene, tutorial hand-off.
 *
 * This is SCENARIO.md sections 3–5 as data and pure functions of time. It contains no
 * rendering and no audio: a screen asks "what does second 15.3 look like?" and draws the
 * answer. tests/flow.test.mjs keeps every number and every line of text here equal to
 * SCENARIO.md, so screens should import from this file rather than retype the scenario.
 *
 * Where the scenario leaves something open, the value here is marked PROPOSAL and listed
 * in docs/LEVELS.md under "Open points in the scenario".
 *
 * Time `t` is seconds since the intro started. Y coordinates are world units on the
 * 1920 x 3200 canvas (src/data/base-layout.js: WORLD).
 */

// ---------------------------------------------------------------- states

/** SCENARIO section 6, rule 2. */
export const FLOW_STATES = Object.freeze(['INTRO_TEXT', 'DESCENT', 'TOUCHDOWN', 'UNDERGROUND_PAN', 'TUTORIAL_HANDOFF']);

const T = Object.freeze({
  introEnd: 10.0,
  descentEnd: 14.0,
  touchdownEnd: 17.5,
  panEnd: 24.0,
});

/** One of FLOW_STATES. */
export function flowStateAt(t) {
  if (t < T.introEnd) return 'INTRO_TEXT';
  if (t < T.descentEnd) return 'DESCENT';
  if (t < T.touchdownEnd) return 'TOUCHDOWN';
  if (t < T.panEnd) return 'UNDERGROUND_PAN';
  return 'TUTORIAL_HANDOFF';
}

/** The coarser game state named in SCENARIO sections 3 and 5. */
export function gameStateAt(t) {
  if (t < T.introEnd) return 'INTRO_TEXT';
  if (t < T.panEnd) return 'CUTSCENE_LANDING';
  return 'TUTORIAL_STEP_1';
}

// ---------------------------------------------------------------- part A: text intro (0.0 s – 10.0 s)

export const INTRO_TEXT = Object.freeze({
  from: 0.0,
  to: T.introEnd,
  background: '#05070A',
  highlightColor: '#FF6B35',
  effects: Object.freeze(['drifting starfield', 'faint horizontal scanlines', 'vignette']),
  typography: 'centered, bold sci-fi sans-serif, typewriter reveal',
  skipLabel: 'Skip >>',
  skipPosition: 'top-right',
  lines: Object.freeze([
    Object.freeze({ text: 'YEAR 2042. MISSION: ARES-KIDS.', pauseAfter: 0.8, highlight: false }),
    Object.freeze({ text: 'A squad of builder drones was sent ahead to construct our underground Mars base...', pauseAfter: 1.0, highlight: false }),
    Object.freeze({ text: 'Until a massive dust storm hit Jezero Crater.', pauseAfter: 1.0, highlight: false }),
    Object.freeze({ text: 'The drones went to sleep. The station is only half-built.', pauseAfter: 1.2, highlight: false }),
    Object.freeze({ text: "IT'S UP TO YOU TO WAKE THEM UP AND SURVIVE.", pauseAfter: 0, highlight: true }),
  ]),
  /** PROPOSAL: how long the finished last line stays before the 10.0 s transition. */
  finalHold: 1.0,
});

/**
 * Typing speed is not given in the scenario; it follows from what is: all five lines, with
 * their pauses, must be finished by 10.0 s. Seconds per character:
 */
export const INTRO_CHAR_INTERVAL = (() => {
  const chars = INTRO_TEXT.lines.reduce((n, l) => n + l.text.length, 0);
  const pauses = INTRO_TEXT.lines.reduce((s, l) => s + l.pauseAfter, 0);
  return (INTRO_TEXT.to - INTRO_TEXT.from - pauses - INTRO_TEXT.finalHold) / chars;
})();

/** When each line starts and finishes typing. */
export const INTRO_SCHEDULE = Object.freeze(
  (() => {
    let at = INTRO_TEXT.from;
    return INTRO_TEXT.lines.map((line, index) => {
      const start = at;
      const end = start + line.text.length * INTRO_CHAR_INTERVAL;
      at = end + line.pauseAfter;
      return Object.freeze({ index, start, end });
    });
  })(),
);

/** What the text intro shows at time t: for each line, how many characters are revealed. */
export function introTextAt(t) {
  const lines = INTRO_TEXT.lines.map((line, i) => {
    const { start } = INTRO_SCHEDULE[i];
    // The small epsilon stops floating-point error from hiding a character at its exact moment.
    const shown = t < start ? 0 : Math.min(line.text.length, Math.floor((t - start) / INTRO_CHAR_INTERVAL + 1e-9));
    return { text: line.text, shown, visible: line.text.slice(0, shown), highlight: line.highlight };
  });
  return { lines, complete: lines.every((l) => l.shown === l.text.length) };
}

// ---------------------------------------------------------------- part B: landing cutscene (10.0 s – 24.0 s)

export const CUTSCENE = Object.freeze({
  from: T.introEnd,
  to: T.panEnd,
  phases: Object.freeze([
    Object.freeze({ state: 'DESCENT', name: 'Atmospheric Descent', from: 10.0, to: 14.0 }),
    Object.freeze({ state: 'TOUCHDOWN', name: 'Retro-Rocket Touchdown', from: 14.0, to: 17.5 }),
    Object.freeze({ state: 'UNDERGROUND_PAN', name: 'Underground X-Ray Pan', from: 17.5, to: 24.0 }),
  ]),
  camera: Object.freeze({ skyY: 400, surfaceY: 850, baseY: 2100, panFrom: 17.5, lockAt: 22.0, panEasing: 'ease-in-out' }),
  lander: Object.freeze({
    startY: -150,
    parachuteY: 650,
    touchdownY: 1050,
    parachute: 'red-and-white',
    parachuteDetachAt: 13.2,
    parachuteDrift: 'left',
    thrusters: 4,
    thrustersAt: 14.0,
    touchdownAt: 16.0,
  }),
  shake: Object.freeze({ at: 16.0, amplitudePx: 4, duration: 0.3 }),
  dustBurstAt: 16.0,
  astronaut: Object.freeze({ exitsAirlockAt: 20.0, into: 'left living quarters', removesHelmet: true }),
  drone: Object.freeze({ id: 'drone-01', label: 'Drone #01', blinkFrom: 22.0, blinkHz: 1, ledColor: 'red' }),
  astraPopup: false, // silent visual storytelling: no AI popup during the cutscene
  // PROPOSALS — timings inside a phase that the scenario does not pin down:
  proposals: Object.freeze({ helmetOffAt: 21.0, airlockHissAt: 16.8, parachuteGoneAfter: 3.0, cameraTracksUntil: 16.0 }),
});

/**
 * Sound cues. Times stated in SCENARIO.md are exact; `proposal: true` marks a time chosen
 * inside the phase where the scenario only gives the order.
 */
export const SFX_CUES = Object.freeze([
  Object.freeze({ at: 10.0, id: 'wind-hum', loop: true, what: 'Martian wind hum' }),
  Object.freeze({ at: 10.0, id: 'parachute-deploy', what: 'Parachute deploy' }),
  Object.freeze({ at: 14.0, id: 'retro-rocket-roar', what: 'Retro-rocket roar' }),
  Object.freeze({ at: 16.0, id: 'landing-thud', what: 'Metallic landing thud' }),
  Object.freeze({ at: CUTSCENE.proposals.airlockHissAt, id: 'airlock-hiss', what: 'Airlock hiss', proposal: true }),
  Object.freeze({ at: 24.0, id: 'astra-chime', what: 'Energetic chime as ASTRA slides in' }),
]);

const lerp = (a, b, u) => a + (b - a) * u;
const unit = (t, from, to) => Math.min(1, Math.max(0, (t - from) / (to - from)));
const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
const easeOut = (u) => 1 - (1 - u) * (1 - u);

/** Camera centre, world Y. Locked on the sky, then follows the lander down, then pans underground. */
export function cameraYAt(t) {
  const c = CUTSCENE.camera;
  if (t < CUTSCENE.lander.thrustersAt) return c.skyY;
  if (t < c.panFrom) return lerp(c.skyY, c.surfaceY, unit(t, CUTSCENE.lander.thrustersAt, CUTSCENE.proposals.cameraTracksUntil));
  if (t < c.lockAt) return lerp(c.surfaceY, c.baseY, easeInOut(unit(t, c.panFrom, c.lockAt)));
  return c.baseY;
}

/** The lander: where it is and what it is doing. */
export function landerAt(t) {
  const l = CUTSCENE.lander;
  if (t < CUTSCENE.from) return { visible: false, y: l.startY, parachute: 'none', thrusters: false, landed: false };
  let y;
  if (t < l.thrustersAt) y = lerp(l.startY, l.parachuteY, unit(t, CUTSCENE.from, l.thrustersAt));
  else if (t < l.touchdownAt) y = lerp(l.parachuteY, l.touchdownY, easeOut(unit(t, l.thrustersAt, l.touchdownAt))); // thrusters slow the descent
  else y = l.touchdownY;
  let parachute = 'attached';
  if (t >= l.parachuteDetachAt) parachute = t < l.parachuteDetachAt + CUTSCENE.proposals.parachuteGoneAfter ? 'drifting-left' : 'none';
  return { visible: true, y, parachute, thrusters: t >= l.thrustersAt && t < l.touchdownAt, landed: t >= l.touchdownAt };
}

/** Camera shake offset in pixels at touchdown: within +/-4 px, fading out over 0.3 s. */
export function shakeAt(t) {
  const s = CUTSCENE.shake;
  const u = (t - s.at) / s.duration;
  if (u < 0 || u >= 1) return { x: 0, y: 0 };
  const fade = 1 - u;
  return { x: s.amplitudePx * fade * Math.sin(u * Math.PI * 8), y: s.amplitudePx * fade * Math.cos(u * Math.PI * 6) };
}

/** The astronaut in the cutscene. */
export function astronautAt(t) {
  const a = CUTSCENE.astronaut;
  return { visible: t >= a.exitsAirlockAt, helmetOn: t < CUTSCENE.proposals.helmetOffAt };
}

/** Is Drone #01's red LED lit right now? (1 Hz from 22.0 s.) */
export function droneLedOn(t) {
  const d = CUTSCENE.drone;
  if (t < d.blinkFrom) return false;
  return ((t - d.blinkFrom) * d.blinkHz) % 1 < 0.5;
}

/** Everything a renderer needs for one frame of the opening. */
export function openingFrameAt(t) {
  return {
    t,
    flowState: flowStateAt(t),
    gameState: gameStateAt(t),
    text: t < INTRO_TEXT.to ? introTextAt(t) : null,
    cameraY: cameraYAt(t),
    lander: landerAt(t),
    shake: shakeAt(t),
    dustBurst: t >= CUTSCENE.dustBurstAt && t < CUTSCENE.dustBurstAt + 1,
    astronaut: astronautAt(t),
    droneLedOn: droneLedOn(t),
    astraOpen: t >= TUTORIAL_STEP_1.from,
  };
}

/**
 * Cues that fire in the half-open interval (t0, t1]: sound effects, typewriter blips (one
 * per revealed character), the bass boom on the last line, and state changes.
 * Call once per frame with the previous and current time.
 */
export function cuesBetween(t0, t1) {
  const cues = [];
  for (const [i, line] of INTRO_TEXT.lines.entries()) {
    const { start, end } = INTRO_SCHEDULE[i];
    for (let k = 1; k <= line.text.length; k++) {
      const at = start + k * INTRO_CHAR_INTERVAL;
      if (at > t0 && at <= t1 && line.text[k - 1] !== ' ') cues.push({ at, type: 'sfx', id: 'type-blip' });
    }
    if (i === INTRO_TEXT.lines.length - 1 && end > t0 && end <= t1) cues.push({ at: end, type: 'sfx', id: 'bass-boom' });
  }
  for (const cue of SFX_CUES) if (cue.at > t0 && cue.at <= t1) cues.push({ at: cue.at, type: 'sfx', id: cue.id });
  for (const at of [T.introEnd, T.descentEnd, T.touchdownEnd, T.panEnd]) {
    if (at > t0 && at <= t1) cues.push({ at, type: 'state', flowState: flowStateAt(at), gameState: gameStateAt(at) });
  }
  return cues.sort((a, b) => a.at - b.at);
}

/**
 * Where "Skip >>" jumps to. The scenario makes the text intro skippable into the cutscene.
 * PROPOSAL: pressing it again during the cutscene jumps to the tutorial hand-off.
 */
export function skipTarget(t) {
  if (t < T.introEnd) return T.introEnd;
  if (t < T.panEnd) return T.panEnd;
  return t;
}

// ---------------------------------------------------------------- tutorial hand-off (24.0 s+)

export const TUTORIAL_STEP_1 = Object.freeze({
  id: 'TUTORIAL_STEP_1',
  from: T.panEnd,
  previousState: 'CUTSCENE_LANDING',
  astra: Object.freeze({
    slidesInFrom: 'left',
    leftPx: 24,
    sfx: 'astra-chime',
    mood: 'cheerful',
    button: 'Got it',
    /** Paragraphs exactly as in SCENARIO section 5. `**` marks bold. */
    dialogue: Object.freeze([
      'Touchdown confirmed! Welcome to Ares-1, Commander.',
      'Look above us—that thick layer of Martian soil shields our base from deadly space radiation! Because Mars has no magnetic field like Earth, living underground keeps us safe.',
      "Right now, only Water, Air, and Sleeping Quarters are online. Let's wake up **Drone #01** so we can finish building the station! **Click on the sleeping drone.**",
    ]),
  }),
  dimAllModulesExcept: 'drone-01',
  marker: Object.freeze({ target: 'drone-01', icon: 'wrench', color: 'yellow', pulsing: true, position: 'above' }),
  action: Object.freeze({ on: 'click', target: 'drone-01', astra: 'close-or-minimize', opens: 'DroneRepairMiniGame' }),
});
