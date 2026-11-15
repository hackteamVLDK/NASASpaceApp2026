/**
 * The campaign simulation (SCENARIO.md v2): a solo Commander and three builder drones rebuild
 * ASTRA Base over 20 Sols and follow the Jezero Signal. Pure and deterministic: no DOM, no
 * Math.random (a seeded generator lives in `state.rng`), no wall clock. One step = one Mars minute.
 *
 *   const s = createCampaign({ seed: 1 });
 *   const events = step(s, 60);                       // one Mars hour
 *   command(s, { type: 'build', module: 'battery' });
 *
 * Rates are the per-Sol numbers of the scenario tables (3.2, 3.3), applied pro-rated each minute.
 * Story beats, dilemmas and expeditions live in story.js and expeditions.js.
 */
import { seedFrom, nextRandom } from '../sim/rng.js';
import {
  SOL, START_MINUTE, RES, START_RES, CAP, NEEDS, BASE_HEAT_LOSS, RECYCLER, HP, SHIELD, SLEEP_FROM, SLEEP_TO, MEALS,
  MODULES, FITNESS, BUILD_SOLS, UPGRADE_SOLS, DRONE_BUILD_POWER, STORM, RECIPES, UPGRADES, MODULE_LINES, BREAKDOWN_RULES, RULES, LIVES, STORAGE_REFILL, EMERGENCY_COST, EMERGENCY_CLEAR_AT,
} from './data.js';
import { clockAt, isNight, online } from './util.js';
import { blockAt, planMoralePerSol, workSpeed, exercisePlace, fitnessPerHour, PLAN_IDS } from './plan.js';
import { storyMinute, onSol, applyChoice, choiceBlock, onModuleStart, onModuleBuilt, onKit, onMini, miniBlock, runTimer, onDroneAwake, onMove, startSoilWash, soilWashBlock, MINI_GAMES, branchBlock } from './story.js';
export { soilWashBlock };
import { expeditionMinute, startExpedition, radioChoice } from './expeditions.js';
import { takeCheckpoint, loseLife } from './lives.js';
import { jobFields, jobCommand, stepJobs, jobBuildMult } from './jobs.js';

export const STATE_VERSION = 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const has = (o, k) => Object.hasOwn(o, k);

export { clockAt, isNight, isDay, online } from './util.js';

export function createCampaign({ seed = 1, hpZeroEndsRun = RULES.hpZeroEndsRun } = {}) {
  const modules = {};
  for (const [id, m] of Object.entries(MODULES)) modules[id] = { status: m.prebuilt ? 'online' : 'unbuilt', tier: 1, progress: 0, drone: null, upgrading: null };
  const s = {
    version: STATE_VERSION,
    rng: seedFrom(seed),
    minute: START_MINUTE,
    status: 'running', // running | over (no lives left) | complete
    rules: { hpZeroEndsRun }, // see RULES in data.js
    over: null, // { reason: 'hp' | 'trip', sol, minute } once the mission is over
    lives: LIVES.start,
    livesMax: LIVES.start,
    checkpoint: null,
    res: { ...START_RES },
    hp: HP.commanderMax,
    fitness: FITNESS.start, // 3.11
    plan: 'balanced', // 3.10: the Sol Plan preset in use
    planNext: null, // a preset chosen today starts at the next midnight
    hpMax: HP.commanderMax,
    research: 0,
    modules,
    drones: ['drone-01', 'drone-02', 'drone-03'].map((id) => ({ id, status: 'dormant', task: null, queue: [] })), // queue: up to 2 waiting jobs (Drone Link)
    order: null, // a place the Commander was sent to { place, until }
    items: {},
    kits: {},
    upgrades: {}, // rover_shielding, suit_liner, titanium_wheels, deep_ice_drill: true
    crafting: null,
    storm: null,
    recycleEta: RECYCLER.ok,
    mult: { solar: 1, food: 1 },
    mods: [], // temporary per-Sol modifiers { id, res, perSol, untilMinute }
    timers: [], // { at, id } delayed story effects
    flags: {},
    emergency: {},
    low: {},
    pending: null, // { kind: 'dilemma' | 'event' | 'radio', id }
    away: null, // expedition in progress
    medRest: null,
    tasks: [], // mini-games on offer { game, why }
    act: 1,
    said: [],
    logbook: [],
    badges: [],
    choices: [],
    path: {}, // { [decision id]: choice } (choices-data.js: every choice has a lasting effect)
    stats: { livesLost: 0, builds: 0, miniWins: 0, flares: 0, expeditions: 0, samples: 0, hpSum: 0, moraleSum: 0, lowestHp: HP.commanderMax, outsideMin: 0, emergencies: 0, flareMaxLoss: 0, recycleStreak: 0, wipes: 0, melted: 0, medRests: 0, harvest: 0 },
    where: 'bedroom',
    ...jobFields(), // the job board (jobs.js): things to do while the drones build
  };
  takeCheckpoint(s, 'Mission start');
  return s;
}

// ------------------------------------------------------------------ rates

const tierFx = (s, id) => (s.modules[id].tier === 2 && MODULES[id].t2 ? MODULES[id].t2 : MODULES[id].t1);

export function powerCap(s) {
  const b = MODULES.battery;
  return online(s, 'battery') ? b.powerCap[s.modules.battery.tier - 1] : CAP.power;
}

/**
 * Every contribution to every meter, per Sol, with a label: the Resources screen shows these
 * lines and `rates` is their sum, so the screen can never disagree with the simulation.
 * Each line: { res, label, nameId?, amount }. `nameId` is a module name string ID.
 */
