/**
 * Job mini-games, on the same 1100 x 620 canvas and { destroy } lifecycle as startMini2.
 * All numbers below are gameplay / art direction, not Mars measurements. Kept here because
 * this delegated patch owns only this module, its panel, stylesheet and pure tests.
 * Code-drawn scenes are procedural development stand-ins, not final image assets.
 * One attempt emits one result; the caller owns the instant, free retry and job rewards.
 */
import { W, H, PAL, plate, glow, outlined, meter, pulse, rand } from './mg-kit.js';
import { play } from './audio.js';
import { hasString, t } from '../flow/strings.js';

// Provenance: gameplay. A 12-second task plus the solo Commander's scenario bonus = 15 s.
export const JOB_RULES = Object.freeze({
  seconds: 12, soloBonus: 3, boltCount: 8, scrapGoal: 4, grainGoal: 3,
  tapRadius: 38, scannerRadius: 125, focusTarget: 0.62, focusTolerance: 0.09,
  feedbackMs: 1300, outroMs: 600, beepMs: 500,
  ringGreen: 0.5, ringYellow: 0.2,
});
// Provenance: gameplay. Layout and hit regions in the shared canvas coordinate system.
export const JOB_LAYOUT = Object.freeze({
  slider: Object.freeze({ x: 735, y: 385, w: 290, h: 76 }),
  scope: Object.freeze({ x: 345, y: 310, r: 205 }),
  bolts: Object.freeze([
    [300, 200], [550, 200], [800, 200], [800, 330],
    [800, 460], [550, 460], [300, 460], [300, 330],
  ].map(([x, y]) => Object.freeze({ x, y }))),
  scrap: Object.freeze([
    [235, 290], [505, 230], [815, 290], [370, 455], [715, 455],
  ].map(([x, y], id) => Object.freeze({ x, y, id, kind: 'scrap' }))),
  rocks: Object.freeze([
    [550, 370], [945, 440],
  ].map(([x, y], id) => Object.freeze({ x, y, id: id + 5, kind: 'rock' }))),
  grains: Object.freeze([
    [260, 220, true], [430, 210, false], [200, 340, false],
    [365, 320, true], [290, 435, false], [480, 390, true],
  ].map(([x, y, match], id) => Object.freeze({ x, y, match, id }))),
});

export const STRINGS = Object.freeze({
  'ui.mg.bolt_sprint.title': 'Help the drones',
  'ui.mg.bolt_sprint.hint': 'Tap each glowing bolt to tighten it. The drones fit the panels, you lock them.',
  'ui.mg.scrap_hunt.title': 'Scrap hunt',
  'ui.mg.scrap_hunt.hint': 'Move the scanner. When it glows, tap to pick up the scrap.',
  'ui.mg.sample_scan.title': 'Microscope',
  'ui.mg.sample_scan.hint': 'Turn the focus until the picture is sharp. Then find the grains from the card.',
  'ui.mg.jobs.bolt_goal': 'Tap the glowing bolt',
  'ui.mg.jobs.scrap_goal': 'Scan the ground. Find 4 pieces',
  'ui.mg.jobs.focus_goal': 'Slide the focus into the green band',
  'ui.mg.jobs.grain_goal': 'Tap 3 square grains like the card',
  'ui.mg.jobs.bolt_next': 'Good turn! Follow the glow.',
  'ui.mg.jobs.bolt_miss': 'Look for the glowing bolt.',
  'ui.mg.jobs.scrap_found': 'Useful scrap! Nice searching.',
  'ui.mg.jobs.scrap_miss': 'Keep scanning. Watch for a glow.',
  'ui.mg.jobs.rock': 'Just a rock!',
  'ui.mg.jobs.focus_first': 'Focus first. Slide into the green band.',
  'ui.mg.jobs.grain_found': 'Shape matched! Keep looking.',
  'ui.mg.jobs.grain_miss': 'Try a square grain like the card.',
  'ui.mg.jobs.win': 'Nice work! Job complete.',
  'ui.mg.jobs.retry': 'Good effort! Ready for another try.',
  'ui.mg.jobs.tight': 'TIGHT',
  'ui.mg.jobs.next': 'NEXT',
  'ui.mg.jobs.scan': 'DRONE SCANNER',
  'ui.mg.jobs.reference': 'REFERENCE CARD',
  'ui.mg.jobs.crystal': 'Salt crystal',
  'ui.mg.jobs.square': 'Match the square shape',
  'ui.mg.jobs.practice': 'Practice sample',
  'ui.mg.jobs.lab': 'Real samples need more tests.',
  'ui.mg.jobs.focus': 'FOCUS',
  'ui.mg.jobs.sharp': 'Sharp! Tap the square grains.',
  'ui.mg.jobs.blur': 'Slide until the grains look sharp.',
  'ui.mg.jobs.bolts': 'Bolts {count} / {goal}',
  'ui.mg.jobs.scrap': 'Scrap {count} / {goal}',
  'ui.mg.jobs.grains': 'Grains {count} / {goal}',
});
const line = (id, vars = {}) => (hasString(id) ? t(id, vars) : STRINGS[id].replace(/\{(\w+)\}/g, (m, key) => vars[key] ?? m));
const GAMES = Object.freeze(['bolt_sprint', 'scrap_hunt', 'sample_scan']);
export const hasJobMini = (game) => GAMES.includes(game);
const near = (p, q, radius = JOB_RULES.tapRadius) => Math.hypot(p.x - q.x, p.y - q.y) <= radius;
const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const clamp = (v) => Math.max(0, Math.min(1, v));

