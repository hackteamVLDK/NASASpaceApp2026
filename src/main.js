/**
 * Browser entry point: loads strings and art, then runs
 *   intro crawl -> landing cutscene -> tutorial -> play
 * as SCENARIO.md (Section 1) describes. The simulation (src/sim) runs only while playing;
 * the screen reads its state and sends commands, it never edits it.
 */
import { loadStrings, t } from './flow/strings.js';
import { loadAtlas } from './render/atlas.js';
import { drawWorld, buildSoil, SCREEN } from './render/world.js';
import { createGame, step, applyCommand, evaluateObjectives } from './sim/index.js';
import { openingFrameAt, cuesBetween, skipTarget, T, GAMEPLAY_VIEW, INTRO_TEXT, introTextAt, flowStateAt } from './flow/intro.js';
import { createGuide, say, hearEvents } from './flow/astra.js';
import { createAstraPanel } from './ui/astra-panel.js';
import { createHud } from './ui/hud.js';
import { startSolarWipe, startBatteryStep } from './ui/minigames.js';
import * as audio from './ui/audio.js';

const LEVEL = 'L1-wake-the-station';
const SIM_MINUTES_PER_SECOND = 12; // about two minutes of real time per Mars day at 1x
const $ = (id) => document.getElementById(id);

const stage = $('stage');
const canvas = $('game');
const ctx = canvas.getContext('2d');

function fit() {
  const k = Math.min(window.innerWidth / SCREEN.w, window.innerHeight / SCREEN.h);
  stage.style.transform = `translate(${(window.innerWidth - SCREEN.w * k) / 2}px, ${(window.innerHeight - SCREEN.h * k) / 2}px) scale(${k})`;
}
window.addEventListener('resize', fit);
fit();

let atlas, soil, game, guide, astra, hud;
let mode = 'loading'; // loading | intro | tutorial | play | over
let flowT = 0;
let prevFlowT = 0;
let speed = 1;
let simAccum = 0;
let tut = null; // { state, phase }
let hits = [];
let hover = null;
let mini = null;
let paused = false;

// ------------------------------------------------------------------ helpers

function toast(text, ms = 2600) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, ms);
}

/** Send a command to the simulation. Rejected commands show their reason. */
function command(cmd) {
  const res = applyCommand(game, cmd);
  if (!res.ok) { toast(res.error); return res; }
  hearEvents(guide, res.events);
  if (tut?.state === 'TUT_BUILD' && cmd.type === 'buildModule') finishTutorial();
  return res;
}

function openMini(kind) {
  $('mgWrap').hidden = false;
  const c = $('mg');
  const common = {
    canvas: c, atlas,
    onTitle: (s) => { document.querySelector('.mgTitle').textContent = s; },
    onHint: (s) => { document.querySelector('.mgHint').textContent = s; },
  };
  if (kind === 'solar') {
    mini = startSolarWipe({ ...common, title: t('ui.mg.solar_wipe.title'), hint: 'Tap the sparkly clumps to zap them, then swipe to wipe.', onWin: () => { closeMini(); onSolarWin(); } });
  } else {
    mini = startBatteryStep({ ...common, title: 'Wake up Drone #01', hint: 'Drag the charged battery into the hatch, then plug in the cable.', onDone: () => { closeMini(); onBatteryDone(); } });
  }
}
function closeMini() {
  mini?.destroy();
  mini = null;
  $('mgWrap').hidden = true;
}

// ------------------------------------------------------------------ tutorial (SCENARIO: TUT_HP ... PLAY)

function enterTutorial() {
  mode = 'tutorial';
  $('hud').hidden = false;
  astra.setAuto(false);
  tut = { state: 'TUT_HP', phase: 'talk' };
  say(guide, { lineId: 'astra.intro.status', mood: 'cheerful' });
  say(guide, { lineId: 'astra.tut.hp_intro', mood: 'calm' });
  hud.highlightGauge('hp-bar');
}

function updateTutorial() {
  if (mini) return;
  const talking = astra.open;
  switch (tut.state) {
    case 'TUT_HP':
      if (!talking) { hud.highlightGauge(null); tut = { state: 'TUT_DRONE_CLICK', phase: 'wait' }; }
      break;
    case 'TUT_SOLAR_WIPE':
      if (!talking && tut.phase === 'talk') { tut.phase = 'game'; openMini('solar'); }
      break;
    case 'TUT_BATTERY':
      if (!talking && tut.phase === 'talk') { tut.phase = 'game'; openMini('battery'); }
      break;
    case 'TUT_BUILD':
      if (!talking && tut.phase === 'talk') { tut.phase = 'pick'; $('side').hidden = false; }
      break;
    default:
  }
}

function onSolarWin() {
  command({ type: 'repairSystem', system: 'solarClean', value: 0.95 });
  tut = { state: 'TUT_BATTERY', phase: 'talk' };
  say(guide, { lineId: 'astra.tut.solar_done', mood: 'cheerful' });
  say(guide, { lineId: 'astra.tut.drone01_prompt', mood: 'calm' });
}

