/**
 * How bodies move through the cutaway (pure: no DOM, so it runs under node --test).
 * The rooms of both wings open onto the shaft. To change floor, a body walks sideways to the
 * shaft, climbs or descends it, and walks into the next room, so nobody crosses a floor or a
 * wall. The surface is the top of the shaft: the airlock. Screen-side animation only; the
 * simulation does not know about any of this.
 */
import { SHAFT_X, GROUND_Y, floorFeetY, garageSpots } from './geometry.js';

export { SHAFT_X, GROUND_Y, floorFeetY };

/** Is a body at `pos` outside, on the surface? (It then wears the EVA suit.) */
export const onSurface = (pos) => Boolean(pos) && pos.y <= GROUND_Y + 40;

/** The points to walk through, in order, to get from `a` to `b`. */
export function route(a, b) {
  if (Math.abs(a.y - b.y) < 6) return [{ x: b.x, y: b.y }]; // same level: straight along it
  const pts = [];
  if (Math.abs(a.x - SHAFT_X) > 4) pts.push({ x: SHAFT_X, y: a.y }); // to the shaft on this level
  pts.push({ x: SHAFT_X, y: b.y }); // up or down the shaft
  pts.push({ x: b.x, y: b.y }); // into the room
  return pts;
}

/** A body that has not appeared yet (pos null) or stands somewhere. */
export function createMover(pos = null) {
  return { pos: pos && { ...pos }, goal: pos && { ...pos }, path: [], moving: false, climbing: false, faceLeft: false };
}

/** Say where the body should be. A new goal plans a new route from wherever the body is now. */
export function setGoal(m, goal) {
  if (!goal) { m.pos = null; m.goal = null; m.path = []; m.moving = false; m.climbing = false; return m; }
  if (!m.pos) { m.pos = { ...goal }; m.goal = { ...goal }; m.path = []; return m; }
  if (m.goal && m.goal.x === goal.x && m.goal.y === goal.y) return m; // same goal: keep going
  m.goal = { ...goal };
  m.path = route(m.pos, goal);
  return m;
}

/** Put the body somewhere at once (a drone dug out of the sand, the Commander stepping off the Rover). */
export function place(m, pos) {
  m.pos = { ...pos };
  m.path = [];
  m.goal = null;
  m.moving = false;
  m.climbing = false;
  return m;
}

/**
 * Move along the route for `dtMs`. Speeds are world units per second; `pace` speeds everything up
 * when the game runs faster than normal, so bodies still arrive.
 */
export function advance(m, dtMs, { walk = 480, climb = 320, pace = 1 } = {}) {
  if (!(dtMs > 0)) return m; // time is stopped: the pose stays exactly as it was (still walking, still climbing)
  m.moving = false;
  m.climbing = false;
  let left = (Math.max(0, dtMs) / 1000) * pace; // seconds of movement to spend
  while (left > 1e-9 && m.pos && m.path.length) {
    const to = m.path[0];
    const dx = to.x - m.pos.x;
    const dy = to.y - m.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) { m.path.shift(); continue; }
    const vertical = Math.abs(dy) > Math.abs(dx);
    const speed = vertical ? climb : walk;
    const reach = speed * left;
    if (dist <= reach) { m.pos = { x: to.x, y: to.y }; m.path.shift(); left -= dist / speed; } else { m.pos = { x: m.pos.x + (dx / dist) * reach, y: m.pos.y + (dy / dist) * reach }; left = 0; }
    m.moving = true;
    m.climbing = vertical;
    if (!vertical && Math.abs(dx) > 1e-6) m.faceLeft = dx < 0;
  }
  return m;
}

/** Has the body reached its goal and stopped? */
export const arrived = (m) => Boolean(m.pos) && m.path.length === 0 && !m.moving;

// ---------------------------------------------------------------- the Rover

/**
 * The Rover parks in the Garage (a surface building) and drives out of the right edge of the screen
 * (SCENARIO 5.1). `outX` is beyond the right edge of the gameplay view (world x 3180 at zoom 0.5).
 */
export const ROVER = Object.freeze({ parkX: garageSpots().park.x, boardX: garageSpots().board.x, outX: 3400, width: 170, ms: 2600 });

/**
 * The Rover's pose in an animation phase. `phase`: 'parked' | 'boarding' (still parked) | 'out' (driving
 * away) | 'in' (coming home) | 'gone'. `k`: 0..1 progress of the drive. Returns { visible, x, driving }.
 */
export function roverPose(phase, k = 0) {
  const u = Math.min(1, Math.max(0, k));
  if (phase === 'parked' || phase === 'boarding') return { visible: true, x: ROVER.parkX, driving: false };
  if (phase === 'out') { const e = u * u; return { visible: u < 1, x: ROVER.parkX + (ROVER.outX - ROVER.parkX) * e, driving: true }; }
  if (phase === 'in') { const e = 1 - (1 - u) * (1 - u); return { visible: true, x: ROVER.outX + (ROVER.parkX - ROVER.outX) * e, driving: u < 1 }; }
  return { visible: false, x: ROVER.outX, driving: false };
}
