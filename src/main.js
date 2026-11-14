/**
 * Browser entry point: loads strings and art, then runs
 *   intro crawl -> landing cutscene -> tutorial -> the 20-Sol campaign and Free-Play
 * as SCENARIO.md describes. The campaign simulation (src/campaign) runs only while playing;
 * the screen reads its state and sends commands, it never edits it.
 */
import { loadStrings, setStringVars, t } from './flow/strings.js';
import { earthMarsLinkForSol, formatDelay } from './data/nasa/lightTime.js';
import { loadAtlas } from './render/atlas.js';
import { drawCampaign, buildSoil, createWalker, SCREEN } from './render/campaign-world.js';
import { ROVER, arrived, place as placeBody } from './render/movers.js';
import { garageSpots, entryGeometry } from './render/geometry.js';
import { createCampaign, step, command, clockAt } from './campaign/engine.js';
import { prefs, setPref, applyPrefs } from './ui/prefs.js';
import { restoreSave } from './campaign/save-migrate.js';
import { SECONDS_PER_SOL, SOL, RECIPES, MODULES } from './campaign/data.js';
import { openingFrameAt, cuesBetween, skipTarget, T, GAMEPLAY_VIEW, INTRO_TEXT, introTextAt, flowStateAt, astronautPathAt, entryDoorsAt } from './flow/intro.js';
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
const NICK = { 'drone-01': 'Pip', 'drone-02': 'Bumble', 'drone-03': 'Zip' };
const $ = (id) => document.getElementById(id);

const stage = $('stage');
const canvas = $('game');
const ctx = canvas.getContext('2d');

function fit() {
  const k = Math.min(window.innerWidth / SCREEN.w, window.innerHeight / SCREEN.h);
  // A20: the game is pinned to the top of the window (only centred left-right). Centred top-bottom, a window that is
  // taller than 16:9 pushed the whole game, top bar included, down behind a black band, so the bar seemed to move.
  stage.style.transform = `translate(${(window.innerWidth - SCREEN.w * k) / 2}px, 0px) scale(${k})`;
  // C16: touch screens. --k lets CSS keep every tap target at least 44 CSS px however small the stage is drawn;
  // a phone held upright gets the "Turn your device sideways" card and the game pauses until it is turned.
  const root = document.documentElement;
  root.style.setProperty('--k', String(k));
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  root.classList.toggle('touch-small', coarse && k < 0.6);
  const portrait = coarse && window.innerHeight > window.innerWidth;
  root.classList.toggle('portrait-touch', portrait);
  fit.portrait = portrait;
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 120));
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
const walker = createWalker(); // the Commander's body (movers.js)
const droneMovers = {}; // one body per drone
const rover = { phase: 'parked', t0: 0, k: 0, boardAt: 0 }; // parked | boarding | out | gone | in
const boardSpot = () => garageSpots().board;
/** The world clock: it runs only while the game runs (not paused, no card, no mini-game), so the characters stop with the time. */
let worldMs = 0;
let worldDtMs = 0;
let speedBeforeDecision = 0; // the game speed to come back to after a decision card

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
  muteBtn.setAttribute('aria-label', muted ? 'Sound is off. Turn sound on' : 'Sound is on. Turn sound off');
  muteBtn.classList.toggle('on', !muted);
}
muteBtn?.addEventListener('click', () => { audio.unlock(); audio.director.toggleMute(); showMute(); });
// Music fix: every click or key wakes the audio. A browser can suspend it (another tab played sound, headphones
// were unplugged, the laptop slept), and only a user gesture may start it again.
window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
window.addEventListener('keydown', () => audio.unlock(), { capture: true });
/** Sound off is remembered between visits: say so once at the start, so silence is not mistaken for a bug. */
function remindIfMuted() {
  if (audio.director.settings.muted) toast('Sound is off. Tap the speaker button (top right) to turn it on.', 4500);
}
if (muteBtn) showMute();

// ------------------------------------------------------------------ settings (C15)

