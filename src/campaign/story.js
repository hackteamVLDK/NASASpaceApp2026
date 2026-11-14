/**
 * The story layer of the campaign (SCENARIO Sections 1 and 6): acts, ASTRA lines by trigger,
 * the five dilemmas, the four random events and mini-game results. All text is referenced by
 * line ID (strings.js); this file only decides WHEN something happens and WHAT it changes.
 * Delayed effects are timers with a name (`runTimer`), so the whole state stays plain data.
 */
import { SOL, MODULE_LINES, RECYCLER, BREAKDOWNS, BREAKDOWN_RULES } from './data.js';
import { clockAt, online, at, addMod, after, clampTo, powerCapOf } from './util.js';

const say = (emit, lineId, mood = 'calm') => emit({ type: 'astra', lineId, mood });
const once = (s, id, cond, fn) => {
  const key = `_${id}`;
  if (!s.flags[key] && cond()) { s.flags[key] = true; fn(); }
};
export const addTask = (s, game, why) => { if (!s.tasks.some((t) => t.game === game)) s.tasks.push({ game, why }); };
const dropTask = (s, game) => { s.tasks = s.tasks.filter((t) => t.game !== game); };
// Power is capped by the battery (100, 250 or 400), not by 100: "Top Up" must not throw stored Power away.
const setRes = (s, k, delta) => { s.res[k] = clampTo(s.res[k] + delta, 0, k === 'sp' ? 999 : k === 'power' ? powerCapOf(s) : 100); };
const hurt = (s, hp) => { s.hp = clampTo(s.hp - hp, 0, s.hpMax); };

/** Scripted storm of Act I: Sols 4-6, solar x0.3 (3.3, Dilemma 1). */
export const STORM_FROM = at(4, 6);
export const STORM_TO = at(6, 23);

// ------------------------------------------------------------------ time triggers

export function storyMinute(s, emit, now) {
  const { sol, hour } = now;
  once(s, 'act1', () => true, () => emit({ type: 'act', act: 1, lineId: 'astra.act1.title' }));
  if (now.minute === 0) scheduleBreakdown(s, emit, sol);
  once(s, 'sunset', () => sol === 1 && now.hourFloat >= 17.5, () => say(emit, 'astra.act1.first_sunset', 'curious'));
  once(s, 'dusk', () => sol === 1 && hour >= 18, () => say(emit, 'astra.act1.first_dusk', 'calm'));
  once(s, 'firstSleep', () => sol === 2 && hour >= 6, () => say(emit, 'astra.act1.first_sleep', 'cheerful'));
  once(s, 'heatPump', () => sol === 2 && hour >= 18, () => { say(emit, 'astra.act1.heat_warning', 'alert'); addTask(s, 'heat_pump', 'Reroute the heat before the cold night.'); });

  // the dust storm of Act I
  once(s, 'stormBegin', () => s.minute >= STORM_FROM, () => { s.storm = { until: STORM_TO }; say(emit, 'astra.act1.storm_begin', 'alert'); emit({ type: 'storm', on: true }); });
  once(s, 'stormMid', () => sol === 5 && hour >= 12, () => say(emit, 'astra.act1.storm_mid', 'calm'));
  if (s.storm && s.minute >= s.storm.until) endStorm(s, emit);

  // dilemma 1 at the end of Sol 3
  once(s, 'd1', () => sol >= 3 && hour >= 20 && !s.away, () => startPending(s, emit, 'dilemma', 'd1'));
  // dilemmas 2, 3, 4 follow the story, not fixed Sols
  once(s, 'd2', () => sol >= 8 && hour >= 10 && online(s, 'workshop') && !s.away && !s.pending, () => startPending(s, emit, 'dilemma', 'd2'));
  once(s, 'd3', () => sol >= 11 && hour >= 10 && online(s, 'greenhouse') && !s.away && !s.pending, () => startPending(s, emit, 'dilemma', 'd3'));
  once(s, 'd4', () => sol >= 16 && hour >= 18 && online(s, 'lab') && !s.away && !s.pending, () => startPending(s, emit, 'dilemma', 'd4'));

  // black box decoding once the Lab stands
  once(s, 'blackbox', () => online(s, 'lab') && (s.items.black_box ?? 0) > 0 && sol >= 16 && hour >= 6 && !s.pending, () => {
    say(emit, 'astra.act3.blackbox_decode_start', 'curious');
    for (const id of ['log.pathfinder.01', 'log.pathfinder.02', 'log.pathfinder.03', 'log.pathfinder.04']) emit({ type: 'log', lineId: id });
    say(emit, 'astra.act3.blackbox_react1', 'curious');
    say(emit, 'astra.act3.blackbox_react2', 'curious');
    emit({ type: 'logbook', card: 'marsquakes' });
    addTask(s, 'antenna', 'Earth is listening. Point the dish.');
  });
  once(s, 'deepScan', () => s.modules.lab.tier === 2 && sol >= 19, () => say(emit, 'astra.act3.deep_scan', 'cheerful'));
  once(s, 'finalPrep', () => canFinale(s), () => say(emit, 'astra.act3.final_prep', 'cheerful'));
  once(s, 'sandbox', () => sol >= 21, () => { emit({ type: 'sandbox' }); say(emit, 'astra.sandbox.start', 'cheerful'); });
  once(s, 'milestone50', () => sol >= 50, () => say(emit, 'astra.sandbox.milestone_50', 'cheerful'));
}

