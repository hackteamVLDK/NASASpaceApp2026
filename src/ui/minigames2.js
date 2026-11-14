/**
 * The other mini-games of SCENARIO Section 4, on one shared scaffold: an overlay canvas, a timer
 * ring, an instant free retry, and no big FAIL screen. After 3 failures in a row a drone helps.
 *   heat_pump (4.5)   valve_balance (4.3)   water_sort (4.4)   nutrient_match (4.6)
 *   air_filter (4.2)  antenna (4.9)         wheel_vacuum (4.7) suit_seal (4.8)
 * Solar Wipe (4.1) and the tutorial battery step are in minigames.js.
 */
import { play, director } from './audio.js';
import { LAYOUTS, scramble, reach, tap, canTurn, ROWS, COLS, N, E, S, W as WEST } from './pipes.js';
import { createSuit, pointerDown, pointerMove, pointerUp, pressureAt, steps, complete, nextStep, STAGE, PRESSURE } from './suit-seal.js';
import { t } from '../flow/strings.js';
import { formatDelay } from '../data/nasa/lightTime.js';

const W = 1100;
const H = 620;
const TIME = { heat_pump: 20, valve_balance: 15, water_sort: 15, nutrient_match: 15, air_filter: 20, antenna: 20, wheel_vacuum: 20, suit_seal: 15 };
const SOLO_BONUS = 3; // the Commander gets +3 s on every timer (SCENARIO 4)
const HINTS = { heat_pump: 'Tap a pipe to turn it. Warm pipes glow orange: send the heat to the Bedroom, the Kitchen and the Greenhouse.' };