applyPrefs();
/** The Settings card: master, music and effects volume (saved by the sound engine), Reduce motion, Large text. */
function openSettings() {
  if (!ui) return;
  const st = audio.director.settings;
  const pct = (v) => Math.round((v ?? 1) * 100);
  ui.openModal(`<div class="card settings" aria-labelledby="setTitle"><div class="hd" id="setTitle">SETTINGS</div>
    <label class="setrow"><span>Master volume</span><input type="range" id="setMaster" min="0" max="100" value="${pct(st.masterVolume)}" aria-label="Master volume"><b id="setMasterV">${pct(st.masterVolume)}%</b></label>
    <label class="setrow"><span>Music volume</span><input type="range" id="setMusic" min="0" max="100" value="${pct(st.musicVolume)}" aria-label="Music volume"><b id="setMusicV">${pct(st.musicVolume)}%</b></label>
    <label class="setrow"><span>Effects volume</span><input type="range" id="setSfx" min="0" max="100" value="${pct(st.sfxVolume)}" aria-label="Sound effects volume"><b id="setSfxV">${pct(st.sfxVolume)}%</b></label>
    <label class="setrow check"><input type="checkbox" id="setMotion" ${prefs.reduceMotion ? 'checked' : ''}><span>Reduce motion <small>(no screen shake, no pulsing)</small></span></label>
    <label class="setrow check"><input type="checkbox" id="setLarge" ${prefs.largeText ? 'checked' : ''}><span>Large text</span></label>
    <button class="choice" id="setOk">Done</button></div>`, 'settings');
  const bind = (id, fn) => $(id).addEventListener('input', (e) => { const v = Number(e.target.value) / 100; fn(v); $(`${id}V`).textContent = `${e.target.value}%`; });
  bind('setMaster', (v) => { audio.unlock(); audio.director.setMasterVolume(v); });
  bind('setMusic', (v) => { audio.unlock(); audio.director.setMusicVolume(v); });
  bind('setSfx', (v) => { audio.unlock(); audio.director.setSfxVolume(v); audio.play('click'); }); // C15: the effects have their own slider; a click lets the player hear the level
  $('setMotion').addEventListener('change', (e) => setPref('reduceMotion', e.target.checked));
  $('setLarge').addEventListener('change', (e) => setPref('largeText', e.target.checked));
  $('setOk').addEventListener('click', () => ui.closeModal());
  $('setMaster').focus();
}
$('settingsBtn')?.addEventListener('click', () => { audio.play('click'); openSettings(); });

// ------------------------------------------------------------------ helpers

// {delay} in ASTRA lines and the antenna counter: the real Earth-Mars one-way light time on the
// current Sol (NASA/JPL Keplerian elements, label: approximation). Recomputed once per Sol.
let delaySol = 0, delaySeconds = 840;
function updateLightTime() {
  const { sol } = clockAt(s.minute);
  if (sol === delaySol) return;
  delaySol = sol;
  delaySeconds = earthMarsLinkForSol(sol).oneWaySeconds;
  setStringVars({ delay: formatDelay(delaySeconds) });
}

let toastShowing = null; // { prio, until } of the message on the screen
const toastQueue = []; // lower-priority messages that arrived while a warning was showing
/** A short message. A warning (prio 2) is never covered by a cheerful one: those wait their turn. */
function toast(text, ms = 2600, prio = 0) {
  if (toastShowing && performance.now() < toastShowing.until && toastShowing.prio > prio) { if (toastQueue.length < 3) toastQueue.push({ text, ms, prio }); return; }
  showToast(text, ms, prio);
}
function showToast(text, ms, prio) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  el.classList.toggle('alert', prio > 0);
  toastShowing = { prio, until: performance.now() + ms };
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.hidden = true;
    toastShowing = null;
    const next = toastQueue.shift();
    if (next) showToast(next.text, next.ms, next.prio);
  }, ms);
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
      case 'launched': rover.phase = 'boarding'; rover.boardAt = worldMs; break;
      case 'returned': rover.phase = 'in'; rover.t0 = worldMs; ui.showLoot(e); break;
      case 'queued': toast(`${NICK[e.drone] ?? 'The drone'} will do that next.`); break;
      case 'ordered': break;
      case 'finale': checkAllBadges(); ui.showFinale(); break;
      case 'gameover': onGameOver(); break;
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
  if (!res.ok) { toast(res.error); audio.play('actionDenied'); return res; } // A23: a soft "no" with every refused command
  handleEvents(res.events);
  if (tut?.state === 'TUT_BUILD' && cmd.type === 'build' && cmd.module === 'battery') finishTutorial();
  if (mode === 'play') scheduleSave();
  return res;
}