export const canFinale = (s) => Boolean(s.upgrades.titanium_wheels && s.upgrades.deep_ice_drill && s.upgrades.rover_shielding && s.modules.garage.tier === 2 && s.modules.lab.tier === 2);

function endStorm(s, emit) {
  s.storm = null;
  s.mods = s.mods.filter((m) => m.id !== 'd1a_saver');
  say(emit, 'astra.act1.storm_end', 'cheerful');
  emit({ type: 'storm', on: false });
  s.flags.panelsCleaned = false;
  addTask(s, 'solar_wipe', 'The storm left dust on the panels.');
  s.flags.filterDue = clockAt(s.minute).sol + 1;
}

// ------------------------------------------------------------------ each new Sol

const EVENTS = [
  { id: 'e1', first: 8, chance: 0.1, cooldown: 6, needs: () => true },
  { id: 'e2', first: 5, chance: 0.15, cooldown: 4, needs: () => true },
  { id: 'e3', first: 10, chance: 0.1, cooldown: 5, needs: () => true },
  { id: 'e4', first: 10, chance: 0.15, cooldown: 4, needs: (s) => online(s, 'greenhouse') },
];

export function onSol(s, emit, now, rand) {
  const { sol } = now;
  if (s.flags.filterDue === sol) { addTask(s, 'air_filter', 'Dust rode in on the suit. Scrub the air filter.'); s.flags.filterClog = BREAKDOWN_RULES.filterOutput; }
  if (sol === 7 && s.drones[1].status === 'awake') once(s, 'act2', () => true, () => emit({ type: 'act', act: 2, lineId: 'astra.act2.title' }));
  if (sol % 5 === 0 && sol > 20) say(emit, 'astra.sandbox.random_tip', 'curious');
  if (sol === 14 && !s.flags._radLesson) { s.flags._radLesson = true; say(emit, 'astra.act3.radiation_lesson', 'curious'); }

  // random Martian events: at most one per Sol, never on a dilemma Sol, never while the Commander is away
  const dilemmaSol = [3, 8, 11, 16, 18].includes(sol);
  if (dilemmaSol || s.away || s.pending || sol < 5) return;
  s.flags.lastEvent ??= {};
  for (const ev of EVENTS) {
    if (sol < ev.first || !ev.needs(s)) continue;
    if (sol - (s.flags.lastEvent[ev.id] ?? -99) < ev.cooldown) continue;
    if (rand() >= ev.chance) continue;
    s.flags.lastEvent[ev.id] = sol;
    if (ev.id === 'e1' && s.modules.lab.tier === 2) { say(emit, 'astra.e1.watch', 'curious'); s.flags.flareWarned = true; }
    after(s, at(sol, 10), `event:${ev.id}`);
    break;
  }
}

