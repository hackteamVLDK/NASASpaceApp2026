/**
 * Off-screen expeditions (SCENARIO Section 5). The Rover leaves the screen; a progress bar, the
 * Commander's HP and a radio log follow it. HP cost follows the scenario formula
 *   dHP = 20 * D * R * (1 - RR) * S_rover * S_suit * F    (Fitness multiplier is not modelled yet)
 * spread evenly over the trip; risk is rolled on return and is never a total loss.
 *
 * Which trips can be made (5.2):
 *   - the five story expeditions are made ONCE each;
 *   - Expedition 4 can be made a second time, as a 1-Sol trip for what was left behind, if the
 *     crew raced home on Dilemma 5 (choice A);
 *   - the Scrap Run (`run`) and the Ice Run (`ice`, needs the Deep Ice Drill) are repeatable.
 */
import { SOL, HP } from './data.js';
import { clockAt, online, after, clampTo } from './util.js';
import { nextRandom } from '../sim/rng.js';
import { addTask, scheduleBreakdown } from './story.js';

const RR_COMMANDER = 0.15;
const ROUTE = { floor: 1.0, rim: 1.25, delta: 1.25, canyon: 1.5 };
const RISK_TABLE = { low: [0.85, 0.15, 0], medium: [0.6, 0.3, 0.1], high: [0.4, 0.4, 0.2] };
const RISK_STEPS = ['low', 'medium', 'high'];
const ROUGH_DELAY = 0.5 * SOL; // 5.1: a Rough trip is back half a Sol late
const ALREADY = 'You have already explored that place.';

/** What Dilemma 5 choice A leaves at the Delta Cliffs (full loot of 5.2 minus what came home). */
const EXP4_REST = Object.freeze({ sp: 15, items: { rare_battery_cell: 1, mineral_sample: 2, titanium_plate: 1, circuit_board: 2 } });

const done = (s, id) => Boolean(s.flags.done?.[id]);
/** A story place can be visited once; then the map shows it as explored. */
const once = (id, rule) => (s) => (done(s, id) ? ALREADY : rule(s));

/** Why the finale cannot start yet, naming exactly what is missing (so the player knows what to do next). */
export function finaleBlock(s) {
  const missing = [];
  if (!s.upgrades.titanium_wheels) missing.push('Titanium Wheels');
  if (!s.upgrades.deep_ice_drill) missing.push('the Deep Ice Drill');
  if (!s.upgrades.rover_shielding) missing.push('Regolith Radiation Shielding');
  if (s.modules.garage.tier !== 2) missing.push(`the Long-Range Battery (Garage upgrade: 1 Rare Battery Cell${s.flags.exp4Repeat ? ', more are waiting at the Delta Cliffs' : ''})`);
  if (s.modules.lab.tier !== 2) missing.push('the Lab Deep Scan (Lab upgrade)');
  return missing.length ? `Still needed: ${missing.join('; ')}.` : null;
}

/**
 * The expeditions of 5.2. `radio`: percent -> radio line suffix (IDs `radio.expN.<pp>`, 0 is "00").
 * `astra`: percent -> ASTRA line. `story`: items that always drop. `requires(s)`: why it cannot
 * be launched now, or null.
 */