/** Pure puzzle state: no clock, DOM, random source or campaign-state writes. */
export function createJobPuzzle(game) {
  if (!hasJobMini(game)) throw new RangeError(`Unknown job mini-game: ${game}`);
  return { game, bolts: 0, picked: [], grains: [], focus: 0, dragging: false,
    pointer: { x: W / 2, y: H / 2 }, touched: false, message: null };
}
export const sampleIsSharp = (puzzle) => Math.abs(puzzle.focus - JOB_RULES.focusTarget) <= JOB_RULES.focusTolerance;
export function jobProgress(puzzle) {
  if (puzzle.game === 'bolt_sprint') return { count: puzzle.bolts, goal: JOB_RULES.boltCount };
  if (puzzle.game === 'scrap_hunt') return { count: puzzle.picked.length, goal: JOB_RULES.scrapGoal };
  return { count: puzzle.grains.length, goal: JOB_RULES.grainGoal };
}
export const jobPuzzleDone = (puzzle) => { const p = jobProgress(puzzle); return p.count >= p.goal; };

/** Pure interaction helper: mutates only this local puzzle. Returns a sound/feedback cue. */
export function jobPointer(puzzle, kind, p) {
  if (jobPuzzleDone(puzzle)) return null;
  if (kind === 'up' || kind === 'cancel') { puzzle.dragging = false; return null; }
  if (kind !== 'down' && kind !== 'move') return null;
  puzzle.pointer = { x: p.x, y: p.y };
  if (puzzle.game === 'sample_scan' && (puzzle.dragging || kind === 'down' && inside(p, JOB_LAYOUT.slider))) {
    puzzle.dragging = true;
    puzzle.touched = true;
    puzzle.focus = clamp((p.x - JOB_LAYOUT.slider.x) / JOB_LAYOUT.slider.w);
    return 'focus';
  }
  if (kind !== 'down') return null;
  puzzle.touched = true;
  let cue = 'miss';
  if (puzzle.game === 'bolt_sprint') {
    const correct = near(p, JOB_LAYOUT.bolts[puzzle.bolts]);
    if (correct) puzzle.bolts++;
    puzzle.message = correct ? 'ui.mg.jobs.bolt_next' : 'ui.mg.jobs.bolt_miss';
    cue = correct ? 'bolt' : 'miss';
  } else if (puzzle.game === 'scrap_hunt') {
    const found = [...JOB_LAYOUT.scrap, ...JOB_LAYOUT.rocks].find((item) => !puzzle.picked.includes(item.id) && near(p, item));
    if (found?.kind === 'scrap') {
      puzzle.picked.push(found.id); puzzle.message = 'ui.mg.jobs.scrap_found'; cue = 'scrap';
    } else puzzle.message = found ? 'ui.mg.jobs.rock' : 'ui.mg.jobs.scrap_miss';
  } else if (!sampleIsSharp(puzzle)) puzzle.message = 'ui.mg.jobs.focus_first';
  else {
    const grain = JOB_LAYOUT.grains.find((item) => near(p, item) && !puzzle.grains.includes(item.id));
    if (grain?.match) { puzzle.grains.push(grain.id); puzzle.message = 'ui.mg.jobs.grain_found'; cue = 'grain'; }
    else puzzle.message = 'ui.mg.jobs.grain_miss';
  }
  return cue;
}

const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const say = (c, id, x, y, size = 24, color = PAL.cream) => outlined(c, line(id), x, y, size, color);

