/**
 * The simulation: create a game, advance it minute by minute, apply player commands.
 *
 * Pure and deterministic. No DOM, no wall clock, no Math.random(): the same level, seed and
 * commands always give the same result. The state is plain JSON-serialisable data.
 *
 * One minute, in order:
 *   1. environment   — solar storms, dust storms, sunlight
 *   2. crew plan     — everyone decides what to do and takes a step toward it
 *   3. power         — panels, battery, load shedding (knows who is working where)
 *   4. crew act      — work, build, eat, sleep, tire, absorb radiation
 *   5. drones        — awake drones add to the current construction (daylight only)
 *   6. life support  — oxygen, water, hydroponics, wear
 *   7. vitals        — morale and health
 *   8. bookkeeping   — achievements, hints, mission log, end of level
 */
import { LEVEL_BY_ID } from '../data/levels.js';
import { ROOMS, ZONE_LABEL, DRONES, depthMetres } from '../data/base-layout.js';
import donkiSep2024 from '../data/nasa/donki-sep-2024.js';
import { TUNING, SOL_MINUTES, JOBS, PROJECTS } from './constants.js';
import { seedFrom, nextRandom } from './rng.js';
import { createCrewMember, planCrewMember, actCrewMember, stepVitals, jobAvailable } from './crew.js';
import { stepPower, stepLifeSupport, updateAlerts, sunFactor, reserves, batteryCapacity } from './resources.js';
import { stepDrones, constructionRemaining } from './construction.js';
import { QUIET_GCR_MSV_PER_HOUR, roomShielding, shieldingReport, doseRateMsvPerHour } from './radiation.js';
import { stormsFromDonki, makeStorm, minuteAt, minuteFromUtc, stormRateMsvPerHour } from './space-weather.js';
import { checkAchievements, evaluateObjectives, scoreBreakdown, starRating, stormWasSheltered } from './objectives.js';
import { describeEvent } from './messages.js';
import { has } from './util.js';

export const STATE_VERSION = 3;
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
    if (s.utc && !sw.donki) throw new Error(`level ${level.id}: a storm placed by UTC time needs spaceWeather.donki.startDateUtc`);
    const startMinute = s.utc ? minuteFromUtc(s.utc, sw.donki.startDateUtc) : minuteAt(s.sol, s.hour ?? 0);
    storms.push(makeStorm({ id: `scripted-${i + 1}`, startMinute, class: s.class, label: s.label, about: s.about, timing: s.timing, strength: s.strength }));
  });
  // A storm that was completely over before the level begins never happens in the game.
  const firstMinute = level.startHour * 60;
  return storms.filter((s) => s.endMinute > firstMinute).sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * Start a level.
 * @param {string} levelId an id from src/data/levels.js
 * @param {{ seed?: number | string }} [options]
 */
export function createGame(levelId, { seed = 1 } = {}) {
  if (!has(LEVEL_BY_ID, levelId)) throw new Error(`unknown level: ${levelId}`);
  const level = LEVEL_BY_ID[levelId];
  const modules = {};
  for (const id of level.modules.online) modules[id] = { status: 'online', hoursDone: ROOMS[id].buildHours ?? 0 };
  for (const id of level.modules.unfinished) modules[id] = { status: 'unfinished', hoursDone: 0 };
  return {
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
    modules, // { [roomId]: { status: 'online' | 'unfinished', hoursDone } } — rooms not listed do not exist in this level
    drones: [...level.drones.awake.map((id) => ({ id, status: 'awake' })), ...level.drones.dormant.map((id) => ({ id, status: 'dormant' }))],
    construction: null, // { kind: 'module' | 'project', id } — one thing is built at a time
    projects: Object.fromEntries(level.projects.map((id) => [id, { status: 'available', hoursDone: 0, paid: false }])),
    extraShielding: {},
    power: { genKw: 0, loadKw: 0, demandKw: 0, powered: { base: true, o2gen: false, recycler: true, greenhouse: false, lab: false }, shed: [] },
    alerts: { noO2: false, noWater: false, noFood: false, blackout: false },
    shortfall: { o2: 0, water: 0 }, // fraction of this minute's air and water the crew did not get
    emergencies: Object.fromEntries(['noO2', 'noWater', 'noFood', 'blackout'].map((k) => [k, { open: false, clearMinutes: 0 }])),
    env: { gcrMsvPerHour: QUIET_GCR_MSV_PER_HOUR, speMsvPerHour: 0, stormActive: false, dustStorm: null, sun: 0 },
    crew: Object.entries(level.crew).map(([id, job]) => createCrewMember(id, job)),
    storms: buildStorms(level),
    stormEpisode: false, // true from the first storm starting until the last overlapping one ends
    dustStorms: level.dustStorms.map((d) => {
      const startMinute = minuteAt(d.startSol, d.startHour ?? 0);
      return { startMinute, endMinute: startMinute + d.durationSols * SOL_MINUTES, solarFactor: d.solarFactor, dustFactor: d.dustFactor, status: 'pending' };
    }),
    science: 0,
    stats: { foodGrownKg: 0, iceMinedL: 0, emergencies: 0, stormsSheltered: 0, stormsTotal: 0, modulesBuilt: 0, dronesWoken: 0 },
    objectives: level.objectives.map((o) => ({ ...o })),
    achievements: [],
    hintsShown: [],
    log: [],
  };
}