const pt = (canvas, e) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height }; };
const inR = (p, x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
const rr = (c, x, y, w, h, r = 12) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const label = (c, text, x, y, size = 22, color = '#fff', align = 'center') => { c.fillStyle = color; c.font = `bold ${size}px sans-serif`; c.textAlign = align; c.fillText(text, x, y); };

function ring(c, frac) {
  c.save();
  c.lineWidth = 12; c.strokeStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(W - 60, 60, 38, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = frac > 0.5 ? '#43e060' : frac > 0.2 ? '#ffd600' : '#ff5252';
  c.beginPath(); c.arc(W - 60, 60, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); c.stroke();
  c.restore();
}

/**
 * Shared scaffold. `make()` returns { down(p), move(p), up(p), draw(c, now, api), done() } where
 * `api.win()` ends the game; `done()` says whether the goal is reached each frame.
 */
function scaffold({ canvas, game, onWin, onFail, onTitle, onHint, title, hint, make, opts = {} }) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  onTitle(title);
  onHint(HINTS[game] ?? hint);
  const limit = TIME[game] + SOLO_BONUS;
  let g, started, failures = 0, finished = false, msg = '', raf = 0, held = 0;
  const reset = () => { g = make(opts); started = performance.now(); held = 0; };
  reset();
  // A game may set `outroMs` and keep drawing after the win (g.wonAt), e.g. the antenna's message counter.
  const api = { win() { if (!finished) { finished = true; g.wonAt = performance.now(); play('win'); setTimeout(() => { destroy(); onWin(); }, g.outroMs ?? 600); } }, elapsed: () => performance.now() - started };
  let pressed = false; // sounds for dragging play only while the pointer is down
  const handlers = {
    pointerdown: (e) => { pressed = true; canvas.setPointerCapture?.(e.pointerId); director.minigame(game, 'down'); g.down?.(pt(canvas, e), api); },
    pointermove: (e) => { if (pressed) director.minigame(game, 'move'); g.move?.(pt(canvas, e), api); },
    pointerup: (e) => { pressed = false; g.up?.(pt(canvas, e), api); },
  };
  for (const [k, f] of Object.entries(handlers)) canvas.addEventListener(k, f);
  function frame(now) {
    const left = Math.max(0, limit - (now - started) / 1000);
    ctx.fillStyle = '#0b1522'; ctx.fillRect(0, 0, W, H);
    g.draw(ctx, now, api);
    ring(ctx, left / limit);
    if (msg) label(ctx, msg, W / 2, H - 24, 34);
    if (!finished && g.done?.(now)) api.win();
    if (!finished && left <= 0) {
      failures++;
      onFail();
      if (failures >= 3) { msg = 'A drone helps you out!'; finished = true; setTimeout(() => { destroy(); onWin(); }, 900); } else { msg = 'Close! Try once more.'; reset(); setTimeout(() => { msg = ''; }, 1500); }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  function destroy() {
    cancelAnimationFrame(raf);
    for (const [k, f] of Object.entries(handlers)) canvas.removeEventListener(k, f);
  }
  void held;
  return { destroy };
}

// ------------------------------------------------------------------ 4.5 Heat Pump Pipe Reroute
// The puzzle itself (ten solvable layouts, the scramble, the heat flow) is in pipes.js and is tested under node.

/** A pointing hand with a tap ring: the "first move" of SCENARIO section 4 ("an animated hand showing the first move"). */
function tapHand(c, x, y, t) {
  const phase = (t / 800) % 1;
  c.strokeStyle = `rgba(255,214,0,${1 - phase})`; c.lineWidth = 6; c.beginPath(); c.arc(x, y, 18 + phase * 40, 0, Math.PI * 2); c.stroke();
  const press = Math.sin(t / 260) * 8;
  c.save(); c.translate(x + 16, y + 40 + press); c.rotate(-0.4);
  c.fillStyle = '#ffe0bd'; c.strokeStyle = '#7a4a2a'; c.lineWidth = 4;
  rr(c, -11, -52, 22, 56, 11); c.fill(); c.stroke(); // the finger
  rr(c, -26, -6, 52, 46, 14); c.fill(); c.stroke(); // the palm
  c.restore();
}

function heatPump() {
  const { tiles, hint } = scramble(LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)], Math.random);
  let first = true; // the hand shows until the first tap
  const X = 150, Y = 150, T = 150, RH = T * 0.95;
  const at = (r, c) => ({ x: X + c * T + T / 2, y: Y + r * RH + RH / 2 });
  return {
    down(p) {
      const col = Math.floor((p.x - X) / T), row = Math.floor((p.y - Y) / RH);
      if (tap(tiles, row, col)) { director.minigame('heat_pump', 'rotate'); first = false; }
    },
    draw(c, now) {
      const { seen, rooms } = reach(tiles);
      label(c, 'Tap a pipe to turn it. Connect the Heating Core to all 3 rooms', W / 2, 60, 27, '#ffb000');
      c.fillStyle = '#ff8a2a'; rr(c, 40, Y + RH + 20, 90, 90); c.fill(); label(c, 'CORE', 85, Y + RH + 76, 20, '#fff');
      ['Bedroom', 'Kitchen', 'Greenhouse'].forEach((n, i) => { c.fillStyle = rooms.has(i) ? '#43e060' : '#3a4a5a'; rr(c, X + COLS * T + 20, Y + i * RH + 20, 150, 90); c.fill(); label(c, n, X + COLS * T + 95, Y + i * RH + 74, 22); });
      for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
        const m = tiles[r][col];
        const x = X + col * T, y = Y + r * RH, cx = x + T / 2, cy = y + RH / 2;
        c.fillStyle = canTurn(m) ? '#16293c' : '#101d2b'; rr(c, x + 4, y + 4, T - 8, RH - 8, 14); c.fill();
        c.strokeStyle = seen.has(`${r},${col}`) ? `rgba(255,${140 + Math.sin(now / 150) * 30},40,1)` : '#7b8a99'; c.lineWidth = 18; c.lineCap = 'round';
        const arm = (dx, dy) => { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + dx * T / 2, cy + dy * RH / 2); c.stroke(); };
        if (m & N) arm(0, -1); if (m & E) arm(1, 0); if (m & S) arm(0, 1); if (m & WEST) arm(-1, 0);
        if (m && !canTurn(m)) { c.fillStyle = '#394b5d'; c.beginPath(); c.arc(cx, cy, 12, 0, Math.PI * 2); c.fill(); } // a fixed junction: it does not turn
      }
      const inlet = (tiles[1][0] & WEST) && seen.has('1,0');
      c.strokeStyle = inlet ? '#ff8a2a' : '#7b8a99'; c.lineWidth = 18; c.lineCap = 'round'; c.beginPath(); c.moveTo(130, Y + RH * 1.5); c.lineTo(X, Y + RH * 1.5); c.stroke();
      if (first) { const h = at(hint[0], hint[1]); tapHand(c, h.x, h.y, now); }
      this._rooms = rooms.size;
    },
    done() { return this._rooms === ROWS; },
  };
}