/** D-T17b: the Greenhouse grows only when it is online, has power and has water (3.1 "At 0", 3.6 fresh crops).
 * Food output, fresh-crop HP, the Soil Beds bonus and the harvest count all use this one test. */
export function greenhouseWorking(s) {
  return online(s, 'greenhouse') && s.res.power > 0 && s.res.water > 0;
}

export function contributions(s) {
  const lines = [];
  const add = (res, label, amount, nameId = null) => { if (amount) lines.push({ res, label, amount, nameId }); };
  add('power', 'Crew needs', NEEDS.power);
  add('heat', 'Base heat loss', BASE_HEAT_LOSS);
  add('water', 'Water the recycler cannot save', -NEEDS.waterUsed * (1 - s.recycleEta));
  add('oxygen', 'Crew breathing', NEEDS.oxygen);
  add('food', 'Crew meals', NEEDS.food);
  add('morale', 'Crew needs', NEEDS.morale);
  // The Sol Plan's Morale, counted against Balanced: the 3.4 snapshots are Balanced days, and 3.10 says Crunch is
  // "4 Morale per Sol less than Balanced". The plan pauses on a trip (3.10, Solo).
  // Not added: "Fitness 70 or more: +1 Morale per Sol" (3.11) contradicts the 3.4 snapshots; see docs/ERRORS.md B12.
  if (!s.away) add('morale', 'Sol Plan (free time and work hours)', planMoralePerSol(PLAN_IDS.includes(s.plan) ? s.plan : 'balanced') - planMoralePerSol('balanced'));
  const blackout = s.res.power <= 0;
  const dry = s.res.water <= 0; // 3.1: with no water the Greenhouse pauses
  for (const id of Object.keys(MODULES)) {
    if (!online(s, id)) continue;
    if (blackout && id !== 'lifesupport' && id !== 'solar') continue; // non-life-support modules switch off
    if (dry && id === 'greenhouse') continue;
    for (const [k, v0] of Object.entries(tierFx(s, id))) {
      if (!RES.includes(k) && k !== 'research') continue;
      let v = v0;
      if (id === 'solar' && k === 'power') v = v0 * s.mult.solar * (s.storm ? (s.modules.solar.tier === 2 ? STORM.solarT2 : STORM.solarT1) : 1);
      if (id === 'battery' && k === 'power' && s.storm) v = v0 * STORM.batteryPowerMult;
      if (id === 'greenhouse' && k === 'food') v = v0 * s.mult.food;
      // a clogged air filter or a stuck valve lowers Life Support's Oxygen output until the mini-game is won (4.2, 4.3)
      if (id === 'lifesupport' && k === 'oxygen') v = v0 * (s.flags.filterClog || 1) * (s.flags.valveStuck ? BREAKDOWN_RULES.valveOutput : 1);
      add(k, null, v, MODULES[id].nameId);
    }
  }
  if (dry) add('morale', 'No water (the Greenhouse is paused)', -5); // 3.1, "At 0"
  if (s.res.food <= 0) add('morale', 'No food (emergency rations)', -5);
  const building = s.drones.filter((d) => d.task && (d.task.type === 'build' || d.task.type === 'upgrade')).length;
  add('power', `Drones working (${building})`, DRONE_BUILD_POWER * building);
  if (s.drones.some((d) => d.status === 'awake' && !d.task)) add('sp', 'A free drone salvages parts', 2);
  const names = { d1a_saver: 'Power Saver (lights and stove off)', d1a_cold: 'Cold meals, dark rooms', d2c_ration: 'Water rationing', d2c_tired: 'Thirsty and tired', d3b_beds: 'Soil Beds', d4c_food: 'Trays in the Kitchen', leak: 'Airlock leak', leak_w: 'Airlock leak' };
  for (const m of s.mods) {
    if (!RES.includes(m.res) || (m.untilMinute != null && s.minute >= m.untilMinute)) continue;
    if (m.id === 'd3b_beds' && !greenhouseWorking(s)) continue; // the Soil Beds grow only in a working Greenhouse
    add(m.res, names[m.id] ?? 'A temporary effect', m.perSol);
  }
  return lines;
}

/** Net change per Sol of every meter, from the current state (3.2, 3.3, 3.4). */
export function rates(s) {
  const r = { power: 0, heat: 0, water: 0, oxygen: 0, food: 0, morale: 0, sp: 0, research: 0 };
  for (const l of contributions(s)) r[l.res] += l.amount;
  return r;
}

/** Where the Commander is right now (visual and radiation). */
export function locationAt(s) {
  if (s.away) return 'away';
  if (s.medRest || s.flags.shelter) return 'bedroom';
  if (s.order && s.minute < s.order.until) return s.order.place;
  const { hour } = clockAt(s.minute);
  const block = blockAt(s, hour); // the Sol Plan (3.10)
  if (block === 'sleep') return 'bedroom';
  if (block === 'meal' || MEALS.includes(hour)) return 'kitchen';
  if (s.flags.outside) return 'outside';
  if (block === 'exercise') return exercisePlace(s);
  if (block === 'free') return online(s, 'recreation') ? 'recreation' : 'kitchen';
  return online(s, 'workshop') ? 'workshop' : 'kitchen';
}

/** Update where the Commander is; the first visit to a room without the Roof Layer gets ASTRA's warning. */
function refreshWhere(s, emit) {
  const was = s.where;
  s.where = locationAt(s);
  if (s.where !== was) onMove(s, emit, s.where);
}

function shieldFactor(s, where) {
  if (where === 'outside') return SHIELD.surface;
  if (where === 'bedroom') return SHIELD.bedroom;
  if (['workshop', 'lab', 'battery', 'garage', 'greenhouse', 'recreation'].includes(where)) return online(s, 'roof') ? SHIELD.left : SHIELD.rightBeforeRoof;
  return SHIELD.left;
}

