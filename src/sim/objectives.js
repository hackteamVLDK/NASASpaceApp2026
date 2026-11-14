/**
 * Level objectives, score, stars and achievements. Pure functions of the game state.
 */
import { TUNING, PROJECTS } from './constants.js';
import { ROOMS } from '../data/base-layout.js';

const maxDose = (state) => Math.max(...state.crew.map((c) => c.doseMsv));
const minHealth = (state) => Math.min(...state.crew.map((c) => c.stats.health));
const ratio = (value, goal) => Math.max(0, Math.min(1, goal > 0 ? value / goal : 1));

/**
 * Evaluate one objective.
 * @returns {{ status: 'done' | 'open' | 'failed', progress: number, detail: string }}
 *   'open' means still achievable; `finished` settles open objectives at the end of a level.
 */
export function evaluateObjective(state, objective, finished = state.status !== 'running') {
  const settle = (ok, progress, detail) => ({ status: ok ? 'done' : finished ? 'failed' : 'open', progress, detail });
  const holdSoFar = (ok, progress, detail) => ({ status: !ok ? 'failed' : finished ? 'done' : 'open', progress, detail });
  switch (objective.type) {
    case 'survive':
      return holdSoFar(minHealth(state) > 0 && state.status !== 'failed', ratio(state.minute, state.endMinute), `lowest health ${Math.round(minHealth(state))}`);
    case 'noEmergencies':
      return holdSoFar(state.stats.emergencies === 0, state.stats.emergencies === 0 ? 1 : 0, `${state.stats.emergencies} emergencies`);
    case 'maxDoseBelow':
      return holdSoFar(maxDose(state) < objective.value, 1 - ratio(maxDose(state), objective.value), `highest dose ${maxDose(state).toFixed(2)} of ${objective.value} mSv`);
    case 'scienceAtLeast':
      return settle(state.science >= objective.value, ratio(state.science, objective.value), `${Math.floor(state.science)} of ${objective.value}`);
    case 'foodGrownAtLeast':
      return settle(state.stats.foodGrownKg >= objective.value, ratio(state.stats.foodGrownKg, objective.value), `${state.stats.foodGrownKg.toFixed(1)} of ${objective.value} kg`);
    case 'stormsSheltered':
      return settle(state.stats.stormsSheltered >= objective.value, ratio(state.stats.stormsSheltered, objective.value), `${state.stats.stormsSheltered} of ${objective.value}`);
    case 'projectDone': {
      const p = state.projects[objective.project];
      const total = PROJECTS[objective.project]?.hours ?? 1;
      return settle(p?.status === 'done', ratio(p?.hoursDone ?? 0, total), p?.status === 'done' ? 'finished' : `${(p?.hoursDone ?? 0).toFixed(0)} of ${total} work-hours`);
    }
    case 'droneAwake': {
      const awake = state.drones.some((d) => d.id === objective.drone && d.status === 'awake');
      return settle(awake, awake ? 1 : 0, awake ? 'awake' : 'still asleep');
    }
    case 'moduleBuilt':
    case 'modulesBuilt': {
      const ids = objective.type === 'moduleBuilt' ? [objective.module] : objective.modules;
      const done = ids.filter((id) => state.modules[id]?.status === 'online').length;
      const hours = ids.reduce((sum, id) => sum + (state.modules[id]?.hoursDone ?? 0), 0);
      const needed = ids.reduce((sum, id) => sum + (ROOMS[id]?.buildHours ?? 0), 0);
      return settle(done === ids.length, ratio(hours, needed), `${done} of ${ids.length} finished`);
    }
    case 'systemAtLeast': {
      // Like a reserve: it has to be true when the level finishes.
      const have = state.systems[objective.system];
      const ok = have >= objective.value;
      return { status: finished ? (ok ? 'done' : 'failed') : 'open', progress: ratio(have, objective.value), detail: `${Math.round(have * 100)}% of ${Math.round(objective.value * 100)}%` };
    }
    case 'resourceAtLeast': {
      // Only meaningful at the end: the reserve has to still be there when the level finishes.
      const have = state.resources[objective.resource];
      const ok = have >= objective.value;
      return { status: finished ? (ok ? 'done' : 'failed') : 'open', progress: ratio(have, objective.value), detail: `${have.toFixed(1)} of ${objective.value}` };
    }
    default:
      throw new Error(`unknown objective type: ${objective.type}`);
  }
}

