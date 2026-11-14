/**
 * The other mini-games of SCENARIO Section 4, on one shared scaffold: an overlay canvas, a timer
 * ring, an instant free retry, and no big FAIL screen. After 3 failures in a row a drone helps.
 *   heat_pump (4.5)   valve_balance (4.3)   water_sort (4.4)   nutrient_match (4.6)
 *   air_filter (4.2)  antenna (4.9)         wheel_vacuum (4.7) suit_seal (4.8)
 * Solar Wipe (4.1) and the tutorial battery step are in minigames.js.
 */
import { play } from './audio.js';

const W = 1100;
const H = 620;
const TIME = { heat_pump: 20, valve_balance: 15, water_sort: 15, nutrient_match: 15, air_filter: 20, antenna: 20, wheel_vacuum: 20, suit_seal: 15 };
const SOLO_BONUS = 3; // the Commander gets +3 s on every timer (SCENARIO 4)

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
function scaffold({ canvas, game, onWin, onFail, onTitle, onHint, title, hint, make }) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  onTitle(title);
  onHint(hint);
  const limit = TIME[game] + SOLO_BONUS;
  let g, started, failures = 0, finished = false, msg = '', raf = 0, held = 0;
  const reset = () => { g = make(); started = performance.now(); held = 0; };
  reset();
  const api = { win() { if (!finished) { finished = true; play('win'); setTimeout(() => { destroy(); onWin(); }, 600); } }, elapsed: () => performance.now() - started };
  const handlers = {
    pointerdown: (e) => { canvas.setPointerCapture?.(e.pointerId); g.down?.(pt(canvas, e), api); },
    pointermove: (e) => g.move?.(pt(canvas, e), api),
    pointerup: (e) => g.up?.(pt(canvas, e), api),
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
const N = 1, E = 2, S = 4, Wd = 8;
const rot = (m) => ((m << 1) | (m >> 3)) & 15; // rotate 90 degrees clockwise
// The solved layout: the core feeds tile (row 1, col 0); a cross in column 1 splits the heat to rows 0 and 2.
const SOLVED = [
  [0, S | E, Wd | E, Wd | E],
  [Wd | E, N | E | S | Wd, Wd | E, Wd | E],
  [0, N | E, Wd | E, Wd | E],
];

function heatPump() {
  const tiles = SOLVED.map((row) => row.map((m) => { let k = Math.floor(Math.random() * 4); let x = m; while (k--) x = rot(x); return x; }));
  const X = 150, Y = 150, T = 150;
  const reach = () => {
    const seen = new Set(); const rooms = new Set();
    const q = [[0, 1, Wd]]; // enter tile (row 1, col 0) from the left
    while (q.length) {
      const [r, c, from] = q.pop();
      const key = `${r},${c}`;
      if (r < 0 || r > 2 || c < 0 || c > 3 || seen.has(key) || !(tiles[r][c] & from)) continue;
      seen.add(key);
      const m = tiles[r][c];
      if (m & N) q.push([r - 1, c, S]);
      if (m & S) q.push([r + 1, c, N]);
      if (m & E) { if (c === 3) rooms.add(r); else q.push([r, c + 1, Wd]); }
      if (m & Wd && c > 0) q.push([r, c - 1, E]);
    }
    return { seen, rooms };
  };
  return {
    down(p) {
      const col = Math.floor((p.x - X) / T), row = Math.floor((p.y - Y) / (T * 0.95));
      if (col >= 0 && col < 4 && row >= 0 && row < 3 && tiles[row][col]) { tiles[row][col] = rot(tiles[row][col]); play('click'); }
    },
    draw(c, now) {
      const { seen, rooms } = reach();
      label(c, 'Connect the Heating Core to all 3 rooms', W / 2, 60, 28, '#ffb000');
      c.fillStyle = '#ff8a2a'; rr(c, 40, Y + T * 0.95 + 20, 90, 90); c.fill(); label(c, 'CORE', 85, Y + T * 0.95 + 76, 20, '#fff');
      ['Bedroom', 'Kitchen', 'Greenhouse'].forEach((n, i) => { c.fillStyle = rooms.has(i) ? '#43e060' : '#3a4a5a'; rr(c, X + 4 * T + 20, Y + i * T * 0.95 + 20, 150, 90); c.fill(); label(c, n, X + 4 * T + 95, Y + i * T * 0.95 + 74, 22); });
      for (let r = 0; r < 3; r++) for (let col = 0; col < 4; col++) {
        const m = tiles[r][col];
        const x = X + col * T, y = Y + r * T * 0.95, cx = x + T / 2, cy = y + T * 0.95 / 2;
        c.fillStyle = '#16293c'; rr(c, x + 4, y + 4, T - 8, T * 0.95 - 8, 14); c.fill();
        c.strokeStyle = seen.has(`${r},${col}`) ? `rgba(255,${140 + Math.sin(now / 150) * 30},40,1)` : '#7b8a99'; c.lineWidth = 18; c.lineCap = 'round';
        const arm = (dx, dy) => { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + dx * T / 2, cy + dy * T * 0.95 / 2); c.stroke(); };
        if (m & N) arm(0, -1); if (m & E) arm(1, 0); if (m & S) arm(0, 1); if (m & Wd) arm(-1, 0);
      }
      c.strokeStyle = '#ff8a2a'; c.lineWidth = 18; c.beginPath(); c.moveTo(130, Y + T * 0.95 * 1.5); c.lineTo(X, Y + T * 0.95 * 1.5); c.stroke();
      this._rooms = rooms.size;
    },
    done() { return this._rooms === 3; },
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
      if (i !== undefined) { slots[i] = drag.id; drag.x = slotRect(i).x + 100; drag.y = slotRect(i).y + 55; play('click'); } else { const k = pos.indexOf(drag); drag.x = [200, 500, 800][k]; drag.y = 500; }
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
      if (inR(p, 960, 480, 100, 90)) { led = trays.every((t) => t.filled); play('click'); return; }
      drag = bottles.find((b) => Math.hypot(p.x - b.x, p.y - b.y) < 50 && !b.used) ?? null;
    },
    move(p) { if (drag) { drag.x = p.x; drag.y = p.y; } },
    up(p) {
      if (!drag) return;
      const t = trays.find((q) => Math.abs(p.x - q.x) < 130 && p.y > 230);
      if (t && !t.filled && t.tag === drag.c) { t.filled = true; drag.used = true; play('click'); } else if (t) t.bad = performance.now();
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
      c.fillStyle = led ? '#ff4de1' : '#555'; rr(c, 960, 480, 100, 90, 14); c.fill(); label(c, 'LED', 1010, 535, 26, '#000');
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
      if (step === 0 && inR(p, X - 100, Y, 80, 200)) { step = 1; play('click'); return; }
      if (step === 1) rub = { last: p, dir: 0 };
      if (step === 2 && inR(p, 820, 300, 120, 100)) this._ok = true;
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
function antenna() {
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
      if (bars >= 4) { good ??= now; c.fillStyle = '#43e060'; c.fillRect(300, 490, Math.min(500, ((now - good) / 3000) * 500), 10); } else good = null;
      this._since = good; this._now = now;
    },
    done() { return this._since !== null && this._now - this._since >= 3000; },
  };
}

