/**
 * Browser entry point: loads strings and art, then runs
 *   intro crawl -> landing cutscene -> tutorial -> the 20-Sol campaign and Free-Play
 * as SCENARIO.md describes. The campaign simulation (src/campaign) runs only while playing;
 * the screen reads its state and sends commands, it never edits it.
 */
import { loadStrings, t } from './flow/strings.js';
import { loadAtlas } from './render/atlas.js';
import { drawCampaign, buildSoil, createWalker, SCREEN } from './render/campaign-world.js';
import { createCampaign, step, command } from './campaign/engine.js';
import { SECONDS_PER_SOL, SOL } from './campaign/data.js';
import { openingFrameAt, cuesBetween, skipTarget, T, GAMEPLAY_VIEW, INTRO_TEXT, introTextAt, flowStateAt } from './flow/intro.js';
import { createGuide, say } from './flow/astra.js';
import { createAstraPanel } from './ui/astra-panel.js';
import { createUi, miniTitle } from './ui/campaign-ui.js';
import { unlockFor, checkBadges } from './campaign/logbook.js';
import { createExtras } from './ui/extras.js';
import { shieldingByPlace } from './campaign/hazards.js';
import { startSolarWipe, startBatteryStep } from './ui/minigames.js';
import { startMini2, hasMini2 } from './ui/minigames2.js';
import * as audio from './ui/audio.js';

const SIM_MINUTES_PER_SECOND = SOL / SECONDS_PER_SOL; // 1 Sol = 4 real minutes at 1x (SCENARIO 3.1)
const SAVE_KEY = 'ares-kids-save-v1';
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

let atlas, soil, s, guide, astra, ui, extras;
let mode = 'loading'; // loading | intro | tutorial | play
let flowT = 0;
let prevFlowT = 0;
let speed = 1;
let simAccum = 0;
let tut = null; // { state, phase }
let hits = [];
let hover = null;
let mini = null;
const walker = createWalker();

// ------------------------------------------------------------------ interface size

const UI_KEY = 'ares-kids-ui-scale';
let uiScale = 1.3;
try { uiScale = Number(localStorage.getItem(UI_KEY)) || uiScale; } catch { /* storage may be blocked */ }
function applyUiScale() {
  uiScale = Math.min(1.8, Math.max(0.9, uiScale));
  document.documentElement.style.setProperty('--ui', String(uiScale));
  try { localStorage.setItem(UI_KEY, String(uiScale)); } catch { /* ignore */ }
}
applyUiScale();
for (const b of document.querySelectorAll('#uisize button')) b.addEventListener('click', () => { uiScale += Number(b.dataset.ui) * 0.1; applyUiScale(); });

// ------------------------------------------------------------------ sound on / off (HUD)

const muteBtn = $('muteBtn');
function showMute() {
  const muted = audio.director.settings.muted;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.title = muted ? 'Sound off (click to turn on)' : 'Sound on (click to turn off)';
  muteBtn.classList.toggle('on', !muted);
}
muteBtn?.addEventListener('click', () => { audio.unlock(); audio.director.toggleMute(); showMute(); });
if (muteBtn) showMute();

// ------------------------------------------------------------------ helpers

function toast(text, ms = 2600) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, ms);
}

/** Unlock Logbook cards for a trigger key and announce them (SCENARIO 8.1). */
function trigger(key) {
  const fresh = unlockFor(s, key);
  for (const id of fresh) {
    toast(`${t('ui.logbook.new_card')} ${t(`card.${id}.title`)}`, 3200);
    if (s.logbook.length === 1) say(guide, { lineId: 'astra.logbook.first', mood: 'cheerful' });
  }
}
function sayLine(lineId, mood) { say(guide, { lineId, mood }); trigger(lineId); }
function checkAllBadges() {
  for (const id of checkBadges(s)) {
    toast(`${t('ui.badge.earned')} ${t(`badge.${id}.name`)}`, 3500);
    audio.play('win');
    if (s.badges.length === 1) say(guide, { lineId: 'astra.badge.first', mood: 'cheerful' });
  }
}

/** Turn campaign events into what the player sees and hears. */
function handleEvents(events) {
  audio.director.campaignEvents(events); // sounds and music state (src/audio/audioDirector.js)
  for (const e of events) {
    switch (e.type) {
      case 'astra': sayLine(e.lineId, e.mood); break;
      case 'act': ui.showActCard(e.lineId); break;
      case 'radio': ui.pushRadio(e.id); trigger(`R:${e.id}`); break;
      case 'dilemma': trigger(`D:${e.id}`); break;
      case 'event': trigger(`E:${e.id}`); break;
      case 'chosen': trigger(`C:${e.id}${e.choice}`); break;
      case 'log': say(guide, { lineId: e.lineId, mood: 'calm' }); break;
      case 'returned': ui.showLoot(e); break;
      case 'finale': checkAllBadges(); ui.showFinale(); break;
      case 'toast': toast(e.text); break;
      case 'emergency': toast(`Emergency: ${e.kind}!`, 4000); break;
      case 'built': toast('Room finished!'); break;
      case 'upgraded': toast('Upgrade installed!'); break;
      default:
    }
  }
}