export const EXPEDITIONS = Object.freeze({
  1: { id: 1, nameId: 'ui.exp1.name', sol: 1, route: 'floor', risk: 'low', requires: once(1, (s) => (online(s, 'garage') ? null : 'Build the Garage & Airlock first.')),
    loot: { sp: 15, items: { probe_power_core: 1, circuit_board: 3, titanium_scrap: 2, weather_sensor: 1 } }, story: ['probe_power_core', 'weather_sensor'],
    radio: [0, 30, 60, 80, 100], returnLine: 'astra.exp1.return', mapPos: [0.72, 0.5] },
  2: { id: 2, nameId: 'ui.exp2.name', sol: 1, route: 'floor', risk: 'medium', requires: once(2, (s) => (s.upgrades.titanium_wheels ? null : 'Craft Titanium Wheels first.')),
    loot: { sp: 20, items: { black_box: 1, dish_antenna: 1, solar_cell: 3, titanium_plate: 3, circuit_board: 2 } }, story: ['black_box', 'dish_antenna'],
    radio: [0, 25, 50, 60, 80, 100], astra: { 50: 'astra.act2.pathfinder_found' }, decision: { at: 60 }, returnLine: 'astra.act2.blackbox_home', mapPos: [0.45, 0.2] },
  3: { id: 3, nameId: 'ui.exp3.name', sol: 1, route: 'rim', risk: 'medium', requires: once(3, (s) => (s.upgrades.deep_ice_drill ? null : 'Craft the Deep Ice Drill first.')),
    loot: { sp: 20, items: { ice_core: 3, water_filter_membrane: 1, titanium_plate: 2, circuit_board: 1 } }, story: ['water_filter_membrane'],
    radio: [0, 30, 55, 70, 85, 100], decision: { at: 85 }, returnLine: 'astra.exp3.return', mapPos: [0.3, 0.28] },
  4: { id: 4, nameId: 'ui.exp4.name', sol: 2, route: 'delta', risk: 'high',
    requires: (s) => (done(s, 4) && !s.flags.exp4Repeat ? ALREADY : s.upgrades.rover_shielding ? null : 'Craft Regolith Radiation Shielding first.'),
    loot: { sp: 25, items: { rare_battery_cell: 3, lab_sensor_kit: 1, mineral_sample: 3, titanium_plate: 1, circuit_board: 2 } }, story: ['lab_sensor_kit'],
    radio: [0, 20, 35, 50, 60, 80, 100], astra: { 20: 'astra.exp4.at20', 35: 'astra.exp4.at35' }, decision: { at: 60, dilemma: 'd5' }, mapPos: [0.2, 0.55] },
  5: { id: 5, nameId: 'ui.exp5.name', sol: 2, route: 'canyon', risk: 'low', scripted: true, requires: once(5, (s) => finaleBlock(s)),
    loot: { sp: 30, items: {} }, story: [],
    radio: [0, 25, 50, 55, 70, 95], radioIdMap: { 0: '01', 25: '02', 50: '03', 55: '04', 70: '05', 95: '06' }, astra: { 75: 'astra.finale.leopard', 85: 'astra.finale.methane' }, mapPos: [0.08, 0.35] },
  run: { id: 'run', nameId: 'ui.exp_run.name', sol: 1, route: 'floor', risk: 'low', requires: (s) => (online(s, 'garage') ? null : 'Build the Garage & Airlock first.'),
    loot: { sp: 15, items: {} }, story: [], radio: [0, 50, 100], radioPool: { 0: [1, 2], 50: [1, 3], 100: [1, 2] }, mapPos: [0.6, 0.7] },
  // Ice mode of the repeatable run (5.2, row R): two Ice Cores, no Spare Parts.
  ice: { id: 'ice', nameId: 'ui.exp_run.name', sol: 1, route: 'floor', risk: 'low', requires: (s) => (!online(s, 'garage') ? 'Build the Garage & Airlock first.' : s.upgrades.deep_ice_drill ? null : 'Craft the Deep Ice Drill first.'),
    loot: { sp: 0, items: { ice_core: 2 } }, story: [], radio: [0, 50, 100], radioPool: { 0: [3], 50: [2, 3], 100: [1, 2] }, mapPos: [0.38, 0.72] },
});

/** Is this launch the second, shorter visit to the Delta Cliffs after Dilemma 5 choice A? */
const isExp4Return = (s, ex) => ex.id === 4 && done(s, 4) && Boolean(s.flags.exp4Repeat);

/** Whole trip duration in minutes (Garage Tier 2 takes one Sol off, minimum one). */
export function durationMinutes(s, ex) {
  let sols = ex.sol;
  if (isExp4Return(s, ex)) return SOL; // "Expedition 4 becomes repeatable (1 Sol) to collect the rest"
  if (s.modules.garage.tier === 2 && ex.id !== 5) sols = Math.max(1, sols - 1);
  if (ex.id === 5 && s.modules.garage.tier !== 2) sols = 2;
  if (ex.id === 5 && s.modules.garage.tier === 2) sols = 1;
  return sols * SOL;
}

