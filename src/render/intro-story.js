/**
 * Draws the intro picture storyboard (SCENARIO "Intro: picture storyboard") on the 1920 x 1080 canvas with the game's
 * own sprites. Reads the storyboard state from src/flow/intro.js (storyAt), never changes anything.
 * Reduce motion: fades only; rings, dust, sand, puffs and the planet are drawn still.
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

/** A dusk sky with a small pale sun off to the right, below the title (Mars sunsets are small and bluish-white). */
function duskSky(ctx, h, sx = 1650, sy = 300) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2c1a3a'); g.addColorStop(0.55, '#7a3c4e'); g.addColorStop(1, '#d08458');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
  const glow = ctx.createRadialGradient(sx, sy, 6, sx, sy, 120);
  glow.addColorStop(0, 'rgba(200,225,255,0.55)'); glow.addColorStop(1, 'rgba(200,225,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(sx - 120, sy - 120, 240, 240);
  ctx.fillStyle = '#eef6ff'; ctx.fillRect(sx - 14, sy - 14, 28, 28); ctx.fillRect(sx - 18, sy - 8, 36, 16); ctx.fillRect(sx - 8, sy - 18, 16, 36);
}

/** Layered cliff walls (stripes like lake sediments) on both sides; cached per soil canvas. */
const canyons = new WeakMap();
function canyonWalls(soil) {
  const key = soil ?? canyons;
  if (canyons.has(key)) return canyons.get(key);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const pal = soilPalette(soil);
  const floor = 800;
  const layer = []; // y -> band (negative: a dark line)
  for (let y = 0, n = 0; y < H; n++) { const t = 18 + Math.floor(hash(n, 41) * 22); for (let i = 0; i < t && y < H; i++, y++) layer[y] = i < 3 ? -1 : n; }
  for (const side of [0, 1]) {
    for (let y = 230; y < floor + 4; y++) {
      // stepped ledges: each band ends at its own width, with a lit top edge
      const band = Math.floor((y - 230) / 46);
      const edge = Math.round(380 + band * 34 + hash(band, side + 7) * 70 + (y - 230) * 0.12);
      const L = layer[y];
      const base = L < 0 ? pal.line : L % 2 ? pal.dark : pal.light;
      const f = side ? 0.9 : 1; // the right wall is a bit darker
      g.fillStyle = rgb(base, f);
      g.fillRect(side ? W - edge : 0, y, edge, 1);
      g.fillStyle = rgb(pal.light, 1.25); // the lit lip of each ledge
      if ((y - 230) % 46 === 0) g.fillRect(side ? W - edge : 0, y, edge, 3);
    }
  }
  g.fillStyle = rgb(pal.dark, 0.9); g.fillRect(0, floor, W, H - floor);
  g.fillStyle = rgb(pal.light, 0.95);
  for (let i = 0; i < 70; i++) g.fillRect(Math.round(hash(i, 9) * W / 4) * 4, floor + 8 + Math.round(hash(i, 8) * 60) * 4, 8 + Math.round(hash(i, 7) * 4) * 4, 4);
  canyons.set(key, c);
  return c;
}

/** A canyon at dusk: sky, sun, layered cliffs, floor. Returns the floor's y. */
function canyon(ctx, atlas, soil) {
  duskSky(ctx, 820, 1180, 290); // the sun in the canyon gap, below the title
  ctx.drawImage(canyonWalls(soil), 0, 0);
  return 800;
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
  duskSky(ctx, G + 4);
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

/** A small pixel-art Mars that turns slowly (Reduce motion: it stands still). Drawn at 72 px, scaled up crisp. */
let planetCanvas = null;
function planet(ctx, cx, cy, size, rot) {
  const N = 72;
  if (!planetCanvas) { planetCanvas = document.createElement('canvas'); planetCanvas.width = N; planetCanvas.height = N; }
  const g = planetCanvas.getContext('2d');
  const img = g.createImageData(N, N);
  const noise = (u, v) => { // smooth value noise, wrapping in longitude (period 8)
    const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
    const at = (x, y) => hash(((x % 8) + 8) % 8, y + 40);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  };
  const L = [-0.55, -0.45, 0.7];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const nx = (x + 0.5) / N * 2 - 1, ny = (y + 0.5) / N * 2 - 1, r2 = nx * nx + ny * ny;
    if (r2 > 1) continue;
    const nz = Math.sqrt(1 - r2), lat = Math.asin(ny), lon = Math.atan2(nx, nz) + rot;
    const u = (lon / (Math.PI * 2)) * 8, v = (lat + 1.6) * 2.2;
    const n = 0.65 * noise(u, v) + 0.35 * noise(u * 2.3, v * 2.3);
    let c = n < 0.38 ? [118, 50, 36] : n < 0.62 ? [188, 84, 50] : [222, 132, 82]; // dark plains, rust, light dust
    if (Math.abs(lat) > 1.2) c = [238, 232, 226]; // polar caps
    const lum = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    const f = lum > 0.6 ? 1.05 : lum > 0.3 ? 0.8 : lum > 0.1 ? 0.55 : 0.35; // banded shading, pixel-art style
    const k = (y * N + x) * 4;
    img.data[k] = Math.min(255, c[0] * f); img.data[k + 1] = Math.min(255, c[1] * f); img.data[k + 2] = Math.min(255, c[2] * f); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const glow = ctx.createRadialGradient(cx, cy, size * 0.45, cx, cy, size * 0.62);
  glow.addColorStop(0, 'rgba(255,120,60,0.35)'); glow.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = glow; ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(planetCanvas, Math.round(cx - size / 2), Math.round(cy - size / 2), size, size);
}

function panelTitle(ctx, nowMs, still, t, st) {
  stars(ctx, nowMs, still);
  planet(ctx, W / 2, 790, 380, still ? 0.6 : 0.6 + nowMs * 0.00025); // Mars turns slowly under the badge and the line
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
  if (id === 'title') panelTitle(ctx, nowMs, still, t, st, soil);
  else if (id === 'signal') panelSignal(ctx, atlas, st, nowMs, still, soil);
  else if (id === 'storm') panelStorm(ctx, atlas, st, nowMs, still, soil);
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
