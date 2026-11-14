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
 * `fair` strategies only report a mini-game that is on offer (as the UI allows); `cheat-*`
 * strategies send commands the UI would not, to test what the engine itself accepts.
 * Logbook cards and badges are unlocked exactly as src/main.js does it, so the star rating
 * is the one a player would see.
 */
import { createCampaign, step, command, clockAt, rates } from '../../src/campaign/engine.js';
import { canFinale } from '../../src/campaign/story.js';
import { unlockFor, checkBadges, buildReport } from '../../src/campaign/logbook.js';

const BUILD_ORDER = ['battery', 'workshop', 'greenhouse', 'garage', 'lab', 'recreation', 'roof'];
const CRAFT_ORDER = ['repair_kit', 'reboot_kit', 'titanium_wheels', 'deep_ice_drill', 'rover_shielding', 'suit_liner'];
const UPGRADE_ORDER = ['solar', 'greenhouse', 'lifesupport', 'battery', 'workshop', 'lab', 'recreation', 'garage'];

// ---------------------------------------------------------------- building blocks of a strategy
// Each block is (s, send) => void; `send` is `command` plus the bookkeeping the UI does.

const decide = (choice) => (s, send) => {
  if (!s.pending) return;
  if (s.pending.kind === 'radio') { send({ type: 'radio', choice: choice === 'c' ? 'b' : choice }); return; }
  // a choice the base cannot pay for is refused; like a player, fall back to another card
  for (const c of [choice, 'c', 'a', 'b']) if (send({ type: 'choose', choice: c }).ok) return;
};
const playMinis = (win) => (s, send) => {
  for (const t of [...s.tasks]) send({ type: 'miniResult', game: t.game, win });
};
const wakeWithKits = (s, send) => {
  if (s.kits.repair_kit && s.drones[1].status === 'dormant') send({ type: 'useKit', kit: 'repair_kit', drone: 'drone-02' });
  if (s.kits.reboot_kit && s.drones[2].status === 'dormant') send({ type: 'useKit', kit: 'reboot_kit', drone: 'drone-03' });
};
const build = (order = BUILD_ORDER) => (s, send) => {
  for (const id of order) if (s.modules[id].status === 'unbuilt') send({ type: 'build', module: id });
};
const craft = (order = CRAFT_ORDER) => (s, send) => {
  if (s.crafting) return;
  for (const r of order) {
    if (r === 'repair_kit' && (s.drones[1].status === 'awake' || s.kits.repair_kit)) continue;
    if (r === 'reboot_kit' && (s.drones[2].status === 'awake' || s.kits.reboot_kit)) continue;
    if (send({ type: 'craft', recipe: r }).ok) break;
  }
};
const upgrade = (order = UPGRADE_ORDER) => (s, send) => {
  for (const m of order) send({ type: 'upgrade', module: m });
};
const melt = (s, send) => {
  if (s.res.water < 40) send({ type: 'melt' });
};
const explore = ({ minHp = 60, runs = true } = {}) => (s, send) => {
  if (s.away || s.pending || s.hp <= minHp) return;
  // any story trip the map allows (a done place is locked; the Delta Cliffs reopen after Dilemma 5 A)
  for (const k of [1, 2, 3, 4, 5]) if (send({ type: 'launch', expedition: k }).ok) return;
  if (!runs) return;
  // repeatable runs: ice when the tank is low and the drill exists, else scrap
  if (s.res.water < 50 && send({ type: 'launch', expedition: 'ice' }).ok) return;
  send({ type: 'launch', expedition: 'run' });
};

