/**
 * B2: "After 3 failures in a row, a drone offers to auto-fix it (1 Sol of drone time)" (SCENARIO section 4, rules for all
 * mini-games). One small helper for every mini-game: the offer panel that is drawn over the canvas, and its two buttons.
 * The mini-game keeps the state; the engine does the work (`droneFix` in src/campaign/engine.js).
 *
 * The canvas is 1100 x 620 (the same logical size in minigames.js and minigames2.js).
 */
import { wave } from './prefs.js';

const W = 1100;
const H = 620;

/** Where the panel and its two buttons are (canvas units). Both buttons are well over 64 px (SCENARIO: touch targets). */
export const OFFER = Object.freeze({
  panel: { x: 150, y: 120, w: 800, h: 380 },
  help: { x: 190, y: 350, w: 350, h: 80 },
  retry: { x: 560, y: 350, w: 350, h: 80 },
});

const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** Which button a point is on: 'help', 'retry' or null. */
export const offerButtonAt = (p) => (inside(p, OFFER.help) ? 'help' : inside(p, OFFER.retry) ? 'retry' : null);

const rr = (c, x, y, w, h, r = 14) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

/** A line of text that is cut into lines no wider than `max`. */
function wrapped(c, text, x, y, max, lineH) {
  let line = '';
  let yy = y;
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (c.measureText(test).width > max && line) { c.fillText(line, x, yy); line = word; yy += lineH; } else line = test;
  }
  if (line) c.fillText(line, x, yy);
  return yy;
}

/**
 * Draw the offer over whatever the mini-game drew. `who`: the drone's nickname or null; `reason`: why help is not possible now
 * (the engine's own words) or null; `said`: a line for the last thing that went wrong; `atlas`: to draw the drone.
 */
export function drawOffer(c, { who = null, reason = null, said = '', atlas = null }, now) {
  c.save();
  c.fillStyle = 'rgba(4,10,20,.8)';
  c.fillRect(0, 0, W, H);
  const P = OFFER.panel;
  c.fillStyle = '#0d2236'; rr(c, P.x, P.y, P.w, P.h, 22); c.fill();
  c.strokeStyle = '#00E5FF'; c.lineWidth = 4; c.stroke();
  // the drone, bobbing a little (still with Reduce motion)
  const bob = (wave(now, 400) - 0.5) * 12;
  if (atlas?.has?.('drone')) atlas.sprite(c, 'drone', 6, P.x + 150, P.y + 215 + bob, { h: 150 });
  else { c.fillStyle = '#ff8a2a'; rr(c, P.x + 90, P.y + 110 + bob, 120, 90, 18); c.fill(); }
  c.textAlign = 'left';
  c.fillStyle = '#ffb000'; c.font = 'bold 38px sans-serif';
  c.fillText(`${who ?? 'A drone'} can help!`, P.x + 290, P.y + 80);
  c.fillStyle = '#fff'; c.font = '24px sans-serif';
  const last = wrapped(c, 'Three tries takes real effort, well done! A drone can fix it for you instead. That uses 1 Sol of the drone\'s time.', P.x + 290, P.y + 130, P.w - 330, 34);
  void last;
  // the two buttons
  const ok = reason == null;
  const H1 = OFFER.help;
  c.fillStyle = ok ? '#1f7a3a' : '#2a3441'; rr(c, H1.x, H1.y, H1.w, H1.h, 16); c.fill();
  c.strokeStyle = ok ? '#7dffa0' : '#55657a'; c.lineWidth = 3; c.stroke();
  c.textAlign = 'center'; c.font = 'bold 26px sans-serif'; c.fillStyle = ok ? '#fff' : '#8896a6';
  c.fillText('Let the drone fix it', H1.x + H1.w / 2, H1.y + 52);
  const R = OFFER.retry;
  c.fillStyle = '#12304a'; rr(c, R.x, R.y, R.w, R.h, 16); c.fill();
  c.strokeStyle = '#00E5FF'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#fff'; c.fillText('Try again myself', R.x + R.w / 2, R.y + 52);
  // why not, or what just went wrong
  const line = said || reason;
  if (line) { c.fillStyle = '#ffd27a'; c.font = 'bold 22px sans-serif'; c.fillText(line, P.x + P.w / 2, P.y + P.h - 22); }
  c.restore();
}