// ------------------------------------------------------------------ mini-games

function openMini(game, { onDone = null } = {}) {
  if (mini || s.status !== 'running') return;
  $('mgWrap').hidden = false;
  $('mgBack').hidden = mode === 'tutorial'; // the tutorial steps cannot be skipped; every other job can be left
  const c = $('mg');
  const common = {
    canvas: c, atlas,
    onTitle: (x) => { document.querySelector('.mgTitle').textContent = x; },
    onHint: (x) => { document.querySelector('.mgHint').textContent = x; },
  };
  const finish = (win) => { send({ type: 'miniResult', game, win }); };
  const win = () => { closeMini(); finish(true); onDone?.(true); };
  if (game === 'solar_wipe') mini = startSolarWipe({ ...common, title: t('ui.mg.solar_wipe.title'), hint: 'Swipe across the panels to wipe the dust. Sparkly sticky spots need a few extra wipes.', onWin: () => { closeMini(); onSolarWin(); onDone?.(true); } });
  else if (game === 'battery') mini = startBatteryStep({ ...common, title: 'Wake up Drone #01', hint: 'Drag the charged battery into the hatch, then plug in the cable.', onDone: () => { closeMini(); onBatteryDone(); } });
  else if (hasMini2(game)) mini = startMini2(game, { ...common, delaySeconds, liner: Boolean(s.upgrades?.suit_liner) /* Suit Seal Check: one more thing to drag (SCENARIO 4.8) */, title: miniTitle(game), hint: '' /* the game's own line at the top says what to do; a second generic line only adds reading */, onWin: win, onFail: () => finish(false) });
  else { toast('That job is not ready yet.'); $('mgWrap').hidden = true; }
}
function closeMini() {
  mini?.destroy();
  mini = null;
  $('mgWrap').hidden = true;
}
$('mgBack').addEventListener('click', () => { if (mini && mode !== 'tutorial') { audio.play('click'); closeMini(); } });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mini && mode !== 'tutorial') closeMini(); });

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
      if (!talking && tut.phase === 'talk') {
        tut.phase = 'pick';
        $('side').hidden = false;
        ui.setTab('base');
        ui.select('module:battery'); // the Battery row, with its Build button, is scrolled into view (A30)
      }
      break;
    default:
  }
}

function onSolarWin() {
  send({ type: 'miniResult', game: 'solar_wipe', win: true });
  if (mode !== 'tutorial') return; // a normal Solar Wipe from the Tasks tab must not replay the tutorial
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

let saveWarned = false;
function save() {
  if (s.status === 'over') return; // a finished mission is not saved
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {
    // B3: say it once instead of failing silently (private windows and some school computers block storage)
    if (!saveWarned) { saveWarned = true; toast('Your progress cannot be saved in this browser (storage is blocked). Keep this tab open to keep playing.', 6000, 1); }
  }
}

/** The Commander ran out of HP (docs/ERRORS.md A28): the clock stops, the old save goes, the loop shows the Game Over screen. */
function onGameOver() {
  clearTimeout(saveTimer);
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage may be blocked */ }
  closeMini();
  document.querySelector('#speed [data-speed="0"]')?.click();
  audio.play('alert');
}
/** "Start over": forget the saved game and load the page again, which shows the start screen. */
function restartGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage may be blocked */ }
  location.reload();
}
function loadSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// ------------------------------------------------------------------ input

