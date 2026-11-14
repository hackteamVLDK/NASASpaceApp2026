/**
 * B4: check and upgrade a saved game before it is loaded. Pure (no DOM), so it runs under node --test.
 * A save made by an older build gets every field the current game expects (deep merge over a fresh campaign),
 * keeping everything the player already had. Saves that cannot be trusted are refused with a reason.
 */
import { createCampaign, STATE_VERSION } from './engine.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Defaults first, then the save on top; objects merge, everything else (numbers, arrays) comes from the save. */
function deepMerge(base, saved) {
  if (!isObj(base) || !isObj(saved)) return saved === undefined ? base : saved;
  const out = { ...base };
  for (const [k, v] of Object.entries(saved)) out[k] = k in base ? deepMerge(base[k], v) : v;
  return out;
}

/**
 * @returns {{ ok: true, state: object, upgraded: boolean } | { ok: false, reason: string }}
 */
export function restoreSave(saved) {
  if (!isObj(saved)) return { ok: false, reason: 'the save is empty or damaged' };
  const version = saved.version ?? 0;
  if (typeof version !== 'number' || version > STATE_VERSION) return { ok: false, reason: 'the save comes from a newer version of the game' };
  if (!Number.isFinite(saved.minute) || saved.minute < 0) return { ok: false, reason: 'the save has no valid time' };
  if (!isObj(saved.res) || !isObj(saved.modules)) return { ok: false, reason: 'the save is missing the base' };
  if (saved.status === 'over') return { ok: false, reason: 'that mission is already over' };
  const fresh = createCampaign({ seed: saved.seed ?? 1 });
  const state = deepMerge(fresh, saved);
  // arrays of objects that gained fields over time
  state.drones = (Array.isArray(saved.drones) ? saved.drones : fresh.drones).map((d, i) => ({ ...fresh.drones[i], ...d, queue: d.queue ?? [] }));
  for (const [k, v] of Object.entries(state.res)) if (!Number.isFinite(v)) state.res[k] = fresh.res[k] ?? 0;
  if (!Number.isFinite(state.hp)) state.hp = fresh.hp;
  state.order ??= null;
  const upgraded = version < STATE_VERSION || JSON.stringify(Object.keys(saved).sort()) !== JSON.stringify(Object.keys(state).sort());
  state.version = STATE_VERSION;
  return { ok: true, state, upgraded };
}
