/** Visual pacing and colour choices, not scientific measurements. */
export const SURFACE_LIGHTING = Object.freeze({
  source: 'gameplay',
  night: Object.freeze({ tint: '6,10,40', opacity: 0.62 }),
  storm: Object.freeze({ tint: '200,110,40', opacity: 0.38 }),
  dusk: Object.freeze({ tint: '80,110,200', opacity: 0.22 }),
  flare: Object.freeze({ tint: '140,255,120', opacity: 0.18 }),
  groundFadeDepth: 80, // one terrain tile below the feet; underground rooms keep their own light
});
