#!/usr/bin/env node
/**
 * Strategy lab: play the campaign with many different kinds of player and compare the results.
 * Finds strategies that break the game (exploits, dead ends) and choices that do not matter.
 *
 *   node tools/balance/strategy-lab.mjs                 all strategies, seeds 1-8, a summary table
 *   node tools/balance/strategy-lab.mjs --seeds 20      more seeds
 *   node tools/balance/strategy-lab.mjs --only idle,rush --verbose
 *   node tools/balance/strategy-lab.mjs --json          machine-readable
 *
 * Every strategy uses only public commands of src/campaign/engine.js, the same ones the UI sends.
 * `fair` strategies only win a mini-game that is on offer (as the UI allows); `cheat-*`
 * strategies send commands the UI would not, to test what the engine itself accepts.
 */
import { createCampaign, step, command, clockAt, rates } from '../../src/campaign/engine.js';
import { canFinale } from '../../src/campaign/story.js';
import { missionReport } from '../../src/campaign/logbook.js';

const BUILD_ORDER = ['battery', 'workshop', 'greenhouse', 'garage', 'lab', 'recreation', 'roof'];
const CRAFT_ORDER = ['repair_kit', 'reboot_kit', 'titanium_wheels', 'deep_ice_drill', 'rover_shielding', 'suit_liner'];
const UPGRADE_ORDER = ['solar', 'greenhouse', 'lifesupport', 'battery', 'workshop', 'lab', 'recreation', 'garage'];
const EMERGENCY_GAME = { power: 'solar_wipe', heat: 'heat_pump', oxygen: 'valve_balance' };

// ---------------------------------------------------------------- building blocks of a strategy

const decide = (choice) => (s) => {
  if (!s.pending) return;
  if (s.pending.kind === 'radio') command(s, { type: 'radio', choice: choice === 'c' ? 'b' : choice });
  else command(s, { type: 'choose', choice });
};
const playMinis = (win) => (s) => {
  for (const t of [...s.tasks]) command(s, { type: 'miniResult', game: t.game, win });
};
const wakeWithKits = (s) => {
  if (s.kits.repair_kit && s.drones[1].status === 'dormant') command(s, { type: 'useKit', kit: 'repair_kit', drone: 'drone-02' });
  if (s.kits.reboot_kit && s.drones[2].status === 'dormant') command(s, { type: 'useKit', kit: 'reboot_kit', drone: 'drone-03' });
};
const build = (order = BUILD_ORDER) => (s) => {
  for (const id of order) if (s.modules[id].status === 'unbuilt') command(s, { type: 'build', module: id });
};
const craft = (order = CRAFT_ORDER) => (s) => {
  if (s.crafting) return;
  for (const r of order) {
    if (r === 'repair_kit' && (s.drones[1].status === 'awake' || s.kits.repair_kit)) continue;
    if (r === 'reboot_kit' && (s.drones[2].status === 'awake' || s.kits.reboot_kit)) continue;
    if (command(s, { type: 'craft', recipe: r }).ok) break;
  }
};
const upgrade = (order = UPGRADE_ORDER) => (s) => {
  for (const m of order) command(s, { type: 'upgrade', module: m });
};
const melt = (s) => {
  if (s.res.water < 40) command(s, { type: 'melt' });
};
const explore = ({ minHp = 60, runs = true } = {}) => (s) => {
  if (s.away || s.pending || s.hp <= minHp) return;
  const want = [1, 2, 3, 4, 5].find((k) => !s.flags.done?.[k]);
  if (want && command(s, { type: 'launch', expedition: want }).ok) return;
  if (runs) command(s, { type: 'launch', expedition: 'run' });
};