/** HP the Commander loses over the whole trip. */
export function hpCost(s, ex, { rough = false } = {}) {
  const sols = durationMinutes(s, ex) / SOL;
  let c = HP.radiationPerSol * sols * ROUTE[ex.route] * (1 - RR_COMMANDER);
  if (s.upgrades.rover_shielding) c *= 0.6;
  if (s.upgrades.suit_liner) c *= 0.75;
  return c + (rough ? 5 : 0);
}

/** What the trip would bring home if all goes well (the map card shows this). */
export function expectedLoot(s, ex) {
  return isExp4Return(s, ex) ? EXP4_REST : ex.loot;
}

/** Launch an expedition. Returns an error string or null. */
export function startExpedition(s, key, emit) {
  if (!Object.hasOwn(EXPEDITIONS, key)) return 'Unknown expedition.';
  const ex = EXPEDITIONS[key];
  if (s.away) return 'The Rover is already out.';
  if (s.pending) return 'Decide first.';
  if (s.flags.noLaunchUntil && s.minute < s.flags.noLaunchUntil) return 'The airlock is sealed for now.';
  if (s.medRest) return 'The Commander is resting.';
  const why = ex.requires(s);
  if (why) return why;
  if (s.hp < 25) return 'HP is too low. Rest first.';
  s.res.water = Math.max(0, s.res.water - 2); // the airlock cycle costs 2 Water; trips are never blocked by an empty tank
  let risk = ex.risk;
  if (s.flags.prepWheel === 'failed') risk = RISK_STEPS[Math.min(2, RISK_STEPS.indexOf(risk) + 1)];
  s.flags.prepWheel = null;
  s.flags.prepSuit = false;
  const second = isExp4Return(s, ex);
  const dur = durationMinutes(s, ex);
  s.away = { id: ex.id, key, start: s.minute, end: s.minute + dur, risk, hpTotal: hpCost(s, ex), hpDone: 0, fired: [], decisionDone: second, halfLoot: false, rescued: false, result: null };
  if (second) {
    s.away.customLoot = EXP4_REST; // the rest of the treasure; no second space-weather dilemma
    s.away.second = true;
  }
  s.stats.expeditions += 1;
  s.where = 'away';
  if (ex.id === 1 || s.stats.expeditions === 1) {
    if (!s.flags._mapIntro) { s.flags._mapIntro = true; emit({ type: 'astra', lineId: 'astra.act2.surface_warning', mood: 'alert' }); }
  }
  emit({ type: 'launched', expedition: ex.id });
  return null;
}

/**
 * How far along the Rover trip is, 0..1. A decision that makes the trip longer or shorter moves
 * `end`; the bar must never run backwards, so the new end is reached from the progress the trip
 * had at that moment (`f0` at minute `m0`), not from the start.
 */
export function awayProgress(a, minute) {
  if (!a) return 0;
  const m0 = a.m0 ?? a.start;
  const f0 = a.f0 ?? 0;
  if (a.end <= m0) return minute >= a.end ? 1 : f0;
  return clampTo(f0 + (1 - f0) * ((minute - m0) / (a.end - m0)), 0, 1);
}

/** Move the end of the trip (a radio decision, the weather, a rescue) without the progress bar jumping back. */
function setTripEnd(a, minute, newEnd) {
  a.f0 = awayProgress(a, minute);
  a.m0 = minute;
  a.end = newEnd;
}

/** Answer the radio decision of the running expedition. */
export function radioChoice(s, choice, emit) {
  if (!s.pending || s.pending.kind !== 'radio' || !s.away) return 'Nothing to decide.';
  if (!['a', 'b'].includes(choice)) return 'Pick a or b.';
  const a = s.away;
  s.pending = null;
  a.decisionDone = true;
  if (a.id === 2) {
    if (choice === 'a') setTripEnd(a, s.minute, a.end + 0.25 * SOL); else { a.hpTotal += 5; }
  } else if (a.id === 3) {
    if (choice === 'a') { a.extraIce = 1; setTripEnd(a, s.minute, a.end + 0.25 * SOL); a.hpTotal += 4; }
  }
  emit({ type: 'radio-chosen', choice });
  return null;
}

