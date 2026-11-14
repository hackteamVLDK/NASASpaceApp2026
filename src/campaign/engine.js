/**
 * The campaign simulation (SCENARIO.md v2): a solo Commander and three builder drones rebuild
 * Ares-1 over 20 Sols and follow the Jezero Signal. Pure and deterministic: no DOM, no
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
  MODULES, BUILD_SOLS, UPGRADE_SOLS, DRONE_BUILD_POWER, STORM, RECIPES, UPGRADES, MODULE_LINES, RULES,
} from './data.js';
import { clockAt, isNight, online } from './util.js';
import { storyMinute, onSol, applyChoice, choiceBlock, onModuleStart, onModuleBuilt, onKit, onMini, miniBlock, runTimer, onDroneAwake, onMove } from './story.js';
import { expeditionMinute, startExpedition, radioChoice } from './expeditions.js';

export const STATE_VERSION = 1;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const has = (o, k) => Object.hasOwn(o, k);

export { clockAt, isNight, isDay, online } from './util.js';

export function createCampaign({ seed = 1, hpZeroEndsRun = RULES.hpZeroEndsRun } = {}) {
  const modules = {};
  for (const [id, m] of Object.entries(MODULES)) modules[id] = { status: m.prebuilt ? 'online' : 'unbuilt', tier: 1, progress: 0, drone: null, upgrading: null };
  return {
    version: STATE_VERSION,
    rng: seedFrom(seed),
    minute: START_MINUTE,
    status: 'running', // running | over (the Commander ran out of HP, see `endRun`) | complete
    rules: { hpZeroEndsRun }, // see RULES in data.js
    over: null, // { reason: 'hp' | 'trip', sol, minute } once the mission is over
    res: { ...START_RES },
    hp: HP.commanderMax,
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
    stats: { builds: 0, miniWins: 0, flares: 0, expeditions: 0, samples: 0, hpSum: 0, moraleSum: 0, lowestHp: HP.commanderMax, outsideMin: 0, emergencies: 0, flareMaxLoss: 0, recycleStreak: 0, wipes: 0, melted: 0, medRests: 0, harvest: 0 },
    where: 'bedroom',
  };
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
export function contributions(s) {
  const lines = [];
  const add = (res, label, amount, nameId = null) => { if (amount) lines.push({ res, label, amount, nameId }); };
  add('power', 'Crew needs', NEEDS.power);
  add('heat', 'Base heat loss', BASE_HEAT_LOSS);
  add('water', 'Water the recycler cannot save', -NEEDS.waterUsed * (1 - s.recycleEta));
  add('oxygen', 'Crew breathing', NEEDS.oxygen);
  add('food', 'Crew meals', NEEDS.food);
  add('morale', 'Crew needs', NEEDS.morale);
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
      add(k, null, v, MODULES[id].nameId);
    }
  }
  if (dry) add('morale', 'No water (the Greenhouse is paused)', -5); // 3.1, "At 0"
  if (s.res.food <= 0) add('morale', 'No food (emergency rations)', -5);
  const building = s.drones.filter((d) => d.task && (d.task.type === 'build' || d.task.type === 'upgrade')).length;
  add('power', `Drones working (${building})`, DRONE_BUILD_POWER * building);
  if (s.drones.some((d) => d.status === 'awake' && !d.task)) add('sp', 'A free drone salvages parts', 2);
  const names = { d1a_saver: 'Power Saver (lights and stove off)', d1a_cold: 'Cold meals, dark rooms', d2c_ration: 'Water rationing', d2c_tired: 'Thirsty and tired', d3b_beds: 'Soil Beds', d4c_food: 'Trays in the Kitchen', leak: 'Airlock leak', leak_w: 'Airlock leak' };
  for (const m of s.mods) if (RES.includes(m.res) && (m.untilMinute == null || s.minute < m.untilMinute)) add(m.res, names[m.id] ?? 'A temporary effect', m.perSol);
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
  const { hourFloat, hour } = clockAt(s.minute);
  if (isNight(hourFloat)) return 'bedroom';
  if (MEALS.includes(hour)) return 'kitchen';
  if (s.flags.outside) return 'outside';
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
  for (let i = 0; i < minutes && s.status === 'running'; i++) {
    if (s.pending) break; // the game waits for the player's choice
    tick(s, emit);
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
  stepHp(s, emit, now);
  if (s.status !== 'running') return; // the Commander ran out of HP: the mission is over
  trackStats(s, dt, now);

  // drones: building, upgrading
  const mult = s.res.morale < 30 ? 0.75 : 1;
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
    // On a trip, a Commander at 0 HP does not come home: the rescue drone and the loot screen of SCENARIO 5.1 are not shown.
    const trip = [];
    expeditionMinute(s, (e) => trip.push(e));
    if (s.hp <= 0) {
      for (const e of trip) if (e.type !== 'returned' && !(e.type === 'astra' && e.lineId === 'astra.hp.zero_expedition')) emit(e);
      if (!s.away && s.where === 'away') refreshWhere(s, emit);
      endRun(s, emit, 'trip');
      return;
    }
    trip.forEach(emit);
  } else expeditionMinute(s, emit);
  if (!s.away && s.where === 'away') refreshWhere(s, emit); // the Rover just came home: the Commander is back in the base
  checkMeters(s, emit);
  storyMinute(s, emit, now);
}

function trackStats(s, dt, now) {
  const st = s.stats;
  if (s.where === 'outside' || s.where === 'away') st.outsideMin += 1;
  if (online(s, 'greenhouse')) st.harvest += MODULES.greenhouse[s.modules.greenhouse.tier === 2 ? 't2' : 't1'].food * s.mult.food * dt;
  st.lowestHp = Math.min(st.lowestHp, s.hp);
  if (now.minute === 0) { st.samples += 1; st.hpSum += s.hp; st.moraleSum += s.res.morale; }
}

function onNewSol(s, emit, now) {
  s.stats.recycleStreak = s.recycleEta >= RECYCLER.ok ? s.stats.recycleStreak + 1 : 0;
  for (const k of Object.keys(s.low)) if (s.res[k] > 40) s.low[k] = false;
  emit({ type: 'sol', sol: now.sol });
  onSol(s, emit, now, () => nextRandom(s));
}

function onTimer(s, t, emit) {
  s.timers = s.timers.filter((x) => x !== t);
  runTimer(s, t.id, emit);
}

/** Does HP 0 end the run (the player's wish) or send the Commander to Med-Rest (SCENARIO)? Saves from before the rule use the default. */
export const endsRunAtZeroHp = (s) => s.rules?.hpZeroEndsRun ?? RULES.hpZeroEndsRun;