function currentView() {
  if (mode === 'intro') { const f = openingFrameAt(flowT); return { cx: f.cameraX, cy: f.cameraY, zoom: f.zoom }; }
  return { cx: GAMEPLAY_VIEW.centerX, cy: GAMEPLAY_VIEW.centerY, zoom: GAMEPLAY_VIEW.zoom };
}
function worldPoint(e) {
  const view = currentView();
  const r = canvas.getBoundingClientRect();
  const sx = ((e.clientX - r.left) / r.width) * SCREEN.w;
  const sy = ((e.clientY - r.top) / r.height) * SCREEN.h;
  return { x: (sx - SCREEN.w / 2) / view.zoom + view.cx, y: (sy - SCREEN.h / 2) / view.zoom + view.cy };
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
    } else if (tut.state === 'TUT_BUILD' && tut.phase === 'pick' && id.startsWith('module:')) pickInWorld(id);
    return;
  }
  // a dormant drone: tap it to wake it (kit ready) or to be told what wakes it
  if (id.startsWith('drone:')) {
    const d = s.drones.find((x) => `drone:${x.id}` === id);
    if (d && d.status !== 'awake') { wakeDrone(d); return; }
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
  pickInWorld(id);
});

/** A21: a tap on anything that lights up always gives a visible answer (a list row, a tip, or the crater map). */
function pickInWorld(id) {
  ui.select(id);
  if (id.startsWith('module:')) {
    const mod = id.slice(7);
    const m = s.modules[mod];
    if (mod === 'garage' && m?.status === 'online' && !s.away) { ui.showMap(); return; }
    ui.setTab('base');
    ui.revealSelected();
    if (!m || !MODULES[mod]) return;
    const nm = t(MODULES[mod].nameId);
    const msg = m.status === 'unbuilt' ? `${nm}: not built yet. Tap Build in the Base list, or tap an awake drone and then this frame.`
      : m.status === 'building' ? `${nm}: building, ${Math.round(m.progress * 100)}% done.`
        : `${nm}: ${m.tier === 2 ? 'Tier 2, working' : 'working'}.`;
    toast(msg, 3200);
  } else if (id.startsWith('drone:')) {
    ui.setTab('drones');
    ui.revealSelected();
    toast(`${NICK[id.slice(6)] ?? 'Drone'} is ready. Now tap a room frame to send it there.`, 3200);
  } else if (id === 'crew:cmdr') {
    toast('Commander selected. Tap a room, or the ground outside, to walk there.', 3200);
  }
}

const KIT = { 'drone-02': 'repair_kit', 'drone-03': 'reboot_kit' };
/** A sleeping drone was tapped: use its kit if there is one, else say how to get it. */
function wakeDrone(d) {
  const kit = KIT[d.id];
  if (kit && (s.kits[kit] ?? 0) > 0) { send({ type: 'useKit', kit, drone: d.id }); return; }
  toast(kit ? `${NICK[d.id]} is asleep. Craft a ${t(RECIPES[kit].nameId)} in the Workshop, then tap ${NICK[d.id]} again.` : `${NICK[d.id]} is asleep.`, 4200);
  if (kit) ui.setTab('workshop');
}

$('skipBtn').addEventListener('click', () => {
  const target = skipTarget(flowT);
  // B15: Skip keeps the transition sounds of the part it jumps over (the touchdown thud, the airlock hiss),
  // each sound once and at most three, instead of dropping them; typing blips and ASTRA lines are skipped
  const seen = new Map();
  for (const cue of cuesBetween(flowT, target)) if (cue.type === 'sfx' && cue.char === undefined) seen.set(cue.id, cue);
  [...seen.values()].slice(-3).forEach((cue) => audio.director.flowCue(cue));
  flowT = target; prevFlowT = flowT; audio.play('click');
});
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

/** The Commander boards, the Rover drives out and later rolls home; the Commander steps off. */
function stepRover(nowMs) {
  const spot = boardSpot();
  const atRover = arrived(walker) && walker.goal && walker.goal.x === spot.x && walker.goal.y === spot.y; // not merely done with an earlier walk
  if (rover.phase === 'boarding' && (atRover || nowMs - rover.boardAt > 9000)) { rover.phase = 'out'; rover.t0 = nowMs; }
  if (rover.phase === 'out' || rover.phase === 'in') {
    rover.k = Math.min(1, (nowMs - rover.t0) / ROVER.ms);
    if (rover.k >= 1) {
      if (rover.phase === 'out') rover.phase = 'gone';
      else { rover.phase = 'parked'; rover.k = 0; placeBody(walker, boardSpot()); }
    }
  }
  if (!s.away && (rover.phase === 'gone' || rover.phase === 'boarding')) { rover.phase = 'parked'; rover.k = 0; } // a loaded game, or a trip that was cancelled
}

