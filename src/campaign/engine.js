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
  MODULES, BUILD_SOLS, UPGRADE_SOLS, DRONE_BUILD_POWER, STORM, RECIPES, UPGRADES, MODULE_LINES,
} from './data.js';
import { clockAt, isNight, online } from './util.js';
import { storyMinute, onSol, applyChoice, onModuleStart, onModuleBuilt, onKit, onMini, runTimer, onDroneAwake } from './story.js';
import { expeditionMinute, startExpedition, radioChoice } from './expeditions.js';

export const STATE_VERSION = 1;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const has = (o, k) => Object.hasOwn(o, k);

export { clockAt, isNight, isDay, online } from './util.js';

export function createCampaign({ seed = 1 } = {}) {
  const modules = {};
  for (const [id, m] of Object.entries(MODULES)) modules[id] = { status: m.prebuilt ? 'online' : 'unbuilt', tier: 1, progress: 0, drone: null, upgrading: null };
  return {
    version: STATE_VERSION,
    rng: seedFrom(seed),
    minute: START_MINUTE,
    status: 'running', // running | complete
    res: { ...START_RES },
    hp: HP.commanderMax,
    hpMax: HP.commanderMax,
    research: 0,
    modules,
    drones: ['drone-01', 'drone-02', 'drone-03'].map((id) => ({ id, status: 'dormant', task: null })),
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
    stats: { builds: 0, miniWins: 0, flares: 0, expeditions: 0 },
    where: 'bedroom',
  };
}

// ------------------------------------------------------------------ rates

const tierFx = (s, id) => (s.modules[id].tier === 2 && MODULES[id].t2 ? MODULES[id].t2 : MODULES[id].t1);

export function powerCap(s) {
  const b = MODULES.battery;
  return online(s, 'battery') ? b.powerCap[s.modules.battery.tier - 1] : CAP.power;
}

/** Net change per Sol of every meter, from the current state (3.2, 3.3, 3.4). */
export function rates(s) {
  const r = { power: NEEDS.power, heat: BASE_HEAT_LOSS, water: -NEEDS.waterUsed * (1 - s.recycleEta), oxygen: NEEDS.oxygen, food: NEEDS.food, morale: NEEDS.morale, sp: 0 };
  const blackout = s.res.power <= 0;
  for (const id of Object.keys(MODULES)) {
    if (!online(s, id)) continue;
    if (blackout && id !== 'lifesupport' && id !== 'solar') continue; // non-life-support modules switch off
    for (const [k, v0] of Object.entries(tierFx(s, id))) {
      if (!has(r, k)) continue;
      let v = v0;
      if (id === 'solar' && k === 'power') v = v0 * s.mult.solar * (s.storm ? (s.modules.solar.tier === 2 ? STORM.solarT2 : STORM.solarT1) : 1);
      if (id === 'battery' && k === 'power' && s.storm) v = v0 * STORM.batteryPowerMult;
      if (id === 'greenhouse' && k === 'food') v = v0 * s.mult.food;
      r[k] += v;
    }
  }
  const building = s.drones.filter((d) => d.task && (d.task.type === 'build' || d.task.type === 'upgrade')).length;
  r.power += DRONE_BUILD_POWER * building;
  if (s.drones.some((d) => d.status === 'awake' && !d.task)) r.sp += 2; // idle-drone salvage
  for (const m of s.mods) if (has(r, m.res) && (m.untilMinute == null || s.minute < m.untilMinute)) r[m.res] += m.perSol;
  return r;
}

/** Where the Commander is right now (visual and radiation). */
export function locationAt(s) {
  if (s.away) return 'away';
  if (s.medRest || s.flags.shelter) return 'bedroom';
  const { hourFloat, hour } = clockAt(s.minute);
  if (isNight(hourFloat)) return 'bedroom';
  if (MEALS.includes(hour)) return 'kitchen';
  if (s.flags.outside) return 'outside';
  return online(s, 'workshop') ? 'workshop' : 'kitchen';
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
  s.where = locationAt(s);
  stepHp(s, emit, now);

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
  if (s.modules.lifesupport.tier === 2 && (s.items.ice_core ?? 0) > 0 && s.res.water <= 75) { s.items.ice_core -= 1; s.res.water = clamp(s.res.water + 25, 0, CAP.water); emit({ type: 'melted', cores: 1 }); }

  // Workshop crafting
  if (s.crafting) {
    const rate = s.modules.workshop.tier === 2 ? 2 : 1;
    s.crafting.progress += dt * rate * mult;
    if (s.crafting.progress >= 1) finishCraft(s, emit);
  }

  // timers, story, expedition
  for (const t of s.timers.filter((x) => s.minute >= x.at)) { onTimer(s, t, emit); }
  s.timers = s.timers.filter((x) => s.minute < x.at);
  expeditionMinute(s, emit);
  checkMeters(s, emit);
  storyMinute(s, emit, now);
}