// ------------------------------------------------------------------ 4.3 Valve Balance
function valveBalance() {
  const v = { co2: 0.85, o2: 0.15 };
  const knobs = [{ id: 'A', x: 250 }, { id: 'B', x: 550 }, { id: 'C', x: 850 }];
  let drag = null, greenSince = null;
  const bandCo2 = [0.2, 0.4], bandO2 = [0.55, 0.75];
  const ang = (k, p) => Math.atan2(p.y - 480, p.x - k.x);
  return {
    down(p) { const k = knobs.find((q) => Math.hypot(p.x - q.x, p.y - 480) < 70); if (k) drag = { k, last: ang(k, p) }; },
    move(p) {
      if (!drag) return;
      let d = ang(drag.k, p) - drag.last;
      if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      drag.last = ang(drag.k, p);
      const amt = d * 0.12;
      if (drag.k.id === 'A') v.co2 -= amt; else if (drag.k.id === 'B') v.o2 += amt; else { v.co2 -= amt * 0.4; v.o2 += amt * 0.4; }
      v.co2 = Math.max(0, Math.min(1, v.co2)); v.o2 = Math.max(0, Math.min(1, v.o2));
    },
    up() { drag = null; },
    draw(c, now) {
      label(c, 'Hold both needles in the green for 2 seconds', W / 2, 60, 28, '#ffb000');
      const gauge = (cx, val, band, name, col) => {
        c.fillStyle = '#16293c'; rr(c, cx - 200, 110, 400, 220, 16); c.fill();
        c.fillStyle = 'rgba(67,224,96,.5)'; c.fillRect(cx - 170 + band[0] * 340, 140, (band[1] - band[0]) * 340, 40);
        c.fillStyle = col; c.fillRect(cx - 170, 250, 340 * val, 22); c.strokeStyle = '#fff'; c.strokeRect(cx - 170, 250, 340, 22);
        c.fillStyle = '#fff'; c.fillRect(cx - 172 + val * 340, 130, 6, 90);
        label(c, name, cx, 310, 24);
      };
      gauge(350, v.co2, bandCo2, 'CO₂', '#9aa');
      gauge(750, v.o2, bandO2, 'O₂', '#4db8ff');
      knobs.forEach((k) => { c.fillStyle = '#394b5d'; c.beginPath(); c.arc(k.x, 480, 62, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#ffb000'; c.lineWidth = 6; c.stroke(); label(c, k.id, k.x, 490, 36); });
      this._ok = v.co2 >= bandCo2[0] && v.co2 <= bandCo2[1] && v.o2 >= bandO2[0] && v.o2 <= bandO2[1];
      if (this._ok) { greenSince ??= now; c.fillStyle = '#43e060'; c.fillRect(100, 380, Math.min(900, ((now - greenSince) / 2000) * 900), 14); } else greenSince = null;
      this._since = greenSince;
      this._now = now;
    },
    done() { return this._since !== null && this._now - this._since >= 2000; },
  };
}

// ------------------------------------------------------------------ 4.4 Water Sort
function waterSort() {
  const tray = [{ id: 'Filter', col: '#9bb', x: 200 }, { id: 'Boiler', col: '#ff8a2a', x: 500 }, { id: 'Purifier', col: '#b36bff', x: 800 }].sort(() => Math.random() - 0.5);
  const order = ['Filter', 'Boiler', 'Purifier'];
  const slots = [null, null, null];
  let drag = null, flowing = null, wobble = null;
  const pos = tray.map((m) => ({ ...m, y: 500 }));
  const slotRect = (i) => ({ x: 250 + i * 250, y: 250, w: 200, h: 110 });
  return {
    down(p) {
      if (inR(p, 480, 130, 140, 60)) { // the tap
        director.minigame('water_sort', 'tap');
        const ok = slots.every((s, i) => s === order[i]);
        if (ok) flowing = performance.now(); else { const bad = slots.findIndex((s, i) => s !== order[i]); wobble = { i: bad, at: performance.now() }; slots.fill(null); pos.forEach((m, i) => { m.x = [200, 500, 800][i]; m.y = 500; }); }
        return;
      }
      const m = [...pos].reverse().find((q) => !slots.includes(q.id) && Math.abs(p.x - q.x) < 90 && Math.abs(p.y - q.y) < 50);
      if (m) drag = m;
    },
    move(p) { if (drag) { drag.x = p.x; drag.y = p.y; } },
    up(p) {
      if (!drag) return;
      const i = [0, 1, 2].find((k) => inR(p, slotRect(k).x, slotRect(k).y, slotRect(k).w, slotRect(k).h) && slots[k] === null);
      if (i !== undefined) { slots[i] = drag.id; drag.x = slotRect(i).x + 100; drag.y = slotRect(i).y + 55; director.minigame('water_sort', 'place'); } else { const k = pos.indexOf(drag); drag.x = [200, 500, 800][k]; drag.y = 500; }
      drag = null;
    },
    draw(c, now) {
      label(c, 'Filter → Boiler → Purifier, then tap the tap!', W / 2, 60, 28, '#ffb000');
      c.fillStyle = flowing ? '#4db8ff' : '#6b4a2a'; c.beginPath(); c.arc(550, 150, 30, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffb000'; rr(c, 480, 130, 140, 60); c.fill(); label(c, 'TAP', 550, 170, 28, '#000');
      for (let i = 0; i < 3; i++) { const r = slotRect(i); c.strokeStyle = wobble?.i === i && now - wobble.at < 600 ? '#ff5252' : '#4db8ff'; c.setLineDash([10, 8]); c.lineWidth = 4; c.strokeRect(r.x + (wobble?.i === i && now - wobble.at < 600 ? Math.sin(now / 30) * 6 : 0), r.y, r.w, r.h); c.setLineDash([]); }
      pos.forEach((m) => { c.fillStyle = m.col; rr(c, m.x - 85, m.y - 45, 170, 90, 12); c.fill(); label(c, m.id, m.x, m.y + 8, 26, '#000'); });
      this._done = flowing && now - flowing > 800;
    },
    done() { return Boolean(this._done); },
  };
}

// ------------------------------------------------------------------ 4.6 Hydroponic LED & Nutrient Match
function nutrientMatch() {
  const cols = ['#43e060', '#ffd600', '#b36bff'];
  const trays = [0, 1, 2].map((i) => ({ x: 220 + i * 330, tag: cols[[1, 2, 0][i]], filled: false, bad: 0 }));
  const bottles = cols.map((c, i) => ({ c, x: 200 + i * 330, y: 140, hx: 200 + i * 330, hy: 140 }));
  let drag = null, led = false;
  return {
    down(p) {
      if (inR(p, 500, 520, 100, 90)) { led = trays.every((t) => t.filled); director.minigame('nutrient_match', 'led'); return; }
      drag = bottles.find((b) => Math.hypot(p.x - b.x, p.y - b.y) < 50 && !b.used) ?? null;
    },
    move(p) { if (drag) { drag.x = p.x; drag.y = p.y; } },
    up(p) {
      if (!drag) return;
      const t = trays.find((q) => Math.abs(p.x - q.x) < 130 && p.y > 230);
      if (t && !t.filled && t.tag === drag.c) { t.filled = true; drag.used = true; director.minigame('nutrient_match', 'drop'); } else if (t) t.bad = performance.now();
      drag.x = drag.hx; drag.y = drag.hy; drag = null;
    },
    draw(c, now) {
      label(c, 'Match each bottle to the colour tag, then switch on the LEDs', W / 2, 60, 26, '#ffb000');
      trays.forEach((t) => {
        c.fillStyle = t.filled ? '#2e6b3a' : '#2a3a4a'; rr(c, t.x - 120, 300, 240, 200); c.fill();
        c.fillStyle = t.tag; rr(c, t.x - 30, 470, 60, 24, 8); c.fill();
        const wilt = !t.filled || !led; const yellow = now - t.bad < 700;
        c.fillStyle = yellow ? '#e5d34a' : wilt ? '#7a8a3a' : '#43e060'; c.fillRect(t.x - 8, wilt ? 380 : 340, 16, wilt ? 90 : 130); c.beginPath(); c.arc(t.x, wilt ? 380 : 340, wilt ? 30 : 46, 0, Math.PI * 2); c.fill();
      });
      bottles.forEach((b) => { if (b.used) return; c.fillStyle = b.c; rr(c, b.x - 28, b.y - 50, 56, 100, 10); c.fill(); c.fillStyle = '#fff'; c.fillRect(b.x - 12, b.y - 62, 24, 14); });
      c.fillStyle = led ? '#ff4de1' : '#555'; rr(c, 500, 520, 100, 90, 14); c.fill(); label(c, 'LED', 550, 575, 26, '#000'); // below the trays, not on top of one
      this._ok = led && trays.every((t) => t.filled);
    },
    done() { return Boolean(this._ok); },
  };
}

// ------------------------------------------------------------------ 4.2 Air Dust Filter Scrub
function airFilter() {
  const cells = Array.from({ length: 16 }, () => ({ dust: 3, last: -1 }));
  let step = 0; // 0 pull the filter out, 1 scrub, 2 lock
  let rub = null;
  const X = 340, Y = 130, C = 100;
  return {
    down(p) {
      if (step === 0 && inR(p, X - 100, Y, 80, 200)) { step = 1; director.minigame('air_filter', 'pull'); return; }
      if (step === 1) rub = { last: p, dir: 0 };
      if (step === 2 && inR(p, 820, 300, 120, 100)) { this._ok = true; director.minigame('air_filter', 'lock'); }
    },
    move(p) {
      if (step !== 1 || !rub) return;
      const col = Math.floor((p.x - X) / C), row = Math.floor((p.y - Y) / C);
      if (col < 0 || col > 3 || row < 0 || row > 3) return;
      const cell = cells[row * 4 + col];
      const dir = Math.sign(p.x - rub.last.x) || rub.dir;
      if (dir !== 0 && dir !== cell.last && Math.abs(p.x - rub.last.x) > 6) { cell.dust = Math.max(0, cell.dust - 1); cell.last = dir; }
      rub.last = p; rub.dir = dir;
      if (cells.every((q) => q.dust === 0)) step = 2;
    },
    up() { rub = null; },
    draw(c) {
      label(c, step === 0 ? 'Pull the filter out of the wall' : step === 1 ? 'Rub each cell 3 times' : 'Push it back and tap the lock lever', W / 2, 60, 28, '#ffb000');
      c.fillStyle = '#394b5d'; rr(c, X - 110, Y - 20, 640, 440, 16); c.fill();
      if (step === 0) { c.fillStyle = '#ffb000'; rr(c, X - 100, Y, 80, 200); c.fill(); label(c, 'PULL', X - 60, Y + 110, 22, '#000'); }
      cells.forEach((q, i) => { const x = X + (i % 4) * C, y = Y + Math.floor(i / 4) * C; c.fillStyle = '#9fb5c8'; c.fillRect(x + 4, y + 4, C - 8, C - 8); c.fillStyle = `rgba(180,70,30,${q.dust / 3 * 0.85})`; c.fillRect(x + 4, y + 4, C - 8, C - 8); });
      if (step === 2) { c.fillStyle = '#43e060'; rr(c, 820, 300, 120, 100); c.fill(); label(c, 'LOCK', 880, 360, 26, '#000'); }
    },
    done() { return Boolean(this._ok); },
  };
}

// ------------------------------------------------------------------ 4.9 Earth Dish Antenna Alignment
// On a win a message icon flies to Earth with "Arriving in {delay}...": {delay} starts at the real
// one-way light time for the current Sol (lightTime.js) and counts down sped up (gameplay).
const ANTENNA_OUTRO_MS = 2600;
function antenna({ delaySeconds = 840 } = {}) {
  const sl = { lr: 0.15, ud: 0.85 };
  let drag = null, good = null;
  const earth = (now) => ({ x: 0.5 + 0.28 * Math.sin(now / 5200), y: 0.35 + 0.18 * Math.cos(now / 6800) });
  return {
    down(p) { if (inR(p, 120, 520, 400, 50)) drag = 'lr'; else if (inR(p, 600, 520, 400, 50)) drag = 'ud'; },
    move(p) { if (drag === 'lr') sl.lr = Math.max(0, Math.min(1, (p.x - 120) / 400)); if (drag === 'ud') sl.ud = Math.max(0, Math.min(1, (p.x - 600) / 400)); },
    up() { drag = null; },
    draw(c, now) {
      c.fillStyle = '#020611'; c.fillRect(0, 100, W, 380);
      for (let i = 0; i < 60; i++) { c.fillStyle = '#9ab'; c.fillRect((i * 137) % W, 110 + ((i * 59) % 360), 2, 2); }
      const e = earth(now), ex = 60 + e.x * 980, ey = 120 + e.y * 340;
      c.fillStyle = '#3d8bff'; c.beginPath(); c.arc(ex, ey, 14, 0, Math.PI * 2); c.fill();
      const bx = 60 + sl.lr * 980, by = 120 + (1 - sl.ud) * 340;
      c.strokeStyle = 'rgba(255,214,0,.8)'; c.lineWidth = 3; c.beginPath(); c.arc(bx, by, 60, 0, Math.PI * 2); c.stroke();
      const d = Math.hypot(ex - bx, ey - by);
      const bars = d < 40 ? 5 : d < 80 ? 4 : d < 150 ? 3 : d < 260 ? 2 : d < 400 ? 1 : 0;
      for (let i = 0; i < 5; i++) { c.fillStyle = i < bars ? (bars >= 4 ? '#43e060' : '#ffd600') : '#333'; c.fillRect(40 + i * 40, 60 - i * 8, 28, 20 + i * 8); }
      label(c, 'Keep 4+ bars for 3 seconds', W / 2, 60, 26, '#ffb000');
      [['Left / Right', 120, sl.lr], ['Up / Down', 600, sl.ud]].forEach(([n, x, v]) => { c.fillStyle = '#394b5d'; rr(c, x, 530, 400, 30, 15); c.fill(); c.fillStyle = '#ffb000'; c.beginPath(); c.arc(x + 400 * v, 545, 26, 0, Math.PI * 2); c.fill(); label(c, n, x + 200, 600, 20); });
      if (bars >= 4) { if (good === null) director.minigame('antenna', 'lock'); good ??= now; c.fillStyle = '#43e060'; c.fillRect(300, 490, Math.min(500, ((now - good) / 3000) * 500), 10); } else good = null;
      this._since = good; this._now = now;
      if (this.wonAt != null) {
        const f = Math.min(1, (now - this.wonAt) / (ANTENNA_OUTRO_MS - 400));
        const ix = bx + (ex - bx) * f, iy = by + (ey - by) * f - Math.sin(f * Math.PI) * 60;
        c.fillStyle = '#fff'; rr(c, ix - 16, iy - 11, 32, 22, 4); c.fill();
        c.strokeStyle = '#3d8bff'; c.lineWidth = 2; c.beginPath(); c.moveTo(ix - 16, iy - 11); c.lineTo(ix, iy + 2); c.lineTo(ix + 16, iy - 11); c.stroke();
        c.fillStyle = 'rgba(0,0,0,.6)'; rr(c, W / 2 - 260, 400, 520, 56); c.fill();
        label(c, t('ui.mg.dish_antenna_alignment.counter', { delay: formatDelay(delaySeconds * (1 - f)) }), W / 2, 438, 28);
      }
    },
    outroMs: ANTENNA_OUTRO_MS,
    done() { return this._since !== null && this._now - this._since >= 3000; },
  };
}

// ------------------------------------------------------------------ 4.7 Rover Wheel Pebble Vacuum
function wheelVacuum() {
  // side view: six wheels in one row under the Rover's body, standing on the ground (they used to float in two rows)
  const wheels = Array.from({ length: 6 }, (_, i) => ({ x: 140 + i * 164, y: 330, dust: 1 }));
  const pebbles = [{ w: 1, ox: 30, oy: -20, out: false }, { w: 4, ox: -30, oy: 10, out: false }];
  let nozzle = null;
  let pressed = false;
  return {
    down(p) { nozzle = p; pressed = true; this._tap(p); },
    move(p) { nozzle = p; if (!pressed) return; wheels.forEach((w) => { if (Math.hypot(p.x - w.x, p.y - w.y) < 75) w.dust = Math.max(0, w.dust - 0.03); }); }, // the vacuum works only while the finger or the mouse button is down
    up() { nozzle = null; pressed = false; },
    _tap(p) { pebbles.forEach((q) => { const w = wheels[q.w]; if (!q.out && Math.hypot(p.x - (w.x + q.ox), p.y - (w.y + q.oy)) < 30) { q.out = true; director.minigame('wheel_vacuum', 'pebble'); } }); },
    draw(c, now) {
      label(c, 'Vacuum every wheel, then pop the 2 sparkling pebbles', W / 2, 60, 26, '#ffb000');
      c.fillStyle = '#c9b9a0'; rr(c, 60, 150, 980, 150, 20); c.fill();
      c.fillStyle = '#7a5a40'; c.fillRect(30, 400, 1040, 8); // the ground the wheels stand on
      wheels.forEach((w) => { c.fillStyle = '#222'; c.beginPath(); c.arc(w.x, w.y, 70, 0, Math.PI * 2); c.fill(); c.fillStyle = `rgb(${90 + w.dust * 110},${80 + w.dust * 20},${70})`; c.beginPath(); c.arc(w.x, w.y, 56, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ddd'; c.beginPath(); c.arc(w.x, w.y, 16, 0, Math.PI * 2); c.fill(); });
      pebbles.forEach((q) => { if (q.out) return; const w = wheels[q.w]; c.fillStyle = Math.floor(now / 200) % 2 ? '#fff' : '#ffd600'; c.beginPath(); c.arc(w.x + q.ox, w.y + q.oy, 12, 0, Math.PI * 2); c.fill(); });
      if (nozzle) { c.fillStyle = '#4db8ff'; c.beginPath(); c.arc(nozzle.x, nozzle.y, 26, 0, Math.PI * 2); c.fill(); }
      this._ok = wheels.every((w) => w.dust < 0.12) && pebbles.every((q) => q.out);
    },
    done() { return Boolean(this._ok); },
  };
}

// ------------------------------------------------------------------ 4.8 Spacesuit Radiation & Pressure Seal Check
// The rules (random seals, the badge, the liner, the pressure gauge) are in suit-seal.js and are tested under node (docs/ERRORS.md A37).
// The suit is drawn from code: a development stand-in for a front-view suit picture, not final art.
const RINGS = { helmet: [550, 222, 58, 14], gloveL: [449, 372, 32, 9], gloveR: [651, 372, 32, 9], bootL: [513, 536, 36, 9], bootR: [587, 536, 36, 9] };
const pulse = (now, ms = 320) => 0.5 + 0.5 * Math.sin(now / ms);

function drawSuit(c) {
  const fill = '#ece6da', line = '#6e6759', dark = '#9c8f7c';
  const part = (x, y, w, h, r, color = fill) => { c.fillStyle = color; rr(c, x, y, w, h, r); c.fill(); c.strokeStyle = line; c.lineWidth = 3; c.stroke(); };
  part(488, 392, 58, 150, 22); part(554, 392, 58, 150, 22); // legs
  part(476, 534, 74, 50, 16, dark); part(550, 534, 74, 50, 16, dark); // boots
  part(424, 236, 52, 140, 26); part(624, 236, 52, 140, 26); // arms
  for (const x of [449, 651]) { c.fillStyle = dark; c.beginPath(); c.arc(x, 398, 30, 0, Math.PI * 2); c.fill(); c.stroke(); } // gloves
  part(478, 226, 144, 176, 38); // body
  c.fillStyle = '#2b3a4a'; rr(c, 584, 258, 44, 34, 6); c.fill(); // the control box on the chest
  c.fillStyle = '#43e060'; c.fillRect(592, 266, 10, 6); c.fillStyle = '#ffb000'; c.fillRect(608, 266, 10, 6); c.fillStyle = '#00E5FF'; c.fillRect(592, 278, 26, 6);
  c.fillStyle = '#b9b3a6'; rr(c, 544, 300, 12, 92, 6); c.fill(); c.strokeStyle = line; c.stroke(); // the zipper
  c.fillStyle = dark; rr(c, 541, 296, 18, 14, 4); c.fill(); // its pull tab
  c.fillStyle = fill; c.beginPath(); c.arc(550, 150, 64, 0, Math.PI * 2); c.fill(); c.strokeStyle = line; c.lineWidth = 3; c.stroke(); // helmet
  c.fillStyle = '#7a5410'; c.beginPath(); c.ellipse(556, 152, 46, 36, 0, 0, Math.PI * 2); c.fill(); c.stroke(); // visor
  c.fillStyle = 'rgba(255,225,140,.75)'; c.beginPath(); c.ellipse(538, 138, 14, 8, -0.5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#a49c8c'; c.lineWidth = 7; // the seals: rings round the neck, wrists and ankles
  for (const [x, y, rx, ry] of Object.values(RINGS)) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.stroke(); }
}

function drawBadge(c, x, y, { on = false, lift = false, glow = 0 } = {}) {
  c.save();
  c.translate(x, y); if (lift) c.scale(1.12, 1.12);
  if (glow) { c.shadowColor = '#ffd600'; c.shadowBlur = 10 + 22 * glow; }
  c.fillStyle = on ? '#ffb000' : '#ff8a2a'; rr(c, -34, -24, 68, 48, 8); c.fill();
  c.shadowBlur = 0; c.strokeStyle = '#5a2d00'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#5a2d00'; rr(c, -10, -32, 20, 12, 3); c.fill(); // the clip
  c.fillStyle = '#000'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText('☢', 0, 11);
  c.restore();
}

function drawLiner(c, x, y, { on = false, lift = false, glow = 0 } = {}) {
  c.save();
  c.translate(x, y); if (lift) c.scale(1.12, 1.12);
  if (glow) { c.shadowColor = '#00E5FF'; c.shadowBlur = 10 + 22 * glow; }
  const w = on ? 56 : 92, h = on ? 40 : 62;
  c.fillStyle = '#2c6f9a'; rr(c, -w / 2, -h / 2, w, h, 8); c.fill();
  c.shadowBlur = 0; c.strokeStyle = '#00E5FF'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-w / 2 + 8, i * h / 4); c.lineTo(w / 2 - 8, i * h / 4); c.stroke(); }
  if (!on) label(c, 'LINER', 0, h / 2 + 22, 18, '#9fd8ff');
  c.restore();
}

function suitSeal(opts = {}) {
  const g = createSuit({ liner: Boolean(opts.liner) });
  let first = true; // the hand shows over the first leak until a leak is sealed
  let said = null; // what the gauge or the suit told the player: { text, color, until }
  let shown = null; // the needle after a release, shown for a moment: { pressure, until }
  let dragging = null; // 'badge' | 'liner' while one is held
  const say = (text, color = '#fff', ms = 1700) => { said = { text, color, until: performance.now() + ms }; };
  return {
    down(p) {
      const what = pointerDown(g, p, performance.now());
      if (what === 'clamp') { director.minigame('suit_seal', 'clamp'); first = false; }
      else if (what === 'grab') { dragging = g.badge.drag ? 'badge' : 'liner'; said = null; }
      else if (what === 'locked') say('Seal every leak first!', '#ffd600');
      else if (what === 'press') shown = null;
    },
    move(p) { pointerMove(g, p); },
    up(p) {
      const r = pointerUp(g, p, performance.now());
      dragging = null;
      if (r.kind === 'badge') director.minigame('suit_seal', 'badge');
      else if (r.kind === 'liner') director.minigame('suit_seal', 'liner');
      else if (r.kind === 'back') say('Drop it on the suit!', '#ffd600');
      else if (r.kind === 'release') {
        shown = { pressure: r.pressure, until: performance.now() + 900 };
        if (r.verdict === 'good') say('Pressure is perfect!', '#9affb0');
        else say(r.verdict === 'low' ? 'A little more pressure!' : 'A little less pressure!', '#ffd600');
      }
    },
    draw(c, now) {
      const t = performance.now();
      const next = nextStep(g);
      const ready = g.leaks.every((l) => l.sealed);
      label(c, 'Seal the leaks, badge on, then hold PRESSURIZE and release in the green', W / 2, 52, 24, '#ffb000');
      drawSuit(c);
      // the hook the badge hangs on, and the places things go
      c.strokeStyle = '#b9b3a6'; c.lineWidth = 6; c.beginPath(); c.moveTo(STAGE.badge.x, 130); c.lineTo(STAGE.badge.x, 168); c.arc(STAGE.badge.x + 14, 168, 14, Math.PI, Math.PI * 0.2, true); c.stroke();
      const beat = dragging ? pulse(now, 180) : 0;
      if (dragging) { // the whole suit is the target
        c.setLineDash([12, 9]); c.lineWidth = 4; c.strokeStyle = `rgba(0,229,255,${0.5 + 0.4 * beat})`; rr(c, STAGE.suit.x0, STAGE.suit.y0, STAGE.suit.x1 - STAGE.suit.x0, STAGE.suit.y1 - STAGE.suit.y0, 28); c.stroke(); c.setLineDash([]);
        label(c, dragging === 'badge' ? 'Drop the badge on the suit' : "Drop the liner on the suit's back", 550, H - 38, 22, '#00E5FF');
      } else if (next?.kind === 'badge') { // an empty badge pocket on the chest
        c.setLineDash([8, 7]); c.lineWidth = 3; c.strokeStyle = `rgba(0,229,255,${0.45 + 0.4 * pulse(now)})`; rr(c, STAGE.chest.x - 34, STAGE.chest.y - 24, 68, 48, 8); c.stroke(); c.setLineDash([]);
      }
      // leaks: puffs of air at the open seals, a clamp on the sealed ones
      g.leaks.forEach((l) => {
        if (l.sealed) {
          const r = RINGS[l.id];
          if (r) { c.strokeStyle = '#43e060'; c.lineWidth = 6; c.beginPath(); c.ellipse(r[0], r[1], r[2], r[3], 0, 0, Math.PI * 2); c.stroke(); }
          c.fillStyle = '#3a4756'; rr(c, l.x - 17, l.y - 10, 34, 20, 6); c.fill(); c.strokeStyle = '#43e060'; c.lineWidth = 3; c.stroke();
          c.fillStyle = '#43e060'; c.beginPath(); c.arc(l.x, l.y, 4, 0, Math.PI * 2); c.fill();
          return;
        }
        const glow = pulse(now, 150);
        c.strokeStyle = `rgba(255,138,42,${0.6 + 0.4 * glow})`; c.lineWidth = 5; c.beginPath(); c.arc(l.x, l.y, 30 + 5 * glow, 0, Math.PI * 2); c.stroke();
        for (let i = 0; i < 4; i++) {
          const ph = ((now / 650) + i * 0.25) % 1;
          const px = l.x + Math.sin(i * 2.3 + now / 280) * 14, py = l.y - 6 - ph * 52;
          c.fillStyle = `rgba(210,245,255,${0.9 * (1 - ph)})`; c.strokeStyle = `rgba(11,21,34,${0.7 * (1 - ph)})`; c.lineWidth = 2;
          c.beginPath(); c.arc(px, py, 6 + ph * 11, 0, Math.PI * 2); c.fill(); c.stroke();
        }
      });
      if (first && next?.kind === 'leak') tapHand(c, next.x, next.y, now);
      // what the player carries, and the things already on
      if (g.liner) drawLiner(c, g.liner.x, g.liner.y, { on: g.liner.on, lift: g.liner.drag, glow: next?.kind === 'liner' ? pulse(now) : g.liner.drag ? 1 : 0 });
      drawBadge(c, g.badge.x, g.badge.y, { on: g.badge.on, lift: g.badge.drag, glow: next?.kind === 'badge' ? pulse(now) : g.badge.drag ? 1 : 0 });
      // the checklist
      const list = steps(g);
      const current = list.find((x) => !x.done);
      list.forEach((s, i) => {
        const y = 128 + i * 44;
        c.fillStyle = s.done ? '#1d5b32' : '#16293c'; rr(c, 60, y - 22, 28, 28, 6); c.fill(); c.strokeStyle = s.done ? '#43e060' : s === current ? '#ffb000' : '#3b5670'; c.lineWidth = 3; c.stroke();
        if (s.done) label(c, '✔', 74, y, 22, '#9affb0');
        label(c, s.text, 102, y, 20, s.done ? '#9affb0' : s === current ? '#ffd600' : '#dfe9f3', 'left');
      });
      // the gauge: the needle moves only while PRESSURIZE is held
      const B = STAGE.button, G = STAGE.gauge;
      const holding = g.hold != null;
      const level = holding ? pressureAt(g, t) : shown && shown.until > t ? shown.pressure : 0;
      c.save(); c.globalAlpha = ready ? 1 : 0.4;
      label(c, 'PRESSURE', G.x, G.y - 10, 18, '#9fd8ff', 'left');
      c.fillStyle = '#16293c'; rr(c, G.x, G.y, G.w, G.h, 10); c.fill();
      c.fillStyle = 'rgba(67,224,96,.65)'; c.fillRect(G.x + G.w * PRESSURE.from, G.y, G.w * (PRESSURE.to - PRESSURE.from), G.h);
      c.strokeStyle = '#3b5670'; c.lineWidth = 2; rr(c, G.x, G.y, G.w, G.h, 10); c.stroke();
      c.fillStyle = '#fff'; c.fillRect(G.x + G.w * level - 3, G.y - 8, 6, G.h + 16);
      c.restore();
      const glowBtn = next?.kind === 'pressure' && !holding ? pulse(now) : 0;
      if (glowBtn) { c.shadowColor = '#00E5FF'; c.shadowBlur = 8 + 20 * glowBtn; }
      c.fillStyle = holding ? '#ff8a2a' : ready ? '#12304a' : '#0e1a28'; rr(c, B.x, B.y, B.w, B.h, 14); c.fill();
      c.shadowBlur = 0; c.strokeStyle = ready ? '#00E5FF' : '#3b5670'; c.lineWidth = 3; c.stroke();
      label(c, 'PRESSURIZE', B.x + B.w / 2, B.y + 52, 26, ready ? '#fff' : '#7f93a8');
      label(c, ready ? 'Hold it down, let go in the green' : 'Seal the leaks first', B.x + B.w / 2, B.y + B.h + 28, 17, ready ? '#9fd8ff' : '#ffd600');
      if (said && said.until > t) { c.fillStyle = 'rgba(0,0,0,.55)'; rr(c, W / 2 - 230, H - 86, 460, 44, 12); c.fill(); label(c, said.text, W / 2, H - 55, 26, said.color); }
      if (this.wonAt != null) { c.fillStyle = 'rgba(0,0,0,.6)'; rr(c, W / 2 - 250, 250, 500, 80, 16); c.fill(); label(c, 'Suit ready for Mars!', W / 2, 303, 36, '#9affb0'); }
      this._ok = complete(g);
    },
    outroMs: 1100,
    done() { return Boolean(this._ok); },
  };
}

const GAMES = {
  heat_pump: heatPump, valve_balance: valveBalance, water_sort: waterSort, nutrient_match: nutrientMatch,
  air_filter: airFilter, antenna, wheel_vacuum: wheelVacuum, suit_seal: suitSeal,
};

/** Start one of the mini-games above. */
export function startMini2(game, { canvas, title, hint, onWin, onFail, onTitle, onHint, ...opts }) {
  return scaffold({ canvas, game, onWin, onFail, onTitle, onHint, title, hint, make: GAMES[game], opts });
}
export const hasMini2 = (game) => Object.hasOwn(GAMES, game);