/** The mission is over: the Commander ran out of HP. Nothing moves after this; the screen offers a new start. */
function endRun(s, emit, reason) {
  if (s.status !== 'running') return;
  s.status = 'over';
  if (s.medRest) { s.medRest = null; s.stats.medRests = Math.max(0, s.stats.medRests - 1); } // the trip's rescue had started a Med-Rest: it does not count
  s.pending = null;
  s.over = { reason, sol: clockAt(s.minute).sol, minute: s.minute };
  emit({ type: 'gameover', reason, sol: s.over.sol });
}

function stepHp(s, emit, now) {
  const dt = 1 / SOL;
  if (s.medRest && s.minute >= s.medRest.until) {
    s.hp = HP.medRestHp;
    s.medRest = null;
    emit({ type: 'astra', lineId: 'astra.hp.medrest_end', mood: 'cheerful' });
  }
  if (s.medRest) return;
  let d = 0;
  if (s.where === 'bedroom' && isNight(now.hourFloat) && !s.away) d += HP.sleepPerHour / 60;
  if (!s.away) d -= (HP.radiationPerSol * shieldFactor(s, s.where) * (s.flags.flare ? 3 : 1)) * dt;
  if (online(s, 'greenhouse') && s.res.food >= 30 && !s.flags.freshOff) d += (s.modules.greenhouse.tier === 2 ? HP.freshCropsT2 : HP.freshCropsT1) * dt + (s.flags.soilBeds ? dt : 0);
  if (s.res.morale >= HP.moraleThreshold) d += HP.highMorale * dt;
  for (const m of s.mods) if (m.res === 'hp') d += m.perSol * dt;
  s.hp = clamp(s.hp + d, 0, s.hpMax);
  hpLines(s, emit);
  if (s.hp <= 0 && !s.away) {
    if (endsRunAtZeroHp(s)) { endRun(s, emit, 'hp'); return; }
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

function checkMeters(s, emit) {
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
    } else if (s.res[k] >= 20 && s.emergency[k]) s.emergency[k] = false;
  }
}

// ------------------------------------------------------------------ building

/** Why a module cannot be built yet, or null. (3.3 "Unlocks when") */
export function unlockReason(s, id) {
  const started = (m) => ['building', 'online'].includes(s.modules[m].status);
  switch (id) {
    case 'battery': return null;
    case 'workshop': return online(s, 'battery') ? null : 'Build Battery & Heating first.';
    case 'greenhouse': return online(s, 'workshop') ? null : 'Build the Workshop first.';
    case 'garage': return started('greenhouse') ? null : 'Start the Greenhouse first.';
    case 'lab': return online(s, 'garage') ? ((s.items.dish_antenna ?? 0) > 0 ? null : 'Needs the Dish Antenna from Pathfinder-X.') : 'Build the Garage first.';
    case 'recreation': return started('lab') ? null : 'Start the Lab first.';
    case 'roof': return started('lab') ? ((s.items.titanium_plate ?? 0) > 0 ? null : 'Needs a Titanium Plate.') : 'Start the Lab first.';
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
    if (id === 'rover_shielding') emit({ type: 'astra', lineId: 'astra.rad.rover_shield', mood: 'cheerful' });
  }
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
  const why = canPay(s, u);
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

/**
 * Player commands. Returns { ok: true, events } or { ok: false, error }.
 *   build { module }            a free awake drone starts building
 *   upgrade { module }          Tier 2 install (half a Sol of drone time)
 *   craft { recipe }            the Workshop makes one item
 *   useKit { kit, drone }       a Repair Kit or Reboot Kit wakes a drone
 *   wakeDrone { drone }         the tutorial battery step wakes Drone #01
 *   choose { choice }           answer the pending dilemma or event
 *   miniResult { game, win }    the result of a mini-game
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
  switch (cmd?.type) {
    case 'wakeDrone': {
      const d = s.drones.find((x) => x.id === cmd.drone);
      if (!d) return fail('Unknown drone.');
      if (d.status === 'awake') return fail('That drone is already awake.');
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
    case 'craft': {
      const rec = RECIPES[cmd.recipe];
      if (!rec) return fail('Unknown recipe.');
      if (!online(s, 'workshop')) return fail('Build the Workshop first.');
      if (s.crafting) return fail('The Workshop is busy.');
      if (rec.kind !== 'kit' && s.upgrades[cmd.recipe]) return fail('Already crafted.');
      const why = canPay(s, rec);
      if (why) return fail(why);
      pay(s, rec);
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
