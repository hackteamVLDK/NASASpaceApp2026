/** Small helpers shared by the campaign modules (kept apart to avoid circular imports). */
import { SOL, SLEEP_FROM, SLEEP_TO, MODULES, CAP } from './data.js';

/** Calendar for a minute count. */
export function clockAt(minute) {
  const inSol = minute % SOL;
  return { sol: Math.floor(minute / SOL) + 1, hour: Math.floor(inSol / 60), minute: inSol % 60, hourFloat: inSol / 60 };
}

export const isNight = (hourFloat) => hourFloat >= SLEEP_FROM || hourFloat < SLEEP_TO;
/** Daylight for the panels and drones: 6:00 to 22:00 (3 of the 4 real minutes of a Sol are day, SCENARIO 3.1). */
export const isDay = (hourFloat) => !isNight(hourFloat);

export const online = (s, id) => s.modules[id]?.status === 'online';

/** Minute count of "Sol X, hour H". */
export const at = (sol, hour = 0) => (sol - 1) * SOL + hour * 60;

/** A temporary per-Sol modifier of a meter ("hp" is allowed too). */
export function addMod(s, id, res, perSol, untilMinute = null) {
  s.mods = s.mods.filter((m) => m.id !== id);
  s.mods.push({ id, res, perSol, untilMinute });
}

/** Schedule a delayed story effect (handled by `runTimer` in story.js). */
export function after(s, minute, id) {
  s.timers.push({ at: minute, id });
}

export const clampTo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** How much Power the base can store: 100, or 250 / 400 with Battery & Heating (3.1). */
export const powerCapOf = (s) => (online(s, 'battery') ? MODULES.battery.powerCap[s.modules.battery.tier - 1] : CAP.power);
