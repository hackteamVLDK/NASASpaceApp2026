/**
 * Draws the intro picture storyboard (SCENARIO "Intro: picture storyboard") on the 1920 x 1080 canvas with the game's
 * own sprites. Reads the storyboard state from src/flow/intro.js (storyAt), never changes anything.
 * Reduce motion: fades only; rings, dust and sand are drawn still.
 */
import { STORYBOARD } from '../flow/intro.js';
import { ICON } from './atlas.js';

const W = 1920, H = 1080;
const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** One big line, centred, with its key word in Martian Orange. */
function bigLine(ctx, text, key, y, px = 72) {
  ctx.font = `900 ${px}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const words = text.split(' ');
  const space = ctx.measureText(' ').width;
  const width = words.reduce((a, w) => a + ctx.measureText(w).width, 0) + space * (words.length - 1);
  let x = (W - width) / 2;
  ctx.lineJoin = 'round';
  for (const w of words) {
    const isKey = key && w.replace(/[^A-Za-z]/g, '') === key;
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(5,7,10,0.85)'; ctx.strokeText(w, x, y);
    ctx.fillStyle = isKey ? STORYBOARD.keyColor : '#ffffff';
    ctx.fillText(w, x, y);
    x += ctx.measureText(w).width + space;
  }
}

function stars(ctx, nowMs, still) {
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 140; i++) {
    const z = 0.3 + hash(i, 3) * 0.7;
    const x = (hash(i, 1) * W - (still ? 0 : nowMs * 0.01 * z) + W * 50) % W;
    ctx.globalAlpha = 0.2 + 0.5 * z;
    ctx.fillRect(Math.round(x), Math.round(hash(i, 2) * H), 2 + Math.round(z * 2), 2 + Math.round(z * 2));
  }
  ctx.globalAlpha = 1;
}

/** A canyon at dusk: the game's sky, stepped rock walls, a floor. Returns the floor's y. */
function canyon(ctx, atlas) {
  atlas.cell(ctx, 'sky', 0, 0, -120, W, H + 120);
  ctx.fillStyle = 'rgba(40,10,40,0.35)'; ctx.fillRect(0, 0, W, H); // dusk
  const floor = 800;
  const wall = (side, color, depth) => {
    ctx.fillStyle = color;
    for (let k = 0; k < 18; k++) {
      const top = 260 + depth + Math.round(hash(k, side + depth) * 90) + k * 22;
      const w = 520 - k * 22 - depth;
      ctx.fillRect(side ? W - w : 0, top, w, floor - top + 4);
    }
  };
  wall(0, '#5a2418', 0); wall(1, '#5a2418', 0); wall(0, '#7a3220', 80); wall(1, '#7a3220', 80);
  ctx.fillStyle = '#8c3c22'; ctx.fillRect(0, floor, W, H - floor);
  ctx.fillStyle = '#a24a28'; for (let i = 0; i < 60; i++) ctx.fillRect(Math.round(hash(i, 9) * W), floor + 6 + Math.round(hash(i, 8) * 240), 6 + Math.round(hash(i, 7) * 10), 4);
  return floor;
}

function rover(ctx, atlas, x, floor) {
  if (atlas.has('rover')) atlas.sprite(ctx, 'rover', 0, x, floor + 6, { w: 430 });
  else { ctx.fillStyle = '#ddd'; ctx.fillRect(x - 180, floor - 120, 360, 110); }
}

function panelSignal(ctx, atlas, st, nowMs, still) {
  const floor = canyon(ctx, atlas);
  // slow seismic rings pulse out of the ground under the rover
  ctx.lineWidth = 6;
  for (const [k, r0] of st.panel.rings.entries()) {
    const age = still ? 0.9 + k * 0.5 : st.local - r0;
    if (age < 0 || age > 2.4) continue;
    const rad = 60 + age * 260;
    ctx.strokeStyle = `rgba(255,176,0,${Math.max(0, 0.75 - age * 0.3)})`;
    ctx.beginPath(); ctx.ellipse(W / 2, floor + 40, rad, rad * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
  }
  rover(ctx, atlas, W / 2, floor);
}

function panelStorm(ctx, atlas, st, nowMs, still) {
  const floor = canyon(ctx, atlas);
  rover(ctx, atlas, W / 2, floor);
  const k = Math.min(1, st.local / 2.4);
  ctx.fillStyle = `rgba(190,104,48,${0.25 + 0.5 * k})`; ctx.fillRect(0, 0, W, H); // dust sweeps across
  ctx.fillStyle = 'rgba(230,150,90,0.5)';
  for (let i = 0; i < 90; i++) {
    const x = still ? hash(i, 21) * W : (hash(i, 21) * W * 2 - st.local * (600 + hash(i, 22) * 500) + W * 4) % (W * 1.3) - 100;
    ctx.fillRect(Math.round(x), Math.round(hash(i, 23) * H), 60 + Math.round(hash(i, 24) * 160), 4);
  }
  // signal bars above the rover drop one by one
  const left = st.panel.barsDropAt.filter((t) => st.local < t).length;
  for (let b = 0; b < 4; b++) {
    ctx.fillStyle = b < left ? '#00E5FF' : 'rgba(255,255,255,0.18)';
    ctx.fillRect(W / 2 + 230 + b * 30, floor - 330 - b * 22, 20, 30 + b * 22);
  }
  // then short radio static
  const lastAt = st.panel.barsDropAt.at(-1);
  if (st.local >= lastAt && st.local < lastAt + 0.6) {
    const seed = still ? 1 : Math.floor(nowMs / 60);
    for (let i = 0; i < 1600; i++) { const v = hash(i, seed) > 0.5 ? 230 : 40; ctx.fillStyle = `rgba(${v},${v},${v},0.35)`; ctx.fillRect(Math.floor(hash(seed, i) * W / 8) * 8, Math.floor(hash(i + 7, seed) * H / 8) * 8, 8, 8); }
  }
}

function panelDrones(ctx, atlas, st, nowMs, still, soil) {
  const ground = 420;
  atlas.cell(ctx, 'sky', 0, 0, ground - 700, W, 720);
  if (soil) ctx.drawImage(soil, 0, 0, Math.min(soil.width, W / 1), Math.min(soil.height, H), 0, ground - 20, W, H);
  else { ctx.fillStyle = '#7a3220'; ctx.fillRect(0, ground, W, H - ground); }
  // the cutaway base being dug: three empty frames
  const rooms = [[360, 520], [960, 520], [1560, 520], [660, 790], [1260, 790]];
  for (const [i, [cx, y]] of rooms.entries()) {
    if (atlas.has('unfinished')) atlas.cell(ctx, 'unfinished', i % 4, cx - 270, y - 230, 540, 240);
    if (atlas.has('drone')) atlas.sprite(ctx, 'drone', 12 + (still ? 0 : Math.floor(nowMs / 180) % 4), cx, y - 2, { h: 120 });
  }
  // then sand pours over them
  const from = st.panel.sandFrom;
  if (st.local >= from) {
    const k = still ? 1 : Math.min(1, (st.local - from) / 1.6);
    const top = H - (H - ground + 40) * k;
    ctx.fillStyle = '#b8642e';
    for (let x = 0; x < W; x += 16) { const j = Math.round(hash(x, 5) * 26); ctx.fillRect(x, top + j, 16, H - top - j); }
    ctx.fillStyle = '#d98a4a';
    if (!still) for (let i = 0; i < 160; i++) { const x = Math.round(hash(i, 31) * W / 8) * 8; const y = (hash(i, 32) * H + st.local * 900) % Math.max(1, top); ctx.fillRect(x, Math.round(y), 8, 8); }
  }
}

function panelTitle(ctx, nowMs, still, t, st) {
  stars(ctx, nowMs, still);
  ctx.font = `800 40px ${FONT}`;
  const label = t(st.panel.badge);
  const bw = ctx.measureText(label).width + 80;
  ctx.fillStyle = 'rgba(0,229,255,0.12)'; ctx.strokeStyle = '#00E5FF'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect((W - bw) / 2, 330, bw, 84, 42); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#00E5FF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, W / 2, 373);
}

function wrap(ctx, text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(' ')) { const tryL = line ? `${line} ${w}` : w; if (ctx.measureText(tryL).width > maxW && line) { out.push(line); line = w; } else line = tryL; }
  if (line) out.push(line);
  return out;
}

function panelBriefing(ctx, atlas, nowMs, still, t, st) {
  stars(ctx, nowMs, still);
  const p = st.panel;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 84px ${FONT}`; ctx.fillStyle = STORYBOARD.keyColor; ctx.fillText(t(p.title), W / 2, 150);
  const icons = { drone: ICON.droneAwake, crew: ICON.shelter, rover: ICON.explore };
  p.tiles.forEach((tile, i) => {
    const x = W / 2 + (i - 1) * 580 - 260, y = 240, w = 520, h = 450;
    ctx.fillStyle = 'rgba(8,12,24,0.92)'; ctx.strokeStyle = 'rgba(0,229,255,0.7)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 22); ctx.fill(); ctx.stroke();
    if (atlas.has('icons')) atlas.cell(ctx, 'icons', icons[tile.icon], x + w / 2 - 80, y + 30, 160, 160);
    ctx.fillStyle = '#ffffff'; ctx.font = `900 52px ${FONT}`; ctx.fillText(t(tile.goal), x + w / 2, y + 250);
    ctx.fillStyle = '#00E5FF'; ctx.font = `700 34px ${FONT}`;
    wrap(ctx, t(tile.learn), w - 60).forEach((l, k) => ctx.fillText(l, x + w / 2, y + 330 + k * 46));
  });
  ctx.fillStyle = '#e8f4ff'; ctx.font = `600 34px ${FONT}`;
  ctx.fillText(t(p.facts), W / 2, 770);
}

