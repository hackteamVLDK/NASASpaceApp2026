/**
 * The simulation: create a game, advance it minute by minute, apply player commands.
 *
 * Pure and deterministic. No DOM, no wall clock, no Math.random(): the same level, seed and
 * commands always give the same result. The state is plain JSON-serialisable data.
 *
 * One minute, in order:
 *   1. environment   — solar storms, dust storms, sunlight
 *   2. power         — panels, battery, load shedding
 *   3. crew          — decide, walk, work, eat, sleep, absorb radiation
 *   4. life support  — oxygen, water, greenhouse, wear
 *   5. vitals        — morale and health
 *   6. bookkeeping   — achievements, hints, mission log, end of level
 */
import { LEVEL_BY_ID } from '../data/levels.js';
import { ROOMS, ZONE_LABEL } from '../data/base-layout.js';
import donkiSep2024 from '../data/nasa/donki-sep-2024.js';
import { TUNING, SOL_MINUTES, JOBS, PROJECTS } from './constants.js';
import { seedFrom, nextRandom } from './rng.js';
import { createCrewMember, stepCrewMember, stepVitals } from './crew.js';
import { stepPower, stepLifeSupport, updateAlerts, sunFactor, reserves } from './resources.js';
import { QUIET_GCR_MSV_PER_HOUR, roomShielding, shieldingReport, doseRateMsvPerHour } from './radiation.js';
import { stormsFromDonki, makeStorm, minuteAt, minuteFromUtc, stormRateMsvPerHour } from './space-weather.js';
import { checkAchievements, evaluateObjectives, scoreBreakdown, starRating, stormWasSheltered } from './objectives.js';
import { describeEvent } from './messages.js';

export const STATE_VERSION = 1;
const LOG_LIMIT = 120;

// ---------------------------------------------------------------- clock

/** Break a mission minute into sol, hour and minute. Sol 1 starts at mission minute 0. */
export function clockAt(minute) {
  const minuteOfSol = minute % SOL_MINUTES;
  const hourFloat = minuteOfSol / 60;
  return {
    sol: Math.floor(minute / SOL_MINUTES) + 1,
    hour: Math.floor(hourFloat),
    minute: minuteOfSol % 60,
    minuteOfSol,
    hourFloat,
    isDay: hourFloat > TUNING.sunriseHour && hourFloat < TUNING.sunsetHour,
  };
}

// ---------------------------------------------------------------- setup