function onBatteryDone() {
  command({ type: 'wakeDrone', drone: 'drone-01' });
  audio.play('chirp');
  tut = { state: 'TUT_BUILD', phase: 'talk' };
  say(guide, { lineId: 'astra.tut.drone01_wake', mood: 'cheerful' });
  say(guide, { lineId: 'astra.char.pip', mood: 'cheerful' });
  say(guide, { lineId: 'astra.tut.build_prompt', mood: 'calm' });
}

function finishTutorial() {
  tut = null;
  mode = 'play';
  say(guide, { lineId: 'astra.tut.done', mood: 'cheerful' });
  toast('Tip: give each astronaut a job in the Crew panel.', 5000);
}

// ------------------------------------------------------------------ input

function worldPoint(e, view) {
  const r = canvas.getBoundingClientRect();
  const sx = ((e.clientX - r.left) / r.width) * SCREEN.w;
  const sy = ((e.clientY - r.top) / r.height) * SCREEN.h;
  return { x: (sx - SCREEN.w / 2) / view.zoom + 960, y: (sy - SCREEN.h / 2) / view.zoom + view.cy };
}
const pick = (p) => [...hits].reverse().find((h) => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h)?.id ?? null;

function currentView() {
  if (mode === 'intro') { const f = openingFrameAt(flowT); return { cy: f.cameraY, zoom: f.zoom }; }
  return { cy: GAMEPLAY_VIEW.centerY, zoom: GAMEPLAY_VIEW.zoom };
}

canvas.addEventListener('pointermove', (e) => { if (mode === 'tutorial' || mode === 'play') hover = pick(worldPoint(e, currentView())); });
canvas.addEventListener('pointerdown', (e) => {
  if (mini || (mode !== 'tutorial' && mode !== 'play')) return;
  const id = pick(worldPoint(e, currentView()));
  if (!id) return;
  audio.play('click');
  if (mode === 'tutorial') {
    if (tut.state === 'TUT_DRONE_CLICK' && id === 'drone:drone-01') {
      tut = { state: 'TUT_SOLAR_WIPE', phase: 'talk' };
      say(guide, { lineId: 'astra.tut.drone01_click', mood: 'curious' });
      say(guide, { lineId: 'astra.tut.solar_prompt', mood: 'cheerful' });
    } else if (tut.state === 'TUT_BUILD' && tut.phase === 'pick' && id.startsWith('module:')) hud.select(id);
    return;
  }
  hud.select(id);
});

$('skipBtn').addEventListener('click', () => { flowT = skipTarget(flowT); prevFlowT = flowT; audio.play('click'); });
for (const b of document.querySelectorAll('#speed button')) {
  b.addEventListener('click', () => {
    speed = Number(b.dataset.speed);
    document.querySelectorAll('#speed button').forEach((x) => x.classList.toggle('on', x === b));
  });
}
window.addEventListener('keydown', (e) => { if (e.code === 'Space' && mode === 'play') { e.preventDefault(); $('speed').querySelector(speed ? '[data-speed="0"]' : '[data-speed="1"]').click(); } });

// ------------------------------------------------------------------ frames

const stars = Array.from({ length: 140 }, (_, i) => ({ x: (i * 977) % 1920, y: (i * 619) % 1080, z: 0.3 + ((i * 37) % 10) / 12 }));

function wrapLines(text, maxWidth) {
  const words = text.split(' ');
  const out = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = w; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

function drawCrawl(nowMs) {
  ctx.fillStyle = INTRO_TEXT.background;
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  ctx.fillStyle = '#fff';
  for (const s of stars) { const x = (s.x - nowMs * 0.012 * s.z + 1920 * 10) % 1920; ctx.globalAlpha = 0.25 + 0.5 * s.z; ctx.fillRect(x, s.y, 2 * s.z + 1, 2 * s.z + 1); }
  ctx.globalAlpha = 1;
  const { lines } = introTextAt(flowT);
  ctx.font = 'bold 46px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  const rows = [];
  for (const l of lines) if (l.shown > 0) for (const part of wrapLines(l.text, 1500)) rows.push({ part, l });
  // reveal: only the characters typed so far, row by row
  let budget = {};
  const lineY = 200;
  let y = lineY;
  for (const l of lines) {
    if (!l.shown) continue;
    const wrapped = wrapLines(l.text, 1500);
    let left = l.shown;
    for (const part of wrapped) {
      const visible = part.slice(0, Math.max(0, Math.min(part.length, left)));
      left -= part.length + 1;
      ctx.fillStyle = l.highlight ? INTRO_TEXT.highlightColor : '#e8f4ff';
      if (l.highlight) { ctx.shadowColor = INTRO_TEXT.highlightColor; ctx.shadowBlur = 24; }
      ctx.fillText(visible, SCREEN.w / 2, y);
      ctx.shadowBlur = 0;
      y += 62;
    }
    y += 22;
  }
  // scanlines and vignette
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let sy = 0; sy < SCREEN.h; sy += 4) ctx.fillRect(0, sy, SCREEN.w, 1);
  const vg = ctx.createRadialGradient(960, 540, 300, 960, 540, 1100);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  void budget; void rows;
}