/** First-move hand: animated through pulse(), stationary with Reduce motion. */
function hand(c, x, y, now) {
  const k = pulse(now);
  c.strokeStyle = PAL.yellow; c.lineWidth = 4;
  circle(c, x, y, 43 + k * 5); c.stroke();
  c.save(); c.translate(x + 22, y + 30 + k * 6);
  c.fillStyle = PAL.cream; c.strokeStyle = PAL.outline; c.lineWidth = 3;
  c.fillRect(-8, -36, 16, 40); c.strokeRect(-8, -36, 16, 40);
  c.fillRect(-8, -2, 38, 32); c.strokeRect(-8, -2, 38, 32);
  c.restore();
}

function drawBolts(c, puzzle, now) {
  plate(c, 170, 125, 760, 410, { r: 4, fill: PAL.steelDark });
  for (let i = 0; i < 3; i++) {
    plate(c, 215 + i * 225, 155, 220, 350, { r: 2, fill: i % 2 ? PAL.creamShade : PAL.cream, bolts: false });
    c.fillStyle = PAL.steel; c.fillRect(240 + i * 225, 280, 170, 70);
  }
  JOB_LAYOUT.bolts.forEach((b, i) => {
    const tight = i < puzzle.bolts, active = i === puzzle.bolts;
    if (active) glow(c, b.x, b.y, 65, '#ffb000', 0.4 + pulse(now) * 0.3);
    c.fillStyle = tight ? PAL.green : active ? PAL.yellow : PAL.steel;
    c.strokeStyle = PAL.outline; c.lineWidth = 4;
    c.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.lineTo(b.x + Math.cos(a) * 28, b.y + Math.sin(a) * 28); }
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = PAL.outline; c.fillRect(b.x - 14, b.y - 4, 28, 8);
    if (tight) c.fillRect(b.x - 4, b.y - 14, 8, 28);
    if (active) say(c, 'ui.mg.jobs.next', b.x, b.y - 47, 18, PAL.yellow);
    if (tight) say(c, 'ui.mg.jobs.tight', b.x, b.y + 50, 16, PAL.green);
  });
  if (!puzzle.touched) hand(c, JOB_LAYOUT.bolts[0].x, JOB_LAYOUT.bolts[0].y, now);
}

function drawSurface(c, puzzle, now) {
  // Drone camera: no astronaut leaves the shelter, no surface HP cost.
  c.fillStyle = '#7a4a2e'; c.fillRect(45, 165, 1010, 365);
  c.fillStyle = PAL.brown;
  for (let i = 0; i < 120; i++) c.fillRect(55 + Math.floor(rand(i) * 980), 175 + Math.floor(rand(i + 200) * 340), 8, 4);
  plate(c, 70, 100, 130, 120, { r: 3, fill: PAL.cream });
  c.fillStyle = PAL.cyan; c.fillRect(100, 124, 70, 22);
  c.fillStyle = PAL.steelDark; c.fillRect(115, 170, 45, 50);
  say(c, 'ui.mg.jobs.scan', 400, 140, 21, PAL.cyan);
  const pointer = puzzle.pointer;
  const nearby = JOB_LAYOUT.scrap.filter((item) => !puzzle.picked.includes(item.id) && near(pointer, item, JOB_RULES.scannerRadius));
  [...JOB_LAYOUT.scrap, ...JOB_LAYOUT.rocks].forEach((item) => {
    if (puzzle.picked.includes(item.id)) return;
    const proximity = clamp(1 - Math.hypot(pointer.x - item.x, pointer.y - item.y) / JOB_RULES.scannerRadius);
    const rock = item.kind === 'rock';
    if (proximity > 0 && !rock) glow(c, item.x, item.y, 60, '#35d5e8', proximity * (0.5 + pulse(now) * 0.3));
    c.save(); c.globalAlpha = rock ? 1 : 0.12 + proximity * 0.88;
    c.fillStyle = rock ? PAL.creamShade : PAL.steel;
    c.fillRect(item.x - 18, item.y - 12, 36, 24);
    c.fillStyle = rock ? PAL.brown : PAL.cyan;
    c.fillRect(item.x - 10, item.y - 20, 20, 12);
    if (!rock) { c.fillStyle = PAL.cream; c.fillRect(item.x + 8, item.y - 4, 10, 12); }
    c.restore();
  });
  c.strokeStyle = nearby.length ? PAL.yellow : PAL.cyan; c.lineWidth = nearby.length ? 5 : 3;
  circle(c, pointer.x, pointer.y, JOB_RULES.scannerRadius); c.stroke();
  c.beginPath(); c.moveTo(pointer.x - 16, pointer.y); c.lineTo(pointer.x + 16, pointer.y);
  c.moveTo(pointer.x, pointer.y - 16); c.lineTo(pointer.x, pointer.y + 16); c.stroke();
  if (!puzzle.touched) hand(c, JOB_LAYOUT.scrap[0].x, JOB_LAYOUT.scrap[0].y, now);
}