/**
 * Recurring breakdowns (2.1, 4.1-4.4). At dawn, at most one system breaks, never sooner than
 * two Sols after the last one, never with two already open, and never while the Commander
 * is away (Base Autopilot). The system stays weaker until its mini-game is won.
 */
function scheduleBreakdown(s, emit, sol) {
  // Checked every hour, not only at dawn: a Commander who is out with the Rover every dawn would
  // otherwise never see a breakdown. It waits until he is home and the loot screen is done.
  if (s.away || s.pending || s.minute - (s.flags.lastReturn ?? -1e9) < 90) return;
  const b = (s.flags.breaks ??= { last: 0, due: Object.fromEntries(Object.entries(BREAKDOWNS).map(([k, v]) => [k, v.firstSol])) });
  const open = s.tasks.filter((t) => Object.hasOwn(BREAKDOWNS, t.game)).length;
  if (open >= BREAKDOWN_RULES.maxOpen || sol - b.last < BREAKDOWN_RULES.minGapSols) return;
  const kind = Object.keys(BREAKDOWNS).filter((k) => b.due[k] <= sol && !s.tasks.some((t) => t.game === k)).sort((x, y) => b.due[x] - b.due[y])[0];
  if (!kind) return;
  b.last = sol;
  b.due[kind] = sol + BREAKDOWNS[kind].every;
  if (kind === 'solar_wipe') s.mult.solar = Math.max(0.2, s.mult.solar - BREAKDOWN_RULES.solarLoss);
  if (kind === 'air_filter') s.flags.filterClog = BREAKDOWN_RULES.filterOutput;
  if (kind === 'valve_balance') s.flags.valveStuck = true;
  if (kind === 'water_sort') s.recycleEta = RECYCLER.cracked;
  addTask(s, kind, BREAKDOWNS[kind].why);
  emit({ type: 'breakdown', kind });
  emit({ type: 'toast', text: BREAKDOWNS[kind].why });
}

// ------------------------------------------------------------------ hooks from the engine

const RIGHT_WING = ['workshop', 'lab', 'battery', 'garage', 'greenhouse', 'recreation'];

/** The Commander moved to `where`: the first visit to a room without the Roof Layer gets ASTRA's warning. */
export function onMove(s, emit, where) {
  once(s, 'partialRoom', () => RIGHT_WING.includes(where) && !online(s, 'roof'), () => say(emit, 'astra.rad.partial_room', 'calm'));
}

export function onModuleStart(s, id, emit) {
  const l = MODULE_LINES[id]?.start;
  if (l) say(emit, l, 'cheerful');
}

export function onModuleBuilt(s, id, emit) {
  const l = MODULE_LINES[id]?.built;
  if (l) say(emit, l, 'cheerful');
  if (id === 'greenhouse') after(s, s.minute + SOL, 'harvest');
}

export function onKit(s, kit, emit) {
  if (kit === 'repair_kit') say(emit, 'astra.act1.repair_kit_ready', 'cheerful');
  if (kit === 'reboot_kit') say(emit, 'astra.act2.reboot_kit', 'cheerful');
  emit({ type: 'kit', kit });
}

