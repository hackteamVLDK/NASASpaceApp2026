/** Visual pacing and colour choices, not scientific measurements. */
export const SURFACE_LIGHTING = Object.freeze({
  source: 'gameplay',
  // night is clearly darker and bluer than day (C-night fix): a deep blue tint that also reaches further into the ground
  night: Object.freeze({ tint: '8,16,70', opacity: 0.8, fadeDepth: 160 }),
  // warm light from the windows of the surface buildings at night; a still glow, nothing moves (Reduce motion safe)
  windowGlow: Object.freeze({ color: '255,150,60', alpha: 0.22 }),
  // the soil around the rooms dims at night too, so the lit rooms stand out (the rooms keep their own light)
  soilNight: 0.5,
  storm: Object.freeze({ tint: '200,110,40', opacity: 0.38 }),
  dusk: Object.freeze({ tint: '80,110,200', opacity: 0.22 }),
  flare: Object.freeze({ tint: '140,255,120', opacity: 0.18 }),
  groundFadeDepth: 80, // one terrain tile below the feet; underground rooms keep their own light
});