/** A strategy is a list of actions run every half hour of game time. */
export const STRATEGIES = {
  // --- reference
  recommended: { fair: true, about: 'The scenario path (3.8): build, craft, upgrade, explore, win every mini-game', acts: [decide('a'), playMinis(true), wakeWithKits, melt, build(), craft(), upgrade(), explore()] },
  // --- neglect
  idle: { fair: true, about: 'Wake Drone #01, then touch nothing except the cards that block the game (choice A)', acts: [decide('a')] },
  'idle-c': { fair: true, about: 'Touch nothing; always pick choice C', acts: [decide('c')] },
  'no-minigames': { fair: true, about: 'Recommended path, but every mini-game is lost', acts: [decide('a'), playMinis(false), wakeWithKits, melt, build(), craft(), upgrade(), explore()] },
  'ignore-minigames': { fair: true, about: 'Recommended path, but mini-games are never opened', acts: [decide('a'), wakeWithKits, melt, build(), craft(), upgrade(), explore()] },
  // --- one-sided play
  'build-only': { fair: true, about: 'Build and upgrade; never craft, never leave the base', acts: [decide('a'), playMinis(true), build(), upgrade()] },
  'no-expeditions': { fair: true, about: 'Everything except expeditions', acts: [decide('a'), playMinis(true), wakeWithKits, melt, build(), craft(), upgrade()] },
  rush: { fair: true, about: 'Leave on a trip whenever the Rover is free (HP 25 is enough); only build what trips need', acts: [decide('a'), playMinis(true), wakeWithKits, melt, build(['battery', 'workshop', 'greenhouse', 'garage', 'lab']), craft(['titanium_wheels', 'deep_ice_drill', 'rover_shielding', 'repair_kit', 'reboot_kit']), upgrade(['garage', 'lab']), explore({ minHp: 25 })] },
  'trip-spam': { fair: true, about: 'Recommended path, but a trip (or Scrap Run) whenever the Rover is free and HP is 25 or more', acts: [decide('a'), playMinis(true), wakeWithKits, melt, build(), craft(), upgrade(), explore({ minHp: 25 })] },
  hoard: { fair: true, about: 'Recommended build order, but no crafting and no upgrades (keep the Spare Parts)', acts: [decide('a'), playMinis(true), build(), explore()] },
  // --- dilemma sweeps
  'always-b': { fair: true, about: 'Recommended path, choice B everywhere', acts: [decide('b'), playMinis(true), wakeWithKits, melt, build(), craft(), upgrade(), explore()] },
  'always-c': { fair: true, about: 'Recommended path, choice C everywhere', acts: [decide('c'), playMinis(true), wakeWithKits, melt, build(), craft(), upgrade(), explore()] },
  // --- what the engine accepts that the UI should never send
  'cheat-minispam': { fair: false, about: 'Idle, but report a won mini-game 20 times every half hour although none is on offer', acts: [decide('a'), (s, send) => { for (let i = 0; i < 20; i++) send({ type: 'miniResult', game: 'air_filter', win: true }); }] },
  'cheat-heatspam': { fair: false, about: 'Idle, but report a won Heat Pump game every half hour without it being offered', acts: [decide('a'), (s, send) => send({ type: 'miniResult', game: 'heat_pump', win: true })] },
};

// ---------------------------------------------------------------- one run

export function play(name, seed, { maxSols = 30 } = {}) {
  const strat = STRATEGIES[name];
  if (!strat) throw new Error(`unknown strategy: ${name}`);
  const s = createCampaign({ seed });
  // what src/main.js does with events: Logbook triggers
  const absorb = (events) => {
    for (const e of events) {
      if (e.type === 'astra') unlockFor(s, e.lineId);
      else if (e.type === 'radio') unlockFor(s, `R:${e.id}`);
      else if (e.type === 'dilemma') unlockFor(s, `D:${e.id}`);
      else if (e.type === 'event') unlockFor(s, `E:${e.id}`);
      else if (e.type === 'chosen') unlockFor(s, `C:${e.id}${e.choice}`);
    }
  };
  const send = (cmd) => {
    const r = command(s, cmd);
    if (r.ok) absorb(r.events);
    return r;
  };
  for (const id of ['astra.intro.landing', 'astra.intro.why_underground', 'astra.tut.hp_intro', 'astra.tut.solar_done', 'astra.tut.done']) unlockFor(s, id); // the tutorial
  send({ type: 'wakeDrone', drone: 'drone-01' });

  const low = { power: 1e9, heat: 1e9, water: 1e9, oxygen: 1e9, food: 1e9, morale: 1e9, sp: 1e9, hp: 1e9 };
  const zeroMinutes = { power: 0, heat: 0, water: 0, oxygen: 0, food: 0 };
  const idleSols = new Set();
  let finaleSol = null;
  let readySol = null;
  let stalled = 0;
  for (let guard = 0; s.minute < maxSols * 1440 && guard < 100000; guard++) {
    for (const act of strat.acts) act(s, send);
    const before = s.minute;
    absorb(step(s, 30));
    checkBadges(s);
    stalled = s.minute === before ? stalled + 1 : 0;
    if (stalled > 5) break; // the game is waiting for something this strategy never does
    for (const k of Object.keys(low)) low[k] = Math.min(low[k], k === 'hp' ? s.hp : s.res[k]);
    for (const k of Object.keys(zeroMinutes)) if (s.res[k] <= 0) zeroMinutes[k] += s.minute - before;
    const sol = clockAt(s.minute).sol;
    if (readySol === null && canFinale(s)) readySol = sol;
    if (finaleSol === null && s.flags.finaleDone) finaleSol = sol;
    const busy = s.drones.some((d) => d.task) || s.crafting || s.away || s.tasks.length || s.pending;
    if (!busy && sol <= 20) idleSols.add(sol);
  }
  const report = buildReport(s);
  return {
    name, seed,
    endSol: clockAt(s.minute).sol,
    stalled: stalled > 5 ? `stuck at Sol ${clockAt(s.minute).sol} (pending: ${s.pending ? `${s.pending.kind} ${s.pending.id}` : 'none'})` : null,
    finaleSol, readySol,
    modules: report.modulesBuilt, tier2: report.tier2, dronesAwake: report.dronesAwake,
    expeditions: s.stats.expeditions,
    low, zeroMinutes,
    emergencies: s.stats.emergencies, medRests: s.stats.medRests,
    sp: Math.round(s.res.sp), hp: Math.round(s.hp), research: Math.round(s.research),
    idleSols: idleSols.size,
    stars: report.total, rating: report.rating, crewCare: Math.round(report.crewCare),
    badges: s.badges.length, cards: s.logbook.length,
    choices: [...s.choices],
    netAtEnd: Object.fromEntries(Object.entries(rates(s)).map(([k, v]) => [k, Math.round(v)])),
  };
}

