/**
 * The pictures of the mini-games (SCENARIO section 4), drawn from code on a 1100 x 620 canvas. The rules and the input stay in
 * minigames2.js; each function here only draws the state it is given, so a scene can be looked at and changed on its own.
 * See mg-kit.js for the helpers and the palette. All motion respects Reduce motion.
 */
import { prefs } from './prefs.js';
import { W, H, PAL, rr, rand, pulse, backdrop, bolt, plate, glow, glint, twinkle, outlined, icon, meter } from './mg-kit.js';

const TAU = Math.PI * 2;
const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); };

// =====================================================================================================================
// 4.7 Rover Wheel Pebble Vacuum
// =====================================================================================================================

const DUST_COLOURS = ['#b5593a', '#8f4326', '#c97a52', '#a34d2f'];

/** One wheel: dark tyre with brown tread, a grey hub, and dust that thins out as `dust` goes from 1 to 0. */
function wheel(c, w, i, now, atlas) {
  const R = 70;
  c.save(); c.translate(w.x, w.y);
  c.fillStyle = PAL.tire; circle(c, 0, 0, R); c.fill();
  c.strokeStyle = PAL.outline; c.lineWidth = 5; c.stroke();
  // the tread: chevrons round the rim
  c.strokeStyle = PAL.brown; c.lineWidth = 7; c.lineCap = 'round';
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU + i * 0.4;
    c.beginPath(); c.moveTo(Math.cos(a) * 52, Math.sin(a) * 52); c.lineTo(Math.cos(a + 0.12) * 64, Math.sin(a + 0.12) * 64); c.stroke();
  }
  c.fillStyle = '#4a4650'; circle(c, 0, 0, 40); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
  // the hub: an octagon with bolts
  c.fillStyle = PAL.hub; c.beginPath();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + Math.PI / 8; c.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); }
  c.closePath(); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; bolt(c, Math.cos(a) * 14, Math.sin(a) * 14, 2.4); }
  // the dust: a veil and speckles that go as the vacuum passes; none is left when the wheel is clean
  if (w.dust > 0.01) {
    c.fillStyle = `rgba(181,89,58,${w.dust * 0.42})`; circle(c, 0, 0, R - 3); c.fill();
    for (let n = 0; n < 120; n++) {
      if (rand(i * 977 + n) > w.dust) continue;
      const a = rand(i * 31 + n * 7) * TAU, d = Math.sqrt(rand(i * 53 + n * 3)) * (R - 6);
      c.fillStyle = DUST_COLOURS[n % 4]; c.globalAlpha = 0.55 + 0.4 * rand(n + i);
      const s = 3 + rand(n * 11 + i) * 6; c.fillRect(Math.cos(a) * d - s / 2, Math.sin(a) * d - s / 2, s, s);
    }
    c.globalAlpha = 1;
  }
  c.restore();
  if (w.dust < 0.12) { // clean: a green glow, a check and two glints
    glow(c, w.x, w.y, 100, 'rgba(67,224,96,.55)', 0.5);
    twinkle(c, w.x - 32, w.y - 34, 14, now, i, '#fff');
    twinkle(c, w.x + 30, w.y + 22, 9, now, i + 2, '#dffff0');
    c.strokeStyle = PAL.green; c.lineWidth = 5; circle(c, w.x, w.y, 76); c.stroke();
    outlined(c, '✔', w.x, w.y + 116, 26, '#9affb0');
  }
  void atlas;
}

/** The Rover seen from the side, drawn in the colours of the sprite sheet: cream body, yellow panels, a dark window, a camera mast. */
function roverBody(c, wheels, now) {
  const O = PAL.outline;
  c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = O;
  // the chassis
  c.fillStyle = '#4a4852'; rr(c, 70, 236, 960, 70, 18); c.fill(); c.stroke();
  for (let i = 0; i < 6; i++) { const x = 130 + i * 150; c.fillStyle = PAL.yellow; rr(c, x, 252, 100, 40, 8); c.fill(); c.lineWidth = 3; c.stroke(); bolt(c, x + 10, 262, 2.5); bolt(c, x + 90, 262, 2.5); bolt(c, x + 10, 282, 2.5); bolt(c, x + 90, 282, 2.5); }
  // the cabin
  c.lineWidth = 5;
  c.fillStyle = PAL.cream; c.beginPath(); c.moveTo(100, 240); c.lineTo(100, 178); c.lineTo(152, 148); c.lineTo(760, 148); c.lineTo(932, 214); c.lineTo(1004, 240); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = PAL.creamShade; c.fillRect(104, 216, 896, 20);
  c.fillStyle = PAL.glass; c.beginPath(); c.moveTo(226, 168); c.lineTo(742, 168); c.lineTo(884, 212); c.lineTo(226, 212); c.closePath(); c.fill(); c.lineWidth = 4; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 8; for (const x of [330, 500, 650]) { c.beginPath(); c.moveTo(x, 170); c.lineTo(x - 50, 210); c.stroke(); }
  c.strokeStyle = O; c.lineWidth = 4;
  c.fillStyle = PAL.orange; rr(c, 134, 190, 54, 12, 5); c.fill(); c.stroke();
  c.strokeStyle = '#3a3238'; c.lineWidth = 5; for (const x of [150, 162, 174]) { c.beginPath(); c.moveTo(x, 218); c.lineTo(x, 232); c.stroke(); }
  c.strokeStyle = O;
  // the rear tank, the roof rack and its light bar
  c.lineWidth = 5; c.fillStyle = PAL.yellow; rr(c, 58, 170, 78, 76, 14); c.fill(); c.stroke();
  c.strokeStyle = O; c.lineWidth = 4; for (const y of [196, 220]) { c.beginPath(); c.moveTo(58, y); c.lineTo(136, y); c.stroke(); }
  c.fillStyle = '#6f6c76'; rr(c, 196, 112, 110, 36, 8); c.fill(); c.lineWidth = 4; c.stroke();
  c.beginPath(); c.moveTo(180, 148); c.lineTo(180, 134); c.lineTo(760, 134); c.lineTo(760, 148); c.stroke();
  c.fillStyle = '#2a2830'; rr(c, 410, 118, 150, 18, 8); c.fill(); c.stroke();
  [PAL.orange, PAL.cyan, PAL.cyan, PAL.cyan, PAL.orange].forEach((col, k) => { c.fillStyle = col; circle(c, 428 + k * 26, 127, 5.5); c.fill(); });
  // the camera mast and the antenna
  c.strokeStyle = O; c.lineWidth = 6; c.beginPath(); c.moveTo(808, 148); c.lineTo(808, 104); c.stroke();
  c.fillStyle = PAL.cream; c.lineWidth = 4; rr(c, 778, 72, 66, 36, 10); c.fill(); c.stroke();
  c.fillStyle = PAL.cyan; circle(c, 830, 90, 8); c.fill(); c.stroke();
  c.strokeStyle = O; c.lineWidth = 5; c.beginPath(); c.moveTo(112, 148); c.lineTo(112, 96); c.stroke();
  c.fillStyle = PAL.orange; circle(c, 112, 90, 7); c.fill(); c.lineWidth = 3; c.stroke();
  // the headlight and the bumper
  glow(c, 1000, 226, 46, 'rgba(255,170,60,.9)', 0.55);
  c.fillStyle = PAL.orange; rr(c, 984, 218, 26, 18, 6); c.fill(); c.lineWidth = 3; c.stroke();
  c.fillStyle = '#2a2830'; rr(c, 1010, 238, 30, 22, 8); c.fill(); c.stroke();
  // the wheel wells, cut into the chassis
  for (const w of wheels) { c.fillStyle = '#17161c'; c.beginPath(); c.arc(w.x, w.y, 82, Math.PI, 0); c.lineTo(w.x + 82, 308); c.lineTo(w.x - 82, 308); c.closePath(); c.fill(); }
  void now;
}