/** D5, the space weather warning at 60% of Expedition 4 (answered through command 'choose'). */
export function resolveD5(s, emit) {
  const a = s.away;
  if (!a || !s.flags.d5Choice) return;
  const c = s.flags.d5Choice;
  s.flags.d5Choice = null;
  if (c === 'a') {
    s.hp = clampTo(s.hp - 6, 0, s.hpMax);
    a.halfLoot = true;
    a.customLoot = { sp: 10, items: { rare_battery_cell: 2, lab_sensor_kit: 1, mineral_sample: 1 } };
    setTripEnd(a, s.minute, Math.min(a.end, s.minute + 0.25 * SOL));
    s.flags.exp4Repeat = true; // the Delta Cliffs can be visited once more for the rest (see EXP4_REST)
  } else if (c === 'b') {
    s.hp = clampTo(s.hp - 2, 0, s.hpMax);
    s.res.morale = clampTo(s.res.morale - 3, 0, 100);
    setTripEnd(a, s.minute, a.end + SOL);
  } else {
    s.hp = clampTo(s.hp - 14, 0, s.hpMax);
    s.res.morale = clampTo(s.res.morale - 3, 0, 100);
    s.upgrades.rover_shielding = false; // worn out: re-craft for 15 SP
  }
  a.decisionDone = true;
  emit({ type: 'astra', lineId: `astra.d5.${c}`, mood: c === 'c' ? 'calm' : 'cheerful' }); // D-T17g: the choice's own explanation (6, D5)
}

const pp = (n) => String(n).padStart(2, '0');

/** The radio line ID for a progress mark. The repeatable runs pick one line from a small pool (5.3). */
function radioId(s, ex, mark) {
  if (ex.radioPool) {
    const pool = ex.radioPool[mark];
    return `radio.run.${mark}.${pool[Math.floor(nextRandom(s) * pool.length)]}`;
  }
  return `radio.exp${ex.id}.${ex.radioIdMap ? ex.radioIdMap[mark] : pp(mark)}`;
}

/** Called every minute by the engine. */
export function expeditionMinute(s, emit) {
  const a = s.away;
  if (!a) return;
  const ex = EXPEDITIONS[a.key];
  if (s.pending) return;
  if (s.flags.d5Choice) resolveD5(s, emit);
  const frac = awayProgress(a, s.minute);
  // HP drains evenly across the trip
  const wantDone = a.hpTotal * frac;
  if (wantDone > a.hpDone) { s.hp = clampTo(s.hp - (wantDone - a.hpDone), 0, s.hpMax); a.hpDone = wantDone; }
  const pct = Math.floor(frac * 100);
  for (const mark of ex.radio) {
    if (pct >= mark && !a.fired.includes(mark)) {
      a.fired.push(mark);
      if (ex.id === 4 && mark === 20) s.flags.passedIngenuity = true;
      emit({ type: 'radio', id: radioId(s, ex, mark), percent: mark });
      if (ex.decision?.at === mark && !a.decisionDone) {
        if (ex.decision.dilemma) { s.pending = { kind: 'dilemma', id: ex.decision.dilemma }; if (ex.decision.dilemma === 'd5') s.flags.flare = true; emit({ type: 'dilemma', id: ex.decision.dilemma }); } else { s.pending = { kind: 'radio', id: `exp${ex.id}.${mark}` }; emit({ type: 'radio-decision', id: `exp${ex.id}.${mark}` }); }
        return;
      }
    }
  }
  // ASTRA's lines have their own progress marks (the finale speaks at 75% and 85%, between radio lines)
  for (const [mark, lineId] of Object.entries(ex.astra ?? {})) {
    const key = `astra${mark}`;
    if (pct >= Number(mark) && !a.fired.includes(key) && !a.second) { a.fired.push(key); emit({ type: 'astra', lineId, mood: 'cheerful' }); }
  }
  // the rescue rule: HP 0 on the trip sends a rescue drone
  if (s.hp <= 0 && !a.rescued) {
    a.rescued = true;
    a.halfLoot = true;
    setTripEnd(a, s.minute, s.minute);
    emit({ type: 'astra', lineId: 'astra.hp.zero_expedition', mood: 'calm' });
  }
  if (s.minute < a.end) return;
  // The risk is rolled once, when the Rover should be home. A Rough trip limps in half a Sol late (5.1).
  if (a.result === null) {
    a.result = 'smooth';
    if (!ex.scripted && !a.rescued) {
      const r = nextRandom(s);
      const [smooth, bumpy] = RISK_TABLE[a.risk];
      a.result = r < smooth ? 'smooth' : r < smooth + bumpy ? 'bumpy' : 'rough';
    }
    if (a.result === 'rough') {
      setTripEnd(a, s.minute, s.minute + ROUGH_DELAY);
      emit({ type: 'toast', text: 'Rough ride! The Rover is limping home. It will be half a Sol late.' });
      return;
    }
  }
  finish(s, ex, emit);
}