/** A drone woke up: Act transitions and the drone nicknames (SCENARIO 2.5, 3.8). */
export function onDroneAwake(s, id, emit) {
  if (id === 'drone-02') {
    say(emit, 'astra.act1.drone02_wake', 'cheerful');
    say(emit, 'astra.char.bumble', 'cheerful');
    say(emit, 'astra.act1.end', 'cheerful');
    if (clockAt(s.minute).sol >= 7) emit({ type: 'act', act: 2, lineId: 'astra.act2.title' });
    s.act = 2;
  }
  if (id === 'drone-03') {
    say(emit, 'astra.act2.drone03_wake', 'cheerful');
    say(emit, 'astra.char.zip', 'cheerful');
    say(emit, 'astra.act2.end', 'cheerful');
    emit({ type: 'act', act: 3, lineId: 'astra.act3.title' });
    s.act = 3;
  }
}

// ------------------------------------------------------------------ pending dilemmas and events

export function startPending(s, emit, kind, id) {
  s.pending = { kind, id };
  if (id === 'e1' || id === 'd5') s.flags.flare = true; // the sky shows the flare while the Commander decides
  emit({ type: kind, id });
}

/**
 * Why a choice cannot be picked right now, or null. A choice that costs Spare Parts or Water
 * needs them in stock, and the Cargo Trailer needs a Garage to hang it on.
 */
export function choiceBlock(s, pending, choice) {
  const key = `${pending.id}${choice}`;
  if ((key === 'd2a' || key === 'd2b') && s.res.sp < 12) return 'Not enough Spare Parts for that. Pick another way.';
  if (key === 'd2b' && !['building', 'online'].includes(s.modules.garage.status)) return 'The Cargo Trailer needs the Garage & Airlock. Start building it first, or pick another way.';
  if (key === 'd3a' && s.res.water < 10) return 'Not enough Water for that. Pick another way.';
  if (key === 'd3b' && s.res.water < 20) return 'Not enough Water for that. Pick another way.';
  return null;
}

