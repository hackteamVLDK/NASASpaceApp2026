/**
 * Draws the intro picture storyboard (SCENARIO "Intro: picture storyboard") on the 1920 x 1080 canvas with the game's
 * own sprites. Reads the storyboard state from src/flow/intro.js (storyAt), never changes anything.
 * Reduce motion: fades only; rings, dust, sand, puffs are drawn still.
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

/** Soil colours for the intro, sampled from the game's soil canvas (layers, rust, ochre), with fixed fallbacks. */
const palettes = new WeakMap();
function soilPalette(soil) {
  const fallback = { light: [204, 128, 80], dark: [132, 58, 36], line: [70, 28, 22], deep: [110, 92, 92] };
  if (!soil) return fallback;
  if (palettes.has(soil)) return palettes.get(soil);
  let pal = fallback;
  try {
    const d = soil.getContext('2d').getImageData(0, 60, Math.min(400, soil.width), 260).data;
    const px = [];
    for (let k = 0; k < d.length; k += 4 * 37) px.push([d[k], d[k + 1], d[k + 2]]);
    px.sort((p, q) => (p[0] + p[1] + p[2]) - (q[0] + q[1] + q[2]));
    const at = (f) => px[Math.min(px.length - 1, Math.floor(px.length * f))];
    pal = { light: at(0.85), dark: at(0.35), line: at(0.05), deep: fallback.deep };
  } catch { /* keep the fallback */ }
  palettes.set(soil, pal);
  return pal;
}
const rgb = (c, f = 1) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v * f)))).join(',')})`;

/** Shared sky atlas and soil cache: exactly the textures used by the playable world. */
function sky(ctx, atlas, height) {
  if (atlas.has('sky')) atlas.cell(ctx, 'sky', 0, 0, 0, W, height);
  else { ctx.fillStyle = '#7a3c4e'; ctx.fillRect(0, 0, W, height); }
}

/** A clipped soil cross-section, with irregular whole-pixel edges instead of smooth terraces. */
const canyons = new WeakMap();
function canyonWalls(soil) {
  const key = soil ?? canyons;
  if (canyons.has(key)) return canyons.get(key);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const floor = 800, pixel = 8;
  for (const side of [0, 1]) {
    g.save(); g.beginPath();
    g.moveTo(side ? W : 0, 280);
    for (let y = 280; y <= floor; y += pixel) {
      const edge = Math.round((260 + (y - 280) * 0.65 + hash(Math.floor(y / 40), side + 7) * 64) / pixel) * pixel;
      const x = side ? W - edge : edge;
      g.lineTo(x, y); g.lineTo(x, y + pixel);
    }
    g.lineTo(side ? W : 0, floor + pixel); g.closePath(); g.clip();
    if (soil) g.drawImage(soil, 0, 0, 960, 400, 0, 280, W, 800);
    else { g.fillStyle = '#844424'; g.fillRect(0, 280, W, 800); }
    g.restore();
  }
  if (soil) g.drawImage(soil, 0, 0, 960, 140, 0, floor, W, 280);
  else { g.fillStyle = '#844424'; g.fillRect(0, floor, W, H - floor); }
  canyons.set(key, c);
  return c;
}

function canyon(ctx, atlas, soil) {
  sky(ctx, atlas, 820);
  ctx.drawImage(canyonWalls(soil), 0, 0);
  return 800;
}

/** A still surface view shared by the title screen and first story panel. */
export function drawIntroSurface(ctx, { atlas, soil }) {
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const ground = 820;
  sky(ctx, atlas, ground + 4);
  if (soil) ctx.drawImage(soil, 0, 0, 960, 140, 0, ground, W, 280);
  if (atlas.has('airlock')) atlas.sprite(ctx, 'airlock', 0, 960, ground + 6, { w: 420 });
  if (atlas.has('solar')) atlas.sprite(ctx, 'solar', 0, 430, ground + 6, { w: 350 });
  ctx.restore();
}

function rover(ctx, atlas, x, floor) {
  if (atlas.has('rover')) atlas.sprite(ctx, 'rover', 0, x, floor + 6, { w: 430 });
  else { ctx.fillStyle = '#ddd'; ctx.fillRect(x - 180, floor - 120, 360, 110); }
}

function panelSignal(ctx, atlas, st, nowMs, still, soil) {
  const floor = canyon(ctx, atlas, soil);
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

function panelStorm(ctx, atlas, st, nowMs, still, soil) {
  const floor = canyon(ctx, atlas, soil);
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

/** Panel 3: a ground cross-section. The rooms sit under the surface in the soil; the shaft goes down from the dome. */
const XS = Object.freeze({
  ground: 340,
  shaft: { x: 930, w: 60, bottom: 860 },
  rooms: [[520, 400], [520, 630], [1000, 400], [1000, 630]], // left, top of each 400 x 200 room
  roomW: 400, roomH: 200,
  dig: { x: 1400, y: 400, w: 230, h: 200 }, // the room being dug: a rough dig face on its right
  drones: [[1590, 598, false], [560, 828, true], [1360, 828, false]], // [x, feet y, flip]: each at the edge of a room
});

function panelDrones(ctx, atlas, st, nowMs, still, soil) {
  const P = st.panel;
  const pal = soilPalette(soil);
  const local = st.local;
  const sandK = local < P.sandFrom ? 0 : still ? 1 : Math.min(1, (local - P.sandFrom) / 1.6);
  const G = XS.ground;
  // sky and surface (the dome stands on the ground; nothing floats)
  sky(ctx, atlas, G + 4);
  if (soil) ctx.drawImage(soil, 300, 0, W, H - G + 20, 0, G - 20, W, H - G + 20);
  else { ctx.fillStyle = rgb(pal.dark); ctx.fillRect(0, G, W, H - G); }
  ctx.fillStyle = rgb(pal.light, 1.1); ctx.fillRect(0, G - 2, W, 6); // the surface line
  if (atlas.has('airlock')) atlas.sprite(ctx, 'airlock', 0, XS.shaft.x + XS.shaft.w / 2, G + 6, { w: 420 });
  // the shaft, cut down from the surface
  ctx.fillStyle = '#140c10'; ctx.fillRect(XS.shaft.x, G, XS.shaft.w, XS.shaft.bottom - G);
  if (atlas.has('shaft')) for (let y = G; y < XS.shaft.bottom; y += 135) atlas.cell(ctx, 'shaft', 0, XS.shaft.x, y, XS.shaft.w, Math.min(135, XS.shaft.bottom - y));
  // the rooms: dark cavities with unfinished frames, cut into the soil
  for (const [i, [x, y]] of XS.rooms.entries()) {
    ctx.fillStyle = '#140c10'; ctx.fillRect(x - 6, y - 6, XS.roomW + 12, XS.roomH + 12);
    if (atlas.has('unfinished')) atlas.cell(ctx, 'unfinished', i % 4, x, y, XS.roomW, XS.roomH);
  }
  // the room being dug: a rough, stepped dig face
  const d = XS.dig;
  ctx.fillStyle = '#140c10';
  for (let y = d.y; y < d.y + d.h; y += 8) ctx.fillRect(d.x, y, d.w - Math.round(hash(Math.floor(y / 8), 3) * 50), 8);
  // drones at the room edges; in the storm their eye lights go out one by one
  const eyesOut = (k) => sandK > 0 && local - P.sandFrom >= (still ? 0 : 0.35 + k * 0.4);
  for (const [k, [x, y, flip]] of XS.drones.entries()) {
    const out = eyesOut(k);
    const frame = out ? 18 : 12 + (still ? 0 : Math.floor(nowMs / 180 + k) % 4);
    if (atlas.has('drone')) atlas.sprite(ctx, 'drone', frame, x, y, { h: 110, flip });
    if (!out && sandK === 0) { // small dust puffs at the dig face
      for (let p = 0; p < 4; p++) {
        const age = still ? 0.3 + p * 0.15 : ((nowMs / 700 + p * 0.25 + k * 0.13) % 1);
        const px = x + (flip ? -1 : 1) * (50 + age * 70 + p * 6), py = y - 40 - age * 50 - p * 8;
        ctx.globalAlpha = 0.8 * (1 - age); ctx.fillStyle = rgb(pal.light, 1.15);
        const r = 6 + Math.round(age * 10); ctx.fillRect(Math.round(px - r / 2), Math.round(py - r / 2), r, r);
      }
      ctx.globalAlpha = 1;
    }
    if (out) { // z z z floats up
      ctx.fillStyle = '#e8f4ff'; ctx.font = `900 30px ${FONT}`; ctx.textAlign = 'center';
      for (let z = 0; z < 3; z++) {
        const age = still ? z / 3 : ((nowMs / 1400 + z / 3 + k * 0.2) % 1);
        ctx.globalAlpha = 0.9 * (1 - age);
        ctx.fillText('z', x + 30 + age * 30 + z * 4, y - 120 - age * 70);
      }
      ctx.globalAlpha = 1;
    }
  }
  if (sandK > 0) {
    // the scene gets darker; the rooms stay visible under the sand
    ctx.fillStyle = `rgba(30,12,14,${0.45 * sandK})`; ctx.fillRect(0, 0, W, H);
    // sand pours in from the top in streams ...
    ctx.fillStyle = 'rgba(214,140,80,0.85)';
    for (let i = 0; i < 26; i++) {
      const x = 360 + Math.round(hash(i, 51) * 1200 / 8) * 8, w = 8 + Math.round(hash(i, 52) * 2) * 8;
      for (let y = 0; y < G; y += 16) if (still || hash(i, Math.floor(y / 16 + nowMs / 60)) > 0.25) ctx.fillRect(x, y, w, 12);
    }
    // ... and piles up in a mound over the rooms
    ctx.fillStyle = '#c0703a';
    const peak = 230 * sandK;
    for (let x = 300; x < 1660; x += 8) {
      const u = (x - 980) / 680, h = Math.round((peak * Math.max(0, 1 - u * u) + hash(x, 61) * 10 * sandK) / 8) * 8;
      if (h > 0) ctx.fillRect(x, G - h, 8, h + 4);
    }
    ctx.fillStyle = '#d8894c';
    for (let x = 300; x < 1660; x += 8) { const u = (x - 980) / 680, h = Math.round(peak * Math.max(0, 1 - u * u) / 8) * 8; if (h > 0) ctx.fillRect(x, G - h, 8, 8); }
    // sand drifts into the rooms and the shaft, translucent so the rooms still show
    ctx.fillStyle = `rgba(192,112,58,${0.6 * sandK})`;
    for (const [x, y] of XS.rooms) { const h = Math.round(XS.roomH * 0.35 * sandK); ctx.fillRect(x, y + XS.roomH - h, XS.roomW, h); }
    ctx.fillRect(XS.shaft.x, G, XS.shaft.w, (XS.shaft.bottom - G) * 0.5 * sandK);
  }
}

function panelTitle(ctx, atlas, t, st, soil) {
  drawIntroSurface(ctx, { atlas, soil });
  ctx.font = `800 40px ${FONT}`;
  const label = t(st.panel.badge);
  const bw = ctx.measureText(label).width + 80;
  ctx.fillStyle = 'rgba(8,12,24,0.88)'; ctx.strokeStyle = 'rgba(0,229,255,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect((W - bw) / 2, 300, bw, 84, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#00E5FF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, W / 2, 342);
}

function wrap(ctx, text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(' ')) { const tryL = line ? `${line} ${w}` : w; if (ctx.measureText(tryL).width > maxW && line) { out.push(line); line = w; } else line = tryL; }
  if (line) out.push(line);
  return out;
}

function panelBriefing(ctx, atlas, t, st, drawBackdrop) {
  drawBackdrop?.();
  ctx.fillStyle = 'rgba(5,7,10,0.6)'; ctx.fillRect(0, 0, W, H);
  const p = st.panel;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 84px ${FONT}`; ctx.fillStyle = STORYBOARD.keyColor; ctx.fillText(t(p.title), W / 2, 150);
  const icons = { drone: ICON.droneAwake, crew: ICON.shelter, rover: ICON.explore };
  p.tiles.forEach((tile, i) => {
    const x = W / 2 + (i - 1) * 580 - 260, y = 240, w = 520, h = 450;
    ctx.fillStyle = 'rgba(8,12,24,0.88)'; ctx.strokeStyle = 'rgba(0,229,255,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
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
export function drawStory(ctx, st, { atlas, nowMs, reduceMotion = false, t, soil = null, drawBackdrop = null }) {
  const still = Boolean(reduceMotion);
  ctx.save();
  ctx.fillStyle = STORYBOARD.background; ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  const id = st.panel.id;
  if (id === 'title') panelTitle(ctx, atlas, t, st, soil);
  else if (id === 'signal') panelSignal(ctx, atlas, st, nowMs, still, soil);
  else if (id === 'storm') panelStorm(ctx, atlas, st, nowMs, still, soil);
  else if (id === 'drones') panelDrones(ctx, atlas, st, nowMs, still, soil);
  else panelBriefing(ctx, atlas, t, st, drawBackdrop);
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