/** A strategy is a list of actions run every half hour of game time. */
const STRATEGIES = {
  // --- reference
  recommended: { fair: true, about: 'The scenario path (3.8): build, craft, upgrade, explore, win every mini-game', acts: [decide('a'), playMinis(true), wakeWithKits, melt, build(), craft(), upgrade(), explore()] },
  // --- neglect
  idle: { fair: true, about: 'Wake Drone #01, then touch nothing except the cards that block the game', acts: [decide('a')] },
  'idle-c': { fair: true, about: 'Touch nothing; always pick the "do nothing" choice C', acts: [decide('c')] },
  'no-minigames': { fair: true, about: 'Recommended path, but every mini-game is lost', acts: [decide('a'), playMinis(false), wakeWithKits, melt, build(), craft(), upgrade(), explore()] },
  'ignore-minigames': { fair: true, about: 'Recommended path, but mini-games are never opened', acts: [decide('a'), wakeWithKits, melt, build(), craft(), upgrade(), explore()] },
  // --- one-sided play
  'build-only': { fair: true, about: 'Build and upgrade; never craft, never leave the base', acts: [decide('a'), playMinis(true), build(), upgrade()] },
  'no-expeditions': { fair: true, about: 'Everything except expeditions', acts: [decide('a'), playMinis(true), wakeWithKits, melt, build(), craft(), upgrade()] },
  rush: { fair: true, about: 'Leave on a trip whenever the Rover is free (HP 25 is enough); only build what trips need', acts: [decide('a'), playMinis(true), wakeWithKits, melt, build(['battery', 'workshop', 'greenhouse', 'garage', 'lab']), craft(['titanium_wheels', 'deep_ice_drill', 'rover_shielding', 'repair_kit', 'reboot_kit']), upgrade(['garage', 'lab']), explore({ minHp: 25 })] },
  'scrap-spam': { fair: true, about: 'Recommended path plus a Scrap Run whenever the Rover is free', acts: [decide('a'), playMinis(true), wakeWithKits, melt, build(), craft(), upgrade(), explore({ minHp: 25 })] },
  hoard: { fair: true, about: 'Recommended build order, but no crafting and no upgrades (keep the Spare Parts)', acts: [decide('a'), playMinis(true), build(), explore()] },
  // --- dilemma sweeps
  'always-b': { fair: true, about: 'Recommended path, choice B everywhere', acts: [decide('b'), playMinis(true), wakeWithKits, melt, build(), craft(), upgrade(), explore()] },
  'always-c': { fair: true, about: 'Recommended path, choice C everywhere', acts: [decide('c'), playMinis(true), wakeWithKits, melt, build(), craft(), upgrade(), explore()] },
  // --- what the engine accepts that the UI should never send
  'cheat-minispam': { fair: false, about: 'Report a won mini-game 20 times every half hour, whether or not one is on offer', acts: [decide('a'), (s) => { for (let i = 0; i < 20; i++) command(s, { type: 'miniResult', game: 'air_filter', win: true }); }] },
  'cheat-heatspam': { fair: false, about: 'Idle, but report a won Heat Pump game every half hour without it being offered', acts: [decide('a'), (s) => command(s, { type: 'miniResult', game: 'heat_pump', win: true })] },
};

// ---------------------------------------------------------------- one run

export function play(name, seed, { maxSols = 30 } = {}) {
  const strat = STRATEGIES[name];
  const s = createCampaign({ seed });
  command(s, { type: 'wakeDrone', drone: 'drone-01' }); // the tutorial always does this
  const low = { power: 1e9, heat: 1e9, water: 1e9, oxygen: 1e9, food: 1e9, morale: 1e9, sp: 1e9, hp: 1e9 };
  const zeroMinutes = { power: 0, heat: 0, water: 0, oxygen: 0, food: 0 };
  const idleSols = new Set();
  let finaleSol = null;
  let readySol = null;
  let stalled = 0;
  for (let guard = 0; s.minute < maxSols * 1440 && guard < 100000; guard++) {
    for (const act of strat.acts) act(s);
    const before = s.minute;
    step(s, 30);
    stalled = s.minute === before ? stalled + 1 : 0;
    if (stalled > 5) break; // the game is waiting for something the strategy never does
    for (const k of Object.keys(low)) low[k] = Math.min(low[k], k === 'hp' ? s.hp : s.res[k]);
    for (const k of Object.keys(zeroMinutes)) if (s.res[k] <= 0) zeroMinutes[k] += s.minute - before;
    const sol = clockAt(s.minute).sol;
    if (readySol === null && canFinale(s)) readySol = sol;
    if (finaleSol === null && s.flags.finaleDone) finaleSol = sol;
    const busy = s.drones.some((d) => d.task) || s.crafting || s.away || s.tasks.length || s.pending;
    if (!busy && sol <= 20) idleSols.add(sol);
  }
  let report = null;
  try {
    report = missionReport(s);
  } catch {
    report = null;
  }
  return {
    name, seed,
    endSol: clockAt(s.minute).sol,
    stalled: stalled > 5 ? `stuck at Sol ${clockAt(s.minute).sol} (pending: ${s.pending ? `${s.pending.kind} ${s.pending.id}` : 'none'})` : null,
    finaleSol, readySol,
    modules: Object.values(s.modules).filter((m) => m.status === 'online').length,
    tier2: Object.values(s.modules).filter((m) => m.tier === 2).length,
    dronesAwake: s.drones.filter((d) => d.status === 'awake').length,
    expeditions: s.stats.expeditions,
    low, zeroMinutes,
    emergencies: s.stats.emergencies, medRests: s.stats.medRests,
    sp: Math.round(s.res.sp), hp: Math.round(s.hp), research: Math.round(s.research),
    idleSols: idleSols.size,
    stars: report?.stars ?? report?.totalStars ?? null,
    badges: s.badges.length, logbook: s.logbook.length,
    netAtEnd: Object.fromEntries(Object.entries(rates(s)).map(([k, v]) => [k, Math.round(v)])),
  };
}