// ------------------------------------------------------------------ one minute

export function step(s, minutes = 1) {
  const events = [];
  const emit = (e) => events.push(e);
  // Old saves can already have an open card. Capture it before checking the pause below.
  const checkpointDecision = (appeared = false) => {
    if (s.pending && (appeared || !s.checkpoint || s.pending.kind !== s.checkpoint.kind || s.pending.id !== s.checkpoint.id)) {
      takeCheckpoint(s, undefined, s.pending.kind, s.pending.id);
    }
  };
  if (s.status === 'running') {
    if (!s.checkpoint) takeCheckpoint(s, s.pending ? undefined : 'Mission start', s.pending?.kind ?? null, s.pending?.id ?? null);
    checkpointDecision();
  }
  for (let i = 0; i < minutes && s.status === 'running'; i++) {
    if (s.pending) break; // the game waits for the player's choice
    if (tick(s, emit)) break; // a life loss restores time: stop this batch too
    checkpointDecision(true);
  }
  return events;
}

function tick(s, emit) {
  const dt = 1 / SOL;
  const before = clockAt(s.minute);
  s.minute += 1;
  const now = clockAt(s.minute);
  if (now.sol !== before.sol) onNewSol(s, emit, now);

  // resources
  const r = rates(s);
  const cap = { ...CAP, power: powerCap(s) };
  for (const k of RES) s.res[k] = clamp(s.res[k] + r[k] * dt, 0, cap[k]);
  if (r.research) s.research += r.research * dt;
  s.mods = s.mods.filter((m) => m.untilMinute == null || s.minute < m.untilMinute);

  // the Commander
  if (s.order && s.minute >= s.order.until) { s.order = null; s.flags.outside = false; }
  refreshWhere(s, emit);
  if (stepHp(s, emit, now)) return true; // rewind or Game Over: do not mutate the restored state
  stepFitness(s, emit, now, dt);
  trackStats(s, dt, now);

  // drones: building, upgrading
  // Morale below 30 slows the work; the Commander's Sol Plan and Fitness speed it up or slow it down (3.10, 3.11).
  // While he is away the base runs on Autopilot at normal speed.
  const mult = (s.res.morale < 30 ? 0.75 : 1) * (s.away ? 1 : workSpeed(s)) * jobBuildMult(s);
  for (const d of s.drones) {
    if (!d.task || d.status !== 'awake') continue;
    const m = s.modules[d.task.module];
    if (d.task.type === 'build') {
      m.progress += (dt / BUILD_SOLS) * mult;
      if (m.progress >= 1) finishBuild(s, d, emit);
    } else if (d.task.type === 'upgrade') {
      m.upgrading.progress += (dt / UPGRADE_SOLS) * mult;
      if (m.upgrading.progress >= 1) finishUpgrade(s, d, emit);
    }
    else if (d.task.type === 'chore' && s.minute >= d.task.until) { // D-T17e: a story job (wash the soil, move trays, fix the leak) is done
      emit({ type: 'choreDone', drone: d.id, chore: d.task.id });
      const { fix, deferred } = d.task;
      d.task = null;
      // B2: a drone that was sent to fix a system finishes it now, if it still needs fixing (the player may have won the game meanwhile)
      if (fix && deferred && s.tasks.some((t) => t.game === fix)) { onMini(s, { game: fix, win: true, auto: true }, emit); emit({ type: 'drone-fixed', drone: d.id, game: fix }); }
      nextJob(s, d, emit);
    }
  }

  // Life Support Tier 2 melts Ice Cores by itself (3.5): each gives +25 Water
  if (s.modules.lifesupport.tier === 2 && (s.items.ice_core ?? 0) > 0 && s.res.water <= 75) { s.items.ice_core -= 1; s.stats.melted += 1; s.res.water = clamp(s.res.water + 25, 0, CAP.water); emit({ type: 'melted', cores: 1 }); }

  // Workshop crafting
  if (s.crafting) {
    const rate = s.modules.workshop.tier === 2 ? 2 : 1;
    s.crafting.progress += dt * rate * mult;
    if (s.crafting.progress >= 1) finishCraft(s, emit);
  }

  // timers, story, expedition
  for (const t of s.timers.filter((x) => s.minute >= x.at)) { onTimer(s, t, emit); }
  s.timers = s.timers.filter((x) => s.minute < x.at);
  if (endsRunAtZeroHp(s)) {
    // Delay trip events until we know whether this minute costs a life.
    const trip = [];
    expeditionMinute(s, (e) => trip.push(e));
    if (s.hp <= 0) {
      for (const e of trip) if (e.type !== 'returned' && !(e.type === 'astra' && e.lineId === 'astra.hp.zero_expedition')) emit(e);
      if (!s.away && s.where === 'away') refreshWhere(s, emit);
      loseLife(s, emit, 'trip');
      return true;
    }
    trip.forEach(emit);
  } else expeditionMinute(s, emit);
  if (!s.away && s.where === 'away') refreshWhere(s, emit); // the Rover just came home: the Commander is back in the base
  checkMeters(s, emit);
  stepJobs(s, emit, now);
  storyMinute(s, emit, now);
}