function render(nowMs) {
  if (mode === 'loading') return;
  if (mode === 'intro' && flowT < T.introEnd) { drawCrawl(nowMs); hits = []; return; }
  let S;
  if (mode === 'intro') {
    const f = openingFrameAt(flowT);
    S = {
      s, cx: f.cameraX, cy: f.cameraY, zoom: f.zoom, shake: prefs.reduceMotion ? null : f.shake, nowMs, worldMs, soil, walker, droneMovers, rover, dtMs: worldDtMs,
      cut: { lander: f.lander, landed: f.lander.landed, dust: f.dustBurst ? { age: flowT - 25 } : null, astronaut: { pose: astronautPathAt(flowT, entryGeometry()) }, airlockOpen: entryDoorsAt(flowT).airlockOpen, droneLedOn: f.droneLedOn, showMound: flowT < 31.0, buried: flowT < 31.0, parachuteDrift: Math.min(1, Math.max(0, (flowT - 22.2) / 3)) },
    };
  } else {
    S = {
      s, cx: GAMEPLAY_VIEW.centerX, cy: GAMEPLAY_VIEW.centerY, zoom: GAMEPLAY_VIEW.zoom, nowMs, worldMs, soil, hover, walker, droneMovers, rover, pace: mode === 'play' && speed > 0 ? Math.min(4, speed) : 1, dtMs: worldDtMs, cut: null,
      dimExcept: tut?.state === 'TUT_DRONE_CLICK' ? 'drone-01' : null,
      marker: tut?.state === 'TUT_DRONE_CLICK' ? 'drone-01' : null,
      highlight: tut?.state === 'TUT_BUILD' && tut.phase === 'pick' ? 'module:battery' : (ui?.selected ?? null),
      hazards: mode === 'play' ? extras.hazards() : [],
      radiation: mode === 'play' && extras.radiation ? shieldingByPlace(s) : null,
    };
  }
  hits = drawCampaign(ctx, atlas, S);
}

// ------------------------------------------------------------------ warnings: a resource that runs low, or out, is never silent

const warned = new Map(); // hazard id -> wall-clock time of its last toast
const activeHazards = new Set();
/** When a warning or alarm appears (a low meter, an empty tank, a storm), say so at once, not only in the strip. */
function warnNewHazards(nowMs) {
  const list = extras.hazards();
  const present = new Set(list.map((h) => h.id));
  let shown = false;
  for (const h of [...list].sort((a, b) => (b.severity === 'alarm') - (a.severity === 'alarm'))) {
    if (activeHazards.has(h.id)) continue;
    activeHazards.add(h.id);
    if (h.severity === 'info' || shown || nowMs - (warned.get(h.id) ?? -1e9) < 45000) continue; // one toast at a time, and not again within 45 s
    warned.set(h.id, nowMs);
    shown = true;
    toast(`${h.severity === 'alarm' ? '\u{1F6A8}' : '⚠️'} ${h.title}: ${h.detail}`, 6000, 2);
    audio.play('alert');
  }
  for (const id of [...activeHazards]) if (!present.has(id)) activeHazards.delete(id);
}

// ------------------------------------------------------------------ saving: after what the player does, and when the page closes