// ---------------------------------------------------------------- command line

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
if (process.argv[1] && process.argv[1].endsWith('strategy-lab.mjs')) {
  const seeds = Number(flag('seeds', 8));
  const names = flag('only', '') ? flag('only', '').split(',') : Object.keys(STRATEGIES);
  const rows = [];
  for (const name of names) {
    if (!STRATEGIES[name]) { console.error(`unknown strategy: ${name}`); process.exit(1); }
    const runs = [];
    for (let seed = 1; seed <= seeds; seed++) runs.push(play(name, seed));
    const avg = (f) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
    const min = (f) => Math.min(...runs.map(f));
    const finished = runs.filter((r) => r.finaleSol !== null);
    rows.push({
      strategy: name,
      fair: STRATEGIES[name].fair,
      about: STRATEGIES[name].about,
      finished: `${finished.length}/${runs.length}`,
      finaleSol: finished.length ? `${Math.min(...finished.map((r) => r.finaleSol))}-${Math.max(...finished.map((r) => r.finaleSol))}` : '-',
      stuck: runs.filter((r) => r.stalled).length,
      modules: avg((r) => r.modules).toFixed(1),
      tier2: avg((r) => r.tier2).toFixed(1),
      trips: avg((r) => r.expeditions).toFixed(1),
      emergencies: avg((r) => r.emergencies).toFixed(1),
      medRests: avg((r) => r.medRests).toFixed(1),
      lowHp: Math.round(min((r) => r.low.hp)),
      lowMorale: Math.round(min((r) => r.low.morale)),
      lowWater: Math.round(min((r) => r.low.water)),
      lowFood: Math.round(min((r) => r.low.food)),
      lowHeat: Math.round(min((r) => r.low.heat)),
      lowOxygen: Math.round(min((r) => r.low.oxygen)),
      lowPower: Math.round(min((r) => r.low.power)),
      solsAtZeroHeat: (avg((r) => r.zeroMinutes.heat) / 1440).toFixed(1),
      solsAtZeroFood: (avg((r) => r.zeroMinutes.food) / 1440).toFixed(1),
      spEnd: Math.round(avg((r) => r.sp)),
      idleSols: avg((r) => r.idleSols).toFixed(1),
      stars: runs[0].stars === null ? '?' : `${Math.min(...runs.map((r) => r.stars))}-${Math.max(...runs.map((r) => r.stars))}`,
      badges: avg((r) => r.badges).toFixed(1),
      runs,
    });
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    const cols = ['strategy', 'finished', 'finaleSol', 'stuck', 'modules', 'tier2', 'trips', 'emergencies', 'medRests', 'lowHp', 'lowMorale', 'lowWater', 'lowFood', 'lowHeat', 'lowOxygen', 'lowPower', 'solsAtZeroHeat', 'solsAtZeroFood', 'spEnd', 'idleSols', 'stars', 'badges'];
    const width = (c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length));
    console.log(cols.map((c) => c.padEnd(width(c))).join('  '));
    for (const r of rows) console.log(cols.map((c) => String(r[c]).padEnd(width(c))).join('  '));
    console.log(`\n${seeds} seeds each, 30 Sols. low* = lowest value seen in any run. Strategies:`);
    for (const r of rows) console.log(`  ${r.strategy.padEnd(18)} ${r.fair ? '' : '[not possible through the UI] '}${r.about}`);
    if (argv.includes('--verbose')) for (const r of rows) for (const run of r.runs) console.log(JSON.stringify(run));
  }
}

export { STRATEGIES };
