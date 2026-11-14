/**
 * Saving and loading.
 *
 * Two things are stored, both as JSON text:
 *   - a game save: one level in progress (the whole simulation state);
 *   - the campaign profile: which levels are unlocked and the best result on each.
 *
 * This module only converts to and from text and validates what it reads. Where the text
 * is kept (browser localStorage, a file, a server) is the caller's business — see
 * src/ui/storage.js. Nothing here reads the clock: the caller passes `savedAt` if it wants one.
 *
 * A save file is untrusted input (it can be damaged, edited or from an old version), so
 * loading is strict in three layers:
 *   1. shape     — every field the simulation reads exists and has the right type and range;
 *   2. derived   — anything that can be recomputed is recomputed instead of trusted;
 *   3. dry run   — a copy of the state is stepped once; if that throws or produces a
 *                  non-finite number, the save is refused.
 */
import { LEVEL_BY_ID, LEVELS, FIRST_LEVEL_ID } from '../data/levels.js';
import { ROOMS } from '../data/base-layout.js';
import { JOBS, ROLES, PROJECTS, STORM_CLASSES } from './constants.js';
import { STATE_VERSION, step, extraShieldingFrom } from './sim.js';
import { edgeMinutes } from './pathfinding.js';
import { evaluateObjectives } from './objectives.js';
import { has, isFiniteNumber as isNumber, forEachNumber } from './util.js';

export const SAVE_FORMAT = 'mars-colony-save';
export const PROFILE_FORMAT = 'mars-colony-profile';
export const PROFILE_VERSION = 1;

export class SaveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SaveError';
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isBool = (v) => typeof v === 'boolean';
const isCount = (v) => Number.isInteger(v) && v >= 0;
const isNonNegative = (v) => isNumber(v) && v >= 0;

/** Turn a game state into save text. */
export function serialize(state, { savedAt = null } = {}) {
  return JSON.stringify({ format: SAVE_FORMAT, version: STATE_VERSION, savedAt, state });
}

/**
 * Read save text back into a game state.
 * @throws {SaveError} with a message fit to show the player if the text is not a usable save
 */
export function deserialize(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SaveError('This save file is damaged and cannot be read.');
  }
  if (!isObject(data) || data.format !== SAVE_FORMAT) throw new SaveError('This is not a Mars colony save file.');
  if (data.version !== STATE_VERSION) throw new SaveError(`This save is from a different version of the game (save version ${data.version}, game version ${STATE_VERSION}).`);
  validateState(data.state);
  return { state: data.state, savedAt: typeof data.savedAt === 'string' ? data.savedAt : null };
}

/**
 * Check that a loaded state is safe to hand to the simulation, and rebuild derived fields.
 * @throws {SaveError}
 */
