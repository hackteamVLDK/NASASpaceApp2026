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
 */
import { LEVEL_BY_ID, LEVELS, FIRST_LEVEL_ID } from '../data/levels.js';
import { JOBS } from './constants.js';
import { ROOMS } from '../data/base-layout.js';
import { STATE_VERSION } from './sim.js';

export const SAVE_FORMAT = 'mars-colony-save';
export const PROFILE_FORMAT = 'mars-colony-profile';
export const PROFILE_VERSION = 1;

export class SaveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SaveError';
  }
}

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

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
  return { state: data.state, savedAt: data.savedAt ?? null };
}

/** Check that a loaded state has the shape the simulation relies on. */
export function validateState(s) {
  const bad = (what) => {
    throw new SaveError(`This save file is incomplete or damaged (${what}).`);
  };
  if (!isObject(s)) bad('no game state');
  if (!LEVEL_BY_ID[s.levelId]) bad(`unknown level "${s.levelId}"`);
  if (!['running', 'complete', 'failed'].includes(s.status)) bad('status');
  for (const key of ['minute', 'endMinute', 'doseBudgetMsv', 'science', 'rng']) if (!isNumber(s[key])) bad(key);
  if (!Number.isInteger(s.minute) || s.minute < 0) bad('minute');
  for (const key of ['resources', 'systems', 'power', 'alerts', 'emergencies', 'env', 'projects', 'stats', 'extraShielding']) if (!isObject(s[key])) bad(key);
  for (const key of ['noO2', 'noWater', 'noFood', 'blackout']) if (!isObject(s.emergencies[key])) bad(`emergencies.${key}`);
  if (!isObject(s.power.powered)) bad('power.powered');
  for (const key of ['o2Kg', 'waterL', 'foodKg', 'batteryKwh']) if (!isNumber(s.resources[key]) || s.resources[key] < 0) bad(`resources.${key}`);
  for (const key of ['o2GenEff', 'recyclerEff', 'solarClean']) if (!isNumber(s.systems[key]) || s.systems[key] < 0 || s.systems[key] > 1) bad(`systems.${key}`);
  for (const key of ['crew', 'storms', 'dustStorms', 'objectives', 'achievements', 'hintsShown', 'log']) if (!Array.isArray(s[key])) bad(key);
  if (s.crew.length === 0) bad('crew');
  for (const c of s.crew) {
    if (!isObject(c) || typeof c.id !== 'string') bad('crew member');
    if (!JOBS[c.job]) bad(`crew job "${c.job}"`);
    if (!ROOMS[c.location]) bad(`crew location "${c.location}"`);
    if (!isObject(c.stats)) bad('crew stats');
    for (const key of ['health', 'morale', 'energy', 'nutrition', 'fitness']) if (!isNumber(c.stats[key])) bad(`crew stats.${key}`);
    if (!isNumber(c.doseMsv) || c.doseMsv < 0) bad('crew dose');
    if (c.move !== null && (!isObject(c.move) || !ROOMS[c.move.from] || !ROOMS[c.move.to] || !ROOMS[c.move.dest])) bad('crew movement');
  }
  for (const st of s.storms) if (!isObject(st) || !isNumber(st.startMinute) || !isNumber(st.endMinute)) bad('storm');
  return s;
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
  const before = profile.levels[level.id] ?? { completed: false, stars: 0, bestScore: 0, attempts: 0 };
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
