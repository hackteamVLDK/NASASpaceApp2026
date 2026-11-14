/**
 * The four thrusters of the flying lander and the flame under each (docs/ERRORS.md A41).
 *
 * The flames used to hang on a made-up grid (52 units apart, the nozzles are 42 apart), so the outer ones stood beside their nozzles, and the
 * two flame frames were stretched to the same height, so the short one came out 40% wider and the flames overlapped. Here every flame is put
 * under the middle of its own nozzle, both frames share one scale, and neighbours flicker in different frames.
 *
 * Pure (no DOM), so it runs under node --test. Everything in LANDER_ART and FLAME_ART was MEASURED on the pictures, in source pixels, after
 * the faint glow around a sprite is cut away (see atlas.js): assets/incoming/lander.craft.png cell 0 and lander.parachute.png cells 2 and 3.
 * If either picture is replaced, measure again (the numbers below are the only place that depends on them). Provenance: `gameplay`.
 */

export const LANDER_ART = Object.freeze({
  bodyW: 699, // the visible width of the flying lander: `atlas.sprite(..., { w })` scales this to the drawn width
  centerX: 511, // the middle of that width
  nozzleX: Object.freeze([311, 444, 579.5, 712.5]), // the middles of the four nozzles
  nozzleW: 65, // a nozzle at its lowest, the orange ring
});

/** The flame frames of lander.parachute (cells 2 and 3): the visible size, the width of the flat top, and how far right its middle is from the box's middle. */
export const FLAME_ART = Object.freeze({
  2: Object.freeze({ w: 242, h: 541, topW: 128, topShift: 9 }), // frame A: long
  3: Object.freeze({ w: 234, h: 382, topW: 107, topShift: 7 }), // frame B: short
});

/** A flame pixel is this much smaller than a lander pixel: the top of a flame is then about as wide as its nozzle, its widest part a little under the nozzle spacing. */
export const FLAME_SCALE = 0.55;
/** How far up behind the nozzle the flame starts, in lander pixels: the lander is drawn over the flames, so the rim of the nozzle covers the flat top. */
export const FLAME_TUCK = 18;

/** The middle of each nozzle, in world units from the middle of a lander drawn `w` units wide. */
export const nozzleOffsets = (w) => LANDER_ART.nozzleX.map((nx) => ((nx - LANDER_ART.centerX) * w) / LANDER_ART.bodyW);

/**
 * Where to draw the four flames. `x, y` is the lander's bottom centre in the world (the bottom of the nozzles), `w` its drawn width, `tick`
 * advances the flicker. Returns four { x, y, frame, k }: `x` is the middle of the flame frame's visible box, `y` its top edge, `frame` the
 * cell of lander.parachute (2 or 3) and `k` the world units per source pixel (the same for both frames, so the short one stays short).
 */
export function flames({ x, y, w, tick = 0 }) {
  const kLander = w / LANDER_ART.bodyW;
  const k = kLander * FLAME_SCALE;
  return nozzleOffsets(w).map((dx, i) => {
    const frame = 2 + ((tick + i) % 2); // neighbours differ, and swap on every tick
    return { x: x + dx - FLAME_ART[frame].topShift * k, y: y - FLAME_TUCK * kLander, frame, k };
  });
}