// ---------------------------------------------------------------- environment

/** How far ahead storm warnings arrive right now, in minutes. */
export function warningLeadMinutes(state) {
  const level = LEVEL_BY_ID[state.levelId];
  const comms = state.modules.lab?.status === 'online' ? 1 : TUNING.noCommsLeadFactor; // the surface antenna is bent
  const antenna = state.projects.antenna?.status === 'done' ? 2 : 1;
  return Math.round(level.warningLeadMinutes * comms * antenna);
}

/**
 * Advance every storm's status and return the surface storm dose rate for this minute.
 * Two passes, so that decisions about the episode (reset doses, all-clear) are made from
 * the complete picture rather than half-way through the list.
 */
function updateStorms(state, lead, events) {
  // Pass 1 — warnings and starts.
  for (const s of state.storms) {
    if (s.status !== 'pending' && s.status !== 'warned') continue;
    if (state.minute >= s.endMinute) {
      s.status = 'done'; // its whole duration is already behind us: it never ran, no credit
    } else if (state.minute >= s.startMinute) {
      s.status = 'active';
      if (!state.stormEpisode) {
        state.stormEpisode = true;
        for (const c of state.crew) c.stormDoseMsv = 0;
      }
      events.push({ type: 'storm-start', storm: s.id, class: s.class, label: s.label, about: s.about });
    } else if (s.status === 'pending' && state.minute >= s.startMinute - lead) {
      s.status = 'warned';
      events.push({ type: 'storm-warning', storm: s.id, class: s.class, label: s.label, about: s.about, minutesUntil: s.startMinute - state.minute, timing: s.timing, strength: s.strength });
    }
  }
  // Pass 2 — ends.
  let ended = null;
  for (const s of state.storms) {
    if (s.status === 'active' && state.minute >= s.endMinute) {
      s.status = 'done';
      ended = s;
    }
  }
  const active = state.storms.filter((s) => s.status === 'active');
  if (ended && active.length === 0) endStormEpisode(state, ended, events);
  let rate = 0;
  for (const s of active) rate += stormRateMsvPerHour(s, state.minute);
  return { rate, active: active.length > 0 };
}