/** A sharp little stone stuck in the tread; `k` 0..1 makes it flash so the child sees it. */
function pebble(c, x, y, id, k) {
  c.save(); c.translate(x, y);
  glow(c, 0, 0, 34, 'rgba(255,230,120,.9)', 0.25 + 0.5 * k);
  c.fillStyle = '#c9c2b6'; c.strokeStyle = PAL.outline; c.lineWidth = 3; c.beginPath();
  for (let n = 0; n < 7; n++) { const a = (n / 7) * TAU, r = 11 + rand(id * 13 + n) * 6; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.moveTo(-6, -6); c.lineTo(2, -9); c.lineTo(-2, -2); c.closePath(); c.fill();
  c.strokeStyle = `rgba(255,214,0,${0.35 + 0.65 * k})`; c.lineWidth = 3; circle(c, 0, 0, 22); c.stroke();
  c.restore();
}

/** The vacuum: a canister at the bottom right, a hose and a nozzle that follows the finger and sucks while the finger is down. */
function vacuum(c, nozzle, pressed, now) {
  const park = { x: 930, y: 520 };
  const nz = nozzle ?? park;
  // the canister
  c.fillStyle = '#2f7fd0'; rr(c, 990, 480, 86, 90, 16); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 4; c.stroke();
  c.fillStyle = '#9ad4ff'; rr(c, 1000, 492, 66, 18, 6); c.fill();
  outlined(c, 'VAC', 1033, 548, 22, '#fff');
  c.fillStyle = PAL.tire; for (const x of [1008, 1058]) { circle(c, x, 574, 9); c.fill(); }
  // the hose
  const sag = Math.min(580, Math.max(nz.y, 500) + 50);
  c.strokeStyle = '#1d4a7a'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(1000, 490); c.quadraticCurveTo((nz.x + 1000) / 2, sag, nz.x, nz.y); c.stroke();
  c.strokeStyle = '#3d94e8'; c.lineWidth = 10; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 3; c.setLineDash([6, 12]); c.stroke(); c.setLineDash([]);
  // the suction while pressed: dust and sparks spiral into the mouth
  if (pressed) {
    glow(c, nz.x, nz.y, 80, 'rgba(120,200,255,.7)', 0.45);
    for (let n = 0; n < 10; n++) {
      const t = prefs.reduceMotion ? 0.4 : ((now / 500) + n / 10) % 1;
      const a = n * 0.9 + t * 4, d = 56 * (1 - t);
      c.fillStyle = DUST_COLOURS[n % 4]; c.globalAlpha = 0.9 * t + 0.1; circle(c, nz.x + Math.cos(a) * d, nz.y + Math.sin(a) * d, 2 + 3 * (1 - t)); c.fill();
    }
    c.globalAlpha = 1;
  }
  // the nozzle: a ring with a dark mouth
  c.fillStyle = '#3d94e8'; circle(c, nz.x, nz.y, 30); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 4; c.stroke();
  c.fillStyle = '#0e2238'; circle(c, nz.x, nz.y, 19); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(nz.x, nz.y, 25, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
  if (!nozzle) outlined(c, 'vacuum', nz.x, nz.y + 54, 18, '#9fd8ff');
}

/**
 * The whole scene. `wheels`: [{ x, y, dust 0..1 }], `pebbles`: [{ w (wheel index), ox, oy, out }], `nozzle`: where the finger is or null,
 * `pressed`: the finger is down.
 */
export function drawRoverScene(c, { wheels, pebbles, nozzle, pressed, now, atlas }) {
  backdrop(c, '#1b1620', '#2a1f1a');
  // the garage floor: a checker of dark tiles, hazard tape at the edge, and a shadow under the Rover
  c.fillStyle = '#241a17'; c.fillRect(0, 404, W, H - 404);
  for (let i = 0; i < 14; i++) for (let j = 0; j < 3; j++) { if ((i + j) % 2) { c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(i * 80 - 10, 410 + j * 44, 80, 44); } }
  for (let x = -20; x < W; x += 56) { c.fillStyle = (x / 56) % 2 ? PAL.yellow : '#23201f'; c.beginPath(); c.moveTo(x, 402); c.lineTo(x + 28, 402); c.lineTo(x + 18, 412); c.lineTo(x - 10, 412); c.closePath(); c.fill(); }
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(550, 408, 500, 14, 0, 0, TAU); c.fill();
  roverBody(c, wheels, now);
  wheels.forEach((w, i) => wheel(c, w, i, now, atlas));
  pebbles.forEach((q, id) => { if (!q.out) pebble(c, wheels[q.w].x + q.ox, wheels[q.w].y + q.oy, id, prefs.reduceMotion ? 1 : (Math.floor(now / 200) % 2)); });
  vacuum(c, nozzle, pressed, now);
}

/** "Clean wheels 3 / 6" and "Pebbles out 1 / 2" as two small meters with icons. */
export function drawRoverMeters(c, { clean, total, out, pebbles, atlas }) {
  icon(c, atlas, 'clean', 78, 462, 40);
  meter(c, 108, 468, 220, clean / total, { label: `Clean wheels: ${clean} / ${total}` });
  icon(c, atlas, 'wrench', 388, 462, 36);
  meter(c, 418, 468, 220, out / pebbles, { label: `Pebbles out: ${out} / ${pebbles}`, color: PAL.amber });
}

export { pulse, plate, glint };

// =====================================================================================================================
// 4.2 Air Dust Filter Scrub
// =====================================================================================================================

const easeOut = (k) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 3;
const DUST = ['#b5593a', '#8f4326', '#c97a52', '#6e3a24'];

/** The filter: a metal frame round a fine mesh. Each of the 16 squares carries dust (3 = thick, 0 = clean) as speckles that thin out. */
function filterElement(c, cells, now) {
  const X = 340, Y = 130, C = 100;
  c.fillStyle = '#6f8294'; rr(c, X - 10, Y - 10, 420, 420, 12); c.fill();
  c.strokeStyle = PAL.outline; c.lineWidth = 4; c.stroke();
  c.fillStyle = '#0f1822'; c.fillRect(X, Y, 400, 400);
  // the mesh
  c.strokeStyle = 'rgba(165,195,215,.28)'; c.lineWidth = 1;
  for (let k = 0; k <= 400; k += 10) { c.beginPath(); c.moveTo(X + k, Y); c.lineTo(X + k, Y + 400); c.moveTo(X, Y + k); c.lineTo(X + 400, Y + k); c.stroke(); }
  c.strokeStyle = 'rgba(200,225,240,.5)'; c.lineWidth = 2;
  for (let k = 0; k <= 400; k += C) { c.beginPath(); c.moveTo(X + k, Y); c.lineTo(X + k, Y + 400); c.moveTo(X, Y + k); c.lineTo(X + 400, Y + k); c.stroke(); }
  cells.forEach((q, i) => {
    const x = X + (i % 4) * C, y = Y + Math.floor(i / 4) * C;
    if (q.dust > 0) {
      c.fillStyle = `rgba(150,70,40,${(q.dust / 3) * 0.5})`; c.fillRect(x + 2, y + 2, C - 4, C - 4);
      const count = Math.round(70 * (q.dust / 3));
      for (let n = 0; n < count; n++) {
        const px = x + 4 + rand(i * 131 + n) * (C - 12), py = y + 4 + rand(i * 71 + n * 5) * (C - 12), s = 3 + rand(n + i * 3) * 7;
        c.fillStyle = DUST[n % 4]; c.globalAlpha = 0.6 + 0.4 * rand(n * 3 + i); c.fillRect(px, py, s, s * 0.8);
      }
      c.globalAlpha = 1;
    } else {
      c.fillStyle = 'rgba(120,220,255,.08)'; c.fillRect(x + 2, y + 2, C - 4, C - 4);
      twinkle(c, x + 24 + rand(i) * 40, y + 24 + rand(i + 9) * 40, 9, now, i * 0.9, '#dff6ff');
    }
  });
}

/** A scrubbing brush with its handle, tilted, under the finger. */
function brush(c, x, y, now) {
  c.save(); c.translate(x, y); c.rotate(-0.5);
  c.fillStyle = '#8a5a34'; rr(c, 10, -10, 74, 20, 9); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#d9b36a'; rr(c, -34, -20, 52, 40, 8); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(80,50,20,.6)'; c.lineWidth = 2; for (let k = -26; k <= 10; k += 8) { c.beginPath(); c.moveTo(k, -15); c.lineTo(k, 15); c.stroke(); }
  c.restore();
  if (!prefs.reduceMotion) for (let n = 0; n < 6; n++) { const t = ((now / 300) + n / 6) % 1; c.fillStyle = DUST[n % 4]; c.globalAlpha = 1 - t; c.fillRect(x - 30 + n * 11, y + 14 + t * 30, 5, 5); c.globalAlpha = 1; }
}

/**
 * The air filter scene. `step`: 0 pull the filter out, 1 scrub it, 2 lock it in. `pulledAt`: when step 1 began (ms, rAF clock);
 * `lockedAt`: when the player locked it (the filter slides back in); `brushAt`: where the finger scrubs or null.
 */
export function drawFilterScene(c, { step, cells, pulledAt, lockedAt, brushAt, clean, now, atlas }) {
  backdrop(c, '#0e1925', '#142230');
  // the air duct: slats and a stream of air that is thin while the filter is clogged
  c.fillStyle = 'rgba(120,150,175,.12)'; for (let y = 120; y < 560; y += 34) { c.fillRect(0, y, 200, 12); c.fillRect(W - 200, y, 200, 12); }
  const air = clean / 16;
  c.strokeStyle = `rgba(150,220,255,${0.12 + 0.4 * air})`; c.lineWidth = 6; c.lineCap = 'round'; c.setLineDash([26, 22]);
  const shift = prefs.reduceMotion ? 0 : (now / 40) % 48;
  for (const y of [190, 330, 470]) { c.lineDashOffset = -shift; c.beginPath(); c.moveTo(20, y); c.lineTo(205, y); c.moveTo(W - 205, y); c.lineTo(W - 20, y); c.stroke(); }
  c.setLineDash([]); c.lineDashOffset = 0;
  // the housing
  plate(c, 230, 110, 640, 440, { fill: '#223347', edge: '#5d7a98' });
  c.fillStyle = '#080e16'; rr(c, 250, 128, 600, 404, 10); c.fill();
  // the filter: tucked in at the start and at the end, brought forward while it is scrubbed
  const out = step === 0 ? 0 : easeOut((now - pulledAt) / 450);
  const back = lockedAt ? easeOut((now - lockedAt) / 600) : 0;
  const k = (0.95 + 0.05 * out) - 0.05 * back;
  c.save(); c.translate(540, 330); c.scale(k, k); c.translate(-540, -330);
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 24 * out; c.shadowOffsetY = 10 * out;
  filterElement(c, cells, now);
  c.restore(); c.shadowBlur = 0; c.shadowOffsetY = 0;
  if (step === 0 || back > 0) { c.fillStyle = `rgba(4,8,14,${step === 0 ? 0.34 : 0.34 * back})`; rr(c, 252, 130, 596, 400, 10); c.fill(); }
  // the handle (step 0)
  if (step === 0) {
    const g = pulse(now, 200);
    c.shadowColor = '#ffd600'; c.shadowBlur = 10 + 18 * g;
    c.fillStyle = PAL.yellow; rr(c, 240, 130, 80, 200, 14); c.fill(); c.shadowBlur = 0; c.strokeStyle = PAL.outline; c.lineWidth = 4; c.stroke();
    c.strokeStyle = 'rgba(90,50,10,.55)'; c.lineWidth = 4; for (let y = 150; y < 320; y += 22) { c.beginPath(); c.moveTo(252, y); c.lineTo(308, y); c.stroke(); }
    c.fillStyle = '#6f8294'; c.fillRect(318, 214, 22, 30);
    outlined(c, 'PULL', 280, 244, 26, '#3a2218'); // dark letters on the yellow handle
  }
  // the lever (step 2) and the little light on the housing
  const locked = Boolean(lockedAt);
  c.fillStyle = '#0b1218'; rr(c, 878, 300, 84, 100, 12); c.fill(); c.strokeStyle = PAL.edge; c.lineWidth = 2; c.globalAlpha = step === 2 ? 1 : 0.35; c.stroke(); c.globalAlpha = 1;
  if (step === 2) { c.shadowColor = PAL.green; c.shadowBlur = 10 + 20 * pulse(now, 200); }
  c.fillStyle = step === 2 ? PAL.green : '#2c3b4a'; rr(c, 820, 318, 120, 64, 14); c.fill(); c.shadowBlur = 0; c.strokeStyle = PAL.outline; c.lineWidth = 4; c.stroke();
  outlined(c, 'LOCK', 880, 360, 24, step === 2 ? '#0c2a14' : '#7f93a8');
  c.fillStyle = locked ? PAL.green : step === 2 ? PAL.amber : PAL.red; circle(c, 846, 148, 9); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
  if (brushAt && step === 1) brush(c, brushAt.x, brushAt.y, now);
  // the numbers: what the dust does to the air
  icon(c, atlas, 'lungs', 972, 150, 56);
  meter(c, 884, 214, 190, air, { label: `Clean squares: ${clean} / 16`, color: PAL.cyan });
  const o2 = Math.round(50 + 50 * air);
  meter(c, 884, 262, 190, o2 / 100, { label: `Oxygen output: ${o2}%`, color: o2 >= 100 ? PAL.green : PAL.amber });
}

// =====================================================================================================================
// 4.6 Hydroponic LED & Nutrient Match
// =====================================================================================================================

/** A plant in a tray. `k`: 0 wilted (not fed), 0.5 fed but in the dark, 1 in bloom (fed and under the LED). `flash`: yellow after a wrong bottle. */
function plant(c, x, y, k, now, flash) {
  const sway = prefs.reduceMotion ? 0 : Math.sin(now / 700 + x) * 3;
  const h = 46 + 110 * k, droop = (1 - k) * 40;
  const tx = x + droop + sway, ty = y - h;
  const stem = flash ? '#c9b43a' : k > 0.4 ? '#3a8f3c' : '#7a8a3a';
  c.strokeStyle = PAL.outline; c.lineWidth = 11; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + droop * 0.2, y - h * 0.6, tx, ty); c.stroke();
  c.strokeStyle = stem; c.lineWidth = 6; c.stroke();
  const leaf = flash ? '#e5d34a' : k > 0.9 ? '#43e060' : k > 0.4 ? '#36b34a' : '#7a8a3a';
  const dark = flash ? '#a8932a' : k > 0.4 ? '#1f7a33' : '#566024';
  const n = k > 0.4 ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1), side = i % 2 ? 1 : -1;
    const lx = x + (tx - x) * t * 0.9, ly = y - h * t * 0.9;
    c.save(); c.translate(lx, ly); c.rotate(side * (k > 0.4 ? -0.6 - 0.2 * k : 0.9 + 0.2 * (1 - k)));
    c.fillStyle = leaf; c.strokeStyle = PAL.outline; c.lineWidth = 3;
    c.beginPath(); c.ellipse(side * 26, 0, 30 * (0.7 + 0.3 * k), 12 * (0.8 + 0.2 * k), 0, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = dark; c.lineWidth = 2; c.beginPath(); c.moveTo(side * 4, 0); c.lineTo(side * 48, 0); c.stroke();
    c.restore();
  }
  if (k > 0.9) { // a flower: it needs the light to open
    for (let p = 0; p < 6; p++) { c.save(); c.translate(tx, ty); c.rotate((p / 6) * TAU); c.fillStyle = '#ff8ad8'; c.strokeStyle = PAL.outline; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -14, 8, 14, 0, 0, TAU); c.fill(); c.stroke(); c.restore(); }
    c.fillStyle = PAL.yellow; circle(c, tx, ty, 8); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 2; c.stroke();
  } else { c.fillStyle = leaf; c.strokeStyle = PAL.outline; c.lineWidth = 3; circle(c, tx, ty, 9 + 5 * k); c.fill(); c.stroke(); }
}

