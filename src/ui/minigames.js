/**
 * Mini-games (SCENARIO section 4 and the Sol 1 tutorial). They open as an overlay on top of the
 * base. Rules shared by all: touch targets at least 64 px, drag and tap only, a timer ring, no
 * big FAIL screen (a gentle "Close!" and an instant free retry).
 * Implemented: Solar Panel Static Wipe (4.1) and the tutorial battery + cable step.
 */
import { t } from '../flow/strings.js';
import { play, director } from './audio.js';
import { ICON } from '../render/atlas.js';

const W = 1100;
const H = 620;

function pointer(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
}

function timerRing(ctx, frac) {
  ctx.save();
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(255,255,255,.15)';
  ctx.beginPath(); ctx.arc(W - 60, 60, 38, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = frac > 0.5 ? '#43e060' : frac > 0.2 ? '#ffd600' : '#ff5252';
  ctx.beginPath(); ctx.arc(W - 60, 60, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
  ctx.restore();
}

/** 4.1 Solar Panel Static Wipe: zap the sparking clumps, then swipe the wiper. Win at 90% clean in 20 s (+3 s solo). */
export function startSolarWipe({ canvas, atlas, title, hint, timeLimit = 23, onWin, onTitle = () => {}, onHint = () => {} }) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  onTitle(title);
  const panels = [0, 1, 2].map((i) => ({ x: 22 + i * 355, y: 150, w: 340, h: 226, cols: 34, rows: 22 }));
  panels.forEach((p) => { p.cells = new Uint8Array(p.cols * p.rows); p.mask = document.createElement('canvas'); p.mask.width = p.w; p.mask.height = p.h; });
  const seeds = [[0, 90, 70], [0, 250, 150], [1, 170, 110], [2, 80, 140], [2, 260, 60]];
  let clumps, started, failures = 0, won = false, tapHint = true, last = null, raf = 0, msg = '';

  function reset() {
    clumps = seeds.map(([panel, x, y]) => ({ panel, x, y, r: 34, zapped: false }));
    panels.forEach((p) => { p.cells.fill(0); p.mask.getContext('2d').clearRect(0, 0, p.w, p.h); });
    started = performance.now();
    tapHint = true;
  }
  reset();
  onHint(hint);

  /** Share of the panel surface that is clean. Only the inner part of each panel counts, not its frame. */
  const clean = () => {
    let done = 0, total = 0;
    for (const p of panels) {
      for (let cy = 0; cy < p.rows; cy++) for (let cx = 0; cx < p.cols; cx++) {
        const u = (cx + 0.5) / p.cols, v = (cy + 0.5) / p.rows;
        if (u < 0.1 || u > 0.9 || v < 0.14 || v > 0.86) continue;
        total++;
        done += p.cells[cy * p.cols + cx];
      }
    }
    return done / total;
  };

  function wipeAt(pt) {
    panels.forEach((p, pi) => {
      const lx = pt.x - p.x, ly = pt.y - p.y;
      if (lx < -30 || ly < -30 || lx > p.w + 30 || ly > p.h + 30) return;
      const under = clumps.find((c) => c.panel === pi && !c.zapped && Math.hypot(c.x - lx, c.y - ly) < c.r + 12);
      if (under) { // an un-zapped clump smears back: the wiper cannot clean it
        const m = p.mask.getContext('2d');
        m.save(); m.globalCompositeOperation = 'destination-out'; m.beginPath(); m.arc(under.x, under.y, under.r + 10, 0, Math.PI * 2); m.fill(); m.restore();
        for (let cy = 0; cy < p.rows; cy++) for (let cx = 0; cx < p.cols; cx++) {
          if (Math.hypot((cx + 0.5) * (p.w / p.cols) - under.x, (cy + 0.5) * (p.h / p.rows) - under.y) < under.r + 10) p.cells[cy * p.cols + cx] = 0;
        }
        return;
      }
      const m = p.mask.getContext('2d');
      m.fillStyle = '#fff'; m.beginPath(); m.arc(lx, ly, 32, 0, Math.PI * 2); m.fill();
      for (let cy = 0; cy < p.rows; cy++) for (let cx = 0; cx < p.cols; cx++) {
        const px = (cx + 0.5) * (p.w / p.cols), py = (cy + 0.5) * (p.h / p.rows);
        if (Math.hypot(px - lx, py - ly) < 32 && !clumps.some((c) => c.panel === pi && !c.zapped && Math.hypot(c.x - px, c.y - py) < c.r)) p.cells[cy * p.cols + cx] = 1;
      }
    });
  }

  const down = (e) => {
    const pt = pointer(canvas, e);
    canvas.setPointerCapture(e.pointerId);
    const tap = clumps.find((c) => !c.zapped && Math.hypot(panels[c.panel].x + c.x - pt.x, panels[c.panel].y + c.y - pt.y) < c.r + 12);
    if (tap) { tap.zapped = true; tapHint = false; director.minigame('solar_wipe', 'zap'); return; }
    last = pt; wipeAt(pt);
  };
  const move = (e) => {
    if (!last) return;
    const pt = pointer(canvas, e);
    const steps = Math.ceil(Math.hypot(pt.x - last.x, pt.y - last.y) / 12);
    for (let i = 1; i <= steps; i++) wipeAt({ x: last.x + ((pt.x - last.x) * i) / steps, y: last.y + ((pt.y - last.y) * i) / steps });
    if (steps > 0) director.minigame('solar_wipe', 'move'); // brush sound, rate-limited
    last = pt;
  };
  const up = () => { last = null; };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);

  function frame(now) {
    const left = Math.max(0, timeLimit - (now - started) / 1000);
    const pct = clean();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#e8a45c'); g.addColorStop(1, '#b8642e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 410, W, H - 410);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Drone camera: Solar Array', 24, 44);
    for (const p of panels) {
      atlas.cell(ctx, 'solarGame', 0, p.x, p.y, p.w, p.h);
      const tmp = p.tmp ?? (p.tmp = document.createElement('canvas'));
      tmp.width = p.w; tmp.height = p.h;
      const tc = tmp.getContext('2d');
      atlas.cell(tc, 'solarGame', 1, 0, 0, p.w, p.h);
      tc.globalCompositeOperation = 'destination-in'; tc.drawImage(p.mask, 0, 0);
      ctx.drawImage(tmp, p.x, p.y);
    }
    const tick = Math.floor(now / 90);
    for (const c of clumps) {
      if (c.zapped) continue;
      const p = panels[c.panel], x = p.x + c.x, y = p.y + c.y;
      ctx.strokeStyle = '#7fd7ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, c.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = tick % 2 ? '#e6fbff' : '#2aa8ff'; ctx.lineWidth = 3;
      for (let k = 0; k < 4; k++) { const a = (tick + k * 1.7) * 1.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26); ctx.stroke(); }
    }
    if (tapHint && clumps.some((c) => !c.zapped)) {
      const c = clumps.find((q) => !q.zapped), p = panels[c.panel];
      ctx.font = '54px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('\u{1F446}', p.x + c.x + 18, p.y + c.y + 70 + Math.sin(now / 160) * 8);
    }
    // sun meter
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(24, 460, 700, 40);
    ctx.fillStyle = pct >= 0.9 ? '#43e060' : '#ffd600'; ctx.fillRect(24, 460, 700 * Math.min(1, pct), 40);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(24, 460, 700, 40);
    ctx.beginPath(); ctx.moveTo(24 + 700 * 0.9, 452); ctx.lineTo(24 + 700 * 0.9, 508); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`Sun power ${Math.round(pct * 100)}%`, 34, 490);
    timerRing(ctx, left / timeLimit);
    if (msg) { ctx.fillStyle = '#fff'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg, W / 2, 570); }

    if (!won && pct >= 0.9) { won = true; play('win'); setTimeout(() => { destroy(); onWin(); }, 650); }
    else if (!won && left <= 0) { failures++; msg = failures >= 3 ? 'A drone helps you out!' : 'Close! Try once more.'; reset(); if (failures >= 3) { won = true; setTimeout(() => { destroy(); onWin(); }, 900); } else setTimeout(() => { msg = ''; }, 1400); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function destroy() {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
  }
  return { destroy };
}