function onNewSol(s, emit, now) {
  for (const k of Object.keys(s.low)) if (s.res[k] > 40) s.low[k] = false;
  emit({ type: 'sol', sol: now.sol });
  onSol(s, emit, now, () => nextRandom(s));
}

function onTimer(s, t, emit) {
  s.timers = s.timers.filter((x) => x !== t);
  runTimer(s, t.id, emit);
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
  if (s.hp <= 0 && !s.away) {
    s.medRest = { until: s.minute + SOL };
    emit({ type: 'astra', lineId: 'astra.hp.zero_base', mood: 'calm' });
  }
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
      emit({ type: 'astra', lineId: line, mood: 'alert' });
      emit({ type: 'emergency', kind: k, mini: { power: 'solar_wipe', heat: 'heat_pump', oxygen: 'valve_balance' }[k] });
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
}

function finishUpgrade(s, d, emit) {
  const id = d.task.module;
  const m = s.modules[id];
  m.tier = 2;
  m.upgrading = null;
  d.task = null;
  emit({ type: 'upgraded', module: id });
  if (UPGRADES[id]?.line) emit({ type: 'astra', lineId: UPGRADES[id].line, mood: 'cheerful' });
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
    case 'build': {
      const id = cmd.module;
      const m = s.modules[id];
      if (!m || !MODULES[id] || MODULES[id].prebuilt) return fail('Unknown module.');
      if (m.status !== 'unbuilt') return fail(m.status === 'online' ? 'Already finished.' : 'Already being built.');
      const why = unlockReason(s, id) ?? canPay(s, MODULES[id].cost);
      if (why) return fail(why);
      const d = freeDrone(s);
      if (!d) return fail('No free drone. Wake a drone or wait for one to finish.');
      pay(s, MODULES[id].cost);
      m.status = 'building';
      m.progress = 0;
      m.drone = d.id;
      d.task = { type: 'build', module: id };
      emit({ type: 'build-started', module: id, drone: d.id });
      onModuleStart(s, id, emit);
      break;
    }
    case 'upgrade': {
      const id = cmd.module;
      const u = UPGRADES[id];
      const m = s.modules[id];
      if (!u || !m) return fail('No upgrade for that module.');
      if (m.status !== 'online') return fail('Build it first.');
      if (m.tier === 2 || m.upgrading) return fail('Already upgraded.');
      if (id === 'garage' && s.flags.noUpgradeUntilBack) return fail('Not now.');
      const why = canPay(s, u);
      if (why) return fail(why);
      const d = freeDrone(s);
      if (!d) return fail('No free drone.');
      pay(s, u);
      m.upgrading = { progress: 0, drone: d.id };
      d.task = { type: 'upgrade', module: id };
      emit({ type: 'upgrade-started', module: id });
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
      s.pending = null;
      applyChoice(s, p, cmd.choice, emit, () => nextRandom(s));
      emit({ type: 'chosen', id: p.id, choice: cmd.choice });
      break;
    }
    case 'miniResult': {
      onMini(s, cmd, emit);
      break;
    }
    case 'melt': {
      if (!online(s, 'lifesupport')) return fail('Life Support is offline.');
      if ((s.items.ice_core ?? 0) < 1) return fail('You have no Ice Core.');
      if (s.res.water > 75) return fail('The tank is nearly full.');
      s.items.ice_core -= 1;
      s.res.water = clamp(s.res.water + 25, 0, CAP.water);
      emit({ type: 'melted', cores: 1 });
      break;
    }
    case 'surface': {
      s.flags.outside = Boolean(cmd.on);
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
