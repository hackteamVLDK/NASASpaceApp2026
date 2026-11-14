/**
 * B4: check and upgrade a saved game before it is loaded. Pure (no DOM), so it runs under node --test.
 * A save made by an older build gets every field the current game expects (deep merge over a fresh campaign),
 * keeping everything the player already had. A save that cannot be trusted is refused with a reason and the game
 * starts fresh; `restoreSave` never throws.
 *
 * Three layers (docs/ERRORS.md B4, D-T9):
 *  1. the shape of every part the engine indexes by key: rooms, drones, drone jobs, tasks, timers, modifiers,
 *     the pending card, the trip, the Workshop job, and the references between them (a job must name a real room);
 *  2. numbers: every meter and time is a finite number (a meter that is not one is reset, the progress is kept);
 *  3. a dry run: the restored game plays one Sol on a copy before it is trusted, so a corruption that the rules
 *     above did not foresee is refused here instead of throwing in the middle of play.
 */
import { createCampaign, step, command, STATE_VERSION } from './engine.js';
import { MODULES, RES, RECIPES } from './data.js';
import { EXPEDITIONS } from './expeditions.js';
import { MINI_GAMES } from './story.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = Number.isFinite;
const isStr = (v) => typeof v === 'string';
const known = (table, key) => (isStr(key) || typeof key === 'number') && Object.hasOwn(table, key);

const DRONE_IDS = ['drone-01', 'drone-02', 'drone-03'];
const DRONE_STATUS = ['dormant', 'awake'];
const MODULE_STATUS = ['unbuilt', 'building', 'online'];
const JOB_TYPES = ['build', 'upgrade', 'chore'];
const PENDING_KINDS = ['dilemma', 'event', 'radio'];
const MAX_QUEUE = 6; // the game keeps 2 waiting jobs (QUEUE_MAX); a story chore may go in front of them
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Defaults first, then the save on top; objects merge, everything else (numbers, arrays) comes from the save. */
function deepMerge(base, saved) {
  if (!isObj(base) || !isObj(saved)) return saved === undefined ? base : saved;
  const out = { ...base };
  for (const [k, v] of Object.entries(saved)) {
    if (UNSAFE_KEYS.has(k)) continue; // a tampered save must not reach the prototype
    out[k] = Object.hasOwn(base, k) ? deepMerge(base[k], v) : v;
  }
  return out;
}

/** Why one drone job (a task being worked on, or a waiting one) cannot be trusted, or null. */
function jobProblem(job, running) {
  if (!isObj(job) || !JOB_TYPES.includes(job.type)) return 'a drone job is damaged';
  if (job.type === 'chore') {
    if (!isStr(job.id) || !isNum(job.sols) || job.sols <= 0) return 'a drone chore is damaged';
    if (running && !isNum(job.until)) return 'a drone chore has no end time';
    if (job.module != null && !known(MODULES, job.module)) return 'a drone chore points at an unknown room';
  } else if (!known(MODULES, job.module)) return 'a drone job points at an unknown room';
  return null;
}

/**
 * Why the (merged) state cannot be trusted, in words a person can read after "could not be loaded (...)", or null.
 * Meters and times are checked by the caller first.
 */
