/**
 * Crew behaviour: what each astronaut wants to do this minute, walking there, doing it,
 * and what it does to them.
 *
 * Priority of what an astronaut does:
 *   1. exhausted            -> sleep, whatever the schedule says
 *   2. the daily schedule   -> sleep / meal / exercise / free time / work
 *   3. during work hours    -> the assigned job (or recovery if medically grounded)
 * A shelter order then overrides any destination that is not underground: the astronaut
 * waits in the storm shelter instead.
 */
import { TUNING, DEFAULT_SCHEDULE, JOBS, PROJECTS, EARTH_DAYS_PER_SIM_MINUTE } from './constants.js';
import { ROOMS } from '../data/base-layout.js';
import { CREW } from '../data/crew.js';
import { shortestPath, edgeMinutes, travelMinutes } from './pathfinding.js';
import { doseForOneMinute, roomShielding } from './radiation.js';
import { clamp, has } from './util.js';

const UNDERGROUND = new Set(['upper', 'deep']);

export function createCrewMember(id, job) {
  if (!has(CREW, id)) throw new Error(`unknown crew member: ${id}`);
  const def = CREW[id];
  return {
    id,
    name: def.name,
    role: def.role,
    job,
    activity: 'sleep',
    location: 'quarters',
    move: null, // { from, to, total, left, rest: [...], dest }
    stats: { health: 100, morale: 75, energy: 90, nutrition: 85, fitness: 80 },
    doseMsv: 0,
    stormDoseMsv: 0,
    doseWarned: false,
    grounded: false,
    forcedSleep: false,
    mealHour: -1,
    mealMinutes: 0,
  };
}

/** Is this meal slot in the middle of a work shift (so field teams eat where they are)? */
function isMidShiftMeal(hour) {
  return DEFAULT_SCHEDULE[hour] === 'meal' && DEFAULT_SCHEDULE[hour - 1] === 'work' && DEFAULT_SCHEDULE[hour + 1] === 'work';
}

function activeProject(state) {
  const id = Object.keys(state.projects).find((p) => state.projects[p].status === 'active');
  return id ? { id, ...PROJECTS[id] } : null;
}

/** Where the job takes place right now, or null if there is nothing to do. */
function jobNode(state, c) {
  if (c.job === 'build') return activeProject(state)?.site ?? null;
  return JOBS[c.job].node;
}

/** What the astronaut should be doing this minute, and where. */
export function desiredActivity(state, c, clock) {
  const slot = DEFAULT_SCHEDULE[clock.hour];
  let want;
  // An exhausted astronaut sleeps whatever the schedule says — except at meal times:
  // they still eat first, otherwise tiredness would turn into hunger.
  if (slot === 'sleep' || (c.forcedSleep && slot !== 'meal')) {
    want = { activity: 'sleep', node: 'quarters' };
  } else if (slot === 'meal') {
    const hourIndex = clock.sol * 24 + clock.hour;
    const alreadyAte = c.mealHour === hourIndex && c.mealMinutes >= TUNING.mealMinutes;
    // A field team at the exploration site eats its packed lunch there instead of walking home.
    const inTheField = isMidShiftMeal(clock.hour) && (c.location === 'away' || c.move?.to === 'away');
    if (inTheField) want = { activity: alreadyAte ? 'free' : 'meal', node: 'away' };
    else want = { activity: alreadyAte ? 'free' : 'meal', node: 'galley' };
  } else if (slot === 'exercise') {
    want = { activity: 'exercise', node: 'galley' };
  } else if (slot === 'free') {
    want = { activity: 'free', node: 'galley' };
  } else if (c.grounded) {
    want = { activity: 'recover', node: 'quarters' };
  } else {
    const node = jobNode(state, c);
    // Outdoor work only happens in daylight and stops early enough to be home before dark.
    const outdoor = node && ROOMS[node].zone === 'outdoor';
    const tooLate = outdoor && (!clock.isDay || clock.hour >= TUNING.evaEndHour);
    want = node && c.job !== 'rest' && !tooLate ? { activity: 'work', node } : { activity: 'free', node: 'galley' };
  }
  if (state.shelterOrder && !UNDERGROUND.has(ROOMS[want.node].zone)) {
    want = { activity: 'shelter', node: 'shelter' };
  }
  return want;
}

// ---------------------------------------------------------------- walking

function startRoute(c, target) {
  const route = shortestPath(c.location, target).nodes;
  const to = route[0];
  const total = edgeMinutes(c.location, to);
  c.move = { from: c.location, to, total, left: total, rest: route.slice(1), dest: target };
}