/** Tutorial step: drag the charged battery into Drone #01's back hatch, then snap 1 cable in. */
export function startBatteryStep({ canvas, atlas, title, hint, onDone, onTitle = () => {}, onHint = () => {} }) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  onTitle(title);
  onHint(hint);
  const slot = { x: 330, y: 190, w: 250, h: 130 };
  const socket = { x: 700, y: 255 };
  const plugHome = { x: 760, y: 470 };
  let battery = { x: 90, y: 400, w: 190, h: 100, seated: false };
  let plug = { ...plugHome }, drag = null, done = false, raf = 0, flash = 0;

  const over = (pt, r) => pt.x > r.x && pt.x < r.x + r.w && pt.y > r.y && pt.y < r.y + r.h;
  const down = (e) => {
    const pt = pointer(canvas, e);
    canvas.setPointerCapture(e.pointerId);
    if (!battery.seated && over(pt, battery)) drag = { what: 'battery', dx: pt.x - battery.x, dy: pt.y - battery.y };
    else if (battery.seated && Math.hypot(pt.x - plug.x, pt.y - plug.y) < 48) drag = { what: 'plug', dx: pt.x - plug.x, dy: pt.y - plug.y };
  };
  const move = (e) => {
    if (!drag) return;
    const pt = pointer(canvas, e);
    if (drag.what === 'battery') { battery.x = pt.x - drag.dx; battery.y = pt.y - drag.dy; } else { plug.x = pt.x - drag.dx; plug.y = pt.y - drag.dy; }
  };
  const up = () => {
    if (!drag) return;
    if (drag.what === 'battery') {
      if (Math.hypot(battery.x + battery.w / 2 - (slot.x + slot.w / 2), battery.y + battery.h / 2 - (slot.y + slot.h / 2)) < 110) { battery = { ...battery, x: slot.x + 30, y: slot.y + 15, seated: true }; director.minigame('battery', 'insert'); }
      else battery = { x: 90, y: 400, w: 190, h: 100, seated: false };
    } else if (Math.hypot(plug.x - socket.x, plug.y - socket.y) < 70) { plug = { ...socket }; done = true; flash = performance.now(); director.minigame('battery', 'cable'); play('win'); setTimeout(() => { destroy(); onDone(); }, 800); }
    else plug = { ...plugHome };
    drag = null;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);

  function frame(now) {
    ctx.fillStyle = '#0b1522'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e6d8c0'; ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(250, 120, 620, 420, 40); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a1214'; ctx.beginPath(); ctx.roundRect(290, 160, 540, 260, 24); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Drone #01 – back hatch', 560, 100);
    ctx.setLineDash([12, 8]); ctx.strokeStyle = battery.seated ? '#43e060' : '#00E5FF'; ctx.lineWidth = 4; ctx.strokeRect(slot.x, slot.y, slot.w, slot.h); ctx.setLineDash([]);
    ctx.fillStyle = '#9aa'; ctx.beginPath(); ctx.arc(socket.x, socket.y, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = done ? '#43e060' : '#ff8a2a'; ctx.beginPath(); ctx.arc(socket.x, socket.y, 18, 0, Math.PI * 2); ctx.fill();
    // cable
    if (battery.seated) {
      ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(plugHome.x + 60, plugHome.y + 90); ctx.bezierCurveTo(plugHome.x, plugHome.y + 60, plug.x + 30, plug.y + 90, plug.x, plug.y); ctx.stroke();
      ctx.fillStyle = '#ffb870'; ctx.beginPath(); ctx.roundRect(plug.x - 26, plug.y - 18, 52, 36, 8); ctx.fill();
      if (!done) { ctx.strokeStyle = `rgba(255,214,0,${0.5 + Math.sin(now / 200) * 0.4})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(plug.x, plug.y, 42, 0, Math.PI * 2); ctx.stroke(); }
    }
    // battery
    ctx.fillStyle = '#2f6f3f'; ctx.strokeStyle = '#d7ffe0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(battery.x, battery.y, battery.w, battery.h, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d7ffe0'; ctx.fillRect(battery.x + battery.w, battery.y + 32, 14, 36);
    atlas.cell(ctx, 'icons', ICON.battery, battery.x + 10, battery.y + 6, 88, 88);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('CHARGED', battery.x + 100, battery.y + 58);
    if (!battery.seated) { ctx.font = '54px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('\u{1F446}', 190 + Math.min(1, ((now / 1500) % 2)) * 190, 560 - Math.min(1, ((now / 1500) % 2)) * 100); }
    if (done && now - flash < 700) { ctx.fillStyle = `rgba(67,224,96,${0.5 - (now - flash) / 1400})`; ctx.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function destroy() {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
  }
  return { destroy };
}

export { t };