/** The last overlapping storm has ended: score the episode and lift the shelter order if allowed. */
function endStormEpisode(state, storm, events) {
  const worst = state.crew.reduce((a, b) => (a.stormDoseMsv >= b.stormDoseMsv ? a : b));
  const sheltered = stormWasSheltered(state);
  state.stormEpisode = false;
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

function updateEnvironment(state, level, clock, events) {
  const storm = updateStorms(state, warningLeadMinutes(state), events);

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

  state.env = { gcrMsvPerHour: QUIET_GCR_MSV_PER_HOUR, speMsvPerHour: storm.rate, stormActive: storm.active, dustStorm, sun: sunFactor(clock.hourFloat) };
}

/** Extra shielding layers per zone, from finished upgrades (newest layer outermost). Derived data. */
export function extraShieldingFrom(projects) {
  const extra = {};
  for (const [id, p] of Object.entries(projects)) {
    if (!has(PROJECTS, id) || p.status !== 'done') continue;
    const shielding = PROJECTS[id].shielding;
    if (!shielding) continue;
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
  // A storm still under way when the level ends is settled on the dose received so far,
  // so riding it out underground still counts.
  const raging = state.storms.filter((s) => s.status === 'active');
  if (raging.length) {
    for (const s of raging) s.status = 'done';
    endStormEpisode(state, raging[raging.length - 1], events);
  }
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
  for (const c of state.crew) planCrewMember(state, c, clock);
  stepPower(state, clock);
  for (const c of state.crew) actCrewMember(state, c, clock, events);
  stepDrones(state, clock, events);
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
 *   { type: 'wakeDrone', drone }        a dormant drone wakes (sent when DroneRepairMiniGame is won)
 *   { type: 'buildModule', module }     start or resume finishing an unfinished module
 *   { type: 'startProject', project }   start or resume an upgrade (pays its costs once)
 *   { type: 'pauseConstruction' }       put the current construction on hold
 * Never throws on bad input.
 * @returns {{ ok: true, events: object[] } | { ok: false, error: string }}
 */
export function applyCommand(state, cmd) {
  const fail = (error) => ({ ok: false, error });
  if (state.status !== 'running') return fail('The level is over.');
  const level = LEVEL_BY_ID[state.levelId];
  const events = [];
  const busy = () => (state.construction ? 'Finish or pause the current construction first.' : null);
  switch (cmd?.type) {
    case 'assign': {
      const c = state.crew.find((m) => m.id === cmd.crew);
      if (!c) return fail(`Unknown crew member: ${cmd.crew}`);
      if (!has(JOBS, cmd.job) || !level.jobs.includes(cmd.job)) return fail(`That job is not available in this level: ${cmd.job}`);
      if (!jobAvailable(state, cmd.job)) return fail(`That job needs the ${ROOMS[JOBS[cmd.job].needs].name}, which is not finished yet.`);
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
    case 'wakeDrone': {
      const drone = state.drones.find((d) => d.id === cmd.drone);
      if (!drone || !has(DRONES, drone.id)) return fail(`Unknown drone: ${cmd.drone}`);
      if (drone.status === 'awake') return fail(`${DRONES[drone.id].name} is already awake.`);
      drone.status = 'awake';
      state.stats.dronesWoken += 1;
      events.push({ type: 'drone-awake', drone: drone.id, name: DRONES[drone.id].name });
      break;
    }
    case 'buildModule': {
      if (!has(state.modules, cmd.module) || !has(ROOMS, cmd.module)) return fail(`That module is not part of this level: ${cmd.module}`);
      if (state.modules[cmd.module].status === 'online') return fail(`${ROOMS[cmd.module].name} is already finished.`);
      if (busy()) return fail(busy());
      state.construction = { kind: 'module', id: cmd.module };
      events.push({ type: 'construction-started', kind: 'module', id: cmd.module, title: ROOMS[cmd.module].name });
      break;
    }
    case 'startProject': {
      if (!has(state.projects, cmd.project) || !has(PROJECTS, cmd.project)) return fail(`That upgrade is not available in this level: ${cmd.project}`);
      const p = state.projects[cmd.project];
      const def = PROJECTS[cmd.project];
      if (p.status === 'done') return fail('That upgrade is already finished.');
      if (def.needs && state.modules[def.needs]?.status !== 'online') return fail(`Upgrades need the ${ROOMS[def.needs].name}, which is not finished yet.`);
      if (busy()) return fail(busy());
      if (!p.paid) {
        // Materials are paid for once, when the upgrade is first started.
        for (const [res, amount] of Object.entries(def.costs)) {
          if (state.resources[res] < amount) return fail(`Not enough ${res === 'waterL' ? 'water' : res}: needs ${amount}.`);
        }
        for (const [res, amount] of Object.entries(def.costs)) state.resources[res] -= amount;
        p.paid = true;
      }
      state.construction = { kind: 'project', id: cmd.project };
      events.push({ type: 'construction-started', kind: 'project', id: cmd.project, title: def.title });
      break;
    }
    case 'pauseConstruction':
      if (!state.construction) return fail('Nothing is being built.');
      state.construction = null;
      break;
    default:
      return fail(`Unknown command: ${cmd?.type}`);
  }
  writeLog(state, events, 0, state.minute);
  return { ok: true, events };
}

// ---------------------------------------------------------------- read-only views

/** Everything the UI needs to explain one room, including why it is safe or not. */
export function roomReport(state, roomId) {
  if (!has(ROOMS, roomId)) throw new Error(`unknown room: ${roomId}`);
  const room = ROOMS[roomId];
  const layers = roomShielding(roomId, state.extraShielding);
  return {
    id: roomId,
    name: room.name,
    about: room.about,
    zone: room.zone,
    zoneLabel: ZONE_LABEL[room.zone],
    depthMetres: depthMetres(roomId),
    module: room.module ? { status: has(state.modules, roomId) ? state.modules[roomId].status : 'absent', hoursDone: state.modules[roomId]?.hoursDone ?? 0, buildHours: room.buildHours ?? 0, inScenario: room.inScenario } : null,
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
    batteryCapacityKwh: batteryCapacity(state),
    reserves: reserves(state),
    systems: { ...state.systems },
    power: { genKw: state.power.genKw, loadKw: state.power.loadKw, shed: [...state.power.shed] },
    modules: Object.fromEntries(Object.entries(state.modules).map(([id, m]) => [id, m.status])),
    drones: state.drones.map((d) => ({ ...d })),
    construction: state.construction ? { ...state.construction, hoursLeft: constructionRemaining(state) } : null,
    warningLeadMinutes: warningLeadMinutes(state),
    surfaceDoseRateMsvPerHour: doseRateMsvPerHour(state.env, []),
    stormActive: state.env.stormActive,
    shelterOrder: state.shelterOrder,
    science: state.science,
    score: scoreBreakdown(state).total,
    crew: state.crew.map((c) => ({ id: c.id, name: c.name, job: c.job, activity: c.activity, location: c.location, doseMsv: c.doseMsv, grounded: c.grounded, ...c.stats })),
  };
}