function trackStats(s, dt, now) {
  const st = s.stats;
  // Sleep per night for the Well Rested badge (8.3). Night N runs from 22:00 on Sol N to 06:00 on Sol N + 1.
  if (s.where === 'bedroom' && !s.away && isNight(now.hourFloat)) {
    const night = now.hourFloat >= 12 ? now.sol : now.sol - 1;
    if (night >= 1 && night <= 6) {
      if (!Array.isArray(st.sleepNights)) st.sleepNights = [0, 0, 0, 0, 0, 0];
      st.sleepNights[night - 1] += 1;
    }
  }
  if (s.where === 'outside' || s.where === 'away') st.outsideMin += 1;
  if (greenhouseWorking(s)) st.harvest += MODULES.greenhouse[s.modules.greenhouse.tier === 2 ? 't2' : 't1'].food * s.mult.food * dt;
  st.lowestHp = Math.min(st.lowestHp, s.hp);
  if (EMERGENCY_COST.zeroRes.some((k) => s.res[k] <= 0)) s.flags.zeroToday = true; // C6: this Sol counts as one with empty supplies
  if (now.minute === 0) {
    st.samples += 1; st.hpSum += s.hp; st.moraleSum += s.res.morale;
    st.fitSamples = (st.fitSamples ?? 0) + 1; st.fitSum = (st.fitSum ?? 0) + s.fitness; // Crew Care averages Fitness too (8.2)
  }
}

function onNewSol(s, emit, now) {
  // the Sol Plan chosen yesterday starts now (3.10); the Strong Bones streak counts Sols at Fitness 70+ (8.3)
  if (s.planNext) { s.plan = s.planNext; s.planNext = null; }
  s.stats.fitStreak = (s.stats.fitDayMin ?? s.fitness) >= FITNESS.goodAt ? (s.stats.fitStreak ?? 0) + 1 : 0;
  s.stats.fitDayMin = null; // the new Sol's lowest Fitness starts from its first minute
  s.stats.fitBest = Math.max(s.stats.fitBest ?? 0, s.stats.fitStreak);
  s.stats.recycleStreak = s.recycleEta >= RECYCLER.ok ? s.stats.recycleStreak + 1 : 0;
  // C6: the Sol that just ended. An Emergency still open costs Morale (ASTRA says why once per stretch); a Sol with
  // Heat, Food or Oxygen at 0 is counted for the Mission Rating.
  if (s.flags.zeroToday) { s.stats.zeroSols = (s.stats.zeroSols ?? 0) + 1; s.flags.zeroToday = false; }
  if (Object.values(s.emergency).some(Boolean)) {
    s.res.morale = clamp(s.res.morale - EMERGENCY_COST.moralePerSol, 0, CAP.morale);
    if (!s.flags.emergencyWorry) { s.flags.emergencyWorry = true; emit({ type: 'astra', lineId: 'astra.res.emergency_worry', mood: 'alert' }); }
  } else s.flags.emergencyWorry = false;
  for (const k of Object.keys(s.low)) if (s.res[k] > 40) s.low[k] = false;
  emit({ type: 'sol', sol: now.sol });
  onSol(s, emit, now, () => nextRandom(s));
}

function onTimer(s, t, emit) {
  s.timers = s.timers.filter((x) => x !== t);
  runTimer(s, t.id, emit);
}

/** Does HP 0 cost a life (team override) or send the Commander to Med-Rest (SCENARIO)? */
export const endsRunAtZeroHp = (s) => s.rules?.hpZeroEndsRun ?? RULES.hpZeroEndsRun;

/** Fitness (3.11): -10 a Sol in low gravity; exercise hours of the Sol Plan build it up; ASTRA warns when it gets low. */
function stepFitness(s, emit, now, dt) {
  if (typeof s.fitness !== 'number') s.fitness = FITNESS.start;
  let f = s.fitness - FITNESS.lossPerSol * dt;
  const exercising = !s.away && !s.medRest && blockAt(s, now.hour) === 'exercise' && s.where === exercisePlace(s);
  if (exercising) {
    f += fitnessPerHour(s) / 60;
    if (now.minute === 1 && now.sol >= 2) {
      s.stats.exerciseHours = (s.stats.exerciseHours ?? 0) + 1;
      if (s.stats.exerciseHours === 1) emit({ type: 'astra', lineId: 'astra.fit.intro', mood: 'curious' });
      if (s.stats.exerciseHours === 2) emit({ type: 'astra', lineId: 'astra.fit.mars', mood: 'curious' });
    }
  }
  s.fitness = clamp(f, 0, 100);
  // the lowest Fitness of this Sol (Strong Bones); the midnight minute closes the old Sol, so it is not counted
  if (now.hour !== 0 || now.minute !== 0) s.stats.fitDayMin = Math.min(s.stats.fitDayMin ?? s.fitness, s.fitness);
  const warn = [['fitLow', FITNESS.lowAt, 'astra.fit.low'], ['fitCritical', FITNESS.criticalAt + 0.5, 'astra.fit.critical']];
  for (const [key, limit, line] of warn) {
    if (s.fitness < limit && !s.low[key]) { s.low[key] = true; emit({ type: 'astra', lineId: line, mood: 'alert' }); }
    if (s.fitness >= limit + 10) s.low[key] = false;
  }
}