function finish(s, ex, emit) {
  const a = s.away;
  s.away = null;
  const result = a.result ?? 'smooth';
  const rough = result === 'rough';
  const half = a.halfLoot || rough;
  const base = a.customLoot ?? ex.loot;
  const got = { sp: Math.floor(base.sp * (half && !a.customLoot ? 0.5 : 1)), items: {} };
  for (const [it, n] of Object.entries(base.items)) {
    const keep = ex.story.includes(it) ? n : half && !a.customLoot ? Math.floor(n / 2) : n;
    if (keep > 0) got.items[it] = keep;
  }
  if (a.extraIce) got.items.ice_core = (got.items.ice_core ?? 0) + a.extraIce;
  if (s.flags.cargoTrailer && ex.id === 1) { got.sp += 20; s.flags.cargoTrailer = false; }
  if (ex.id === 'run') {
    const pool = ['circuit_board', 'titanium_plate', 'solar_cell'];
    got.items = { [pool[Math.floor(nextRandom(s) * pool.length)]]: 1 };
  }
  s.res.sp = clampTo(s.res.sp + got.sp, 0, 999);
  for (const [it, n] of Object.entries(got.items)) s.items[it] = (s.items[it] ?? 0) + n;
  if (rough) { s.hp = clampTo(s.hp - 5, 0, s.hpMax); }
  if (s.hp <= 0) { s.medRest = { until: s.minute + SOL }; s.stats.medRests += 1; } // the rescue ends in Med-Rest, which counts
  // 4.7: sharp rocks after a Bumpy or Rough ride: the wheels need a check before the next trip
  if (result !== 'smooth') addTask(s, 'wheel_vacuum', result === 'rough' ? 'A rough ride. Check the wheels for cracks.' : 'A bumpy ride. Clean the pebbles out of the wheels.');
  s.flags.done ??= {};
  s.flags.done[ex.id] = true;
  if (a.second) s.flags.exp4Repeat = false; // the rest is home: the Delta Cliffs are fully explored
  s.flags.lastReturn = s.minute;
  emit({ type: 'returned', expedition: ex.id, result, loot: got });
  if (ex.returnLine && !a.second) emit({ type: 'astra', lineId: ex.returnLine, mood: 'cheerful' });
  if (ex.id === 5) {
    emit({ type: 'astra', lineId: 'astra.finale.home', mood: 'cheerful' });
    after(s, s.minute + 60, 'finale_earth');
    s.flags.finaleDone = true;
  }
  if (ex.id === 3) emit({ type: 'badge', id: 'ice_miner' });
  scheduleBreakdown(s, emit, clockAt(s.minute).sol, true); // Base Autopilot held breakdowns back while he was away (2.1)
}