// ------------------------------------------------------------------ 4.7 Rover Wheel Pebble Vacuum
function wheelVacuum() {
  const wheels = Array.from({ length: 6 }, (_, i) => ({ x: 170 + (i % 3) * 330, y: 220 + Math.floor(i / 3) * 210, dust: 1 }));
  const pebbles = [{ w: 1, ox: 30, oy: -20, out: false }, { w: 4, ox: -30, oy: 10, out: false }];
  let nozzle = null;
  return {
    down(p) { nozzle = p; this._tap(p); },
    move(p) { nozzle = p; wheels.forEach((w) => { if (Math.hypot(p.x - w.x, p.y - w.y) < 75) w.dust = Math.max(0, w.dust - 0.03); }); },
    up() { nozzle = null; },
    _tap(p) { pebbles.forEach((q) => { const w = wheels[q.w]; if (!q.out && Math.hypot(p.x - (w.x + q.ox), p.y - (w.y + q.oy)) < 30) { q.out = true; play('zap'); } }); },
    draw(c, now) {
      label(c, 'Vacuum every wheel, then pop the 2 sparkling pebbles', W / 2, 60, 26, '#ffb000');
      c.fillStyle = '#c9b9a0'; rr(c, 60, 140, 980, 140, 20); c.fill(); c.fillRect(60, 300, 980, 6);
      wheels.forEach((w) => { c.fillStyle = '#222'; c.beginPath(); c.arc(w.x, w.y, 70, 0, Math.PI * 2); c.fill(); c.fillStyle = `rgb(${90 + w.dust * 110},${80 + w.dust * 20},${70})`; c.beginPath(); c.arc(w.x, w.y, 56, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ddd'; c.beginPath(); c.arc(w.x, w.y, 16, 0, Math.PI * 2); c.fill(); });
      pebbles.forEach((q) => { if (q.out) return; const w = wheels[q.w]; c.fillStyle = Math.floor(now / 200) % 2 ? '#fff' : '#ffd600'; c.beginPath(); c.arc(w.x + q.ox, w.y + q.oy, 12, 0, Math.PI * 2); c.fill(); });
      if (nozzle) { c.fillStyle = '#4db8ff'; c.beginPath(); c.arc(nozzle.x, nozzle.y, 26, 0, Math.PI * 2); c.fill(); }
      this._ok = wheels.every((w) => w.dust < 0.12) && pebbles.every((q) => q.out);
    },
    done() { return Boolean(this._ok); },
  };
}

// ------------------------------------------------------------------ 4.8 Spacesuit Radiation & Pressure Seal Check
function suitSeal() {
  const leaks = [{ x: 470, y: 150 }, { x: 330, y: 330 }, { x: 640, y: 480 }].map((l) => ({ ...l, sealed: false }));
  let badge = { x: 880, y: 220, on: false }, drag = false, hold = null, pressure = 0, pressed = false;
  return {
    down(p) {
      leaks.forEach((l) => { if (!l.sealed && Math.hypot(p.x - l.x, p.y - l.y) < 50) { l.sealed = true; play('click'); } });
      if (!badge.on && Math.hypot(p.x - badge.x, p.y - badge.y) < 50) drag = true;
      if (inR(p, 120, 470, 220, 80)) { hold = performance.now(); pressed = false; }
    },
    move(p) { if (drag) { badge.x = p.x; badge.y = p.y; } },
    up(p) {
      if (drag) { drag = false; if (Math.hypot(p.x - 550, p.y - 280) < 90) { badge = { x: 550, y: 280, on: true }; play('click'); } else badge = { x: 880, y: 220, on: false }; }
      if (hold) { hold = null; if (pressure > 0.62 && pressure < 0.82) pressed = true; pressure = 0; }
    },
    draw(c, now) {
      label(c, 'Seal the leaks, badge on, then hold PRESSURIZE and release in the green', W / 2, 60, 24, '#ffb000');
      c.fillStyle = '#e8e2d6'; rr(c, 400, 90, 300, 440, 60); c.fill(); c.fillStyle = '#c9a24a'; rr(c, 450, 120, 200, 110, 50); c.fill();
      leaks.forEach((l) => { if (!l.sealed) { c.fillStyle = `rgba(160,220,255,${0.5 + Math.sin(now / 120) * 0.3})`; c.beginPath(); c.arc(l.x, l.y, 30, 0, Math.PI * 2); c.fill(); } else { c.fillStyle = '#43e060'; c.fillRect(l.x - 18, l.y - 6, 36, 12); } });
      c.fillStyle = badge.on ? '#ffb000' : '#ff8a2a'; rr(c, badge.x - 30, badge.y - 22, 60, 44, 6); c.fill(); label(c, '☢', badge.x, badge.y + 10, 28, '#000');
      if (hold) pressure = Math.min(1, (now - hold) / 1800);
      c.fillStyle = '#16293c'; rr(c, 120, 380, 220, 40); c.fill(); c.fillStyle = 'rgba(67,224,96,.6)'; c.fillRect(120 + 220 * 0.62, 380, 220 * 0.2, 40); c.fillStyle = '#fff'; c.fillRect(120 + 220 * pressure - 2, 372, 5, 56);
      c.fillStyle = hold ? '#ff8a2a' : '#12304a'; rr(c, 120, 470, 220, 80); c.fill(); c.strokeStyle = '#00E5FF'; c.stroke(); label(c, 'PRESSURIZE', 230, 520, 24);
      this._ok = leaks.every((l) => l.sealed) && badge.on && pressed;
    },
    done() { return Boolean(this._ok); },
  };
}

const GAMES = {
  heat_pump: heatPump, valve_balance: valveBalance, water_sort: waterSort, nutrient_match: nutrientMatch,
  air_filter: airFilter, antenna, wheel_vacuum: wheelVacuum, suit_seal: suitSeal,
};

/** Start one of the mini-games above. */
export function startMini2(game, { canvas, title, hint, onWin, onFail, onTitle, onHint }) {
  return scaffold({ canvas, game, onWin, onFail, onTitle, onHint, title, hint, make: GAMES[game] });
}
export const hasMini2 = (game) => Object.hasOwn(GAMES, game);