function stepHp(s, emit, now) {
  const dt = 1 / SOL;
  if (s.hp <= 0 && endsRunAtZeroHp(s)) return loseLife(s, emit, s.away ? 'trip' : 'hp');
  if (s.medRest && s.minute >= s.medRest.until) {
    s.hp = HP.medRestHp;
    s.medRest = null;
    emit({ type: 'astra', lineId: 'astra.hp.medrest_end', mood: 'cheerful' });
  }
  if (s.medRest) return;
  let d = 0;
  if (s.where === 'bedroom' && blockAt(s, now.hour) === 'sleep' && !s.away) d += HP.sleepPerHour / 60; // the Sol Plan's Sleep block (3.10)
  if ((s.fitness ?? FITNESS.start) <= FITNESS.criticalAt) d += FITNESS.criticalHpPerSol * dt; // 3.11: very low Fitness hurts (never below Med-Rest)
  if (s.away && isNight(now.hourFloat)) d += HP.roverSleepPerHour / 60; // camping in the Rover (3.6: +6 a night)
  const liner = s.where === 'outside' && s.upgrades.suit_liner ? 0.75 : 1; // D-T17d: "Surface HP loss x0.75" (SCENARIO 5.4), also on foot
  if (!s.away) d -= (HP.radiationPerSol * shieldFactor(s, s.where) * (s.flags.flare ? 3 : 1) * liner) * dt;
  if (greenhouseWorking(s) && s.res.food >= 30 && !s.flags.freshOff) d += (s.modules.greenhouse.tier === 2 ? HP.freshCropsT2 : HP.freshCropsT1) * dt + (s.flags.soilBeds ? dt : 0);
  if (s.res.morale >= HP.moraleThreshold) d += HP.highMorale * dt;
  for (const m of s.mods) if (m.res === 'hp') d += m.perSol * dt;
  if (endsRunAtZeroHp(s) && !s.away) {
    for (const [meter, loss] of Object.entries(LIVES.emptyMeterHpPerSol)) {
      const key = `danger_${meter}`;
      if (s.res[meter] <= 0) {
        d -= loss * dt;
        if (!s.low[key]) {
          s.low[key] = true;
          emit({ type: 'astra', lineId: `astra.lives.${key}`, mood: 'calm' });
        }
      } else s.low[key] = false;
    }
  }
  s.hp = clamp(s.hp + d, 0, s.hpMax);
  hpLines(s, emit);
  if (s.hp <= 0 && endsRunAtZeroHp(s)) return loseLife(s, emit, s.away ? 'trip' : 'hp');
  if (s.hp <= 0 && !s.away) {
    s.medRest = { until: s.minute + SOL };
    s.stats.medRests += 1;
    emit({ type: 'astra', lineId: 'astra.hp.zero_base', mood: 'calm' });
  }
}

/** ASTRA's HP lines (SCENARIO 3.x system lines): each fires once when HP crosses its limit, again after HP recovers. */
function hpLines(s, emit) {
  const rules = [['hp70', 70, 'astra.hp.surface_70', () => Boolean(s.away)], ['hp50', 50, 'astra.hp.50', () => true], ['hp25', 25, 'astra.hp.25', () => true]];
  for (const [key, limit, line, applies] of rules) {
    if (s.hp < limit && !s.low[key] && applies()) { s.low[key] = true; emit({ type: 'astra', lineId: line, mood: 'alert' }); }
    if (s.hp >= limit + 10) s.low[key] = false;
  }
  if (s.hp >= s.hpMax - 0.01 && s.low.hpFullReady) { s.low.hpFullReady = false; emit({ type: 'astra', lineId: 'astra.hp.full', mood: 'cheerful' }); }
  if (s.hp < 80) s.low.hpFullReady = true;
}

/** Recreation & Storage opens its emergency stores when Water, Food or Oxygen runs very low (3.3, once per 5 / 3 Sols). */
function storageRefill(s, emit) {
  if (!online(s, 'recreation')) return;
  const R = STORAGE_REFILL;
  if (s.minute < (s.flags.storageReadyAt ?? 0)) return;
  const low = R.res.filter((k) => s.res[k] < R.below).sort((a, b) => s.res[a] - s.res[b]);
  if (!low.length) return;
  const k = low[0];
  s.res[k] = Math.min(CAP[k], s.res[k] + R.amount);
  s.flags.storageReadyAt = s.minute + R.cooldownSols[s.modules.recreation.tier] * SOL;
  s.stats.storageRefills = (s.stats.storageRefills ?? 0) + 1;
  emit({ type: 'astra', lineId: 'astra.res.storage_save', mood: 'cheerful' });
  emit({ type: 'storageRefill', res: k, amount: R.amount });
}

function checkMeters(s, emit) {
  storageRefill(s, emit);
  const lines = { oxygen: ['astra.res.oxygen_low', 25], water: ['astra.res.water_low', 25], food: ['astra.res.food_low', 25], morale: ['astra.res.morale_low', 30] };
  for (const [k, [line, limit]] of Object.entries(lines)) {
    if (s.res[k] < limit && !s.low[k]) { s.low[k] = true; emit({ type: 'astra', lineId: line, mood: 'alert' }); }
  }
  const zero = { power: 'astra.res.power_zero', heat: 'astra.res.heat_zero', oxygen: 'astra.res.oxygen_zero' };
  for (const [k, line] of Object.entries(zero)) {
    if (s.res[k] <= 0 && !s.emergency[k]) {
      s.emergency[k] = true;
      s.stats.emergencies += 1;
      emit({ type: 'astra', lineId: line, mood: 'alert' });
      const mini = { power: 'solar_wipe', heat: 'heat_pump', oxygen: 'valve_balance' }[k];
      emit({ type: 'emergency', kind: k, mini });
      if (!s.tasks.some((t) => t.game === mini)) s.tasks.push({ game: mini, why: 'Emergency! Fix it now.' });
    } else if (s.res[k] >= EMERGENCY_CLEAR_AT && s.emergency[k]) s.emergency[k] = false;
  }
}

// ------------------------------------------------------------------ building

/**
 * Why a module cannot be built yet, or null. (3.3 "Unlocks when")
 * docs/ERRORS.md A29: every lock says what to do AND why that comes first, in short kid-friendly words.
 */