/** Run an action the player picked. Called by command({type:'choose'}). */
export function applyChoice(s, pending, choice, emit, rand) {
  const key = `${pending.id}${choice}`;
  const { sol } = clockAt(s.minute);
  if (pending.id === 'e1' || pending.id === 'd5') s.flags.flare = false;
  const follow = (lineId, mood = 'cheerful') => say(emit, lineId, mood);
  switch (key) {
    // ---- Dilemma 1: the dust storm
    case 'd1a':
      addMod(s, 'd1a_saver', 'power', 6, STORM_TO);
      addMod(s, 'd1a_cold', 'morale', -3, STORM_TO);
      after(s, at(7, 6), 'd1a');
      break;
    case 'd1b':
      setRes(s, 'power', 40);
      hurt(s, 10);
      after(s, at(4, 8), 'd1b');
      break;
    case 'd1c':
      after(s, at(6, 6), 'd1c');
      break;
    // ---- Dilemma 2: the cracked filter (SP 12)
    case 'd2a':
      setRes(s, 'sp', -12);
      s.recycleEta = RECYCLER.cracked;
      addTask(s, 'water_sort', 'Fix the recycler filter.');
      follow('astra.d2.a');
      break;
    case 'd2b':
      setRes(s, 'sp', -12);
      s.recycleEta = RECYCLER.cracked;
      s.flags.cargoTrailer = true;
      after(s, at(Math.max(11, sol + 3), 6), 'd2b_fix');
      break;
    case 'd2c':
      s.recycleEta = RECYCLER.cracked;
      addMod(s, 'd2c_ration', 'water', 7.5, at(sol + 2, 6));
      addMod(s, 'd2c_tired', 'morale', -2, at(sol + 2, 6));
      addMod(s, 'd2c_hp', 'hp', -2, at(sol + 2, 6));
      after(s, at(sol + 2, 6), 'd2c_fix');
      break;
    // ---- Dilemma 3: the Martian soil test
    case 'd3a':
      setRes(s, 'water', -10);
      after(s, at(sol + 2, 8), 'd3a');
      break;
    case 'd3b':
      setRes(s, 'water', -20);
      after(s, at(sol + 2, 8), 'd3b');
      break;
    case 'd3c':
      s.flags.washUnlocked = true;
      follow('astra.d3.c');
      break;
    // ---- Dilemma 4: cold plants or call home
    case 'd4a':
      setRes(s, 'morale', -5);
      s.flags.earthWindow = sol + 3;
      follow('astra.d4.a');
      break;
    case 'd4b':
      addTask(s, 'antenna', 'Call Earth tonight.');
      s.flags.d4b = true;
      break;
    case 'd4c':
      addMod(s, 'd4c_food', 'food', -2, at(sol + 1, 6));
      setRes(s, 'morale', 5);
      follow('astra.d4.c');
      break;
    // ---- Dilemma 5 is answered inside the expedition (expeditions.js)
    // ---- Event 1: solar flare
    case 'e1a': { const h0 = s.hp; hurt(s, 1); setRes(s, 'sp', -3); setRes(s, 'food', -5); s.stats.flares += 1; s.stats.flareMaxLoss = Math.max(s.stats.flareMaxLoss, h0 - s.hp); follow('astra.e1.a'); break; }
    case 'e1b': {
      const h0 = s.hp;
      const where = s.where;
      hurt(s, where === 'outside' ? 30 : ['workshop', 'lab', 'battery', 'garage', 'greenhouse', 'recreation'].includes(where) && !online(s, 'roof') ? 9 : 2);
      s.stats.flares += 1;
      s.stats.flareMaxLoss = Math.max(s.stats.flareMaxLoss, h0 - s.hp);
      follow('astra.e1.b', 'calm');
      break;
    }
    case 'e1c': { const h0 = s.hp; hurt(s, 1); s.stats.flares += 1; s.stats.flareMaxLoss = Math.max(s.stats.flareMaxLoss, h0 - s.hp); follow('astra.e1.c'); break; }
    // ---- Event 2: dust devil
    case 'e2a':
      if (rand() < 0.5) { s.mult.solar = 1.2; after(s, at(sol + 3, 6), 'solar_normal'); follow('astra.e2.a.clean'); } else { s.mult.solar = 0.7; addTask(s, 'solar_wipe', 'The dust devil dumped dust on the panels.'); follow('astra.e2.a.dusty', 'calm'); }
      break;
    case 'e2b': s.mult.solar = 0.5; after(s, at(sol + 1, 6), 'solar_normal'); follow('astra.e2.b'); break;
    case 'e2c': hurt(s, 5); s.mult.solar = 1.1; after(s, at(sol + 3, 6), 'solar_normal'); follow('astra.e2.c'); break;
    // ---- Event 3: airlock micro-leak
    case 'e3a': addTask(s, 'valve_balance', 'Hunt the leak.'); break;
    case 'e3b': setRes(s, 'sp', -1); s.mods = s.mods.filter((m) => m.id !== 'leak' && m.id !== 'leak_w'); after(s, at(sol + 3, 6), 'leak_returns'); follow('astra.e3.b'); break; // the tape stops the leak at once
    case 'e3c': s.flags.noLaunchUntil = at(sol + 1, 6); follow('astra.e3.c'); break;
    // ---- Event 4: nutrient drift
    case 'e4a': addTask(s, 'nutrient_match', 'Match the nutrients.'); s.mult.food = 0.6; s.flags.freshOff = true; break;
    case 'e4b': setRes(s, 'water', -10); s.mult.food = 0.6; after(s, at(sol + 1, 6), 'drift_fixed'); follow('astra.e4.b'); break;
    case 'e4c': s.mult.food = 0.6; s.flags.freshOff = true; after(s, at(sol + 2, 6), 'drift_wilt'); break;
    default:
      if (pending.id === 'd5') s.flags.d5Choice = choice; // read by expeditions.js
  }
}

// ------------------------------------------------------------------ delayed effects

