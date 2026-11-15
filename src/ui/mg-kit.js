/**
 * Small drawing helpers shared by the mini-game scenes (src/ui/mg-scenes.js). Canvas only, no DOM: the mini-games draw on a
 * 1100 x 620 canvas. Everything that moves respects Reduce motion through `wave` (a steady value) and `prefs.reduceMotion`.
 * Provenance: art direction, `gameplay`. The pictures are drawn from code in the palette of the sprite sheets (cream, yellow, orange,
 * brown, cyan on dark navy): development stand-ins, not final art.
 */
import { prefs, wave } from './prefs.js';
import { ICON } from '../render/atlas.js';

export const W = 1100;
export const H = 620;

/** The palette of the sprite sheets (Rover, drones, icons). */
export const PAL = Object.freeze({
  cream: '#f1e4cc', creamShade: '#cdb99a', yellow: '#f2b632', orange: '#e5702a', brown: '#7a4a2e', outline: '#3a2218',
  tire: '#2a2830', hub: '#8b8b95', glass: '#262630', cyan: '#35d5e8', navy: '#0b1522', panel: '#0d2236', edge: '#00E5FF',
  green: '#43e060', amber: '#ffb000', red: '#ff5252', steel: '#5d7388', steelDark: '#2b3a4a', white: '#ffffff',
});

export const rr = (c, x, y, w, h, r = 12) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

/** A repeatable pseudo-random number in [0, 1) from an integer: the same dust, the same stars every frame. */
export const rand = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** 0..1 for pulsing things; steady with Reduce motion. */
export const pulse = (now, ms = 320) => wave(now, ms);

/** A filled gradient background for a scene, with a soft vignette. `top` and `bottom` are CSS colours. */
export function backdrop(c, top, bottom) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.68);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

/** A rivet. */
export function bolt(c, x, y, r = 4) {
  c.fillStyle = '#9aa7b4'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(x + r * 0.25, y + r * 0.25, r * 0.55, 0, Math.PI * 2); c.fill();
}

/** A metal plate with a light top edge, a dark bottom edge and a rivet in each corner. */
export function plate(c, x, y, w, h, { r = 14, fill = '#1d3248', edge = '#4f6f8e', bolts = true } = {}) {
  c.fillStyle = fill; rr(c, x, y, w, h, r); c.fill();
  c.strokeStyle = edge; c.lineWidth = 3; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + r, y + 3); c.lineTo(x + w - r, y + 3); c.stroke();
  if (bolts) for (const [bx, by] of [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]]) bolt(c, bx, by, 3.5);
}

/** A soft round glow. */
export function glow(c, x, y, radius, color, alpha = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.globalAlpha = alpha; c.fillStyle = g; c.fillRect(x - radius, y - radius, radius * 2, radius * 2); c.restore();
}

/** A four-pointed glint (the "shiny" mark). `k` 0..1 is how big it is right now. */
export function glint(c, x, y, size, k = 1, color = '#ffffff') {
  const s = size * k;
  if (s < 0.5) return;
  c.save(); c.fillStyle = color; c.translate(x, y);
  c.beginPath();
  c.moveTo(0, -s); c.lineTo(s * 0.18, -s * 0.18); c.lineTo(s, 0); c.lineTo(s * 0.18, s * 0.18);
  c.lineTo(0, s); c.lineTo(-s * 0.18, s * 0.18); c.lineTo(-s, 0); c.lineTo(-s * 0.18, -s * 0.18);
  c.closePath(); c.fill(); c.restore();
}

/** A glint that comes and goes; a steady small one with Reduce motion. */
export const twinkle = (c, x, y, size, now, phase = 0, color) => glint(c, x, y, size, prefs.reduceMotion ? 0.7 : Math.max(0, Math.sin(now / 260 + phase)) ** 2, color);

/** Text with a dark outline, so it reads on any picture. */
export function outlined(c, text, x, y, size = 22, color = '#fff', align = 'center') {
  c.font = `bold ${size}px sans-serif`; c.textAlign = align; c.lineJoin = 'round';
  c.lineWidth = Math.max(4, size / 5); c.strokeStyle = 'rgba(8,14,24,.9)'; c.strokeText(text, x, y);
  c.fillStyle = color; c.fillText(text, x, y);
}

/** One of the pictures of ui.icons (ICON.heat, ICON.farm ...) centred at (x, y), `size` units square. */
export function icon(c, atlas, name, x, y, size, alpha = 1) {
  if (!atlas?.has?.('icons') || ICON[name] === undefined) return;
  c.save(); c.globalAlpha = alpha; atlas.cell(c, 'icons', ICON[name], x - size / 2, y - size / 2, size, size); c.restore();
}

/** A rounded progress bar with a label on the left of it. */
export function meter(c, x, y, w, frac, { color = PAL.green, label = '', h = 16 } = {}) {
  c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, x, y, w, h, h / 2); c.fill();
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) { c.fillStyle = color; rr(c, x, y, Math.max(h, w * f), h, h / 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.28)'; rr(c, x + 3, y + 2, Math.max(h - 6, w * f - 6), 4, 2); c.fill(); }
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; rr(c, x, y, w, h, h / 2); c.stroke();
  if (label) outlined(c, label, x, y - 8, 18, '#dff3ff', 'left');
}