let saveTimer = 0;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { if (mode === 'play') save(); }, 800); }
window.addEventListener('pagehide', () => { if (mode === 'play') save(); });
// B3: phones and tablets often close a hidden tab without 'pagehide': save when the game goes to the background
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') save(); });

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
      if (s.status === 'over') {
        if (!ui.modalOpen) ui.showGameOver(restartGame); // the report can be read; closing it brings the screen back
      } else if (s.pending) {
        if (!ui.modalOpen || ui.modalKey === `choice:${s.pending.id}`) ui.showChoice(s.pending.kind, s.pending.id); // the loot screen finishes first
        if (speed > 0) { speedBeforeDecision = speed; document.querySelector('#speed [data-speed="0"]').click(); }
      } else if (speedBeforeDecision && speed === 0 && !ui.modalOpen && !mini) {
        document.querySelector(`#speed [data-speed="${speedBeforeDecision}"]`)?.click(); // the decision is made: time runs on
        speedBeforeDecision = 0;
      } else if (!mini && !ui.modalOpen && speed > 0 && !fit.portrait) { // C16: no time passes while the phone is upright
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
    if (s) updateLightTime();
    audio.director.tick({ s, mode });
    // the Missions tracker appears when Drone #01 is repaired (the tutorial's build step) and stays for the whole game (A30)
    if (extras) extras.update(mode === 'play' || (mode === 'tutorial' && tut?.state === 'TUT_BUILD'), mode === 'play');
    if (ui && (mode === 'tutorial' || mode === 'play')) { ui.update(); $('hud').hidden = false; if (mode === 'play') $('side').hidden = false; }
    astra.update(now);
    // the world clock: it stops with the time (paused, a card open, a mini-game), so people and drones stop too
    const blocked = Boolean(mini || ui?.modalOpen || s?.pending || fit.portrait);
    const running = mode === 'intro' || (mode === 'tutorial' && !blocked) || (mode === 'play' && speed > 0 && !blocked);
    worldDtMs = running ? dt * 1000 : 0;
    worldMs += worldDtMs;
    if (mode === 'play') { stepRover(worldMs); warnNewHazards(now); }
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
  const raw = loadSave();
  const restored = raw && raw.status !== 'over' ? restoreSave(raw) : null; // B4: check and upgrade before loading
  const saved = restored?.ok ? restored.state : null;
  if (restored && !restored.ok) {
    toast(`Your saved mission could not be loaded (${restored.reason}). Start a new mission!`, 6000);
    if (!restored.newer) { // B4: keep a copy of the damaged save, and do not complain again on every visit; a save from a newer build stays where it is
      try { localStorage.setItem(`${SAVE_KEY}-damaged`, localStorage.getItem(SAVE_KEY)); localStorage.removeItem(SAVE_KEY); } catch { /* storage may be blocked */ }
    }
  }
  $('startBtn').hidden = false;
  if (saved) {
    const cont = document.createElement('button');
    cont.id = 'contBtn';
    cont.textContent = 'Continue mission';
    cont.addEventListener('click', () => {
      audio.unlock();
      remindIfMuted();
      Object.assign(s, saved); // the UI and the renderer hold this same object (already checked and upgraded by restoreSave)
      audio.director.reset(s); // music state that one-time events would have set (finale)
      rover.phase = s.away ? 'gone' : 'parked';
      $('loading').hidden = true;
      mode = 'play';
    });
    $('startBtn').after(cont);
  }
  $('startBtn').addEventListener('click', () => {
    audio.unlock();
    remindIfMuted();
    $('loading').hidden = true;
    mode = 'intro';
    $('skipBtn').hidden = false;
  });
  // test and debug hooks
  const q = new URLSearchParams(location.search);
  window.__ares = {
    get hits() { return hits; }, view: () => currentView(), get mode() { return mode; }, get tut() { return tut; }, get s() { return s; },
    get rover() { return rover; }, get walker() { return walker; }, get droneMovers() { return droneMovers; },
    send, jump: (sec) => { flowT = sec; prevFlowT = sec; }, state: () => flowStateAt(flowT), openMini,
    // jump over the two tutorial mini-games to the "build the Battery" step (Drone #01 repaired)
    fast: (minutes) => { if (mode === 'play' && !s.pending && s.status !== 'over') handleEvents(step(s, minutes)); }, // dev/test: run game time now
    tutorialBuild: () => { if (mode === 'tutorial') { s.flags.panelsCleaned = true; onBatteryDone(); } },
  };
  if (q.has('autostart')) { $('loading').hidden = true; mode = 'intro'; flowT = Number(q.get('autostart')) || 0; prevFlowT = flowT; }
  if (q.has('play')) { $('loading').hidden = true; mode = 'play'; command(s, { type: 'wakeDrone', drone: 'drone-01' }); s.flags.panelsCleaned = true; }
  requestAnimationFrame(loop);
}

boot().catch((err) => {
  console.error(err);
  document.querySelector('#loading .sub').textContent = `Could not start: ${err.message}`;
});
