/**
 * Seeded random numbers. The simulation never calls Math.random(): given the same seed and
 * the same commands it always produces the same result, which makes it testable and lets a
 * saved game continue exactly where it stopped.
 *
 * The generator state is a single integer stored in the game state (`state.rng`).
 */

/** Advance the generator stored at state.rng and return a number in [0, 1). (mulberry32) */
export function nextRandom(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Turn any seed (number or string) into a 32-bit integer. */
export function seedFrom(value) {
  if (Number.isInteger(value)) return value | 0;
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