/**
 * @param {object} st  storyAt(storyTime)
 * @param {object} o   { atlas, nowMs, reduceMotion, t (strings), soil }
 */
export function drawStory(ctx, st, { atlas, nowMs, reduceMotion = false, t, soil = null }) {
  const still = Boolean(reduceMotion);
  ctx.save();
  ctx.fillStyle = STORYBOARD.background; ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  const id = st.panel.id;
  if (id === 'title') panelTitle(ctx, nowMs, still, t, st);
  else if (id === 'signal') panelSignal(ctx, atlas, st, nowMs, still);
  else if (id === 'storm') panelStorm(ctx, atlas, st, nowMs, still);
  else if (id === 'drones') panelDrones(ctx, atlas, st, nowMs, still, soil);
  else panelBriefing(ctx, atlas, nowMs, still, t, st);
  if (st.line) { // a line change inside a panel (panel 3) fades the caption only
    ctx.globalAlpha = Math.min(1, (st.local - (st.line.from ?? 0)) / STORYBOARD.fadeSec);
    bigLine(ctx, t(st.line.id), st.line.key, id === 'title' ? 520 : 150, 76);
    ctx.globalAlpha = 1;
  }
  // progress dots
  const n = STORYBOARD.panels.length;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i === st.index ? STORYBOARD.keyColor : 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(W / 2 + (i - (n - 1) / 2) * 40, 1040, i === st.index ? 10 : 7, 0, Math.PI * 2); ctx.fill();
  }
  // gentle fade in from the dark
  if (st.fade < 1) { ctx.fillStyle = `rgba(5,7,10,${1 - st.fade})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