/** Send a command to the campaign. Rejected commands show their reason. */
function send(cmd) {
  if (cmd.type === 'say') { say(guide, { lineId: cmd.lineId, mood: 'curious' }); return { ok: true }; }
  const res = command(s, cmd);
  if (!res.ok) { toast(res.error); return res; }
  handleEvents(res.events);
  if (tut?.state === 'TUT_BUILD' && cmd.type === 'build' && cmd.module === 'battery') finishTutorial();
  return res;
}

// ------------------------------------------------------------------ mini-games

function openMini(game, { onDone = null } = {}) {
  if (mini) return;
  $('mgWrap').hidden = false;
  const c = $('mg');
  const common = {
    canvas: c, atlas,
    onTitle: (x) => { document.querySelector('.mgTitle').textContent = x; },
    onHint: (x) => { document.querySelector('.mgHint').textContent = x; },
  };
  const finish = (win) => { send({ type: 'miniResult', game, win }); };
  const win = () => { closeMini(); finish(true); onDone?.(true); };
  if (game === 'solar_wipe') mini = startSolarWipe({ ...common, title: t('ui.mg.solar_wipe.title'), hint: 'Tap the sparkly clumps to zap them, then swipe to wipe.', onWin: () => { closeMini(); onSolarWin(); onDone?.(true); } });
  else if (game === 'battery') mini = startBatteryStep({ ...common, title: 'Wake up Drone #01', hint: 'Drag the charged battery into the hatch, then plug in the cable.', onDone: () => { closeMini(); onBatteryDone(); } });
  else if (hasMini2(game)) mini = startMini2(game, { ...common, title: miniTitle(game), hint: 'Follow the one-line instruction at the top. You have time!', onWin: win, onFail: () => finish(false) });
  else { toast('That job is not ready yet.'); $('mgWrap').hidden = true; }
}
function closeMini() {
  mini?.destroy();
  mini = null;
  $('mgWrap').hidden = true;
}

/** Required prep before an expedition: Wheel Pebble Vacuum, then a Suit Seal Check (SCENARIO 5.1). */
function launchWithPrep(key) {
  openMini('wheel_vacuum', { onDone: () => setTimeout(() => openMini('suit_seal', { onDone: () => { send({ type: 'launch', expedition: key }); } }), 250) });
}

// ------------------------------------------------------------------ tutorial (SCENARIO: TUT_HP ... PLAY)

function enterTutorial() {
  mode = 'tutorial';
  $('hud').hidden = false;
  astra.setAuto(false);
  tut = { state: 'TUT_HP', phase: 'talk' };
  sayLine('astra.intro.status', 'cheerful');
  sayLine('astra.tut.hp_intro', 'calm');
  ui.highlight('hp');
}

function updateTutorial() {
  if (mini) return;
  const talking = astra.open;
  switch (tut.state) {
    case 'TUT_HP':
      if (!talking) { ui.highlight(null); tut = { state: 'TUT_DRONE_CLICK', phase: 'wait' }; }
      break;
    case 'TUT_SOLAR_WIPE':
      if (!talking && tut.phase === 'talk') { tut.phase = 'game'; openMini('solar_wipe'); }
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
  send({ type: 'miniResult', game: 'solar_wipe', win: true });
  tut = { state: 'TUT_BATTERY', phase: 'talk' };
  sayLine('astra.tut.solar_done', 'cheerful');
  sayLine('astra.tut.drone01_prompt', 'calm');
}

function onBatteryDone() {
  send({ type: 'wakeDrone', drone: 'drone-01' });
  tut = { state: 'TUT_BUILD', phase: 'talk' };
  sayLine('astra.tut.drone01_wake', 'cheerful');
  sayLine('astra.char.pip', 'cheerful');
  sayLine('astra.tut.build_prompt', 'calm');
}

function finishTutorial() {
  tut = null;
  mode = 'play';
  sayLine('astra.tut.done', 'cheerful');
  ui.select('module:battery');
  save();
}

// ------------------------------------------------------------------ save and load

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage may be blocked */ }
}
function loadSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// ------------------------------------------------------------------ input