/** A glass bottle of nutrient with a colour label; `tilt` pours it. */
function bottle(c, x, y, col, tilt = 0, glowing = false, now = 0) {
  c.save(); c.translate(x, y); c.rotate(tilt);
  if (glowing) glow(c, 0, 0, 90, col, 0.35 + 0.25 * pulse(now, 180));
  c.fillStyle = 'rgba(190,225,240,.22)'; c.strokeStyle = 'rgba(210,235,250,.85)'; c.lineWidth = 4;
  rr(c, -28, -36, 56, 90, 14); c.fill(); c.stroke();
  c.fillStyle = col; c.globalAlpha = 0.9; rr(c, -24, -8, 48, 58, 10); c.fill(); c.globalAlpha = 1;
  c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, -19, -30, 7, 62, 3); c.fill();
  c.fillStyle = 'rgba(210,235,250,.85)'; rr(c, -14, -52, 28, 20, 5); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#e8f6ff'; rr(c, -16, -66, 32, 16, 5); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.moveTo(0, 6); c.quadraticCurveTo(9, 22, 0, 30); c.quadraticCurveTo(-9, 22, 0, 6); c.fill(); // a drop on the label
  c.restore();
}

/** The grow-light bar over the trays: dark until the LED is switched on, then pink, with cones of light on the plants. */
function growLight(c, led, now) {
  c.fillStyle = '#1c2a2e'; rr(c, 90, 96, 920, 30, 10); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
  for (let i = 0; i < 3; i++) {
    const x = 220 + i * 330;
    c.fillStyle = led ? '#ff4de1' : '#4a3a48'; rr(c, x - 100, 106, 200, 12, 6); c.fill();
    if (led) {
      const k = 0.35 + 0.15 * pulse(now, 500);
      const g = c.createLinearGradient(0, 118, 0, 400); g.addColorStop(0, `rgba(255,77,225,${k})`); g.addColorStop(1, 'rgba(255,77,225,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 100, 118); c.lineTo(x + 100, 118); c.lineTo(x + 150, 400); c.lineTo(x - 150, 400); c.closePath(); c.fill();
    }
  }
}

/**
 * The hydroponic scene. `trays`: [{ x, tag (colour), filled, bad (ms), poured (ms) }], `bottles`: [{ c (colour), x, y, used }], `drag`: the bottle
 * being carried, `led`: the light is on, `ready`: all three plants are fed (the switch calls for a tap), `fed`: how many are.
 */
export function drawNutrientScene(c, { trays, bottles, drag, led, ready, fed, now, atlas }) {
  backdrop(c, '#0a1a1c', '#0f2a22');
  // the greenhouse wall: window panes and a pipe along the ceiling
  c.strokeStyle = 'rgba(120,200,170,.10)'; c.lineWidth = 3;
  for (let x = 40; x < W; x += 140) c.strokeRect(x, 150, 110, 230);
  c.fillStyle = '#25414a'; rr(c, 0, 70, W, 14, 7); c.fill();
  growLight(c, led, now);
  trays.forEach((t) => {
    const wrong = now - t.bad < 900;
    // the trough: a deep box with a water channel along the top and a tag on the front
    c.fillStyle = '#1e3a40'; rr(c, t.x - 120, 340, 240, 150, 16); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 4; c.stroke();
    c.fillStyle = '#2f6670'; rr(c, t.x - 120, 340, 240, 30, 12); c.fill(); c.stroke();
    c.fillStyle = 'rgba(80,190,230,.65)'; rr(c, t.x - 108, 348, 216, 14, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(t.x - 90, 352); c.lineTo(t.x - 50, 352); c.moveTo(t.x + 10, 358); c.lineTo(t.x + 60, 358); c.stroke();
    if (t.filled) glow(c, t.x, 360, 130, 'rgba(67,224,96,.5)', 0.35);
    if (drag && !t.filled && t.tag === drag.c) { c.strokeStyle = `rgba(255,255,255,${0.2 + 0.8 * pulse(now, 150)})`; c.lineWidth = 5; rr(c, t.x - 120, 300, 240, 190, 16); c.stroke(); }
    // the plant
    plant(c, t.x, 352, !t.filled ? 0 : led ? 1 : 0.5, now, wrong);
    if (wrong) outlined(c, '!', t.x + 60, 300, 38, '#ff8a8a');
    // the tag on the front, in the colour of the bottle that belongs to it
    c.strokeStyle = '#8aa'; c.lineWidth = 3; c.beginPath(); c.moveTo(t.x, 466); c.lineTo(t.x, 474); c.stroke();
    c.fillStyle = t.tag; rr(c, t.x - 34, 470, 68, 30, 9); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; rr(c, t.x - 28, 474, 24, 7, 3); c.fill();
    if (t.filled) outlined(c, '✔', t.x + 96, 335, 28, '#9affb0');
    // the pour: the bottle tips over the tray for a moment and a stream runs down
    if (t.poured && now - t.poured < 650) {
      const p = (now - t.poured) / 650;
      c.save(); c.globalAlpha = 1 - p * 0.6;
      c.strokeStyle = t.tag; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(t.x + 24, 262); c.lineTo(t.x + 6, 346); c.stroke();
      bottle(c, t.x + 40, 218, t.tag, -2.2 + p * 0.4);
      c.restore();
    }
  });
  // the bottles on the shelf and the one being carried
  bottles.forEach((b) => {
    if (b.used) return;
    const over = drag === b ? trays.find((q) => Math.abs(b.x - q.x) < 130 && b.y > 230) : null;
    bottle(c, b.x, b.y, b.c, over ? -0.7 : 0, drag === b, now);
  });
  // the LED switch
  const sx = 500, sy = 520;
  c.fillStyle = '#1b2832'; rr(c, sx, sy, 100, 90, 16); c.fill(); c.strokeStyle = ready ? '#ff8ae6' : '#4f6f8e'; c.lineWidth = 4; c.stroke();
  if (ready) glow(c, sx + 50, sy + 40, 80, 'rgba(255,77,225,.8)', 0.3 + 0.3 * pulse(now, 200));
  c.fillStyle = led ? '#ff4de1' : ready ? '#c98ac0' : '#59606a'; circle(c, sx + 50, sy + 34, 17); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#9aa7b4'; rr(c, sx + 40, sy + 49, 20, 10, 3); c.fill(); c.stroke();
  if (led) for (let r = 0; r < 8; r++) { const a = (r / 8) * TAU; c.strokeStyle = '#ffb3f0'; c.lineWidth = 3; c.beginPath(); c.moveTo(sx + 50 + Math.cos(a) * 24, sy + 34 + Math.sin(a) * 24); c.lineTo(sx + 50 + Math.cos(a) * 33, sy + 34 + Math.sin(a) * 33); c.stroke(); }
  outlined(c, 'LED', sx + 50, sy + 81, 18, '#fff');
  icon(c, atlas, 'farm', 64, 566, 46);
  meter(c, 96, 568, 230, fed / 3, { label: `Plants fed: ${fed} / 3`, color: PAL.green });
}

// =====================================================================================================================
// 4.9 Earth Dish Antenna Alignment
// =====================================================================================================================

/** Where the beam starts: the dish at the top of the tower (measured on surface.antenna cell 1: the dish is at 0.77 / 0.18 of the visible box). */
export const DISH = Object.freeze({ x: 1034, y: 206, towerX: 1000, towerBase: 482, towerH: 340 });

/** The Earth: blue ocean, green and brown land, white clouds and a thin blue glow of air. */
function earthBall(c, x, y, r, now) {
  glow(c, x, y, r * 3.2, 'rgba(70,150,255,.55)', 0.55);
  c.save(); circle(c, x, y, r); c.clip();
  const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#6fc0ff'); g.addColorStop(1, '#1b4fa8');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  const spin = prefs.reduceMotion ? 0 : (now / 9000) * r * 2;
  c.fillStyle = '#3f9a52';
  for (const [dx, dy, w, h] of [[-0.35, -0.2, 0.55, 0.35], [0.4, 0.25, 0.4, 0.5], [-0.1, 0.55, 0.45, 0.22]]) {
    const px = x + ((dx * r * 2 + spin) % (r * 2.4)) - r * 0.2;
    c.beginPath(); c.ellipse(px, y + dy * r, w * r, h * r, 0.3, 0, TAU); c.fill();
  }
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(2, r * 0.16); c.lineCap = 'round';
  for (const [dy, a0, a1] of [[-0.4, 0.2, 1.8], [0.1, 1.3, 3.0], [0.6, 0.4, 1.5]]) { c.beginPath(); c.arc(x - r * 0.1, y + dy * r, r * 0.8, a0 + Math.PI, a1 + Math.PI); c.stroke(); }
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.arc(x + r * 0.55, y + r * 0.35, r * 1.15, 0, TAU); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(190,230,255,.8)'; c.lineWidth = 2; circle(c, x, y, r); c.stroke();
}

/** A slider: a groove with ticks, a knob with grips, and a glow while it is held. */
function slider(c, x, y, w, v, name, held, locked, now) {
  c.fillStyle = locked ? '#222c36' : '#1a2a3a'; rr(c, x, y, w, 30, 15); c.fill(); c.strokeStyle = locked ? '#3a4654' : PAL.edge; c.lineWidth = 3; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2; for (let k = 1; k < 10; k++) { c.beginPath(); c.moveTo(x + (w * k) / 10, y + 8); c.lineTo(x + (w * k) / 10, y + 22); c.stroke(); }
  const kx = x + w * v;
  c.fillStyle = 'rgba(255,176,0,.35)'; rr(c, x + 6, y + 8, Math.max(8, w * v - 6), 14, 7); c.fill();
  if (held) glow(c, kx, y + 15, 60, 'rgba(255,200,60,.9)', 0.5);
  c.fillStyle = locked ? '#6b6258' : PAL.amber; circle(c, kx, y + 15, 26); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 4; c.stroke();
  c.strokeStyle = 'rgba(90,50,10,.55)'; c.lineWidth = 3; for (const dx of [-8, 0, 8]) { c.beginPath(); c.moveTo(kx + dx, y + 5); c.lineTo(kx + dx, y + 25); c.stroke(); }
  outlined(c, name, x + w / 2, y + 70, 20, locked ? '#7f93a8' : '#dff3ff');
  void now;
}

/**
 * The night sky over the Martian ground, the antenna tower with its dish, the beam, Earth and the controls.
 * `bent`: the dish is still bent from the storm (cell 0 of surface.antenna), `straight`: 0..1 how far the straightening animation is (cross-fade
 * to cell 1); `beam`: the point the dish is aimed at (the ring); `earth`: where Earth is; `bars`: signal 0..5; `lr`, `ud`: the sliders 0..1;
 * `held`: which slider the finger holds ('lr', 'ud' or null).
 */
export function drawAntennaScene(c, { bent, straight, beam, earth, bars, lr, ud, held, now, atlas }) {
  // the sky: deep blue, a faint glow of the Milky Way, two layers of stars
  const sky = c.createLinearGradient(0, 100, 0, 480); sky.addColorStop(0, '#01030a'); sky.addColorStop(1, '#0a1534');
  c.fillStyle = sky; c.fillRect(0, 100, W, 380);
  glow(c, 330, 250, 330, 'rgba(90,70,170,.35)', 0.5); glow(c, 820, 330, 260, 'rgba(40,120,170,.3)', 0.45);
  for (let i = 0; i < 90; i++) {
    const x = rand(i * 3) * W, y = 104 + rand(i * 7 + 1) * 370, big = i % 9 === 0;
    const tw = prefs.reduceMotion ? 0.85 : 0.55 + 0.45 * Math.sin(now / (400 + (i % 5) * 170) + i);
    c.fillStyle = `rgba(210,225,255,${tw})`; c.fillRect(x, y, big ? 3 : 2, big ? 3 : 2);
  }
  // the Martian ground and two hills
  c.fillStyle = '#3a1f1a'; c.beginPath(); c.moveTo(0, 480); c.lineTo(0, 455); c.quadraticCurveTo(220, 420, 420, 458); c.quadraticCurveTo(640, 440, 820, 462); c.quadraticCurveTo(960, 448, W, 456); c.lineTo(W, 480); c.closePath(); c.fill();
  c.fillStyle = '#4b2a22'; c.fillRect(0, 470, W, 10);
  // the beam from the dish to the ring, with a bright core and signal rings when the lock is good
  const ox = DISH.x, oy = DISH.y;
  const cone = c.createLinearGradient(ox, oy, beam.x, beam.y);
  cone.addColorStop(0, `rgba(255,214,0,${0.28 + 0.1 * (bars >= 4 ? 1 : 0)})`); cone.addColorStop(1, 'rgba(255,214,0,.05)');
  c.fillStyle = cone; c.beginPath(); c.moveTo(ox, oy); c.lineTo(beam.x - 52, beam.y); c.lineTo(beam.x + 52, beam.y); c.closePath(); c.fill();
  c.strokeStyle = `rgba(255,214,0,${bars >= 4 ? 0.7 : 0.4})`; c.lineWidth = 3; c.setLineDash([16, 12]); c.lineDashOffset = prefs.reduceMotion ? 0 : -(now / 25) % 28; c.beginPath(); c.moveTo(ox, oy); c.lineTo(beam.x, beam.y); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0; // the core of the beam
  if (!bent && bars >= 4 && !prefs.reduceMotion) for (let k = 0; k < 3; k++) { const t = ((now / 900) + k / 3) % 1; c.strokeStyle = `rgba(120,255,160,${0.6 * (1 - t)})`; c.lineWidth = 3; const px = ox + (beam.x - ox) * t, py = oy + (beam.y - oy) * t; c.beginPath(); c.arc(px, py, 10 + 40 * t, 0, TAU); c.stroke(); }
  // the tower: bent after a storm, straight once it is put right
  const bentCell = bent || straight < 1;
  if (atlas?.has?.('antenna')) {
    if (bentCell) { c.save(); c.globalAlpha = bent ? 1 : 1 - straight; atlas.sprite(c, 'antenna', 0, DISH.towerX, DISH.towerBase, { h: DISH.towerH }); c.restore(); }
    if (!bent) { c.save(); c.globalAlpha = Math.min(1, straight); atlas.sprite(c, 'antenna', 1, DISH.towerX, DISH.towerBase, { h: DISH.towerH }); c.restore(); }
  } else { c.fillStyle = '#b9b3a6'; c.beginPath(); c.ellipse(ox, oy, 34, 14, -0.6, 0, TAU); c.fill(); c.fillRect(ox - 4, oy, 8, 60); }
  // the ring the dish points at, then Earth
  c.strokeStyle = 'rgba(255,214,0,.9)'; c.lineWidth = 3; c.setLineDash([10, 8]); circle(c, beam.x, beam.y, 60); c.stroke(); c.setLineDash([]);
  c.strokeStyle = 'rgba(255,214,0,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(beam.x - 14, beam.y); c.lineTo(beam.x + 14, beam.y); c.moveTo(beam.x, beam.y - 14); c.lineTo(beam.x, beam.y + 14); c.stroke();
  outlined(c, 'dish beam', beam.x, beam.y + 82, 16, 'rgba(255,214,0,.95)');
  earthBall(c, earth.x, earth.y, 17, now);
  outlined(c, 'EARTH', earth.x, earth.y - 30, 18, '#9fd8ff');
  // the signal bars, in a little panel
  plate(c, 26, 22, 176, 76, { fill: '#0d1c2c', edge: '#2e5675', bolts: false, r: 12 });
  outlined(c, 'SIGNAL', 40, 46, 15, '#9fd8ff', 'left');
  for (let i = 0; i < 5; i++) { c.fillStyle = i < bars ? (bars >= 4 ? PAL.green : PAL.amber) : '#2a3541'; rr(c, 50 + i * 28, 88 - i * 9 - 4, 20, 14 + i * 9, 4); c.fill(); }
  // the controls
  c.fillStyle = '#0f1a26'; c.fillRect(0, 480, W, H - 480);
  slider(c, 120, 515, 400, lr, bent ? 'Left / Right (the dish is bent)' : 'Left / Right', held === 'lr', bent, now);
  slider(c, 600, 515, 400, ud, bent ? 'Up / Down (the dish is bent)' : 'Up / Down', held === 'ud', bent, now);
}

// =====================================================================================================================
// 4.5 Heat Pump Pipe Reroute
// =====================================================================================================================

/** The geometry of the pipe grid (the same numbers the rules in minigames2.js use for taps). */
export const HEAT_GRID = Object.freeze({ X: 150, Y: 150, T: 150, RH: 142.5 });

/** One pipe arm from the middle of a tile towards an edge: a dark tube, a coloured core, a highlight, and a coupling ring at the edge. */
function pipeArm(c, cx, cy, dx, dy, len, warm, now) {
  const ex = cx + dx * len, ey = cy + dy * len;
  c.lineCap = 'round';
  c.strokeStyle = '#10161d'; c.lineWidth = 26; c.beginPath(); c.moveTo(cx, cy); c.lineTo(ex, ey); c.stroke();
  c.strokeStyle = warm ? '#ff7a2a' : '#71869a'; c.lineWidth = 17; c.stroke();
  c.strokeStyle = warm ? '#ffc070' : '#a9bccd'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx - dy * 4, cy + dx * 4); c.lineTo(ex - dy * 4, ey + dx * 4); c.stroke();
  if (warm) { // the heat runs through: bright dashes, still with Reduce motion
    c.strokeStyle = 'rgba(255,240,150,.85)'; c.lineWidth = 6; c.setLineDash([10, 22]); c.lineDashOffset = prefs.reduceMotion ? 0 : -(now / 20) % 32;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(ex, ey); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
  }
  // the coupling where the pipe meets the next tile
  const px = cx + dx * (len - 3), py = cy + dy * (len - 3);
  c.fillStyle = warm ? '#7a3a14' : '#44525f'; c.save(); c.translate(px, py); c.rotate(Math.atan2(dy, dx));
  rr(c, -4, -17, 8, 34, 3); c.fill(); c.strokeStyle = '#10161d'; c.lineWidth = 2; c.stroke(); c.restore();
}

/**
 * The heat pump scene. `tiles`: the 3 x 4 grid of pipe masks (N = 1, E = 2, S = 4, W = 8), `seen`: the tiles the heat reaches ('row,col'),
 * `rooms`: the rows (rooms) that are warm, `fixedAt`: (row, col) -> true when the tile cannot turn. Draws everything but the instruction and the hand.
 */
export function drawHeatScene(c, { tiles, seen, rooms, canTurn, inlet, now, atlas }) {
  const { X, Y, T, RH } = HEAT_GRID;
  backdrop(c, '#150e12', '#1f1418');
  // a wall of rivets and two big old pipes in the dark behind everything
  c.strokeStyle = 'rgba(255,255,255,.035)'; c.lineWidth = 2; for (let y = 120; y < 600; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.fillStyle = 'rgba(70,45,40,.35)'; c.fillRect(0, 100, W, 22); c.fillRect(0, 560, W, 22);
  // the Heating Core: a heater with a flame, always warm
  const cy = Y + RH * 1.5;
  glow(c, 85, cy, 120, 'rgba(255,110,40,.8)', 0.5);
  plate(c, 36, cy - 62, 98, 124, { fill: '#7a2f12', edge: '#ff8a2a', r: 16 });
  c.fillStyle = '#ffb000'; c.beginPath(); c.moveTo(85, cy - 36); c.quadraticCurveTo(112, cy - 6, 98, cy + 16); c.quadraticCurveTo(85, cy + 34, 72, cy + 16); c.quadraticCurveTo(60, cy - 6, 85, cy - 36); c.fill();
  c.fillStyle = '#fff3b0'; c.beginPath(); c.moveTo(85, cy - 10); c.quadraticCurveTo(95, cy + 6, 85, cy + 20); c.quadraticCurveTo(75, cy + 6, 85, cy - 10); c.fill();
  outlined(c, 'CORE', 85, cy + 54, 19, '#fff');
  // the pipe from the core into the grid
  pipeArm(c, 134, cy, 1, 0, X - 134, inlet, now);
  // the tiles: a metal plate each; a darker one (with a bolt) cannot turn
  for (let r = 0; r < tiles.length; r++) for (let col = 0; col < tiles[r].length; col++) {
    const x = X + col * T, y = Y + r * RH, m = tiles[r][col];
    const turn = canTurn(m);
    plate(c, x + 4, y + 4, T - 8, RH - 8, { fill: turn ? '#1a2b3d' : '#121d2a', edge: turn ? '#3f5f7f' : '#2b3c4d', r: 14, bolts: turn });
    if (!turn && m) icon(c, atlas, 'lock', x + T - 24, y + 24, 28, 0.9); // a fixed junction: it does not turn
  }
  for (let r = 0; r < tiles.length; r++) for (let col = 0; col < tiles[r].length; col++) {
    const m = tiles[r][col];
    if (!m) continue;
    const cx = X + col * T + T / 2, ty = Y + r * RH + RH / 2, warm = seen.has(`${r},${col}`);
    if (m & 1) pipeArm(c, cx, ty, 0, -1, RH / 2, warm, now);
    if (m & 2) pipeArm(c, cx, ty, 1, 0, T / 2, warm, now);
    if (m & 4) pipeArm(c, cx, ty, 0, 1, RH / 2, warm, now);
    if (m & 8) pipeArm(c, cx, ty, -1, 0, T / 2, warm, now);
    // the hub where the arms meet, with a bolt
    c.fillStyle = warm ? '#d9561c' : '#58697a'; circle(c, cx, ty, 15); c.fill(); c.strokeStyle = '#10161d'; c.lineWidth = 3; c.stroke();
    bolt(c, cx, ty, 3.5);
  }
  // the last pipe of a row feeds its room through a short stub
  const last = tiles[0].length - 1;
  for (let r = 0; r < tiles.length; r++) if (tiles[r][last] & 2) pipeArm(c, X + (last + 1) * T, Y + r * RH + RH / 2, 1, 0, 20, seen.has(`${r},${last}`), now);
  // the rooms: each wants heat; a warm one glows green with a check
  const names = ['Bedroom', 'Kitchen', 'Greenhouse'], pics = ['rest', 'eat', 'farm'];
  names.forEach((n, i) => {
    const x = X + tiles[0].length * T + 20, y = Y + i * RH + 20, warm = rooms.has(i);
    if (warm) glow(c, x + 75, y + 45, 110, 'rgba(67,224,96,.7)', 0.4);
    plate(c, x, y, 150, 100, { fill: warm ? '#134226' : '#1f2e3d', edge: warm ? '#43e060' : '#4a6178', r: 14 });
    icon(c, atlas, pics[i], x + 75, y + 28, 40, warm ? 1 : 0.55);
    outlined(c, n, x + 75, y + 66, 20, warm ? '#dfffe8' : '#b9c7d6');
    outlined(c, warm ? 'warm' : 'cold', x + 75, y + 90, 15, warm ? '#9affb0' : '#8fb4ff');
    if (warm) outlined(c, '✔', x + 133, y + 26, 24, '#9affb0');
  });
}

// =====================================================================================================================
// 4.4 Closed-Loop Water Sort
// =====================================================================================================================

/** The three machines of the water loop, each drawn as what it does: a filter with mesh, a boiler with a flame, a purifier with a UV tube. */
function machine(c, kind, x, y, now, scale = 1, lifted = false) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  if (lifted) { c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 20; c.shadowOffsetY = 8; }
  const body = kind === 'Filter' ? '#7d9db0' : kind === 'Boiler' ? '#b4541f' : '#6b45a8';
  plate(c, -85, -45, 170, 90, { fill: body, edge: PAL.outline, r: 14, bolts: false });
  c.shadowBlur = 0; c.shadowOffsetY = 0;
  if (kind === 'Filter') { // a funnel over a mesh
    c.fillStyle = '#d9e8f0'; c.beginPath(); c.moveTo(-50, -30); c.lineTo(50, -30); c.lineTo(20, 4); c.lineTo(-20, 4); c.closePath(); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
    c.strokeStyle = 'rgba(40,70,90,.7)'; c.lineWidth = 2; for (let k = -40; k <= 40; k += 10) { c.beginPath(); c.moveTo(k, -28); c.lineTo(k * 0.45, 2); c.stroke(); }
    c.fillStyle = '#0f2a3a'; rr(c, -30, 12, 60, 16, 5); c.fill();
    c.strokeStyle = 'rgba(160,210,235,.7)'; c.lineWidth = 2; for (let k = -24; k <= 24; k += 8) { c.beginPath(); c.moveTo(k, 14); c.lineTo(k, 26); c.stroke(); }
  } else if (kind === 'Boiler') { // a tank with a flame
    c.fillStyle = '#e8d2b8'; rr(c, -42, -34, 84, 62, 16); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
    glow(c, 0, 0, 56, 'rgba(255,150,40,.9)', 0.45 + 0.2 * pulse(now, 220));
    c.fillStyle = '#ff8a2a'; c.beginPath(); c.moveTo(0, -22); c.quadraticCurveTo(22, 0, 12, 14); c.quadraticCurveTo(0, 22, -12, 14); c.quadraticCurveTo(-22, 0, 0, -22); c.fill();
    c.fillStyle = '#ffe27a'; c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(8, 6, 0, 14); c.quadraticCurveTo(-8, 6, 0, -6); c.fill();
    c.fillStyle = '#8a8f96'; rr(c, -6, -42, 12, 10, 3); c.fill();
  } else { // a tube with a purple UV lamp
    c.fillStyle = '#d7c8f0'; rr(c, -48, -26, 96, 52, 26); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
    glow(c, 0, 0, 62, 'rgba(190,120,255,.95)', 0.5 + 0.2 * pulse(now, 260));
    c.fillStyle = '#c9a0ff'; rr(c, -38, -9, 76, 18, 9); c.fill();
    c.fillStyle = '#fff'; rr(c, -30, -5, 40, 5, 2); c.fill();
    twinkle(c, 30, -16, 8, now, 1, '#fff');
  }
  outlined(c, kind, 0, 78, 22, '#fff'); // the name: the rules talk about the Filter, the Boiler and the Purifier
  c.restore();
}

/** The touch area of the TAP button (the rules in minigames2.js use it too). */
export const TAP_RECT = Object.freeze({ x: 30, y: 150, w: 150, h: 70 });

/** A faucet: the yellow TAP button (the touch area is 30, 150, 150, 70), a steel spout and a drip; it glows when it is ready to be tapped. */
function faucet(c, ready, now) {
  const { x, y, w, h } = TAP_RECT;
  c.strokeStyle = PAL.outline; c.lineWidth = 4;
  c.fillStyle = '#6f8294'; rr(c, 120, 206, 40, 60, 10); c.fill(); c.stroke(); // the spout
  c.fillStyle = '#8fa2b4'; rr(c, 110, 258, 60, 16, 6); c.fill(); c.stroke(); // the nozzle
  c.fillStyle = '#6f8294'; rr(c, 70, 132, 70, 22, 8); c.fill(); c.stroke(); // the handle bar
  if (ready) { c.shadowColor = '#ffd600'; c.shadowBlur = 10 + 16 * pulse(now, 200); }
  c.fillStyle = PAL.yellow; rr(c, x, y, w, h, 18); c.fill(); c.shadowBlur = 0; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.4)'; rr(c, x + 12, y + 6, w - 24, 8, 4); c.fill();
  c.fillStyle = '#3a2218'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('TAP', x + w / 2, y + h / 2 + 12);
  const drip = prefs.reduceMotion ? 0.3 : (now / 1200) % 1;
  c.fillStyle = '#7fd0ff'; c.beginPath(); c.ellipse(140, 282 + drip * 18, 5, 8, 0, 0, TAU); c.fill();
}