export function validateState(s) {
  const bad = (what) => {
    throw new SaveError(`This save file is incomplete or damaged (${what}).`);
  };
  const need = (ok, what) => {
    if (!ok) bad(what);
  };

  // --- top level
  need(isObject(s), 'no game state');
  need(has(LEVEL_BY_ID, s.levelId), `unknown level "${s.levelId}"`);
  need(['running', 'complete', 'failed'].includes(s.status), 'status');
  need(isCount(s.minute) && isCount(s.endMinute) && s.minute <= s.endMinute, 'minute');
  need(isNumber(s.doseBudgetMsv) && s.doseBudgetMsv > 0, 'doseBudgetMsv');
  need(isNonNegative(s.science), 'science');
  need(Number.isInteger(s.rng), 'rng');
  for (const key of ['shelterOrder', 'autoAllClear', 'stormEpisode']) need(isBool(s[key]), key);
  for (const key of ['resources', 'systems', 'power', 'alerts', 'emergencies', 'shortfall', 'env', 'projects', 'stats']) need(isObject(s[key]), key);
  for (const key of ['o2', 'water']) need(isNumber(s.shortfall[key]) && s.shortfall[key] >= 0 && s.shortfall[key] <= 1, `shortfall.${key}`);
  for (const key of ['crew', 'storms', 'dustStorms', 'objectives', 'achievements', 'hintsShown', 'log']) need(Array.isArray(s[key]), key);
  need(s.status === 'running' ? s.result === null : isObject(s.result), 'result');

  // --- base
  for (const key of ['o2Kg', 'waterL', 'foodKg', 'batteryKwh']) need(isNonNegative(s.resources[key]), `resources.${key}`);
  for (const key of ['o2GenEff', 'recyclerEff', 'solarClean']) need(isNumber(s.systems[key]) && s.systems[key] >= 0 && s.systems[key] <= 1, `systems.${key}`);
  for (const key of ['genKw', 'loadKw', 'demandKw']) need(isNonNegative(s.power[key]), `power.${key}`);
  need(isObject(s.power.powered) && Array.isArray(s.power.shed), 'power.powered');
  for (const key of ['base', 'o2gen', 'recycler', 'greenhouse', 'lab']) need(isBool(s.power.powered[key]), `power.powered.${key}`);
  for (const key of ['noO2', 'noWater', 'noFood', 'blackout']) {
    need(isBool(s.alerts[key]), `alerts.${key}`);
    need(isObject(s.emergencies[key]) && isBool(s.emergencies[key].open) && isCount(s.emergencies[key].clearMinutes), `emergencies.${key}`);
  }
  for (const key of ['gcrMsvPerHour', 'speMsvPerHour', 'sun']) need(isNonNegative(s.env[key]), `env.${key}`);
  need(isBool(s.env.stormActive), 'env.stormActive');
  need(s.env.dustStorm === null || (isObject(s.env.dustStorm) && isNonNegative(s.env.dustStorm.solarFactor) && isNonNegative(s.env.dustStorm.dustFactor)), 'env.dustStorm');
  for (const key of ['foodGrownKg', 'iceMinedL']) need(isNonNegative(s.stats[key]), `stats.${key}`);
  for (const key of ['emergencies', 'stormsSheltered', 'stormsTotal']) need(isCount(s.stats[key]), `stats.${key}`);

  // --- projects
  for (const [id, p] of Object.entries(s.projects)) {
    need(has(PROJECTS, id), `unknown project "${id}"`);
    need(isObject(p) && ['available', 'active', 'done'].includes(p.status) && isNonNegative(p.hoursDone) && isBool(p.paid), `project ${id}`);
  }
  need(Object.values(s.projects).filter((p) => p.status === 'active').length <= 1, 'more than one active project');

  // --- weather
  for (const st of s.storms) {
    need(isObject(st) && typeof st.id === 'string', 'storm');
    need(has(STORM_CLASSES, st.class), `storm class "${st?.class}"`);
    need(['pending', 'warned', 'active', 'done'].includes(st.status), 'storm status');
    need(Number.isInteger(st.startMinute) && Number.isInteger(st.endMinute) && st.endMinute > st.startMinute, 'storm times');
  }
  for (const d of s.dustStorms) {
    need(isObject(d) && ['pending', 'active', 'done'].includes(d.status), 'dust storm');
    need(Number.isInteger(d.startMinute) && Number.isInteger(d.endMinute) && isNonNegative(d.solarFactor) && isNonNegative(d.dustFactor), 'dust storm values');
  }

  // --- crew
  need(s.crew.length > 0, 'crew');
  for (const c of s.crew) {
    need(isObject(c) && typeof c.id === 'string' && typeof c.name === 'string', 'crew member');
    need(has(ROLES, c.role), `crew role "${c.role}"`);
    need(has(JOBS, c.job), `crew job "${c.job}"`);
    need(has(ROOMS, c.location), `crew location "${c.location}"`);
    need(typeof c.activity === 'string', 'crew activity');
    need(isObject(c.stats), 'crew stats');
    for (const key of ['health', 'morale', 'energy', 'nutrition', 'fitness']) need(isNumber(c.stats[key]) && c.stats[key] >= 0 && c.stats[key] <= 100, `crew stats.${key}`);
    need(isNonNegative(c.doseMsv) && isNonNegative(c.stormDoseMsv), 'crew dose');
    for (const key of ['doseWarned', 'grounded', 'forcedSleep']) need(isBool(c[key]), `crew ${key}`);
    need(Number.isInteger(c.mealHour) && isCount(c.mealMinutes), 'crew meal');
    if (c.move !== null) validateMove(c, need);
  }

  // --- lists of text
  for (const key of ['achievements', 'hintsShown']) need(s[key].every((v) => typeof v === 'string'), key);
  need(s.log.every((l) => isObject(l) && isNumber(l.minute) && typeof l.level === 'string' && typeof l.text === 'string'), 'log');
  need(s.objectives.every((o) => isObject(o) && typeof o.type === 'string'), 'objectives');

  // --- derived data is rebuilt, never trusted
  s.extraShielding = extraShieldingFrom(s.projects);

  // --- dry run on a copy: the state must actually work
  try {
    evaluateObjectives(s);
    if (s.status === 'running') {
      const copy = structuredClone(s);
      step(copy, 1);
      forEachNumber(copy, (path, value) => {
        if (!Number.isFinite(value)) throw new Error(`${path} became ${value}`);
      });
    }
  } catch (e) {
    bad(`the game cannot continue from it: ${e.message}`);
  }
  return s;
}