// ---------------------------------------------------------------- command line

function main() {
  const argv = process.argv.slice(2);
  const flag = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
  const seeds = Number(flag('seeds', 8));
  const names = flag('only', '') ? flag('only', '').split(',') : Object.keys(STRATEGIES);
  const rows = [];
  for (const name of names) {
    const runs = [];
    for (let seed = 1; seed <= seeds; seed++) runs.push(play(name, seed));
    const avg = (f) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
    const min = (f) => Math.min(...runs.map(f));
    const range = (f) => { const v = runs.map(f); return Math.min(...v) === Math.max(...v) ? String(v[0]) : `${Math.min(...v)}-${Math.max(...v)}`; };
    const finished = runs.filter((r) => r.finaleSol !== null);
    rows.push({
      strategy: name,
      fair: STRATEGIES[name].fair,
      about: STRATEGIES[name].about,
      finale: `${finished.length}/${runs.length}`,
      onSol: finished.length ? range.call(null, (r) => r.finaleSol ?? 0).replace(/^0-/, '') : '-',
      stuck: runs.filter((r) => r.stalled).length,
      rooms: avg((r) => r.modules).toFixed(1),
      t2: avg((r) => r.tier2).toFixed(1),
      trips: avg((r) => r.expeditions).toFixed(1),
      emerg: avg((r) => r.emergencies).toFixed(1),
      medRest: avg((r) => r.medRests).toFixed(1),
      loHP: Math.round(min((r) => r.low.hp)),
      loMorale: Math.round(min((r) => r.low.morale)),
      loWater: Math.round(min((r) => r.low.water)),
      loFood: Math.round(min((r) => r.low.food)),
      loHeat: Math.round(min((r) => r.low.heat)),
      loO2: Math.round(min((r) => r.low.oxygen)),
      loPower: Math.round(min((r) => r.low.power)),
      heat0: (avg((r) => r.zeroMinutes.heat) / 1440).toFixed(1),
      food0: (avg((r) => r.zeroMinutes.food) / 1440).toFixed(1),
      SP: Math.round(avg((r) => r.sp)),
      idle: avg((r) => r.idleSols).toFixed(1),
      stars: range((r) => r.stars),
      badges: avg((r) => r.badges).toFixed(1),
      cards: avg((r) => r.cards).toFixed(0),
      runs,
    });
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  const cols = ['strategy', 'finale', 'onSol', 'stuck', 'rooms', 't2', 'trips', 'emerg', 'medRest', 'loHP', 'loMorale', 'loWater', 'loFood', 'loHeat', 'loO2', 'loPower', 'heat0', 'food0', 'SP', 'idle', 'stars', 'badges', 'cards'];
  const width = (c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length));
  console.log(cols.map((c) => c.padEnd(width(c))).join('  '));
  for (const r of rows) console.log(cols.map((c) => String(r[c]).padEnd(width(c))).join('  '));
  console.log(`\n${seeds} seeds each, 30 Sols. finale = runs that reached the Canyon Anomaly; lo* = lowest value in any run;`);
  console.log('heat0 / food0 = Sols spent at zero; idle = Sols (of the first 20) with nothing going on; stars = Mission Rating out of 9.\n');
  for (const r of rows) console.log(`  ${r.strategy.padEnd(17)} ${r.fair ? '' : '[not possible through the UI] '}${r.about}`);
  if (argv.includes('--verbose')) for (const r of rows) for (const run of r.runs) console.log(JSON.stringify(run));
}

if (process.argv[1] && process.argv[1].endsWith('strategy-lab.mjs')) main();