function render(nowMs) {
  if (mode === 'loading') return;
  if (mode === 'intro' && flowT < T.introEnd) { drawCrawl(nowMs); hits = []; return; }
  let S;
  if (mode === 'intro') {
    const f = openingFrameAt(flowT);
    S = {
      game, cy: f.cameraY, zoom: f.zoom, shake: f.shake, nowMs, soil,
      cut: { lander: f.lander, landed: f.lander.landed, dust: f.dustBurst ? { age: flowT - 25 } : null, astronaut: f.astronaut, droneLedOn: f.droneLedOn, showMound: true, parachuteDrift: Math.min(1, Math.max(0, (flowT - 22.2) / 3)) },
    };
  } else {
    S = {
      game, cy: GAMEPLAY_VIEW.centerY, zoom: GAMEPLAY_VIEW.zoom, nowMs, soil, hover,
      cut: null,
      dimExcept: tut?.state === 'TUT_DRONE_CLICK' ? 'drone-01' : null,
      marker: tut?.state === 'TUT_DRONE_CLICK' ? 'drone-01' : null,
      highlight: tut?.state === 'TUT_BUILD' && tut.phase === 'pick' ? 'module:power' : (hud?.selected ?? null),
    };
  }
  hits = drawWorld(ctx, atlas, S);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  try {
    if (mode === 'intro') {
      prevFlowT = flowT;
      flowT += dt;
      for (const cue of cuesBetween(prevFlowT, flowT)) {
        if (cue.type === 'sfx') audio.play(cue.id);
        else if (cue.type === 'astra') say(guide, { lineId: cue.lineId, mood: 'cheerful' });
      }
      astra.setAuto(true);
      if (flowT >= T.introEnd) $('skipBtn').hidden = false;
      if (flowT >= T.panEnd) { audio.stopWind(); $('skipBtn').hidden = true; enterTutorial(); }
    } else if (mode === 'tutorial') {
      updateTutorial();
    } else if (mode === 'play' && !mini) {
      if (speed > 0 && game.status === 'running') {
        simAccum += dt * speed * SIM_MINUTES_PER_SECOND;
        const whole = Math.min(60, Math.floor(simAccum));
        if (whole > 0) {
          simAccum -= whole;
          const events = step(game, whole);
          hearEvents(guide, events);
          if (events.some((e) => e.type === 'storm-warning' || e.type === 'emergency')) { speed = 0; document.querySelector('#speed [data-speed="0"]').click(); audio.play('alert'); }
        }
      }
      if (game.status !== 'running') showSummary();
    }
    if (hud && (mode === 'tutorial' || mode === 'play')) hud.update();
    astra.update(now);
    render(now);
  } catch (err) {
    console.error(err);
    toast(`Error: ${err.message}`, 8000);
  }
  requestAnimationFrame(loop);
}

function showSummary() {
  if (mode === 'over') return;
  mode = 'over';
  const goals = evaluateObjectives(game, true);
  const stars = game.result?.stars ?? 0;
  const el = $('summary');
  el.hidden = false;
  el.innerHTML = `<h1>${game.status === 'complete' ? 'Mission complete!' : 'Mission paused'}</h1><div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><div>${game.result?.reason ?? ''}</div><div>Score ${game.result?.score?.total ?? 0}</div><ul>${goals.map((g) => `<li>${g.status === 'done' ? '✔' : '✖'} ${g.text}</li>`).join('')}</ul><button id="again">Play again</button>`;
  $('again').addEventListener('click', () => location.reload());
}

// ------------------------------------------------------------------ boot

async function boot() {
  const bar = document.querySelector('#loadbar i');
  await loadStrings();
  atlas = await loadAtlas((f) => { bar.style.width = `${f * 100}%`; });
  soil = buildSoil(atlas);
  game = createGame(LEVEL);
  guide = createGuide();
  astra = createAstraPanel(guide, atlas);
  hud = createHud(game, atlas, command);
  $('startBtn').hidden = false;
  $('startBtn').addEventListener('click', () => {
    audio.unlock();
    $('loading').hidden = true;
    mode = 'intro';
    $('skipBtn').hidden = false;
  });
  // test and debug hook: ?skip jumps straight to the end of the cutscene
  const q = new URLSearchParams(location.search);
  window.__ares = { get hits() { return hits; }, view: () => currentView(), get mode() { return mode; }, get tut() { return tut; }, get game() { return game; }, jump: (s) => { flowT = s; prevFlowT = s; }, state: () => flowStateAt(flowT) };
  if (q.has('autostart')) { $('loading').hidden = true; mode = 'intro'; flowT = Number(q.get('autostart')) || 0; prevFlowT = flowT; }
  requestAnimationFrame(loop);
}

boot().catch((err) => {
  console.error(err);
  document.querySelector('#loading .sub').textContent = `Could not start: ${err.message}`;
});