/**
 * The water loop scene. `machines`: [{ id, x, y }] on the shelf or in the hand, `slots`: the three bays [{ x, y, w, h }] with what is in them
 * (`filled`: the machine id or null), `next`: the bay to fill next, `drag`: the machine in the hand, `wobble`: { i, at } after a wrong order,
 * `dropletX` / `clean`: the droplet on the pipe and how clean it is (0 murky .. 1 clear), `ready`: all three are in (the tap calls for a tap).
 */
export function drawWaterScene(c, { machines, bays, filled, next, drag, wobble, dropletX, clean, ready, count, now, atlas }) {
  backdrop(c, '#08182a', '#0e2a40');
  // the counter: how many machines are in, on a little plate
  plate(c, 780, 150, 290, 84, { fill: '#0d2236', edge: '#2e5675', r: 14 });
  // the pipe: steel, with the water in it turning clear as it passes the machines
  c.fillStyle = '#10161d'; rr(c, 96, 288, 972, 34, 17); c.fill();
  c.fillStyle = '#4c6277'; rr(c, 100, 292, 964, 26, 13); c.fill();
  const g = c.createLinearGradient(100, 0, 1060, 0); g.addColorStop(0, 'rgba(110,76,44,.85)'); g.addColorStop(0.3, 'rgba(110,76,44,.7)'); g.addColorStop(0.6, 'rgba(70,150,230,.85)'); g.addColorStop(1, 'rgba(90,200,255,.95)');
  c.fillStyle = g; rr(c, 106, 298, 952, 14, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.22)'; rr(c, 110, 294, 944, 4, 2); c.fill();
  faucet(c, ready, now);
  // the bays
  bays.forEach((r, i) => {
    const bad = wobble?.i === i && now - wobble.at < 600;
    const shake = bad ? Math.sin(now / 30) * 6 : 0;
    c.fillStyle = 'rgba(2,10,18,.7)'; rr(c, r.x + shake, r.y, r.w, r.h, 14); c.fill();
    c.strokeStyle = bad ? '#ff5252' : i === next && !drag ? `rgba(0,229,255,${0.25 + 0.75 * pulse(now, 200)})` : '#4db8ff'; c.lineWidth = 4; c.setLineDash([10, 8]);
    rr(c, r.x + shake, r.y, r.w, r.h, 14); c.stroke(); c.setLineDash([]);
    if (!filled[i]) outlined(c, String(i + 1), r.x + r.w / 2, r.y + 72, 44, 'rgba(120,200,255,.55)');
  });
  // a machine glows while the droplet passes through it
  bays.forEach((r, i) => { if (filled[i] && Math.abs(dropletX - (r.x + r.w / 2)) < 100) glow(c, r.x + r.w / 2, r.y + r.h / 2, 150, 'rgba(255,255,255,.9)', 0.35); });
  machines.forEach((m) => machine(c, m.id, m.x, m.y, now, m === drag ? 1.08 : 1, m === drag));
  // the droplet, in front: murky brown with dirt specks and a worried face, clear blue and smiling once it is clean
  const cl = Math.max(0, Math.min(1, clean));
  const col = `rgb(${Math.round(107 + (77 - 107) * cl)},${Math.round(74 + (184 - 74) * cl)},${Math.round(42 + (255 - 42) * cl)})`;
  const dx = dropletX, top = 268, cyy = 316, R = 27;
  c.fillStyle = col; c.strokeStyle = PAL.outline; c.lineWidth = 4;
  c.beginPath(); c.moveTo(dx, top); c.bezierCurveTo(dx + 8, top + 18, dx + R, cyy - 26, dx + R, cyy); c.arc(dx, cyy, R, 0, Math.PI, false); c.bezierCurveTo(dx - R, cyy - 26, dx - 8, top + 18, dx, top); c.closePath(); c.fill(); c.stroke();
  if (cl < 0.85) { c.fillStyle = `rgba(40,25,10,${0.6 * (1 - cl)})`; for (const [sx, sy] of [[-11, 12], [12, 9], [3, -17]]) { circle(c, dx + sx, cyy + sy, 3); c.fill(); } }
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(dx - 13, cyy - 8, 4, 9, -0.4, 0, TAU); c.fill();
  c.fillStyle = '#fff'; circle(c, dx - 9, cyy - 1, 5.5); c.fill(); circle(c, dx + 9, cyy - 1, 5.5); c.fill();
  c.fillStyle = '#13202c'; circle(c, dx - 8, cyy, 2.4); c.fill(); circle(c, dx + 10, cyy, 2.4); c.fill();
  c.strokeStyle = '#13202c'; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath();
  if (cl > 0.7) c.arc(dx, cyy + 6, 8, 0.15 * Math.PI, 0.85 * Math.PI); else { c.moveTo(dx - 6, cyy + 14); c.quadraticCurveTo(dx, cyy + 10, dx + 6, cyy + 14); }
  c.stroke();
  if (cl > 0.95) { twinkle(c, dx + 26, top + 22, 9, now, 0.5); twinkle(c, dx - 26, top + 44, 6, now, 2); }
  icon(c, atlas, 'water', 816, 192, 44);
  meter(c, 850, 198, 200, count / 3, { label: `Machines in: ${count} / 3`, color: PAL.cyan });
}