/** Change destination while walking. Turns around mid-way if that is quicker. */
function retarget(c, target) {
  const m = c.move;
  const onward = m.left + travelMinutes(m.to, target);
  const back = m.total - m.left + travelMinutes(m.from, target);
  if (back < onward) {
    [m.from, m.to] = [m.to, m.from];
    m.left = m.total - m.left;
  }
  m.rest = shortestPath(m.to, target).nodes;
  m.dest = target;
}

/** Advance walking by one minute. Returns true if the minute was spent walking. */
function stepMovement(c, target) {
  if (!c.move) {
    if (c.location === target) return false;
    startRoute(c, target);
  } else if (c.move.dest !== target) {
    retarget(c, target);
  }
  const m = c.move;
  m.left -= 1;
  if (m.left <= 0) {
    c.location = m.to;
    if (m.rest.length) {
      const to = m.rest[0];
      const total = edgeMinutes(c.location, to);
      c.move = { from: c.location, to, total, left: total, rest: m.rest.slice(1), dest: m.dest };
    } else {
      c.move = null;
    }
  }
  return true;
}

// ---------------------------------------------------------------- working

/** How productive an astronaut is: tired, hungry or unhappy people work slower. */
export function workMultiplier(c, skill) {
  const s = c.stats;
  const condition = (s.energy + s.nutrition + s.morale) / 300;
  let bonus = 1;
  if (skill && c.role === skill) bonus = TUNING.skillBonus;
  else if (c.role === 'commander') bonus = TUNING.commanderBonus;
  return (TUNING.workFloor + (1 - TUNING.workFloor) * condition) * bonus;
}

function doWork(state, c, events) {
  const T = TUNING;
  const job = JOBS[c.job];
  const perMinute = workMultiplier(c, job.skill) / 60;
  const sys = state.systems;
  const res = state.resources;
  switch (c.job) {
    case 'farm':
      if (state.power.powered.greenhouse && res.waterL > 0) {
        const grown = T.cropKgPerWorkHour * perMinute;
        res.foodKg += grown;
        res.o2Kg += grown * T.cropO2PerKgFood;
        state.stats.foodGrownKg += grown;
      }
      break;
    case 'lifesupport':
      sys.o2GenEff = Math.min(1, sys.o2GenEff + T.maintenancePerHour * perMinute);
      sys.recyclerEff = Math.min(1, sys.recyclerEff + T.maintenancePerHour * perMinute);
      break;
    case 'solar':
      sys.solarClean = Math.min(1, sys.solarClean + T.dustCleanPerHour * perMinute);
      break;
    case 'explore': {
      state.science += T.scienceEvaPerHour * perMinute;
      // Ice is hauled, not studied: no specialist bonus.
      const ice = T.iceLPerWorkHour * (workMultiplier(c, null) / 60);
      res.waterL += ice;
      state.stats.iceMinedL += ice;
      break;
    }
    case 'research':
      if (state.power.powered.lab) state.science += T.scienceLabPerHour * perMinute;
      break;
    case 'build': {
      const id = Object.keys(state.projects).find((p) => state.projects[p].status === 'active');
      if (!id) break;
      const project = state.projects[id];
      project.hoursDone += perMinute;
      if (project.hoursDone >= PROJECTS[id].hours) {
        project.hoursDone = PROJECTS[id].hours;
        project.status = 'done';
        events.push({ type: 'project-done', project: id, title: PROJECTS[id].title });
      }
      break;
    }
    default:
      break;
  }
}

function eat(state, c, clock) {
  const hourIndex = clock.sol * 24 + clock.hour;
  if (c.mealHour !== hourIndex) {
    c.mealHour = hourIndex;
    c.mealMinutes = 0;
  }
  if (c.mealMinutes >= TUNING.mealMinutes) return;
  // One sol's ration is spread over three full meals.
  const ration = (TUNING.foodKgPerCrewDay * EARTH_DAYS_PER_SIM_MINUTE * 1440) / (3 * TUNING.mealMinutes);
  if (state.resources.foodKg <= 0) return;
  const eaten = Math.min(ration, state.resources.foodKg);
  state.resources.foodKg -= eaten;
  c.stats.nutrition = clamp(c.stats.nutrition + TUNING.mealGainPerMin * (eaten / ration));
  c.mealMinutes += 1;
}

// ---------------------------------------------------------------- one minute of one life

