/**
 * Mini-games (SCENARIO section 4 and the Sol 1 tutorial). They open as an overlay on top of the
 * base. Rules shared by all: touch targets at least 64 px, drag and tap only, a timer ring, no
 * big FAIL screen (a gentle "Close!" and an instant free retry).
 * Implemented: Solar Panel Static Wipe (4.1) and the tutorial battery + cable step.
 */
import { t } from '../flow/strings.js';
import { play, director } from './audio.js';
import { offerButtonAt, drawOffer } from './drone-offer.js';
import { drawBatteryScene, BATTERY } from './mg-scenes.js';

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

/**
 * 4.1 Solar Panel Static Wipe (A16, team decision): the player only swipes. Static stays the explanation:
 * a few sticky, sparkling clumps need 2 extra wipes (3 strokes in all) before they come off. Win at 90% clean in 20 s (+3 s solo).
 */
export function startSolarWipe({ canvas, atlas, title, hint, timeLimit = 23, onWin, help, onTitle = () => {}, onHint = () => {} }) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  onTitle(title);
  const panels = [0, 1, 2].map((i) => ({ x: 22 + i * 355, y: 150, w: 340, h: 226, cols: 34, rows: 22 }));
  panels.forEach((p) => { p.cells = new Uint8Array(p.cols * p.rows); p.mask = document.createElement('canvas'); p.mask.width = p.w; p.mask.height = p.h; });
  const seeds = [[0, 120, 100], [1, 210, 130], [2, 150, 90]]; // one sticky clump per panel (max 3)
  const STICKY = 3; // wipes a clump needs: the first stroke plus 2 extra
  let clumps, started, failures = 0, won = false, swipeHint = true, last = null, raf = 0, msg = '', stroke = 0, sparks = [];
  let offer = null; // B2: after the third failed try a drone offers to help (`help`: { who, block, ask, done }); none in the tutorial

  function reset() {
    clumps = seeds.map(([panel, x, y]) => ({ panel, x, y, r: 34, left: STICKY, lastStroke: -1, zapped: false }));
    sparks = [];
    panels.forEach((p) => { p.cells.fill(0); p.mask.getContext('2d').clearRect(0, 0, p.w, p.h); });
    started = performance.now();
    swipeHint = true;
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
      if (under) { // a sticky clump: each stroke over it loosens it once; the last one pops it off with a spark
        if (under.lastStroke !== stroke) {
          under.lastStroke = stroke;
          under.left -= 1;
          if (under.left <= 0) {
            under.zapped = true;
            for (let k = 0; k < 10; k++) sparks.push({ x: p.x + under.x, y: p.y + under.y, a: (k / 10) * Math.PI * 2, t0: performance.now() });
            director.minigame('solar_wipe', 'zap'); // the static spark sound (AUDIO_HOOKS: staticZap when a clump comes off)
          }
        }
        if (!under.zapped) return;
      }
      const m = p.mask.getContext('2d');
      m.fillStyle = '#fff'; m.beginPath(); m.arc(lx, ly, 32, 0, Math.PI * 2); m.fill();
      for (let cy = 0; cy < p.rows; cy++) for (let cx = 0; cx < p.cols; cx++) {
        const px = (cx + 0.5) * (p.w / p.cols), py = (cy + 0.5) * (p.h / p.rows);
        if (Math.hypot(px - lx, py - ly) < 32 && !clumps.some((c) => c.panel === pi && !c.zapped && Math.hypot(c.x - px, c.y - py) < c.r)) p.cells[cy * p.cols + cx] = 1;
      }
    });
  }

  /** A tap while the offer is up: the drone helps, or the player tries again (the three failures are forgotten). */
  const answerOffer = (pt) => {
    const b = offerButtonAt(pt);
    if (b === 'retry') { play('click'); failures = 0; offer = null; reset(); return; }
    if (b !== 'help') return;
    const why = help.block();
    if (why) { offer.said = why; return; }
    const r = help.ask();
    if (r?.ok) { play('click'); won = true; destroy(); help.done?.(); } else offer.said = r?.error ?? 'The drone could not help just now.';
  };
  const down = (e) => {
    const pt = pointer(canvas, e);
    if (offer) { answerOffer(pt); return; }
    canvas.setPointerCapture(e.pointerId);
    stroke += 1;
    swipeHint = false;
    last = pt; wipeAt(pt);
  };
  const move = (e) => {
    if (offer || !last) return;
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
  canvas.addEventListener('pointercancel', up);

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
      // a thick, darker dust clump (static makes it cling): it fades a little with every wipe
      ctx.fillStyle = `rgba(110,48,22,${0.45 + 0.18 * c.left})`;
      ctx.beginPath(); ctx.arc(x, y, c.r, 0, Math.PI * 2); ctx.fill();
      // small sparks as a hint, not a target (no tapping)
      ctx.strokeStyle = tick % 2 ? '#e6fbff' : '#7fd7ff'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) { const a = (tick + k * 2.1) * 1.3; const r0 = c.r * 0.55; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * (r0 + 12), y + Math.sin(a) * (r0 + 12)); ctx.stroke(); }
    }
    // the pop when a sticky clump comes off
    sparks = sparks.filter((sp) => now - sp.t0 < 450);
    for (const sp of sparks) {
      const d = (now - sp.t0) / 450, r = 10 + d * 50;
      ctx.strokeStyle = `rgba(200,245,255,${1 - d})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sp.x + Math.cos(sp.a) * r * 0.5, sp.y + Math.sin(sp.a) * r * 0.5); ctx.lineTo(sp.x + Math.cos(sp.a) * r, sp.y + Math.sin(sp.a) * r); ctx.stroke();
    }
    if (swipeHint) { // an animated hand that swipes across the first panel
      const k = (now / 1400) % 1, p = panels[0];
      ctx.font = '54px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('\u{1F446}', p.x + 40 + k * (p.w - 60), p.y + p.h * 0.62);
    }
    // sun meter
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(24, 460, 700, 40);
    ctx.fillStyle = pct >= 0.9 ? '#43e060' : '#ffd600'; ctx.fillRect(24, 460, 700 * Math.min(1, pct), 40);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(24, 460, 700, 40);
    ctx.beginPath(); ctx.moveTo(24 + 700 * 0.9, 452); ctx.lineTo(24 + 700 * 0.9, 508); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`Sun power ${Math.round(pct * 100)}%`, 34, 490);
    const sticky = clumps.filter((c) => !c.zapped).length;
    if (sticky && pct >= 0.85) { ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 22px sans-serif'; ctx.fillText(`Almost! ${sticky} sticky spot${sticky > 1 ? 's' : ''} left: wipe over ${sticky > 1 ? 'them' : 'it'} again.`, 24, 540); }
    timerRing(ctx, left / timeLimit);
    if (msg) { ctx.fillStyle = '#fff'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg, W / 2, 570); }
    if (offer) drawOffer(ctx, { who: help.who?.() ?? null, reason: help.block(), said: offer.said, atlas }, now);

    if (!won && !offer && pct >= 0.9 && clumps.every((c) => c.zapped)) { won = true; play('win'); setTimeout(() => { destroy(); onWin(); }, 650); }
    else if (!won && !offer && left <= 0) {
      failures++;
      if (failures >= 3 && help) { msg = ''; offer = { said: '' }; } // a drone offers to fix it: 1 Sol of its time
      else { msg = failures >= 3 ? 'A drone helps you out!' : 'Close! Try once more.'; reset(); if (failures >= 3) { won = true; setTimeout(() => { destroy(); onWin(); }, 900); } else setTimeout(() => { msg = ''; }, 1400); } // no drone to offer (the tutorial): the pass stays free
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function destroy() {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  }
  return { destroy };
}

/** Tutorial step: drag the charged battery into Drone #01's back hatch, then snap 1 cable in. */
export function startBatteryStep({ canvas, atlas, title, hint, onDone, onTitle = () => {}, onHint = () => {} }) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  onTitle(title);
  onHint(hint);
  const { slot, socket, plugHome, home } = BATTERY; // the same numbers as the picture (mg-scenes.js)
  let battery = { ...home, seated: false };
  let plug = { ...plugHome }, drag = null, done = false, raf = 0, flash = 0;

  const over = (pt, r) => pt.x > r.x && pt.x < r.x + r.w && pt.y > r.y && pt.y < r.y + r.h;
  const down = (e) => {
    if (done) return; // the step is finished: more taps must not finish it a second time
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
    if (!drag || done) return;
    if (drag.what === 'battery') {
      if (Math.hypot(battery.x + battery.w / 2 - (slot.x + slot.w / 2), battery.y + battery.h / 2 - (slot.y + slot.h / 2)) < 110) {
        battery = { ...battery, x: slot.x + 30, y: slot.y + 15, seated: true };
        director.minigame('battery', 'insert');
        onHint('Now drag the orange plug into the round socket.'); // step 2 gets its own instruction
      }
      else battery = { ...home, seated: false };
    } else if (Math.hypot(plug.x - socket.x, plug.y - socket.y) < 70) { plug = { ...socket }; done = true; flash = performance.now(); director.minigame('battery', 'cable'); play('win'); setTimeout(() => { destroy(); onDone(); }, 800); }
    else plug = { ...plugHome };
    drag = null;
  };
  const cancel = () => { // a lost touch puts the dragged part back instead of leaving it stuck in the air
    if (!drag || done) { drag = null; return; }
    if (drag.what === 'battery') battery = { ...home, seated: false }; else plug = { ...plugHome };
    drag = null;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);

  function frame(now) {
    drawBatteryScene(ctx, { battery, plug, done, drag, now, atlas }); // the picture (mg-scenes.js)
    // an animated hand shows the next move: battery -> hatch, then plug -> socket
    if (!drag && !done) {
      const k = Math.min(1, ((now / 1500) % 2));
      const [from, to] = battery.seated ? [[plug.x, plug.y], [socket.x, socket.y]] : [[battery.x + battery.w / 2, battery.y + battery.h / 2], [slot.x + slot.w / 2, slot.y + slot.h / 2]];
      ctx.font = '54px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('\u{1F446}', from[0] + (to[0] - from[0]) * k + 14, from[1] + (to[1] - from[1]) * k + 50);
    }
    if (done && now - flash < 700) { ctx.fillStyle = `rgba(67,224,96,${0.5 - (now - flash) / 1400})`; ctx.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function destroy() {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
  }
  return { destroy };
}

export { t };
