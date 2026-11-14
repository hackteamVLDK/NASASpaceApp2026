/**
 * Radiation exposure model.
 *
 * Dose rate at a place =
 *     cosmic rays (GCR) at the surface   x  GCR transmission of the shielding overhead
 *   + solar storm particles (SPE)        x  SPE transmission of the shielding overhead
 *   + natural radioactivity of the rock  (always there)
 *
 * The surface GCR rate is a NASA measurement (Curiosity RAD). The transmission curves are
 * scientific approximations — see TUNING_PROVENANCE in constants.js. They are calibrated
 * for plausibility, not against measured particle-transport data. The model has four
 * properties that matter for teaching:
 *   - more shielding mass overhead means less dose (after a small initial bump for GCR);
 *   - the material matters, not only the thickness — for any thickness, hydrogen-rich
 *     materials do better than regolith, and regolith better than metal;
 *   - solar storm particles are far easier to stop than cosmic rays;
 *   - the dose is never exactly zero, however deep you go.
 */
import { TUNING, MATERIALS, EARTH_HOURS_PER_SIM_MINUTE } from './constants.js';
import { ROOMS, ZONE_SHIELDING } from '../data/base-layout.js';
import { has } from './util.js';

function material(layer) {
  if (!has(MATERIALS, layer?.material)) throw new Error(`unknown shielding material: ${layer?.material}`);
  if (!(layer.thicknessM >= 0) || !Number.isFinite(layer.thicknessM)) throw new Error(`invalid shielding thickness: ${layer.thicknessM}`);
  return MATERIALS[layer.material];
}

function weighted(layers, weight) {
  let total = 0;
  for (const layer of layers) {
    const m = material(layer);
    total += layer.thicknessM * 100 * m.density * weight(m);
  }
  return total;
}

/** Mass of shielding overhead, in g/cm^2 (metres x 100 cm x g/cm^3). */
export const arealDensity = (layers) => weighted(layers, () => 1);

/** Areal density weighted by how well each material stops particles, relative to regolith. */
export const effectiveDensity = (layers) => weighted(layers, (m) => m.effectiveness);

/** Areal density weighted by how many secondary particles each material makes. */
export const secondaryDensity = (layers) => weighted(layers, (m) => m.secondaries);

/**
 * Fraction of the surface cosmic-ray dose that gets through a shield.
 *
 *   attenuation: exp(-effective / L)          — stopping power, better for light materials
 *   build-up:    1 + B (secondary / D) e^(1 - areal / D)
 *                                             — showers of secondary particles made in the
 *                                               first tens of g/cm^2; more for heavy nuclei
 *   floor:       a small residual from secondary neutrons, never zero
 *
 * Called with one number it describes plain regolith of that many g/cm^2.
 */
export function gcrTransmission(effective, areal = effective, secondary = areal) {
  const { gcrAttenuationGcm2: L, gcrBuildupStrength: B, gcrBuildupDepthGcm2: D, gcrResidualFraction: R } = TUNING;
  const buildup = 1 + B * (secondary / D) * Math.exp(1 - areal / D);
  return Math.max(R, Math.exp(-effective / L) * buildup);
}

/** Fraction of the surface solar-storm dose that gets through `effective` g/cm^2 (regolith-equivalent). */
export function speTransmission(effective) {
  return Math.exp(-effective / TUNING.speAttenuationGcm2);
}

/** Everything the UI needs to explain one stack of shielding. */
export function shieldingReport(layers) {
  const areal = arealDensity(layers);
  const effective = effectiveDensity(layers);
  return {
    layers,
    arealDensity: areal,
    effectiveDensity: effective,
    gcr: gcrTransmission(effective, areal, secondaryDensity(layers)),
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
  if (!has(ROOMS, roomId)) throw new Error(`unknown room: ${roomId}`);
  const zone = ROOMS[roomId].zone;
  return [...(has(extraByZone, zone) ? extraByZone[zone] : []), ...ZONE_SHIELDING[zone]];
}

/** Surface cosmic-ray dose rate in quiet conditions, mSv per Earth hour. */
export const QUIET_GCR_MSV_PER_HOUR = TUNING.gcrSurfaceMsvPerDay / 24;