function buildStorms(level) {
  const sw = level.spaceWeather;
  const storms = sw.donki ? stormsFromDonki(donkiSep2024, { startDateUtc: sw.donki.startDateUtc, sols: level.lengthSols }) : [];
  sw.scripted.forEach((s, i) => {
    const startMinute = s.utc ? minuteFromUtc(s.utc, sw.donki.startDateUtc) : minuteAt(s.sol, s.hour ?? 0);
    storms.push(makeStorm({ id: `scripted-${i + 1}`, startMinute, class: s.class, label: s.label, timing: s.timing, strength: s.strength }));
  });
  return storms.sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * Start a level.
 * @param {string} levelId an id from src/data/levels.js
 * @param {{ seed?: number | string }} [options]
 */
export function createGame(levelId, { seed = 1 } = {}) {
  const level = LEVEL_BY_ID[levelId];
  if (!level) throw new Error(`unknown level: ${levelId}`);
  const state = {
    version: STATE_VERSION,
    levelId,
    seed,
    rng: seedFrom(seed),
    status: 'running', // running | complete | failed
    result: null,
    minute: level.startHour * 60,
    endMinute: level.lengthSols * SOL_MINUTES,
    doseBudgetMsv: level.doseBudgetMsv,
    shelterOrder: false,
    autoAllClear: true,
    resources: { ...level.start.resources },
    systems: { ...level.start.systems },
    power: { genKw: 0, loadKw: 0, demandKw: 0, powered: { base: true, o2gen: false, recycler: true, greenhouse: true, lab: false }, shed: [] },
    alerts: { noO2: false, noWater: false, noFood: false, blackout: false },
    emergencies: Object.fromEntries(['noO2', 'noWater', 'noFood', 'blackout'].map((k) => [k, { open: false, clearMinutes: 0 }])),
    env: { gcrMsvPerHour: QUIET_GCR_MSV_PER_HOUR, speMsvPerHour: 0, stormActive: false, dustStorm: null, sun: 0 },
    crew: Object.entries(level.crew).map(([id, job]) => createCrewMember(id, job)),
    projects: Object.fromEntries(level.projects.map((id) => [id, { status: 'available', hoursDone: 0, paid: false }])),
    extraShielding: {},
    storms: buildStorms(level),
    dustStorms: level.dustStorms.map((d) => {
      const startMinute = minuteAt(d.startSol, d.startHour ?? 0);
      return { startMinute, endMinute: startMinute + d.durationSols * SOL_MINUTES, solarFactor: d.solarFactor, dustFactor: d.dustFactor, status: 'pending' };
    }),
    science: 0,
    stats: { foodGrownKg: 0, iceMinedL: 0, emergencies: 0, stormsSheltered: 0, stormsTotal: 0 },
    objectives: level.objectives.map((o) => ({ ...o })),
    achievements: [],
    hintsShown: [],
    log: [],
  };
  return state;
}

// ---------------------------------------------------------------- environment

function updateEnvironment(state, level, clock, events) {
  const lead = level.warningLeadMinutes * (state.projects.stormWatch?.status === 'done' ? 2 : 1);
  let spe = 0;
  let active = false;

  for (const s of state.storms) {
    if (s.status === 'done') continue;
    if (s.status === 'pending' && state.minute >= s.startMinute - lead && state.minute < s.startMinute) {
      s.status = 'warned';
      events.push({ type: 'storm-warning', storm: s.id, class: s.class, label: s.label, minutesUntil: s.startMinute - state.minute, timing: s.timing, strength: s.strength });
    }
    if ((s.status === 'pending' || s.status === 'warned') && state.minute >= s.startMinute) {
      const episodeInProgress = state.storms.some((o) => o.status === 'active');
      s.status = 'active';
      if (!episodeInProgress) for (const c of state.crew) c.stormDoseMsv = 0;
      events.push({ type: 'storm-start', storm: s.id, class: s.class, label: s.label });
    }
    if (s.status === 'active') {
      if (state.minute >= s.endMinute) {
        s.status = 'done';
        if (!state.storms.some((o) => o.status === 'active')) endStormEpisode(state, s, events);
      } else {
        spe += stormRateMsvPerHour(s, state.minute);
        active = true;
      }
    }
  }

  let dustStorm = null;
  for (const d of state.dustStorms) {
    if (d.status === 'pending' && state.minute >= d.startMinute) {
      d.status = 'active';
      events.push({ type: 'dust-storm-start', solarFactor: d.solarFactor });
    }
    if (d.status === 'active') {
      if (state.minute >= d.endMinute) {
        d.status = 'done';
        events.push({ type: 'dust-storm-end' });
      } else {
        dustStorm = { solarFactor: d.solarFactor, dustFactor: d.dustFactor };
      }
    }
  }

  // A passing dust devil can blow the panels clean (it really happened to Spirit and Opportunity).
  if (level.dustDevilChance > 0 && clock.minuteOfSol === 13 * 60) {
    const lucky = nextRandom(state) < level.dustDevilChance;
    if (lucky && state.systems.solarClean < 0.9) {
      state.systems.solarClean = Math.min(1, state.systems.solarClean + TUNING.dustDevilCleaning);
      events.push({ type: 'dust-devil' });
    }
  }

  state.env = { gcrMsvPerHour: QUIET_GCR_MSV_PER_HOUR, speMsvPerHour: spe, stormActive: active, dustStorm, sun: sunFactor(clock.hourFloat) };
}

function endStormEpisode(state, storm, events) {
  const worst = state.crew.reduce((a, b) => (a.stormDoseMsv >= b.stormDoseMsv ? a : b));
  const sheltered = stormWasSheltered(state);
  state.stats.stormsTotal += 1;
  if (sheltered) state.stats.stormsSheltered += 1;
  events.push({
    type: 'storm-end',
    storm: storm.id,
    sheltered,
    maxDoseMsv: worst.stormDoseMsv,
    maxDoseName: worst.name,
    doses: state.crew.map((c) => ({ crew: c.id, name: c.name, doseMsv: c.stormDoseMsv })),
  });
  const moreComing = state.storms.some((o) => o.status === 'warned' || o.status === 'active');
  if (state.shelterOrder && state.autoAllClear && !moreComing) {
    state.shelterOrder = false;
    events.push({ type: 'all-clear' });
  }
}

/** Extra shielding layers per zone, from finished projects (newest layer outermost). */
function extraShieldingFrom(projects) {
  const extra = {};
  for (const [id, p] of Object.entries(projects)) {
    const shielding = PROJECTS[id].shielding;
    if (p.status !== 'done' || !shielding) continue;
    for (const zone of shielding.zones) (extra[zone] ??= []).push({ ...shielding.layer });
  }
  return extra;
}

// ---------------------------------------------------------------- hints and log

function runHints(state, level, events, firstNewEvent) {
  for (const h of level.hints) {
    if (state.hintsShown.includes(h.id)) continue;
    const t = h.trigger;
    let fire = false;
    if (t.at) fire = state.minute >= minuteAt(t.at.sol, t.at.hour ?? 0);
    else if (t.event) fire = events.slice(firstNewEvent).some((e) => e.type === t.event);
    else if (t.resourceBelow) fire = Object.entries(t.resourceBelow).some(([k, v]) => state.resources[k] < v);
    else if (t.systemBelow) fire = Object.entries(t.systemBelow).some(([k, v]) => state.systems[k] < v);
    if (fire) {
      state.hintsShown.push(h.id);
      events.push({ type: 'hint', id: h.id, text: h.text });
    }
  }
}

function writeLog(state, events, firstNewEvent, minute) {
  for (const e of events.slice(firstNewEvent)) {
    const line = describeEvent(e);
    if (!line) continue;
    state.log.push({ minute, level: line.level, text: line.text });
  }
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

function finish(state, status, reason, events) {
  state.status = status;
  state.result = {
    status,
    reason,
    stars: 0,
    score: scoreBreakdown(state),
    objectives: evaluateObjectives(state, true),
    achievements: [...state.achievements],
    stats: { ...state.stats, science: state.science, highestDoseMsv: Math.max(...state.crew.map((c) => c.doseMsv)) },
  };
  state.result.stars = starRating(state);
  events.push({ type: status === 'complete' ? 'level-complete' : 'level-failed', result: state.result });
}

// ---------------------------------------------------------------- stepping

function stepOneMinute(state, events) {
  const level = LEVEL_BY_ID[state.levelId];
  const clock = clockAt(state.minute);
  const firstNewEvent = events.length;
  const minute = state.minute;

  if (clock.minuteOfSol === 0) events.push({ type: 'sol-start', sol: clock.sol });
  updateEnvironment(state, level, clock, events);
  stepPower(state, clock);
  for (const c of state.crew) stepCrewMember(state, c, clock, events);
  if (events.slice(firstNewEvent).some((e) => e.type === 'project-done')) state.extraShielding = extraShieldingFrom(state.projects);
  stepLifeSupport(state);
  updateAlerts(state, events);
  for (const c of state.crew) stepVitals(state, c);
  for (const a of checkAchievements(state)) events.push({ type: 'achievement', ...a });
  runHints(state, level, events, firstNewEvent);

  state.minute += 1;
  const down = state.crew.find((c) => c.stats.health <= 0);
  if (down) finish(state, 'failed', `${down.name} needs emergency medical evacuation.`, events);
  else if (state.minute >= state.endMinute) finish(state, 'complete', 'The crew reached the end of the mission.', events);
  writeLog(state, events, firstNewEvent, minute);
}

/**
 * Advance the simulation.
 * @param state game state from createGame() or a loaded save; it is modified in place
 * @param {number} [minutes] whole simulation minutes to advance
 * @returns {Array<object>} events that happened, in order (see messages.js for the types)
 */
export function step(state, minutes = 1) {
  const events = [];
  for (let i = 0; i < minutes && state.status === 'running'; i++) stepOneMinute(state, events);
  return events;
}

// ---------------------------------------------------------------- commands

/**
 * Apply a player command.
 *   { type: 'assign', crew, job }       give an astronaut a job
 *   { type: 'shelter', on }             give or lift the shelter order
 *   { type: 'autoAllClear', on }        lift the shelter order automatically when storms end
 *   { type: 'startProject', project }   start a base upgrade (pays its costs)
 *   { type: 'pauseProject' }            put the active project on hold
 * @returns {{ ok: true, events: object[] } | { ok: false, error: string }}
 */
export function applyCommand(state, cmd) {
  const fail = (error) => ({ ok: false, error });
  if (state.status !== 'running') return fail('The level is over.');
  const level = LEVEL_BY_ID[state.levelId];
  const events = [];
  switch (cmd?.type) {
    case 'assign': {
      const c = state.crew.find((m) => m.id === cmd.crew);
      if (!c) return fail(`Unknown crew member: ${cmd.crew}`);
      if (!level.jobs.includes(cmd.job)) return fail(`That job is not available in this level: ${cmd.job}`);
      if (c.job !== cmd.job) {
        c.job = cmd.job;
        events.push({ type: 'assigned', crew: c.id, name: c.name, job: cmd.job, jobLabel: JOBS[cmd.job].label });
      }
      break;
    }
    case 'shelter': {
      const on = Boolean(cmd.on);
      if (state.shelterOrder !== on) {
        state.shelterOrder = on;
        events.push({ type: 'shelter-order', on });
      }
      break;
    }
    case 'autoAllClear':
      state.autoAllClear = Boolean(cmd.on);
      break;
    case 'startProject': {
      const p = state.projects[cmd.project];
      if (!p) return fail(`That project is not available in this level: ${cmd.project}`);
      if (p.status === 'done') return fail('That project is already finished.');
      if (p.status === 'active') return fail('That project is already under way.');
      if (Object.values(state.projects).some((o) => o.status === 'active')) return fail('Finish or pause the current project first.');
      const def = PROJECTS[cmd.project];
      if (!p.paid) {
        // Materials are paid for once, when the project is first started.
        for (const [res, amount] of Object.entries(def.costs)) {
          if (state.resources[res] < amount) return fail(`Not enough ${res === 'waterL' ? 'water' : res}: needs ${amount}.`);
        }
        for (const [res, amount] of Object.entries(def.costs)) state.resources[res] -= amount;
        p.paid = true;
      }
      p.status = 'active';
      events.push({ type: 'project-started', project: cmd.project, title: def.title });
      break;
    }
    case 'pauseProject': {
      const id = Object.keys(state.projects).find((k) => state.projects[k].status === 'active');
      if (!id) return fail('No project is under way.');
      state.projects[id].status = 'available';
      break;
    }
    default:
      return fail(`Unknown command: ${cmd?.type}`);
  }
  writeLog(state, events, 0, state.minute);
  return { ok: true, events };
}

// ---------------------------------------------------------------- read-only views

/** Everything the UI needs to explain one room, including why it is safe or not. */
export function roomReport(state, roomId) {
  const room = ROOMS[roomId];
  if (!room) throw new Error(`unknown room: ${roomId}`);
  const layers = roomShielding(roomId, state.extraShielding);
  return {
    id: roomId,
    name: room.name,
    about: room.about,
    zone: room.zone,
    zoneLabel: ZONE_LABEL[room.zone],
    shielding: shieldingReport(layers),
    doseRateMsvPerHour: doseRateMsvPerHour(state.env, layers),
    surfaceDoseRateMsvPerHour: doseRateMsvPerHour(state.env, []),
    occupants: state.crew.filter((c) => c.location === roomId && !c.move).map((c) => c.id),
  };
}

/** A compact snapshot for dashboards, tests and balance scripts. */
export function summary(state) {
  const clock = clockAt(state.minute);
  return {
    status: state.status,
    sol: clock.sol,
    time: `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`,
    resources: { ...state.resources },
    reserves: reserves(state),
    systems: { ...state.systems },
    power: { genKw: state.power.genKw, loadKw: state.power.loadKw, shed: [...state.power.shed] },
    surfaceDoseRateMsvPerHour: doseRateMsvPerHour(state.env, []),
    stormActive: state.env.stormActive,
    shelterOrder: state.shelterOrder,
    science: state.science,
    score: scoreBreakdown(state).total,
    crew: state.crew.map((c) => ({ id: c.id, name: c.name, job: c.job, activity: c.activity, location: c.location, doseMsv: c.doseMsv, grounded: c.grounded, ...c.stats })),
  };
}