export function unlockReason(s, id, action = 'build') {
  const branch = branchBlock(s, action, id);
  if (branch) return branch;
  if (action === 'upgrade') return null;
  const started = (m) => ['building', 'online'].includes(s.modules[m].status);
  switch (id) {
    case 'battery': return null;
    case 'workshop': return online(s, 'battery') ? null : 'Build Battery & Heating first: the Workshop machines need steady power and warmth.';
    case 'greenhouse': return online(s, 'workshop') ? null : 'Build the Workshop first: it makes the pumps, pipes and LED panels a Greenhouse needs.';
    case 'garage': return started('greenhouse') ? null : 'Start the Greenhouse first: food must be growing before the crew drives far from home.';
    case 'lab': return online(s, 'garage')
      ? ((s.items.dish_antenna ?? 0) > 0 ? null : 'Needs the Dish Antenna from Pathfinder-X: send the Rover on Expedition 2 to bring it home.')
      : 'Build the Garage first: the Lab needs a big dish antenna, and only the Rover can fetch one.';
    case 'recreation': return started('lab') || (s.flags.earlyRecreation && online(s, 'workshop')) ? null : 'Start the Lab first: the drones finish the work rooms before the rest room.';
    case 'roof': return started('lab') || (s.flags.earlyRoof && online(s, 'garage'))
      ? ((s.items.titanium_plate ?? 0) > 0 ? null : 'Needs a Titanium Plate to hold up the soil: find one on Expedition 2 or a Scrap Run.')
      : 'Start the Lab first: the roof covers the right-wing rooms, so their frames must stand first.';
    default: return 'Already built.';
  }
}

function canPay(s, cost = {}) {
  if ((cost.sp ?? 0) > s.res.sp) return `Needs ${cost.sp} Spare Parts.`;
  if ((cost.water ?? 0) > s.res.water) return `Needs ${cost.water} Water.`;
  for (const [it, n] of Object.entries(cost.items ?? {})) if ((s.items[it] ?? 0) < n) return `Needs ${n} ${it.replaceAll('_', ' ')}.`;
  return null;
}
function pay(s, cost = {}) {
  s.res.sp -= cost.sp ?? 0;
  s.res.water -= cost.water ?? 0;
  for (const [it, n] of Object.entries(cost.items ?? {})) s.items[it] -= n;
}
const freeDrone = (s) => s.drones.find((d) => d.status === 'awake' && !d.task);

function finishBuild(s, d, emit) {
  const id = d.task.module;
  const m = s.modules[id];
  m.status = 'online';
  m.progress = 1;
  m.drone = null;
  d.task = null;
  s.stats.builds += 1;
  emit({ type: 'built', module: id });
  onModuleBuilt(s, id, emit);
  nextJob(s, d, emit);
}

function finishUpgrade(s, d, emit) {
  const id = d.task.module;
  const m = s.modules[id];
  m.tier = 2;
  m.upgrading = null;
  d.task = null;
  emit({ type: 'upgraded', module: id });
  if (UPGRADES[id]?.line) emit({ type: 'astra', lineId: UPGRADES[id].line, mood: 'cheerful' });
  nextJob(s, d, emit);
}

function finishCraft(s, emit) {
  const id = s.crafting.recipe;
  s.crafting = null;
  const rec = RECIPES[id];
  if (rec.kind === 'kit') { s.kits[id] = (s.kits[id] ?? 0) + 1; onKit(s, id, emit); } else {
    s.upgrades[id] = true;
    emit({ type: 'crafted', recipe: id });
    if (id === 'suit_liner') emit({ type: 'astra', lineId: 'astra.rad.suit_liner', mood: 'cheerful' });
    if (id === 'rover_shielding') { s.flags.shieldCrafted = true; emit({ type: 'astra', lineId: 'astra.rad.rover_shield', mood: 'cheerful' }); }
  }
}

/**
 * C9: what a recipe costs right now. SCENARIO Dilemma 5 C: worn-out shielding is re-crafted for 15 SP only
 * (the soil bricks are re-packed; the Titanium Plate frame is still there).
 */
export function recipeCost(s, id) {
  const rec = RECIPES[id];
  if (id === 'rover_shielding' && s.flags?.shieldCrafted) return { ...rec, sp: 15, items: {} };
  return rec;
}


const QUEUE_MAX = 2; // jobs a busy drone keeps waiting (Drone Link)

/** Why a job cannot wait in drone `d`'s queue right now, or null. Cost is paid when it starts. */
function queueCheck(s, job, d) {
  const m = s.modules[job.module];
  const queued = s.drones.some((x) => x.queue.some((q) => q.type === job.type && q.module === job.module));
  if (queued) return 'That job is already waiting.';
  if (s.drones.some((x) => x.task && x.task.type === job.type && x.task.module === job.module)) return 'A drone is already on that job.';
  if (d.queue.length >= QUEUE_MAX) return 'That drone already has 2 jobs waiting.';
  if (job.type === 'build' && m.status !== 'unbuilt') return m.status === 'online' ? 'Already finished.' : 'Already being built.';
  if (job.type === 'upgrade' && (!UPGRADES[job.module] || m.tier === 2 || m.upgrading)) return 'No upgrade to do there.';
  return null;
}