export function runTimer(s, id, emit) {
  const follow = (lineId, mood = 'cheerful') => say(emit, lineId, mood);
  switch (id) {
    case 'd1a': setRes(s, 'morale', 5); follow('astra.d1.a'); break;
    case 'd1b': follow('astra.d1.b'); break;
    case 'd1c':
      s.flags._d1c = true;
      // 6, Dilemma 1 C: Power hits 0, a Power Emergency, Static Wipe and Heat Pump, Morale -10 — whatever Power was left.
      s.res.power = 0;
      setRes(s, 'morale', -10);
      addTask(s, 'solar_wipe', 'The storm drained the batteries. Clean the panels.');
      addTask(s, 'heat_pump', 'No power for heating. Reroute the heat.');
      follow('astra.d1.c', 'calm');
      break;
    case 'd2b_fix': s.recycleEta = RECYCLER.ok; setRes(s, 'sp', -12); follow('astra.d2.b'); break;
    case 'd2c_fix': s.recycleEta = RECYCLER.ok; follow('astra.d2.c'); break;
    case 'd3a': setRes(s, 'morale', -3); s.flags.washUnlocked = true; follow('astra.d3.a', 'calm'); break;
    case 'd3b': s.flags.soilBeds = true; addMod(s, 'd3b_beds', 'food', 3); s.research += 5; follow('astra.d3.b'); break;
    case 'solar_normal': s.mult.solar = 1; break;
    case 'leak_returns': addMod(s, 'leak', 'oxygen', -2); addMod(s, 'leak_w', 'water', -1); break;
    case 'drift_fixed': s.mult.food = 1; break;
    case 'drift_wilt': if (s.mult.food < 1) { setRes(s, 'food', -10); addTask(s, 'nutrient_match', 'The plants wilted. Fix the mix.'); } break; // nothing wilts if the mix was fixed in time
    case 'harvest': say(emit, 'astra.act2.first_harvest', 'cheerful'); break;
    case 'd4_cold_end': s.flags.freshOff = false; s.mult.food = 1; break;
    case 'finale_earth': follow('astra.finale.earth'); after(s, s.minute + 60, 'finale_closing'); break;
    case 'finale_closing': follow('astra.finale.closing'); emit({ type: 'finale' }); break;
    default:
      if (id.startsWith('event:')) {
        // SCENARIO 2.1: dilemmas and random events wait until the Commander is home (and a little after, for the loot screen)
        if (s.away || s.pending || s.minute - (s.flags.lastReturn ?? -1e9) < 90) { after(s, s.minute + 30, id); return; }
        startPending(s, emit, 'event', id.slice(6));
      }
  }
}

// ------------------------------------------------------------------ mini-game results

const MINI_LINES = { solar_wipe: 'astra.mg.solar_wipe', heat_pump: 'astra.mg.heat_pump_reroute', valve_balance: 'astra.mg.valve_balance', water_sort: 'astra.mg.water_sort', nutrient_match: 'astra.mg.nutrient_match', air_filter: 'astra.mg.air_filter_scrub', antenna: 'astra.mg.dish_antenna_alignment', wheel_vacuum: 'astra.mg.wheel_pebble_vacuum', suit_seal: 'astra.mg.suit_seal_check' };

const PREP_GAMES = ['wheel_vacuum', 'suit_seal']; // before every trip (5.1)
const TUTORIAL_GAMES = ['solar_wipe', 'battery']; // the Sol 1 tutorial plays these once without a task

/**
 * Why a mini-game result is refused, or null. A game only counts when the base asked for it:
 * a task on offer (which includes every Emergency), the prep before a trip, or the tutorial.
 * Without this, reporting wins over and over gave free Spare Parts and free Heat.
 */
