/**
 * Construction: finishing the unfinished modules, and building upgrades.
 *
 * Story (SCENARIO.md plus the team's clarification): builder drones began the base, a dust
 * storm stopped them, then people arrived — and the people carry on building. So:
 *   - the crew build: anyone with the "Build" job works at the construction site;
 *   - drones that have been woken help automatically, by daylight (they are solar powered).
 * One thing is under construction at a time: `state.construction = { kind, id }`.
 */
import { TUNING, PROJECTS } from './constants.js';
import { ROOMS } from '../data/base-layout.js';

/** Where the work is happening right now, or null if nothing is being built. */
export function constructionSite(state) {
  const c = state.construction;
  if (!c) return null;
  return c.kind === 'module' ? c.id : PROJECTS[c.id].site;
}

/** Work-hours still needed for the current construction (0 if none). */
export function constructionRemaining(state) {
  const c = state.construction;
  if (!c) return 0;
  return c.kind === 'module' ? ROOMS[c.id].buildHours - state.modules[c.id].hoursDone : PROJECTS[c.id].hours - state.projects[c.id].hoursDone;
}

/** Add work-hours to the current construction and finish it when it has enough. */
export function addConstructionWork(state, hours, events) {
  const c = state.construction;
  if (!c || !(hours > 0)) return;
  if (c.kind === 'module') {
    const m = state.modules[c.id];
    m.hoursDone = Math.min(ROOMS[c.id].buildHours, m.hoursDone + hours);
    if (m.hoursDone >= ROOMS[c.id].buildHours) {
      m.status = 'online';
      state.construction = null;
      state.stats.modulesBuilt += 1;
      events.push({ type: 'module-built', module: c.id, name: ROOMS[c.id].name });
    }
  } else {
    const p = state.projects[c.id];
    p.hoursDone = Math.min(PROJECTS[c.id].hours, p.hoursDone + hours);
    if (p.hoursDone >= PROJECTS[c.id].hours) {
      p.status = 'done';
      state.construction = null;
      events.push({ type: 'project-done', project: c.id, title: PROJECTS[c.id].title });
    }
  }
}

/** Awake drones add their share of work for this minute. They only work in daylight. */
export function stepDrones(state, clock, events) {
  if (!state.construction || !clock.isDay) return;
  const awake = state.drones.filter((d) => d.status === 'awake').length;
  if (awake > 0) addConstructionWork(state, (awake * TUNING.droneBuildHoursPerHour) / 60, events);
}