function drawSample(c, puzzle, now) {
  const scope = JOB_LAYOUT.scope, sharp = sampleIsSharp(puzzle), slider = JOB_LAYOUT.slider;
  c.save(); circle(c, scope.x, scope.y, scope.r); c.clip();
  c.fillStyle = '#624832'; c.fillRect(scope.x - scope.r, scope.y - scope.r, scope.r * 2, scope.r * 2);
  for (let i = 0; i < 100; i++) {
    c.fillStyle = i % 2 ? PAL.brown : PAL.creamShade;
    c.fillRect(140 + rand(i) * 410, 105 + rand(i + 150) * 410, 5, 5);
  }
  // Deliberate focus blur is functional feedback, not a moving visual effect.
  c.filter = sharp ? 'none' : `blur(${4 + Math.abs(puzzle.focus - JOB_RULES.focusTarget) * 12}px)`;
  JOB_LAYOUT.grains.forEach((grain) => {
    c.fillStyle = grain.match ? PAL.cream : PAL.steelDark;
    if (grain.match) c.fillRect(grain.x - 24, grain.y - 24, 48, 48);
    else { circle(c, grain.x, grain.y, 24); c.fill(); }
    c.fillStyle = grain.match ? PAL.white : PAL.steel;
    c.fillRect(grain.x - 14, grain.y - 14, 12, 8);
  });
  c.filter = 'none';
  JOB_LAYOUT.grains.forEach((grain) => {
    c.strokeStyle = puzzle.grains.includes(grain.id) ? PAL.green : PAL.cyan; c.lineWidth = 3;
    c.strokeRect(grain.x - 34, grain.y - 34, 68, 68);
    if (puzzle.grains.includes(grain.id)) outlined(c, '+', grain.x, grain.y + 10, 32, PAL.green);
  });
  c.restore();
  c.strokeStyle = PAL.steel; c.lineWidth = 12; circle(c, scope.x, scope.y, scope.r); c.stroke();
  plate(c, 700, 125, 350, 215, { r: 4 });
  say(c, 'ui.mg.jobs.reference', 875, 157, 21, PAL.cyan);
  c.fillStyle = PAL.cream; c.fillRect(848, 177, 54, 54);
  c.fillStyle = PAL.white; c.fillRect(858, 187, 14, 10);
  say(c, 'ui.mg.jobs.crystal', 875, 263, 26);
  say(c, 'ui.mg.jobs.square', 875, 297, 20);
  say(c, 'ui.mg.jobs.focus', 875, 370, 22, PAL.cyan);
  plate(c, slider.x, slider.y, slider.w, slider.h, { r: 4, bolts: false });
  c.fillStyle = PAL.steel; c.fillRect(slider.x, slider.y + 32, slider.w, 12);
  c.fillStyle = PAL.green;
  c.fillRect(slider.x + slider.w * (JOB_RULES.focusTarget - JOB_RULES.focusTolerance), slider.y + 20, slider.w * JOB_RULES.focusTolerance * 2, 36);
  c.fillStyle = PAL.yellow;
  c.fillRect(slider.x + slider.w * puzzle.focus - 14, slider.y + 8, 28, slider.h - 16);
  say(c, sharp ? 'ui.mg.jobs.sharp' : 'ui.mg.jobs.blur', 875, 490, 18, sharp ? PAL.green : PAL.cream);
  say(c, 'ui.mg.jobs.practice', scope.x, 545, 20, PAL.creamShade);
  say(c, 'ui.mg.jobs.lab', 875, 529, 18, PAL.creamShade);
  if (!puzzle.touched) hand(c, slider.x + 40, slider.y + slider.h / 2, now);
}

function drawTimer(c, fraction, seconds) {
  const x = W - 60, y = 60, radius = 38;
  c.lineWidth = 10; c.strokeStyle = PAL.steelDark;
  circle(c, x, y, radius); c.stroke();
  c.strokeStyle = fraction > JOB_RULES.ringGreen ? PAL.green : fraction > JOB_RULES.ringYellow ? PAL.yellow : PAL.red;
  c.beginPath(); c.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction); c.stroke();
  outlined(c, String(Math.ceil(seconds)), x, y + 8, 24);
}

