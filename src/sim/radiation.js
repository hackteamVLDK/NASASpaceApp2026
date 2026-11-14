/**
 * Radiation exposure model.
 *
 * Dose rate at a place =
 *     cosmic rays (GCR) at the surface   x  GCR transmission of the shielding overhead
 *   + solar storm particles (SPE)        x  SPE transmission of the shielding overhead
 *   + natural radioactivity of the rock  (always there)
 *
 * The surface GCR rate is a NASA measurement (Curiosity RAD). The transmission curves are
 * scientific approximations — see TUNING_PROVENANCE in constants.js. The model has four
 * properties that matter for teaching:
 *   - more shielding mass overhead means less dose (after a small initial bump for GCR);
 *   - the material matters, not only the thickness;
 *   - solar storm particles are far easier to stop than cosmic rays;
 *   - the dose is never exactly zero, however deep you go.
 */
import { TUNING, MATERIALS, EARTH_HOURS_PER_SIM_MINUTE } from './constants.js';
import { ROOMS, ZONE_SHIELDING } from '../data/base-layout.js';

/** Mass of shielding overhead, in g/cm^2 (metres x 100 cm x g/cm^3). */
export function arealDensity(layers) {
  let total = 0;
  for (const layer of layers) total += layer.thicknessM * 100 * material(layer).density;
  return total;
}

/** Areal density weighted by how well each material shields, relative to regolith. */
export function effectiveDensity(layers) {
  let total = 0;
  for (const layer of layers) {
    const m = material(layer);
    total += layer.thicknessM * 100 * m.density * m.effectiveness;
  }
  return total;
}

function material(layer) {
  const m = MATERIALS[layer.material];
  if (!m) throw new Error(`unknown shielding material: ${layer.material}`);
  if (!(layer.thicknessM >= 0)) throw new Error(`invalid shielding thickness: ${layer.thicknessM}`);
  return m;
}

/**
 * Fraction of the surface cosmic-ray dose that gets through `x` g/cm^2 (regolith-equivalent).
 * Exponential attenuation, a small build-up bump from secondary particles in thin shields,
 * and a floor from secondary neutrons.
 */
export function gcrTransmission(x) {
  const { gcrAttenuationGcm2: L, gcrBuildupStrength: B, gcrBuildupDepthGcm2: D, gcrResidualFraction: R } = TUNING;
  const buildup = 1 + B * (x / D) * Math.exp(1 - x / D);
  return Math.max(R, Math.exp(-x / L) * buildup);
}

/** Fraction of the surface solar-storm dose that gets through `x` g/cm^2 (regolith-equivalent). */
export function speTransmission(x) {
  return Math.exp(-x / TUNING.speAttenuationGcm2);
}

/** Everything the UI needs to explain one stack of shielding. */
export function shieldingReport(layers) {
  const effective = effectiveDensity(layers);
  return {
    layers,
    arealDensity: arealDensity(layers),
    effectiveDensity: effective,
    gcr: gcrTransmission(effective),
    spe: speTransmission(effective),
  };
}

/**
 * Dose rate in mSv per Earth hour.
 * @param {{ gcrMsvPerHour: number, speMsvPerHour: number }} env surface conditions right now
 * @param {Array} layers shielding overhead
 */
export function doseRateMsvPerHour(env, layers) {
  const t = shieldingReport(layers);
  return env.gcrMsvPerHour * t.gcr + env.speMsvPerHour * t.spe + TUNING.rockBackgroundMsvPerDay / 24;
}

/** Dose received during one simulation minute, in mSv. */
export function doseForOneMinute(env, layers) {
  return doseRateMsvPerHour(env, layers) * EARTH_HOURS_PER_SIM_MINUTE;
}

/** Shielding layers over a room: what the zone has built in, plus finished projects. */
export function roomShielding(roomId, extraByZone = {}) {
  const room = ROOMS[roomId];
  if (!room) throw new Error(`unknown room: ${roomId}`);
  return [...(extraByZone[room.zone] || []), ...ZONE_SHIELDING[room.zone]];
}

/** Surface cosmic-ray dose rate in quiet conditions, mSv per Earth hour. */
export const QUIET_GCR_MSV_PER_HOUR = TUNING.gcrSurfaceMsvPerDay / 24;
