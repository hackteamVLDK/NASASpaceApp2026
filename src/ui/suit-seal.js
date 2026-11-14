/**
 * Spacesuit Radiation & Pressure Seal Check (SCENARIO 4.8) as plain functions, so the rules can be tested under node (docs/ERRORS.md A37).
 * The drawing is in minigames2.js; this file holds the state, the hit tests and the pressure gauge.
 *
 * SCENARIO: leaks show as puffs of air at random seals (helmet ring, gloves, boots, zipper); tap each puff to snap a clamp on it;
 * drag the radiation badge onto the chest; with the Suit Radiation Liner crafted, drag the liner panel into the suit's back; then press
 * and hold PRESSURIZE until the needle is in the green band and release. Win: all leaks sealed, badge on, gauge green within 15 s.
 *
 * Provenance: the stage coordinates, hit sizes and the gauge numbers are `gameplay` (SCENARIO gives no numbers; they were chosen so a child
 * can hit them: a wide green band and a slow needle). The canvas is 1100 x 620.
 */

/** Where each seal is on the front view of the suit (canvas units). */
export const SEALS = Object.freeze({
  helmet: { x: 550, y: 222, label: 'helmet ring' },
  gloveL: { x: 449, y: 372, label: 'left glove' },
  gloveR: { x: 651, y: 372, label: 'right glove' },
  zipper: { x: 550, y: 345, label: 'zipper' },
  bootL: { x: 513, y: 536, label: 'left boot' },
  bootR: { x: 587, y: 536, label: 'right boot' },
});

/** The things the player moves and the places they come from and go to. */
export const STAGE = Object.freeze({
  badge: { x: 905, y: 215, grab: 64 }, // hangs on a hook at the right
  liner: { x: 905, y: 400, grab: 70 }, // a panel waiting at the right (only with the Suit Radiation Liner)
  suit: { x0: 405, y0: 80, x1: 695, y1: 592 }, // dropping anywhere on the suit counts (the badge snaps to the chest): no need to aim at a pixel
  chest: { x: 516, y: 282 }, // where the badge ends up
  back: { x: 584, y: 300 }, // where the liner shows after it is in
  leakHit: 56,
  button: { x: 60, y: 452, w: 250, h: 84 },
  gauge: { x: 60, y: 372, w: 250, h: 38 },
});

/** The pressure gauge: the needle sweeps from 0 to 1 while the button is held. Provenance: `gameplay`. */
export const PRESSURE = Object.freeze({ sweepMs: 2400, from: 0.58, to: 0.84, minHoldMs: 150 });