// =====================================================================================================================
// 4.3 Valve Balance
// =====================================================================================================================

/** The numbers the rules in minigames2.js share with the picture: the width of a gauge and of its lever, the lever's height and the scale. */
export const VALVE = Object.freeze({ GW: 440, SLIDER_Y: 430, GAUGE_Y: 160, GAUGE_H: 70 });

const VALVE_ICON = { co2: 'dust', o2: 'lungs' };

/** One gauge panel: the name with its icon and a lamp, the scale (low / SAFE / high) under glass, the needle and the hint. */
function gaugePanel(c, g, val, inBand, now, atlas) {
  const { GW, GAUGE_Y: sy, GAUGE_H: gh } = VALVE, sx = g.x;
  plate(c, sx - 20, 90, GW + 40, 230, { fill: '#10253a', edge: inBand ? 'rgba(67,224,96,.9)' : '#3f5f7f', r: 16 });
  icon(c, atlas, VALVE_ICON[g.id], sx + 22, 118, 38);
  outlined(c, g.name, sx + 50, 127, 26, g.col, 'left');
  // the lamp: green while the needle is in SAFE
  if (inBand) glow(c, sx + GW - 12, 116, 30, 'rgba(67,224,96,.95)', 0.6);
  c.fillStyle = inBand ? PAL.green : '#5a2b2b'; circle(c, sx + GW - 12, 116, 9); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
  // the scale
  c.save(); rr(c, sx, sy, GW, gh, 10); c.clip();
  c.fillStyle = '#0a121c'; c.fillRect(sx, sy, GW, gh);
  c.fillStyle = 'rgba(77,184,255,.24)'; c.fillRect(sx, sy, g.band[0] * GW, gh);
  c.fillStyle = inBand ? 'rgba(67,224,96,.62)' : 'rgba(67,224,96,.36)'; c.fillRect(sx + g.band[0] * GW, sy, (g.band[1] - g.band[0]) * GW, gh);
  c.fillStyle = 'rgba(255,90,70,.24)'; c.fillRect(sx + g.band[1] * GW, sy, (1 - g.band[1]) * GW, gh);
  c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 2;
  for (let k = 0; k <= 20; k++) { const x = sx + (GW * k) / 20, h = k % 2 === 0 ? 14 : 8; c.beginPath(); c.moveTo(x, sy + gh); c.lineTo(x, sy + gh - h); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(sx, sy, GW, gh / 2); // the glass
  c.restore();
  rr(c, sx, sy, GW, gh, 10); c.strokeStyle = '#4f6f8e'; c.lineWidth = 3; c.stroke();
  outlined(c, 'low', sx + 6, sy + gh + 20, 15, '#8fb4ff', 'left');
  outlined(c, 'high', sx + GW - 6, sy + gh + 20, 15, '#ff9a8a', 'right');
  // the needle: a marker on top and a line through the scale; green in SAFE, red outside it
  const nx = sx + val * GW, nc = inBand ? '#43e060' : '#ff8a80';
  if (inBand) glow(c, nx, sy + gh / 2, 64, 'rgba(67,224,96,.85)', 0.5);
  c.fillStyle = nc; c.strokeStyle = PAL.outline; c.lineWidth = 3;
  c.beginPath(); c.moveTo(nx, sy - 2); c.lineTo(nx - 12, sy - 20); c.lineTo(nx + 12, sy - 20); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = nc; c.fillRect(nx - 3.5, sy - 4, 7, gh + 14);
  outlined(c, 'SAFE', sx + ((g.band[0] + g.band[1]) / 2) * GW, sy + 38, 20, '#d7ffe0');
  outlined(c, g.hint, sx + GW / 2, 292, 18, '#bcd');
}

/** One lever: a slot with a fill in the lever's colour, notches, a metal knob with a coloured cap, and a pulsing arrow towards SAFE. */
function lever(c, g, val, inBand, held, now) {
  const { GW, SLIDER_Y: ly } = VALVE, sx = g.x, hx = sx + g.target * GW;
  c.fillStyle = '#0a121c'; rr(c, sx, ly - 13, GW, 26, 13); c.fill(); c.strokeStyle = '#3b5670'; c.lineWidth = 3; c.stroke();
  c.save(); c.globalAlpha = 0.5; c.fillStyle = g.col; rr(c, sx + 4, ly - 9, Math.max(18, hx - sx - 4), 18, 9); c.fill(); c.restore();
  c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 2;
  for (let k = 1; k < 10; k++) { const x = sx + (GW * k) / 10; c.beginPath(); c.moveTo(x, ly + 18); c.lineTo(x, ly + 26); c.stroke(); }
  outlined(c, 'less', sx + 4, ly + 52, 15, '#8fb4ff', 'left');
  outlined(c, 'more', sx + GW - 4, ly + 52, 15, '#ff9a8a', 'right');
  // which way to go: a pulsing arrow until the needle is safe
  if (!inBand) {
    const dir = val > g.band[1] ? -1 : 1, a = pulse(now, 180), ax = hx + dir * 62;
    c.fillStyle = `rgba(255,214,0,${a})`; c.beginPath(); c.moveTo(ax + dir * 22, ly); c.lineTo(ax, ly - 18); c.lineTo(ax, ly + 18); c.closePath(); c.fill();
  }
  if (held) glow(c, hx, ly, 76, 'rgba(255,255,255,.9)', 0.35);
  c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 8; c.shadowOffsetY = 4;
  c.fillStyle = '#2b3a4a'; circle(c, hx, ly, 34); c.fill();
  c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.fillStyle = g.col; circle(c, hx, ly, 27); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(hx - 8, ly - 12, 12, 6, -0.5, 0, TAU); c.fill();
  c.strokeStyle = held ? '#fff' : PAL.outline; c.lineWidth = 4; circle(c, hx, ly, 34); c.stroke();
  c.fillStyle = '#0b1522'; c.font = 'bold 28px sans-serif'; c.textAlign = 'center'; c.fillText('↔', hx, ly + 9);
}

/**
 * The two gauges and their levers. `gauges`: [{ id, name, hint, col, band, target, x }], `vals`: the shown needle position of each (0..1),
 * `drag`: the gauge whose lever is held, `holdK`: how far the 2 seconds of hold are (0..1), or null while a needle is out of SAFE.
 */
export function drawValveScene(c, { gauges, vals, drag, holdK, now, atlas }) {
  backdrop(c, '#0a1a22', '#0e2a33');
  c.strokeStyle = 'rgba(255,255,255,.03)'; c.lineWidth = 2; for (let y = 80; y < 600; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  // an air duct between the gauges and the levers, with a few chevrons showing the air going through
  c.fillStyle = 'rgba(120,170,190,.08)'; c.fillRect(0, 338, W, 34);
  c.strokeStyle = 'rgba(160,210,230,.14)'; c.lineWidth = 3; c.lineCap = 'round';
  const slide = prefs.reduceMotion ? 0 : (now / 40) % 70;
  for (let x = -70; x < W + 70; x += 70) { const px = x + slide; c.beginPath(); c.moveTo(px, 346); c.lineTo(px + 12, 355); c.lineTo(px, 364); c.stroke(); }
  gauges.forEach((g, i) => {
    const inBand = vals[i] >= g.band[0] && vals[i] <= g.band[1];
    gaugePanel(c, g, vals[i], inBand, now, atlas);
    lever(c, g, vals[i], inBand, drag === g, now);
  });
  if (holdK !== null) {
    outlined(c, 'Hold steady...', W / 2, 512, 22, '#9affb0');
    meter(c, 150, 520, 800, holdK, { color: PAL.green, h: 26 });
  }
}

// =====================================================================================================================
// Tutorial step: the battery and the cable of Drone #01 (SCENARIO TUT_BATTERY)
// =====================================================================================================================

/** Where the parts are: the rules in minigames.js use the same numbers (the pocket, the socket, the cable's rest place, the battery's shelf). */
export const BATTERY = Object.freeze({
  slot: Object.freeze({ x: 330, y: 190, w: 250, h: 130 }),
  socket: Object.freeze({ x: 700, y: 255 }),
  plugHome: Object.freeze({ x: 760, y: 470 }),
  home: Object.freeze({ x: 90, y: 400, w: 190, h: 100 }),
});

/**
 * The back of Drone #01 on a workbench: a hatch with the battery pocket, the round socket, the orange cable and the charged battery.
 * `battery`: { x, y, w, h, seated }, `plug`: { x, y }, `done`: the cable is in, `drag`: { what: 'battery' | 'plug' } while a part is held.
 * The battery and the pocket pulse until the battery is in (SCENARIO: they highlight); then the socket and the plug do.
 */
export function drawBatteryScene(c, { battery, plug, done, drag, now, atlas }) {
  const { slot, socket, plugHome } = BATTERY, seated = battery.seated;
  backdrop(c, '#0a1420', '#13233a');
  glow(c, 560, 330, 520, 'rgba(255,230,170,.14)', 1); // a lamp over the bench
  c.fillStyle = '#2a1f1a'; c.fillRect(0, 566, W, 54); c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, 566, W, 4);
  // the back of the drone: a cream plate with a seam and bolts
  plate(c, 250, 120, 620, 420, { fill: '#e6d8c0', edge: PAL.outline, r: 40, bolts: false });
  c.strokeStyle = 'rgba(58,34,24,.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(262, 464); c.lineTo(858, 464); c.stroke();
  for (const [bx, by] of [[284, 154], [836, 154], [284, 506], [836, 506], [560, 506]]) bolt(c, bx, by, 6);
  // the hatch: a dark compartment with two hinges on top
  c.fillStyle = '#1a1214'; rr(c, 290, 160, 540, 260, 24); c.fill();
  const shade = c.createLinearGradient(0, 160, 0, 420); shade.addColorStop(0, 'rgba(0,0,0,.55)'); shade.addColorStop(0.4, 'rgba(0,0,0,0)');
  c.fillStyle = shade; rr(c, 290, 160, 540, 260, 24); c.fill();
  c.strokeStyle = '#8b7a66'; c.lineWidth = 6; rr(c, 290, 160, 540, 260, 24); c.stroke();
  for (const hx of [350, 770]) { c.fillStyle = '#8b7a66'; rr(c, hx - 24, 150, 48, 20, 6); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke(); }
  outlined(c, 'Drone #01 – back hatch', 560, 100, 24, '#fff');
  // the battery pocket with its gold contacts; its outline pulses until the battery is in
  c.fillStyle = '#0c0809'; rr(c, slot.x, slot.y, slot.w, slot.h, 12); c.fill();
  for (const ty of [slot.y + 45, slot.y + 71]) { c.fillStyle = '#d9a63a'; rr(c, slot.x + 208, ty, 16, 22, 4); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 2; c.stroke(); }
  if (!seated) outlined(c, 'BATTERY', slot.x + 16, slot.y + 24, 16, 'rgba(0,229,255,.75)', 'left');
  c.setLineDash([12, 8]); c.lineWidth = 4; c.strokeStyle = seated ? '#43e060' : `rgba(0,229,255,${0.55 + 0.45 * pulse(now, 300)})`;
  rr(c, slot.x, slot.y, slot.w, slot.h, 12); c.stroke(); c.setLineDash([]);
  // the round socket: it lights up only when it is the next thing to use, so the first step has one clear target
  c.fillStyle = '#3a4756'; circle(c, socket.x, socket.y, 38); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 4; c.stroke();
  c.fillStyle = '#9aa7b4'; circle(c, socket.x, socket.y, 28); c.fill();
  c.fillStyle = done ? '#43e060' : seated ? '#ff8a2a' : '#4a5560'; circle(c, socket.x, socket.y, 18); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.beginPath(); c.arc(socket.x, socket.y, 23, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
  outlined(c, 'PORT', socket.x, socket.y + 64, 16, '#cdb99a');
  if (seated && !done) { c.strokeStyle = `rgba(255,138,42,${0.35 + 0.65 * pulse(now, 200)})`; c.lineWidth = 5; circle(c, socket.x, socket.y, 48); c.stroke(); }
  // the cable: a dark edge, an orange core and a bright line; the plug has two metal prongs
  if (seated) {
    const ox = plugHome.x + 60, oy = plugHome.y + 90;
    c.fillStyle = '#3a4756'; rr(c, ox - 34, oy - 16, 68, 34, 8); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
    const path = () => { c.beginPath(); c.moveTo(ox, oy); c.bezierCurveTo(plugHome.x, plugHome.y + 60, plug.x + 30, plug.y + 90, plug.x, plug.y); };
    c.lineCap = 'round';
    c.strokeStyle = PAL.outline; c.lineWidth = 18; path(); c.stroke();
    c.strokeStyle = '#ff8a2a'; c.lineWidth = 12; path(); c.stroke();
    c.strokeStyle = 'rgba(255,230,180,.5)'; c.lineWidth = 3; path(); c.stroke();
    c.fillStyle = '#c9ced4'; rr(c, plug.x - 42, plug.y - 11, 18, 8, 3); c.fill(); rr(c, plug.x - 42, plug.y + 3, 18, 8, 3); c.fill();
    c.fillStyle = '#ffb870'; rr(c, plug.x - 26, plug.y - 18, 52, 36, 8); c.fill(); c.strokeStyle = PAL.outline; c.lineWidth = 3; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.4)'; rr(c, plug.x - 20, plug.y - 14, 40, 6, 3); c.fill();
    if (!done) { c.strokeStyle = `rgba(255,214,0,${0.35 + 0.6 * pulse(now, 200)})`; c.lineWidth = 5; circle(c, plug.x, plug.y, 44); c.stroke(); }
  }
  // the charged battery: it glows while it is the thing to pick up, and lifts off the bench in the hand
  const { x, y, w, h } = battery;
  if (!seated && !drag) glow(c, x + w / 2, y + h / 2, 150, 'rgba(0,229,255,.9)', 0.2 + 0.3 * pulse(now, 300));
  if (drag?.what === 'battery') { c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 22; c.shadowOffsetY = 10; }
  c.fillStyle = '#2f6f3f'; rr(c, x, y, w, h, 14); c.fill();
  c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.strokeStyle = '#d7ffe0'; c.lineWidth = 5; c.stroke();
  c.fillStyle = '#d7ffe0'; rr(c, x + w, y + 32, 14, 36, 3); c.fill();
  c.fillStyle = 'rgba(255,255,255,.16)'; rr(c, x + 8, y + 6, w - 16, 10, 5); c.fill();
  icon(c, atlas, 'battery', x + 54, y + 50, 88);
  outlined(c, 'CHARGED', x + 98, y + 58, 17, '#fff', 'left'); // fits inside the battery body
}