/**
 * First half of an astronaut's minute: decide what to do and take a step toward it.
 * Sets `c.activity`. Runs for the whole crew before power is allocated, so the power step
 * knows who is really working where.
 */
export function planCrewMember(state, c, clock) {
  const T = TUNING;
  if (!c.forcedSleep && c.stats.energy <= T.forcedSleepBelow) c.forcedSleep = true;
  if (c.forcedSleep && c.stats.energy >= T.forcedSleepUntil) c.forcedSleep = false;
  const want = desiredActivity(state, c, clock);
  const walking = stepMovement(c, want.node);
  c.activity = walking ? 'walk' : want.activity;
}

/** Second half: do the activity, tire, get hungry, absorb radiation. */
export function actCrewMember(state, c, clock, events) {
  const T = TUNING;
  const s = c.stats;
  const slot = DEFAULT_SCHEDULE[clock.hour];
  const walking = c.activity === 'walk';
  const outdoors = ROOMS[c.location].zone === 'outdoor';

  let resting = false;
  if (!walking) {
    switch (c.activity) {
      case 'sleep':
        s.energy = clamp(s.energy + T.sleepGainPerMin);
        resting = true;
        break;
      case 'shelter':
        // Life goes on in the shelter: rations at meal times, uneasy sleep at night.
        if (slot === 'meal') eat(state, c, clock);
        if (slot === 'sleep' || c.forcedSleep) {
          s.energy = clamp(s.energy + T.sleepGainPerMin * T.shelterSleepFactor);
          resting = true;
        }
        break;
      case 'meal':
        eat(state, c, clock);
        break;
      case 'exercise':
        s.fitness = clamp(s.fitness + T.exerciseGainPerMin);
        break;
      case 'work':
        doWork(state, c, events);
        break;
      default:
        break; // free, recover
    }
  }

  if (!resting) s.energy = clamp(s.energy - T.energyDrainPerMin * (outdoors ? T.evaEnergyFactor : 1));
  s.nutrition = clamp(s.nutrition - T.nutritionDrainPerMin);
  s.fitness = clamp(s.fitness - T.fitnessDrainPerMin);

  // Radiation: depends on the conditions outside right now and on what is overhead here.
  const dose = doseForOneMinute(state.env, roomShielding(c.location, state.extraShielding));
  c.doseMsv += dose;
  if (state.env.stormActive) c.stormDoseMsv += dose;
  const budget = state.doseBudgetMsv;
  if (!c.doseWarned && c.doseMsv >= budget * T.doseWarningFraction) {
    c.doseWarned = true;
    events.push({ type: 'dose-warning', crew: c.id, name: c.name, doseMsv: c.doseMsv, budgetMsv: budget });
  }
  if (!c.grounded && c.doseMsv >= budget) {
    c.grounded = true;
    events.push({ type: 'crew-grounded', crew: c.id, name: c.name, doseMsv: c.doseMsv, budgetMsv: budget });
  }
}

/** Mood and health follow from how the astronaut and the base are doing. Called after resources. */
export function stepVitals(state, c) {
  const T = TUNING;
  const s = c.stats;
  const a = state.alerts;

  let target = 60 + (s.energy - 50) * 0.15 + (s.nutrition - 50) * 0.15 + (s.fitness - 50) * 0.1;
  if (c.activity === 'free') target += 15;
  if (c.activity === 'shelter') target -= 15;
  if (state.env.stormActive) target -= 5;
  if (a.blackout) target -= 20;
  if (a.noO2 || a.noWater || a.noFood) target -= 25;
  if (c.grounded) target -= 10;
  s.morale = clamp(s.morale + (clamp(target) - s.morale) * T.moraleRatePerMin);

  let harm = 0;
  // Harm from thin air or thirst is proportional to how much is actually missing.
  harm += T.healthNoO2PerMin * state.shortfall.o2;
  harm += T.healthNoWaterPerMin * state.shortfall.water;
  if (s.nutrition <= 5) harm += T.healthStarvingPerMin;
  if (s.energy <= 5) harm += T.healthExhaustedPerMin;
  if (s.fitness <= 15) harm += T.healthUnfitPerMin;
  if (a.blackout) harm += T.healthColdPerMin;
  // Deliberately no health loss from radiation dose: at mission-scale doses the real effect
  // is long-term risk, not sickness. Going over budget grounds the astronaut instead.
  s.health = clamp(harm > 0 ? s.health - harm : s.health + T.healthRecoverPerMin);
}