/** Start a build or upgrade on a free drone: all checks, payment and effects. Returns an error text or null. */
function startJob(s, d, job, emit) {
  if (job.type === 'chore') { d.task = { ...job, until: s.minute + job.sols * SOL }; return null; }
  const id = job.module;
  const m = s.modules[id];
  if (job.type === 'build') {
    if (m.status !== 'unbuilt') return m.status === 'online' ? 'Already finished.' : 'Already being built.';
    const why = unlockReason(s, id) ?? canPay(s, MODULES[id].cost);
    if (why) return why;
    pay(s, MODULES[id].cost);
    m.status = 'building';
    m.progress = 0;
    m.drone = d.id;
    d.task = { type: 'build', module: id };
    emit({ type: 'build-started', module: id, drone: d.id });
    onModuleStart(s, id, emit);
    return null;
  }
  const u = UPGRADES[id];
  if (!u) return 'No upgrade for that module.';
  if (m.status === 'building') return 'That room is still being built.';
  if (m.status !== 'online') return 'Build it first.';
  if (m.tier === 2 || m.upgrading) return 'Already upgraded.';
  const why = unlockReason(s, id, 'upgrade') ?? canPay(s, u);
  if (why) return why;
  pay(s, u);
  m.upgrading = { progress: 0, drone: d.id };
  d.task = { type: 'upgrade', module: id };
  emit({ type: 'upgrade-started', module: id });
  return null;
}

/** When a drone is free, start the next waiting job; one that cannot start is dropped with a note. */
function nextJob(s, d, emit) {
  while (d.queue.length && !d.task) {
    const job = d.queue.shift();
    const err = startJob(s, d, job, emit);
    if (err) emit({ type: 'toast', text: `A waiting job was dropped: ${err}` });
  }
}

// ------------------------------------------------------------------ commands

/** The prep games before a Rover trip (SCENARIO 5.1): a drone can do them too. */
const PREP_GAMES = ['wheel_vacuum', 'suit_seal'];

/**
 * B2: why a drone cannot offer to fix `game` right now, or null. A drone needs to be awake and free, the game must be
 * something a drone can do (a system that is down, or the prep before a trip) and nobody may be on it already.
 */
export function droneFixBlock(s, game) {
  if (s.status !== 'running') return 'The mission is over.';
  if (!MINI_GAMES.includes(game) || !(PREP_GAMES.includes(game) || s.tasks.some((t) => t.game === game))) return 'There is nothing for a drone to fix.';
  if (s.drones.some((d) => d.task?.fix === game)) return 'A drone is already on it.';
  if (!s.drones.some((d) => d.status === 'awake')) return 'No drone is awake yet.';
  if (!s.drones.some((d) => d.status === 'awake' && !d.task)) return 'Every drone is busy right now. Try once more yourself!';
  return null;
}

/**
 * Player commands. Returns { ok: true, events } or { ok: false, error }.
 *   build { module }            a free awake drone starts building
 *   upgrade { module }          Tier 2 install (half a Sol of drone time)
 *   craft { recipe }            the Workshop makes one item
 *   useKit { kit, drone }       a Repair Kit or Reboot Kit wakes a drone
 *   wakeDrone { drone }         the tutorial battery step wakes Drone #01
 *   choose { choice }           answer the pending dilemma or event
 *   miniResult { game, win }    the result of a mini-game
 *   droneFix { game }           after 3 failed tries a free drone fixes the system (1 Sol) or does the prep (B2)
 *   launch { expedition }       send the Rover out (expeditions.js)
 *   radio { choice }            answer a radio decision
 *   melt {}                     melt one Ice Core into 25 Water in Life Support
 *   surface { on }              the Commander works outside (or comes back)
 */