function currentView() {
  if (mode === 'intro') { const f = openingFrameAt(flowT); return { cy: f.cameraY, zoom: f.zoom }; }
  return { cy: GAMEPLAY_VIEW.centerY, zoom: GAMEPLAY_VIEW.zoom };
}
function worldPoint(e) {
  const view = currentView();
  const r = canvas.getBoundingClientRect();
  const sx = ((e.clientX - r.left) / r.width) * SCREEN.w;
  const sy = ((e.clientY - r.top) / r.height) * SCREEN.h;
  return { x: (sx - SCREEN.w / 2) / view.zoom + 960, y: (sy - SCREEN.h / 2) / view.zoom + view.cy };
}
const pick = (p) => [...hits].reverse().find((h) => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h)?.id ?? null;

canvas.addEventListener('pointermove', (e) => { if (mode === 'tutorial' || mode === 'play') hover = pick(worldPoint(e)); });
canvas.addEventListener('pointerdown', (e) => {
  if (mini || ui.modalOpen || (mode !== 'tutorial' && mode !== 'play')) return;
  const id = pick(worldPoint(e));
  if (!id) return;
  audio.play('click');
  if (mode === 'tutorial') {
    if (tut.state === 'TUT_DRONE_CLICK' && id === 'drone:drone-01') {
      tut = { state: 'TUT_SOLAR_WIPE', phase: 'talk' };
      sayLine('astra.tut.drone01_click', 'curious');
      sayLine('astra.tut.solar_prompt', 'cheerful');
    } else if (tut.state === 'TUT_BUILD' && tut.phase === 'pick' && id.startsWith('module:')) ui.select(id);
    return;
  }
  // orders: a selected drone sent to a room frame, or the selected Commander sent to a place
  const sel = ui.selected;
  if (sel?.startsWith('drone:') && id.startsWith('module:')) {
    const mod = id.slice(7);
    const m = s.modules[mod];
    if (!m) { ui.select(id); return; }
    send({ type: m.status === 'unbuilt' ? 'build' : 'upgrade', module: mod, drone: sel.slice(6) });
    return;
  }
  if (sel === 'crew:cmdr' && (id.startsWith('module:') || id === 'surface')) {
    const place = id === 'surface' ? 'outside' : id.slice(7);
    const res = send({ type: 'order', place });
    if (res.ok) {
      const game = { outside: 'solar_wipe', lifesupport: 'valve_balance', battery: 'heat_pump', greenhouse: 'nutrient_match' }[place];
      if (game && s.tasks.some((t2) => t2.game === game)) setTimeout(() => openMini(game), 600);
    }
    return;
  }
  ui.select(id);
});

$('skipBtn').addEventListener('click', () => { flowT = skipTarget(flowT); prevFlowT = flowT; audio.play('click'); });
for (const b of document.querySelectorAll('#speed button')) {
  b.addEventListener('click', () => {
    speed = Number(b.dataset.speed);
    document.querySelectorAll('#speed button').forEach((x) => x.classList.toggle('on', x === b));
  });
}
window.addEventListener('keydown', (e) => { if (e.code === 'Space' && mode === 'play') { e.preventDefault(); document.querySelector(speed ? '#speed [data-speed="0"]' : '#speed [data-speed="1"]').click(); } });

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
  for (const st of stars) { const x = (st.x - nowMs * 0.012 * st.z + 1920 * 10) % 1920; ctx.globalAlpha = 0.25 + 0.5 * st.z; ctx.fillRect(x, st.y, 2 * st.z + 1, 2 * st.z + 1); }
  ctx.globalAlpha = 1;
  const { lines } = introTextAt(flowT);
  ctx.font = 'bold 46px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  let y = 200;
  for (const l of lines) {
    if (!l.shown) continue;
    let left = l.shown;
    for (const part of wrapLines(l.text, 1500)) {
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
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let sy = 0; sy < SCREEN.h; sy += 4) ctx.fillRect(0, sy, SCREEN.w, 1);
  const vg = ctx.createRadialGradient(960, 540, 300, 960, 540, 1100);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
}

let lastFrameMs = 0;
function render(nowMs) {
  if (mode === 'loading') return;
  if (mode === 'intro' && flowT < T.introEnd) { drawCrawl(nowMs); hits = []; return; }
  const dtMs = Math.min(100, nowMs - lastFrameMs);
  lastFrameMs = nowMs;
  let S;
  if (mode === 'intro') {
    const f = openingFrameAt(flowT);
    S = {
      s, cy: f.cameraY, zoom: f.zoom, shake: f.shake, nowMs, soil, walker, dtMs,
      cut: { lander: f.lander, landed: f.lander.landed, dust: f.dustBurst ? { age: flowT - 25 } : null, astronaut: f.astronaut, droneLedOn: f.droneLedOn, showMound: true, parachuteDrift: Math.min(1, Math.max(0, (flowT - 22.2) / 3)) },
    };
  } else {
    S = {
      s, cy: GAMEPLAY_VIEW.centerY, zoom: GAMEPLAY_VIEW.zoom, nowMs, soil, hover, walker, dtMs, cut: null,
      dimExcept: tut?.state === 'TUT_DRONE_CLICK' ? 'drone-01' : null,
      marker: tut?.state === 'TUT_DRONE_CLICK' ? 'drone-01' : null,
      highlight: tut?.state === 'TUT_BUILD' && tut.phase === 'pick' ? 'module:battery' : (ui?.selected ?? null),
      hazards: mode === 'play' ? extras.hazards() : [],
      radiation: mode === 'play' && extras.radiation ? shieldingByPlace(s) : null,
    };
  }
  hits = drawCampaign(ctx, atlas, S);
}