/** Same opts and return shape as startMini2; unused role/atlas/help opts remain caller-compatible. */
export function startJobMini(game, { canvas, title, hint, onWin, onFail, onTitle, onHint }) {
  const puzzle = createJobPuzzle(game);
  const ctx = canvas.getContext('2d');
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';
  ctx.imageSmoothingEnabled = false;
  onTitle?.(title || line(`ui.mg.${game}.title`));
  onHint?.(hint || line(`ui.mg.${game}.hint`));
  const started = performance.now(), limit = JOB_RULES.seconds + JOB_RULES.soloBonus;
  let raf = 0, outcome = null, endedAt = null, destroyed = false, activePointer = null;
  let feedbackAt = -Infinity, lastBeep = -Infinity;
  const point = (event) => {
    const r = canvas.getBoundingClientRect();
    return { x: (event.clientX - r.left) * W / r.width, y: (event.clientY - r.top) * H / r.height };
  };
  function releasePointer() {
    if (activePointer !== null && canvas.hasPointerCapture?.(activePointer)) canvas.releasePointerCapture?.(activePointer);
    activePointer = null;
    puzzle.dragging = false;
  }
  function finish(win, now) {
    if (outcome !== null || destroyed) return;
    outcome = win; endedAt = now; releasePointer();
    if (win) play('win');
  }
  function input(kind, event) {
    if (destroyed || outcome !== null) return;
    const now = performance.now();
    if (now - started >= limit * 1000) { finish(false, now); return; }
    if (kind === 'down') {
      if (activePointer !== null || event.isPrimary === false || event.button !== 0) return;
      activePointer = event.pointerId;
      canvas.setPointerCapture?.(activePointer);
      event.preventDefault();
    } else if (activePointer !== null && event.pointerId !== activePointer || kind !== 'move' && activePointer === null) return;
    const p = point(event);
    const cue = jobPointer(puzzle, kind, p);
    if (cue && cue !== 'focus') {
      feedbackAt = now;
      play(cue === 'bolt' ? 'suitClampSnap' : cue === 'scrap' ? 'pebblePop' : cue === 'grain' ? 'antennaLock' : 'click');
    }
    if (kind === 'up' || kind === 'cancel') releasePointer();
    if (jobPuzzleDone(puzzle)) finish(true, now);
  }
  const handlers = {
    pointerdown: (event) => input('down', event),
    pointermove: (event) => input('move', event),
    pointerup: (event) => input('up', event),
    pointercancel: (event) => input('cancel', event),
    lostpointercapture: releasePointer,
  };
  for (const [name, fn] of Object.entries(handlers)) canvas.addEventListener(name, fn);

  function frame(now) {
    if (destroyed) return;
    const left = Math.max(0, limit - (now - started) / 1000);
    if (outcome === null && left === 0) finish(false, now);
    ctx.fillStyle = PAL.navy; ctx.fillRect(0, 0, W, H);
    if (game === 'bolt_sprint') drawBolts(ctx, puzzle, now);
    else if (game === 'scrap_hunt') drawSurface(ctx, puzzle, now);
    else drawSample(ctx, puzzle, now);
    const goal = game === 'sample_scan' ? sampleIsSharp(puzzle) ? 'grain_goal' : 'focus_goal' : game === 'bolt_sprint' ? 'bolt_goal' : 'scrap_goal';
    say(ctx, `ui.mg.jobs.${goal}`, W / 2, 58, 28, PAL.yellow);
    const progress = jobProgress(puzzle), unit = game === 'bolt_sprint' ? 'bolts' : game === 'scrap_hunt' ? 'scrap' : 'grains';
    meter(ctx, 75, H - 38, 220, progress.count / progress.goal, { label: line(`ui.mg.jobs.${unit}`, progress) });
    if (outcome !== null) say(ctx, outcome ? 'ui.mg.jobs.win' : 'ui.mg.jobs.retry', 670, H - 28, 24, outcome ? PAL.green : PAL.cream);
    else if (puzzle.message && now - feedbackAt < JOB_RULES.feedbackMs) say(ctx, puzzle.message, 670, H - 28, 22, PAL.yellow);
    drawTimer(ctx, left / limit, left);
    if (game === 'scrap_hunt' && outcome === null && now - lastBeep >= JOB_RULES.beepMs &&
        JOB_LAYOUT.scrap.some((item) => !puzzle.picked.includes(item.id) && near(puzzle.pointer, item, JOB_RULES.scannerRadius))) {
      play('click'); lastBeep = now;
    }
    if (outcome !== null && now - endedAt >= JOB_RULES.outroMs) {
      const won = outcome;
      destroy();
      if (won) onWin?.(); else onFail?.();
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(raf);
    for (const [name, fn] of Object.entries(handlers)) canvas.removeEventListener(name, fn);
    releasePointer();
    canvas.style.touchAction = previousTouchAction;
  }
  raf = requestAnimationFrame(frame);
  return { destroy };
}