/** A walk in progress must be along real corridors, with sensible timing, to a real place. */
function validateMove(c, need) {
  const m = c.move;
  need(isObject(m) && has(ROOMS, m.from) && has(ROOMS, m.to) && has(ROOMS, m.dest), 'crew movement rooms');
  need(Array.isArray(m.rest) && m.rest.every((r) => has(ROOMS, r)), 'crew movement route');
  need(m.from === c.location || m.to === c.location, 'crew movement start');
  let total;
  try {
    total = edgeMinutes(m.from, m.to);
    let at = m.to;
    for (const next of m.rest) {
      edgeMinutes(at, next);
      at = next;
    }
    need(at === m.dest, 'crew movement destination');
  } catch {
    need(false, 'crew movement uses rooms that are not connected');
  }
  need(m.total === total && isNumber(m.left) && m.left > 0 && m.left <= m.total, 'crew movement timing');
}

// ---------------------------------------------------------------- campaign profile

/** A fresh profile: only the first level is unlocked. */
export function newProfile() {
  return { format: PROFILE_FORMAT, version: PROFILE_VERSION, unlocked: [FIRST_LEVEL_ID], levels: {} };
}

/**
 * Record a finished level in the profile: keep the best stars and score, and unlock the
 * next level if this one was completed. Returns what changed, for the results screen.
 */
export function recordResult(profile, state) {
  if (state.status === 'running' || !state.result) throw new Error('recordResult needs a finished level');
  const level = LEVEL_BY_ID[state.levelId];
  const before = has(profile.levels, level.id) ? profile.levels[level.id] : { completed: false, stars: 0, bestScore: 0, attempts: 0 };
  const after = {
    completed: before.completed || state.status === 'complete',
    stars: Math.max(before.stars, state.result.stars),
    bestScore: Math.max(before.bestScore, state.result.score.total),
    attempts: before.attempts + 1,
  };
  profile.levels[level.id] = after;
  let unlocked = null;
  if (after.completed && level.unlocks && !profile.unlocked.includes(level.unlocks)) {
    profile.unlocked.push(level.unlocks);
    unlocked = level.unlocks;
  }
  return { newBestScore: after.bestScore > before.bestScore, newStars: after.stars > before.stars, unlocked };
}

export function serializeProfile(profile) {
  return JSON.stringify(profile);
}

/** Read a profile; anything unusable gives a fresh profile rather than an error. */
export function deserializeProfile(text) {
  try {
    const p = JSON.parse(text);
    if (!isObject(p) || p.format !== PROFILE_FORMAT || p.version !== PROFILE_VERSION) return newProfile();
    const known = new Set(LEVELS.map((l) => l.id));
    const unlocked = Array.isArray(p.unlocked) ? p.unlocked.filter((id) => known.has(id)) : [];
    if (!unlocked.includes(FIRST_LEVEL_ID)) unlocked.unshift(FIRST_LEVEL_ID);
    const levels = {};
    for (const [id, r] of Object.entries(isObject(p.levels) ? p.levels : {})) {
      if (!known.has(id) || !isObject(r)) continue;
      levels[id] = { completed: Boolean(r.completed), stars: isNumber(r.stars) ? Math.max(0, Math.min(3, Math.round(r.stars))) : 0, bestScore: isNumber(r.bestScore) ? r.bestScore : 0, attempts: isNumber(r.attempts) ? r.attempts : 0 };
    }
    return { format: PROFILE_FORMAT, version: PROFILE_VERSION, unlocked, levels };
  } catch {
    return newProfile();
  }
}