export function evaluateObjectives(state, finished = state.status !== 'running') {
  return state.objectives.map((o) => ({ ...o, ...evaluateObjective(state, o, finished) }));
}

/** Score, as a list of named parts so the player can see where the points come from. (Gameplay values.) */
export function scoreBreakdown(state) {
  const crew = state.crew;
  const avg = (f) => crew.reduce((sum, c) => sum + f(c), 0) / crew.length;
  const parts = [
    { label: 'Science', points: Math.round(state.science * 10) },
    { label: 'Crew health', points: Math.round(avg((c) => c.stats.health) * 3) },
    { label: 'Crew morale', points: Math.round(avg((c) => c.stats.morale) * 2) },
    { label: 'Radiation kept low', points: Math.round(300 * Math.max(0, 1 - maxDose(state) / state.doseBudgetMsv)) },
    { label: 'Storms ridden out safely', points: state.stats.stormsSheltered * 50 },
    { label: 'Modules and upgrades built', points: (state.stats.modulesBuilt + Object.values(state.projects).filter((p) => p.status === 'done').length) * 60 },
    { label: 'Drones woken', points: state.stats.dronesWoken * 30 },
    { label: 'Emergencies', points: -100 * state.stats.emergencies },
  ];
  return { parts, total: Math.max(0, parts.reduce((sum, p) => sum + p.points, 0)) };
}

/**
 * Stars for a finished level:
 *   0  the mission was aborted
 *   1  the crew made it to the end
 *   2  ...and every primary objective was met
 *   3  ...and every bonus objective too
 */
export function starRating(state) {
  if (state.status !== 'complete') return 0;
  const results = evaluateObjectives(state, true);
  const primary = results.filter((o) => o.primary);
  const bonus = results.filter((o) => !o.primary);
  if (!primary.every((o) => o.status === 'done')) return 1;
  return bonus.every((o) => o.status === 'done') ? 3 : 2;
}

export const ACHIEVEMENTS = Object.freeze([
  { id: 'first-science', title: 'First Results', text: 'Collect 10 science points.', test: (s) => s.science >= 10 },
  { id: 'green-thumb', title: 'Green Thumb', text: 'Grow 10 kg of food on Mars.', test: (s) => s.stats.foodGrownKg >= 10 },
  { id: 'ice-miner', title: 'Ice Miner', text: 'Bring home 100 litres of water from icy soil.', test: (s) => s.stats.iceMinedL >= 100 },
  { id: 'storm-safe', title: 'Safe Below', text: 'Get the whole crew through a solar storm with almost no dose.', test: (s) => s.stats.stormsSheltered >= 1 },
  { id: 'wake-up', title: 'Rise and Shine', text: 'Wake up a sleeping builder drone.', test: (s) => s.stats.dronesWoken >= 1 },
  { id: 'builder', title: 'Station Builder', text: 'Finish a module of the base.', test: (s) => s.stats.modulesBuilt >= 1 },
  { id: 'upgrade', title: 'Home Improvement', text: 'Finish a base upgrade.', test: (s) => Object.values(s.projects).some((p) => p.status === 'done') },
  { id: 'spotless', title: 'Spotless', text: 'Get the solar panels above 98% clean.', test: (s) => s.systems.solarClean >= 0.98 },
]);

/** Award any achievements newly earned. Returns the newly earned ones. */
export function checkAchievements(state) {
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements.includes(a.id) && a.test(state)) {
      state.achievements.push(a.id);
      earned.push({ id: a.id, title: a.title, text: a.text });
    }
  }
  return earned;
}

/** Was this storm ridden out safely by everyone? */
export function stormWasSheltered(state) {
  return state.crew.every((c) => c.stormDoseMsv < TUNING.stormShelteredMsv);
}