export function command(s, cmd) {
  const events = [];
  const emit = (e) => events.push(e);
  const fail = (error) => ({ ok: false, error });
  if (s.status !== 'running') return fail('The mission is over.');
  const job = jobCommand(s, cmd, emit); // startJob / jobResult (jobs.js); null for every other command
  if (job) return job.ok ? { ok: true, events } : fail(job.error);
  switch (cmd?.type) {
    case 'wakeDrone': {
      const d = s.drones.find((x) => x.id === cmd.drone);
      if (!d) return fail('Unknown drone.');
      if (d.status === 'awake') return fail('That drone is already awake.');
      if (d.id !== 'drone-01') return fail('This drone needs its kit from the Workshop.'); // D-T17c: only the tutorial wakes a drone for free
      d.status = 'awake';
      emit({ type: 'drone-awake', drone: d.id });
      onDroneAwake(s, d.id, emit);
      break;
    }
    case 'build':
    case 'upgrade': {
      const id = cmd.module;
      if (!s.modules[id]) return fail('Unknown module.');
      if (cmd.type === 'build' && (!MODULES[id] || MODULES[id].prebuilt)) return fail('Unknown module.');
      const d = cmd.drone ? s.drones.find((x) => x.id === cmd.drone) : freeDrone(s);
      if (cmd.drone && (!d || d.status !== 'awake')) return fail('That drone is asleep.');
      if (!d) return fail('No free drone. Wake a drone or wait for one to finish.');
      const job = { type: cmd.type, module: id };
      if (d.task) { // Drone Link: the drone is busy, so the job waits in its queue (up to 2)
        const why = queueCheck(s, job, d);
        if (why) return fail(why);
        d.queue.push(job);
        emit({ type: 'queued', drone: d.id, job });
        break;
      }
      const err = startJob(s, d, job, emit);
      if (err) return fail(err);
      break;
    }
    case 'unqueue': {
      const d = s.drones.find((x) => x.id === cmd.drone);
      if (!d || !d.queue[cmd.index]) return fail('Nothing to remove.');
      d.queue.splice(cmd.index, 1);
      break;
    }
    case 'order': {
      if (s.away) return fail('The Commander is out with the Rover.');
      if (!['bedroom', 'kitchen', 'lifesupport', 'workshop', 'lab', 'battery', 'garage', 'greenhouse', 'recreation', 'outside'].includes(cmd.place)) return fail('Unknown place.');
      if (cmd.place !== 'bedroom' && cmd.place !== 'kitchen' && cmd.place !== 'lifesupport' && cmd.place !== 'outside' && !online(s, cmd.place)) return fail('That room is not finished yet.');
      s.order = { place: cmd.place, until: s.minute + 180 };
      s.flags.outside = cmd.place === 'outside';
      refreshWhere(s, emit); // the Commander sets off at once, even while the game is paused
      emit({ type: 'ordered', place: cmd.place });
      break;
    }
    case 'setPlan': { // 3.10: a preset; it starts at the next midnight
      if (!PLAN_IDS.includes(cmd.plan)) return fail('Pick Balanced, Crunch or Recover.');
      if (clockAt(s.minute).sol < 2) return fail('The Sol Plan opens at dawn on Sol 2.');
      s.planNext = cmd.plan === s.plan ? null : cmd.plan;
      if (cmd.plan === 'crunch' && s.planNext) emit({ type: 'astra', lineId: 'astra.plan.crunch', mood: 'calm' });
      emit({ type: 'plan', plan: cmd.plan, from: 'midnight' });
      break;
    }
    case 'craft': {
      const rec = RECIPES[cmd.recipe];
      if (!rec) return fail('Unknown recipe.');
      if (!online(s, 'workshop')) return fail('Build the Workshop first.');
      if (s.crafting) return fail('The Workshop is busy.');
      if (rec.kind !== 'kit' && s.upgrades[cmd.recipe]) return fail('Already crafted.');
      const cost = recipeCost(s, cmd.recipe);
      const why = canPay(s, cost);
      if (why) return fail(why);
      pay(s, cost);
      s.crafting = { recipe: cmd.recipe, progress: 0 };
      emit({ type: 'craft-started', recipe: cmd.recipe });
      break;
    }
    case 'useKit': {
      const d = s.drones.find((x) => x.id === cmd.drone);
      const need = { 'drone-02': 'repair_kit', 'drone-03': 'reboot_kit' }[cmd.drone];
      if (!d || cmd.kit !== need) return fail('That kit does not fit that drone.');
      if ((s.kits[need] ?? 0) < 1) return fail('You have no such kit.');
      if (d.status === 'awake') return fail('That drone is already awake.');
      s.kits[need] -= 1;
      d.status = 'awake';
      emit({ type: 'drone-awake', drone: d.id });
      onDroneAwake(s, d.id, emit);
      break;
    }
    case 'choose': {
      if (!s.pending) return fail('Nothing to decide.');
      const p = s.pending;
      if (!['a', 'b', 'c'].includes(cmd.choice)) return fail('Pick a, b or c.');
      if (p.kind === 'radio') return fail('Answer on the radio.');
      const blocked = choiceBlock(s, p, cmd.choice);
      if (blocked) return fail(blocked);
      s.pending = null;
      if (p.kind === 'dilemma' || p.kind === 'event') s.choices.push(`${p.id}${cmd.choice}`);
      applyChoice(s, p, cmd.choice, emit, () => nextRandom(s));
      emit({ type: 'chosen', id: p.id, choice: cmd.choice });
      break;
    }
    case 'miniResult': {
      const why = miniBlock(s, cmd.game);
      if (why) return fail(why);
      onMini(s, cmd, emit);
      break;
    }
    case 'washSoil': { // B11: Dilemma 3 choice B, started later from the Lab
      const why = startSoilWash(s, emit);
      if (why) return fail(why);
      break;
    }
    case 'droneFix': { // B2 / SCENARIO section 4: after 3 failures in a row a drone offers to fix it (1 Sol of drone time)
      const why = droneFixBlock(s, cmd.game);
      if (why) return fail(why);
      const d = s.drones.find((x) => x.status === 'awake' && !x.task);
      const deferred = s.tasks.some((t) => t.game === cmd.game); // a system that is down is fixed when the Sol is over; a prep game is needed now, for the trip
      d.task = { type: 'chore', id: `fix:${cmd.game}`, fix: cmd.game, deferred, module: null, sols: 1, until: s.minute + SOL };
      if (!deferred) onMini(s, { game: cmd.game, win: true, auto: true }, emit);
      emit({ type: 'drone-fix', drone: d.id, game: cmd.game, deferred });
      break;
    }
    case 'melt': {
      if (!online(s, 'lifesupport')) return fail('Life Support is offline.');
      if ((s.items.ice_core ?? 0) < 1) return fail('You have no Ice Core.');
      if (s.res.water > 75) return fail('The tank is nearly full.');
      s.items.ice_core -= 1;
      s.stats.melted += 1;
      s.res.water = clamp(s.res.water + 25, 0, CAP.water);
      emit({ type: 'melted', cores: 1 });
      break;
    }
    case 'surface': {
      s.flags.outside = Boolean(cmd.on);
      refreshWhere(s, emit);
      break;
    }
    case 'launch': {
      const res = startExpedition(s, cmd.expedition, emit);
      if (res) return fail(res);
      break;
    }
    case 'radio': {
      const res = radioChoice(s, cmd.choice, emit);
      if (res) return fail(res);
      break;
    }
    default: return fail(`Unknown command: ${cmd?.type}`);
  }
  return { ok: true, events };
}

/** Build state of a module for the UI: { status, tier, reason, cost }. */
export function moduleInfo(s, id) {
  const m = s.modules[id];
  const def = MODULES[id];
  return { id, status: m.status, tier: m.tier, progress: m.progress, drone: m.drone, upgrading: m.upgrading, reason: m.status === 'unbuilt' ? unlockReason(s, id) : null, cost: def.cost ?? null, upgrade: UPGRADES[id] ?? null };
}

export { MODULE_LINES };