let last = performance.now();
let savedSol = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  try {
    if (mode === 'intro') {
      prevFlowT = flowT;
      flowT += dt;
      for (const cue of cuesBetween(prevFlowT, flowT)) {
        if (cue.type === 'sfx') audio.director.flowCue(cue);
        else if (cue.type === 'astra') sayLine(cue.lineId, 'cheerful');
      }
      astra.setAuto(true);
      if (flowT >= T.introEnd) $('skipBtn').hidden = false;
      if (flowT >= T.panEnd) { audio.stopWind(); $('skipBtn').hidden = true; enterTutorial(); }
    } else if (mode === 'tutorial') {
      updateTutorial();
    } else if (mode === 'play') {
      astra.setAuto(false);
      if (s.pending) {
        ui.showChoice(s.pending.kind, s.pending.id);
        if (speed > 0) document.querySelector('#speed [data-speed="0"]').click();
      } else if (!mini && !ui.modalOpen && speed > 0) {
        simAccum += dt * speed * SIM_MINUTES_PER_SECOND;
        const whole = Math.min(60, Math.floor(simAccum));
        if (whole > 0) {
          simAccum -= whole;
          const solBefore = Math.floor(s.minute / SOL);
          handleEvents(step(s, whole));
          if (Math.floor(s.minute / SOL) !== solBefore) { savedSol = s.minute; save(); }
        }
      }
    }
    if (mode === 'play' && Math.floor(now / 1000) !== loop.lastSec) { loop.lastSec = Math.floor(now / 1000); checkAllBadges(); }
    audio.director.tick({ s, mode });
    if (extras) extras.update(mode === 'play');
    if (ui && (mode === 'tutorial' || mode === 'play')) { ui.update(); $('hud').hidden = false; if (mode === 'play') $('side').hidden = false; }
    astra.update(now);
    render(now);
  } catch (err) {
    console.error(err);
    toast(`Error: ${err.message}`, 8000);
  }
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ boot

async function boot() {
  const bar = document.querySelector('#loadbar i');
  await loadStrings();
  atlas = await loadAtlas((f) => { bar.style.width = `${f * 100}%`; });
  soil = buildSoil(atlas);
  s = createCampaign({ seed: 1 });
  guide = createGuide();
  astra = createAstraPanel(guide, atlas);
  ui = createUi({ atlas, s, send, openMini });
  ui.launch = launchWithPrep;
  extras = createExtras({ s, ui, openMap: () => ui.showMap(launchWithPrep) });
  void savedSol;
  const saved = loadSave();
  $('startBtn').hidden = false;
  if (saved) {
    const cont = document.createElement('button');
    cont.id = 'contBtn';
    cont.textContent = 'Continue mission';
    cont.addEventListener('click', () => {
      audio.unlock();
      audio.director.reset();
      Object.assign(s, saved); // the UI and the renderer hold this same object
      for (const d of s.drones) d.queue ??= []; // saves made before Drone Link have no queue
      s.order ??= null;
      $('loading').hidden = true;
      mode = 'play';
    });
    $('startBtn').after(cont);
  }
  $('startBtn').addEventListener('click', () => {
    audio.unlock();
    $('loading').hidden = true;
    mode = 'intro';
    $('skipBtn').hidden = false;
  });
  // test and debug hooks
  const q = new URLSearchParams(location.search);
  window.__ares = {
    get hits() { return hits; }, view: () => currentView(), get mode() { return mode; }, get tut() { return tut; }, get s() { return s; },
    send, jump: (sec) => { flowT = sec; prevFlowT = sec; }, state: () => flowStateAt(flowT), openMini,
  };
  if (q.has('autostart')) { $('loading').hidden = true; mode = 'intro'; flowT = Number(q.get('autostart')) || 0; prevFlowT = flowT; }
  if (q.has('play')) { $('loading').hidden = true; mode = 'play'; command(s, { type: 'wakeDrone', drone: 'drone-01' }); s.flags.panelsCleaned = true; }
  requestAnimationFrame(loop);
}

boot().catch((err) => {
  console.error(err);
  document.querySelector('#loading .sub').textContent = `Could not start: ${err.message}`;
});