export function validateState(s) {
  if (!isObj(s.modules)) return 'the base is missing';
  for (const [id, m] of Object.entries(s.modules)) {
    if (!known(MODULES, id)) return `there is a room called "${String(id).slice(0, 24)}" that does not exist`;
    if (!isObj(m) || !MODULE_STATUS.includes(m.status) || ![1, 2].includes(m.tier)) return `the room "${id}" is damaged`;
    if (!isNum(m.progress) || m.progress < 0 || m.progress > 1.0001) return `the room "${id}" has a build time that makes no sense`;
    if (m.drone != null && !DRONE_IDS.includes(m.drone)) return `the room "${id}" is built by a drone that does not exist`;
    if (m.upgrading != null && !(isObj(m.upgrading) && isNum(m.upgrading.progress))) return `the upgrade of "${id}" is damaged`;
  }
  if (!Array.isArray(s.drones) || s.drones.length !== DRONE_IDS.length) return 'the drones are missing';
  for (const [i, d] of s.drones.entries()) {
    if (!isObj(d) || d.id !== DRONE_IDS[i] || !DRONE_STATUS.includes(d.status)) return `drone ${i + 1} is damaged`;
    if (d.task != null) { const why = jobProblem(d.task, true); if (why) return why; }
    if (!Array.isArray(d.queue) || d.queue.length > MAX_QUEUE) return `the job queue of drone ${i + 1} is damaged`;
    for (const job of d.queue) { const why = jobProblem(job, false); if (why) return why; }
  }
  if (!Array.isArray(s.tasks) || s.tasks.some((t) => !isObj(t) || !MINI_GAMES.includes(t.game))) return 'a job on the Tasks list is damaged';
  if (!Array.isArray(s.timers) || s.timers.some((t) => !isObj(t) || !isNum(t.at) || !isStr(t.id))) return 'a timer is damaged';
  if (!Array.isArray(s.mods) || s.mods.some((m) => !isObj(m) || !isStr(m.id) || !(RES.includes(m.res) || m.res === 'hp') || !isNum(m.perSol) || (m.untilMinute != null && !isNum(m.untilMinute)))) return 'a temporary effect is damaged';
  if (s.pending != null && !(isObj(s.pending) && PENDING_KINDS.includes(s.pending.kind) && isStr(s.pending.id))) return 'the card waiting for an answer is damaged';
  if (s.away != null && !(isObj(s.away) && known(EXPEDITIONS, s.away.key) && [s.away.start, s.away.end, s.away.hpTotal, s.away.hpDone].every(isNum) && Array.isArray(s.away.fired))) return 'the Rover trip is damaged';
  if (s.crafting != null && !(isObj(s.crafting) && known(RECIPES, s.crafting.recipe) && isNum(s.crafting.progress))) return 'the Workshop job is damaged';
  if (s.order != null && !(isObj(s.order) && isStr(s.order.place) && isNum(s.order.until))) return 'the Commander\'s order is damaged';
  if (s.storm != null && !(isObj(s.storm) && isNum(s.storm.until))) return 'the storm is damaged';
  for (const key of ['items', 'kits']) {
    if (!isObj(s[key]) || Object.values(s[key]).some((n) => !isNum(n) || n < 0)) return `the ${key} are damaged`;
  }
  if (!isObj(s.upgrades) || !isObj(s.flags) || !isObj(s.stats) || !isObj(s.emergency) || !isObj(s.low) || !isObj(s.mult)) return 'part of the base is damaged';
  if (!isNum(s.mult.solar) || !isNum(s.mult.food)) return 'the sunlight or food multiplier is damaged';
  for (const key of ['logbook', 'badges', 'choices', 'said']) if (!Array.isArray(s[key])) return `the ${key} are damaged`;
  if (!isStr(s.where) || !isNum(s.act) || !isNum(s.research) || !isNum(s.recycleEta) || !isNum(s.rng)) return 'part of the mission state is damaged';
  return null;
}

/** Play one Sol on a copy: a corruption nobody foresaw throws here instead of in the middle of play. Returns a reason, or null. */
function dryRunProblem(state) {
  try {
    const probe = JSON.parse(JSON.stringify(state));
    if (probe.pending) command(probe, probe.pending.kind === 'radio' ? { type: 'radio', choice: 'a' } : { type: 'choose', choice: 'a' });
    step(probe, 1440);
    return null;
  } catch {
    return 'the saved mission would not run';
  }
}

/**
 * @returns {{ ok: true, state: object, upgraded: boolean } | { ok: false, reason: string, newer?: boolean }}
 *          `newer`: the save was made by a newer build; it is not damaged, so the caller should leave it where it is.
 */
export function restoreSave(saved) {
  try {
    return restore(saved);
  } catch {
    return { ok: false, reason: 'the save is damaged' };
  }
}

function restore(saved) {
  if (!isObj(saved)) return { ok: false, reason: 'the save is empty or damaged' };
  const version = saved.version ?? 0;
  if (typeof version !== 'number' || version > STATE_VERSION) return { ok: false, reason: 'the save comes from a newer version of the game', newer: true };
  if (!Number.isFinite(saved.minute) || saved.minute < 0) return { ok: false, reason: 'the save has no valid time' };
  if (!isObj(saved.res) || !isObj(saved.modules)) return { ok: false, reason: 'the save is missing the base' };
  if (saved.status === 'over') return { ok: false, reason: 'that mission is already over' };
  if (saved.drones !== undefined && (!Array.isArray(saved.drones) || saved.drones.some((d) => !isObj(d)))) return { ok: false, reason: 'the drones are damaged' };
  const fresh = createCampaign({ seed: isNum(saved.seed) ? saved.seed : 1 });
  const state = deepMerge(fresh, saved);
  // arrays of objects that gained fields over time
  state.drones = (Array.isArray(saved.drones) ? saved.drones : fresh.drones).map((d, i) => ({ ...fresh.drones[i], ...d, queue: Array.isArray(d.queue) ? d.queue : d.queue === undefined ? [] : d.queue }));
  // a meter that is not a number is reset; everything else the player had is kept
  for (const [k, v] of Object.entries(state.res)) if (!isNum(v)) state.res[k] = fresh.res[k] ?? 0;
  if (!isNum(state.hp)) state.hp = fresh.hp;
  if (!isNum(state.hpMax)) state.hpMax = fresh.hpMax;
  if (!isNum(state.research)) state.research = 0;
  state.order ??= null;
  const bad = validateState(state) ?? dryRunProblem(state);
  if (bad) return { ok: false, reason: bad };
  const upgraded = version < STATE_VERSION || JSON.stringify(Object.keys(saved).sort()) !== JSON.stringify(Object.keys(state).sort());
  state.version = STATE_VERSION;
  return { ok: true, state, upgraded };
}