const inRect = (p, x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
const near = (p, q, r) => Math.hypot(p.x - q.x, p.y - q.y) <= r;

/**
 * A new game. `leaks` seals are chosen at random with `rand` (a function returning [0, 1)); `liner` says whether the Suit Radiation
 * Liner is crafted (one more thing to drag).
 */
export function createSuit({ rand = Math.random, leaks = 3, liner = false } = {}) {
  const ids = Object.keys(SEALS);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const item = (home) => ({ x: home.x, y: home.y, home: { x: home.x, y: home.y }, on: false, drag: false });
  return {
    leaks: ids.slice(0, Math.min(leaks, ids.length)).map((id) => ({ id, ...SEALS[id], sealed: false })),
    badge: item(STAGE.badge),
    liner: liner ? item(STAGE.liner) : null,
    hold: null, // when PRESSURIZE went down (ms), or null
    pressed: false, // the needle was in the green when the button was released
    said: null, // the last thing the gauge told the player: { text, until }
  };
}

const sealed = (g) => g.leaks.every((l) => l.sealed);

/** The steps of the check in order, for the little list on the screen. */
export function steps(g) {
  const list = [{ id: 'leaks', text: `Seal the leaks (${g.leaks.filter((l) => l.sealed).length}/${g.leaks.length})`, done: sealed(g) }];
  list.push({ id: 'badge', text: 'Badge on the chest', done: g.badge.on });
  if (g.liner) list.push({ id: 'liner', text: "Liner into the suit's back", done: g.liner.on });
  list.push({ id: 'pressure', text: 'Pressurize: release in the green', done: g.pressed });
  return list;
}

/** All leaks sealed, the badge on (and the liner), and the gauge was green. */
export const complete = (g) => sealed(g) && g.badge.on && (!g.liner || g.liner.on) && g.pressed;

/** The first thing still to do, for the hint hand: { kind: 'leak', x, y } | { kind: 'badge' } | { kind: 'liner' } | { kind: 'pressure' } | null. */
export function nextStep(g) {
  const leak = g.leaks.find((l) => !l.sealed);
  if (leak) return { kind: 'leak', x: leak.x, y: leak.y };
  if (!g.badge.on) return { kind: 'badge', x: g.badge.home.x, y: g.badge.home.y };
  if (g.liner && !g.liner.on) return { kind: 'liner', x: g.liner.home.x, y: g.liner.home.y };
  if (!g.pressed) return { kind: 'pressure', x: STAGE.button.x + STAGE.button.w / 2, y: STAGE.button.y + STAGE.button.h / 2 };
  return null;
}

/** Is the point on the suit (where the badge and the liner may be dropped)? */
export const onSuit = (p) => inRect(p, STAGE.suit.x0, STAGE.suit.y0, STAGE.suit.x1 - STAGE.suit.x0, STAGE.suit.y1 - STAGE.suit.y0);

/** The needle, 0 to 1, at time `now` (ms): it moves only while the button is held. */
export const pressureAt = (g, now) => (g.hold == null ? 0 : Math.min(1, Math.max(0, (now - g.hold) / PRESSURE.sweepMs)));

/** What a needle position means: 'low', 'good' (in the green) or 'high'. */
export const verdictFor = (pressure) => (pressure < PRESSURE.from ? 'low' : pressure > PRESSURE.to ? 'high' : 'good');

/**
 * A press at `p` at time `now`. Returns what it did: 'clamp' (a leak was sealed), 'grab' (the badge or the liner was picked up),
 * 'press' (PRESSURIZE is held), 'locked' (PRESSURIZE was pressed while a leak is open) or null (nothing there).
 */
export function pointerDown(g, p, now) {
  const leak = g.leaks.find((l) => !l.sealed && near(p, l, STAGE.leakHit));
  if (leak) { leak.sealed = true; return 'clamp'; }
  for (const it of [g.badge, g.liner]) {
    if (it && !it.on && near(p, it, it === g.badge ? STAGE.badge.grab : STAGE.liner.grab)) { it.drag = true; return 'grab'; }
  }
  const b = STAGE.button;
  if (inRect(p, b.x, b.y, b.w, b.h)) {
    if (!sealed(g)) return 'locked'; // the pressure would only escape: seal the leaks first
    g.hold = now;
    return 'press';
  }
  return null;
}

/** A pointer move: whatever is being dragged follows it. */
export function pointerMove(g, p) {
  for (const it of [g.badge, g.liner]) if (it?.drag) { it.x = p.x; it.y = p.y; }
}

/**
 * A release at `p` at time `now`. Returns { kind, verdict? }: 'badge' / 'liner' (dropped on the suit), 'back' (dropped elsewhere: it
 * goes back where it came from), 'release' (PRESSURIZE let go: `verdict` is 'low', 'good' or 'high'), or { kind: null }.
 */
export function pointerUp(g, p, now) {
  for (const it of [g.badge, g.liner]) {
    if (!it?.drag) continue;
    it.drag = false;
    if (onSuit(p)) {
      it.on = true;
      const spot = it === g.badge ? STAGE.chest : STAGE.back;
      it.x = spot.x; it.y = spot.y;
      return { kind: it === g.badge ? 'badge' : 'liner' };
    }
    it.x = it.home.x; it.y = it.home.y;
    return { kind: 'back' };
  }
  if (g.hold != null) {
    const pressure = pressureAt(g, now);
    const held = now - g.hold;
    g.hold = null;
    const verdict = held < PRESSURE.minHoldMs ? 'low' : verdictFor(pressure);
    if (verdict === 'good') g.pressed = true;
    return { kind: 'release', verdict, pressure };
  }
  return { kind: null };
}