export function miniBlock(s, game) {
  if (s.away) return 'The Commander is out with the Rover.'; // base jobs wait until he is home (2.1)
  if (s.tasks.some((t) => t.game === game)) return null;
  if (PREP_GAMES.includes(game)) return s.away ? 'The Rover is already out.' : null;
  if (TUTORIAL_GAMES.includes(game) && clockAt(s.minute).sol === 1 && !s.flags.mini?.[game]) return null;
  return 'That job is not needed right now.';
}

export function onMini(s, { game, win }, emit) {
  const rec = (s.flags.mini ??= {});
  // The prep games pay once per trip, not once per try.
  const onOffer = s.tasks.some((t) => t.game === game);
  const prepAlreadyDone = !onOffer && ((game === 'wheel_vacuum' && s.flags.prepWheel === 'ok') || (game === 'suit_seal' && s.flags.prepSuit));
  if (win && !prepAlreadyDone) {
    s.stats.miniWins += 1;
    if (game === 'solar_wipe') s.stats.wipes += 1;
    setRes(s, 'sp', 2);
    if (!rec[game]) { rec[game] = true; if (MINI_LINES[game]) say(emit, MINI_LINES[game], 'cheerful'); } else emit({ type: 'toast', text: 'Nice work!' });
  }
  if (game === 'solar_wipe') {
    if (win) {
      dropTask(s, 'solar_wipe');
      s.flags.panelsCleaned = true;
      if (s.mult.solar < 1) { s.mult.solar = 1; }
      if (s.emergency.power) { s.res.power = Math.max(s.res.power, 25); s.emergency.power = false; }
    }
  } else if (game === 'heat_pump') {
    if (win) { dropTask(s, 'heat_pump'); setRes(s, 'heat', 12); if (s.emergency.heat) { s.res.heat = Math.max(s.res.heat, 25); s.emergency.heat = false; } } else setRes(s, 'heat', -10);
  } else if (game === 'valve_balance') {
    if (win) {
      dropTask(s, 'valve_balance');
      if (s.emergency.oxygen) { s.res.oxygen = Math.max(s.res.oxygen, 25); s.emergency.oxygen = false; }
      s.mods = s.mods.filter((m) => m.id !== 'leak' && m.id !== 'leak_w');
      s.flags.valveStuck = false;
    }
  } else if (game === 'water_sort') {
    if (win) { dropTask(s, 'water_sort'); s.recycleEta = RECYCLER.ok; }
  } else if (game === 'nutrient_match') {
    if (win) { dropTask(s, 'nutrient_match'); s.mult.food = 1; s.flags.freshOff = false; }
  } else if (game === 'air_filter') {
    if (win) { dropTask(s, 'air_filter'); s.flags.filterClog = null; } else if (s.flags.filterClog) s.flags.filterClog = BREAKDOWN_RULES.filterOutputAfterFail; // 4.2: the cells already cleaned count
  } else if (game === 'antenna') {
    if (win) {
      dropTask(s, 'antenna');
      setRes(s, 'morale', s.flags.d4b ? 10 : 5);
      s.research += s.flags.d4b ? 10 : 0;
      say(emit, 'astra.act3.earth_reply', 'cheerful');
      s.flags.earthContact = true;
      emit({ type: 'earth-contact' });
      emit({ type: 'badge', id: 'first_contact' });
      if (s.flags.d4b) {
        s.flags.d4b = false;
        s.flags.freshOff = true;
        s.mult.food = 0.5;
        after(s, s.minute + 2 * SOL, 'd4_cold_end');
        say(emit, 'astra.d4.b', 'calm');
        addTask(s, 'nutrient_match', 'The plants got chilly. Fix the mix.');
      }
    } // a failed try keeps Dilemma 4 B open: the retry still brings the full call home
  } else if (game === 'wheel_vacuum') {
    if (win) dropTask(s, 'wheel_vacuum'); // also clears the extra check after a Bumpy or Rough ride
    s.flags.prepWheel = win ? 'ok' : 'failed';
  } else if (game === 'suit_seal') {
    if (win) s.flags.prepSuit = true;
  }
}
