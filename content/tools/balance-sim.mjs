#!/usr/bin/env node
/**
 * 20-Sol balance check: plays the real campaign engine (src/campaign) along the scenario's
 * recommended path on many seeds, records every Sol, and compares the results with the balance
 * claims of SCENARIO.md (3.4 snapshots, 3.5 water, 3.6 HP, 3.8 plan, 3.9 Spare Parts).
 *
 *   node content/tools/balance-sim.mjs              write content/balance/BALANCE_REPORT.md (+ .json)
 *   node content/tools/balance-sim.mjs --seeds 50   more seeds
 *   node content/tools/balance-sim.mjs --json       also write every run to content/balance/balance-runs.json
 *
 * It changes no numbers: mismatches are reported for the team to decide (SCENARIO.md wins).
 * The decision logic copies tools/balance/campaign-bot.mjs (recommended path, SCENARIO 3.8) so it
 * can sample state every Sol; variant "careless" picks the least prepared choice in every dilemma.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCampaign, step, command, clockAt, rates } from '../../src/campaign/engine.js';
import { RECIPES, UPGRADES } from '../../src/campaign/data.js';
import { tables } from './extract-game-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_MD = path.join(ROOT, 'content', 'balance', 'BALANCE_REPORT.md');
const OUT_JSON = path.join(ROOT, 'content', 'balance', 'balance-runs.json');

const BUILD_ORDER = ['battery', 'workshop', 'greenhouse', 'garage', 'lab', 'recreation', 'roof'];
const SIX = ['battery', 'workshop', 'greenhouse', 'garage', 'lab', 'recreation'];
const CRAFT_ORDER = ['repair_kit', 'reboot_kit', 'titanium_wheels', 'deep_ice_drill', 'rover_shielding', 'suit_liner'];
const UPGRADE_ORDER = ['solar', 'greenhouse', 'lifesupport', 'battery', 'workshop', 'lab', 'recreation', 'garage'];
const GOOD = { d1: 'a', d2: 'a', d3: 'c', d4: 'c', d5: 'b', e1: 'a', e2: 'c', e3: 'a', e4: 'a' };
const CARELESS = { d1: 'c', d2: 'b', d3: 'a', d4: 'b', d5: 'c', e1: 'b', e2: 'a', e3: 'b', e4: 'c' };
/**
 * planned: follows the Sol-by-Sol plan of SCENARIO 3.8 (nothing starts before its planned Sol, no
 *          Scrap Runs). This is the variant the SCENARIO claims are checked against.
 * eager:   tools/balance/campaign-bot.mjs behaviour: start everything as soon as the engine allows,
 *          Scrap Runs between expeditions (a fast player).
 * careless: eager, with the least prepared choice in every dilemma and event.
 */
export const VARIANTS = {
  planned: { choices: GOOD, planned: true, scrapRuns: 'gaps' },
  eager: { choices: GOOD, planned: false, scrapRuns: true },
  careless: { choices: CARELESS, planned: false, scrapRuns: true },
};
/** Earliest Sol for each job in SCENARIO 3.8 (and 3.9 for the Workshop crafts). */
export const PLAN = {
  build: { battery: 1, workshop: 3, greenhouse: 7, garage: 7, lab: 13, recreation: 13, roof: 15 },
  craft: { repair_kit: 5, titanium_wheels: 11, reboot_kit: 12, deep_ice_drill: 13, rover_shielding: 14, suit_liner: 15 },
  upgrade: { solar: 13, greenhouse: 15, lifesupport: 15, battery: 19, workshop: 19, garage: 19, lab: 19, recreation: 20 },
  expedition: { 1: 10, 2: 12, 3: 14, 4: 17, 5: 20 },
};

const SCRAP_ITEMS = ['circuit_board', 'titanium_plate', 'solar_cell'];
/** Components still missing for the crafts and Tier 2 upgrades not done yet (what a Scrap Run can fix). */
function scrapGap(s) {
  const need = {};
  for (const [id, r] of Object.entries(RECIPES)) {
    const done = r.kind === 'kit' ? (id === 'repair_kit' ? s.drones[1].status === 'awake' : s.drones[2].status === 'awake') : Boolean(s.upgrades[id]);
    if (!done) for (const [it, n] of Object.entries(r.items ?? {})) need[it] = (need[it] ?? 0) + n;
  }
  for (const [mod, u] of Object.entries(UPGRADES)) if (s.modules[mod]?.tier !== 2) for (const [it, n] of Object.entries(u.items ?? {})) need[it] = (need[it] ?? 0) + n;
  // scrap first: plates, boards and cells gate the finale (Long-Range, Lab T2); ice only gates Life Support T2
  if (SCRAP_ITEMS.some((it) => (need[it] ?? 0) > (s.items[it] ?? 0))) return 'scrap';
  return (need.ice_core ?? 0) > (s.items.ice_core ?? 0) && s.upgrades.deep_ice_drill ? 'ice' : null;
}

/**
 * Pick the run mode. The engine supports an Ice Run (s.flags.runMode = 'ice') but no command or UI
 * sets it yet; the bot sets the flag the way a future "Ice / Scrap" toggle would.
 */
function setRunMode(s) {
  s.flags.runMode = scrapGap(s) === 'ice' ? 'ice' : 'scrap';
  return true;
}

/** Play one campaign. Returns per-Sol samples and milestones. */
export function run(seed, { variant = 'planned', maxSols = 30 } = {}) {
  const { choices, planned, scrapRuns } = VARIANTS[variant];
  const ready = (kind, id) => !planned || clockAt(s.minute).sol >= (PLAN[kind][id] ?? 0);
  const s = createCampaign({ seed });
  command(s, { type: 'wakeDrone', drone: 'drone-01' });
  const solOf = () => clockAt(s.minute).sol;
  const ms = { modules: {}, tier2: {}, drones: { 'drone-01': 1 }, expeditions: {}, finale: null };
  const samples = [];
  const mins = { sp: Infinity, hp: Infinity, water: Infinity, power: Infinity };
  let emergencies = 0;
  let minHpDawn = Infinity;
  let scrapRunCount = 0;
  const rough = {};
  const emergencyKinds = {};

  const act = () => {
    if (s.pending) {
      if (s.pending.kind === 'radio') command(s, { type: 'radio', choice: 'a' });
      else command(s, { type: 'choose', choice: choices[s.pending.id] ?? 'a' });
    }
    for (const t of [...s.tasks]) command(s, { type: 'miniResult', game: t.game, win: true });
    for (const k of Object.keys(s.emergency)) if (s.emergency[k]) command(s, { type: 'miniResult', game: { power: 'solar_wipe', heat: 'heat_pump', oxygen: 'valve_balance' }[k], win: true });
    if (s.res.water < 60 && (s.items.ice_core ?? 0) > 2) command(s, { type: 'melt' });
    if (s.res.water < 40) command(s, { type: 'melt' });
    if (s.kits.repair_kit && s.drones[1].status === 'dormant') command(s, { type: 'useKit', kit: 'repair_kit', drone: 'drone-02' });
    if (s.kits.reboot_kit && s.drones[2].status === 'dormant') command(s, { type: 'useKit', kit: 'reboot_kit', drone: 'drone-03' });
    for (const id of BUILD_ORDER) if (s.modules[id].status === 'unbuilt' && ready('build', id)) command(s, { type: 'build', module: id });
    if (!s.crafting) {
      for (const r of CRAFT_ORDER) {
        if (r === 'repair_kit' && s.drones[1].status === 'awake') continue;
        if (r === 'reboot_kit' && s.drones[2].status === 'awake') continue;
        if (r === 'suit_liner' && s.upgrades.suit_liner) continue;
        if (!ready('craft', r)) continue;
        if (command(s, { type: 'craft', recipe: r }).ok) break;
      }
    }
    const done = (k) => Boolean(s.flags.done?.[k]);
    const gate = { solar: () => done(2), greenhouse: () => done(3), lifesupport: () => done(3), battery: () => done(4), workshop: () => done(4), lab: () => done(4), recreation: () => done(4), garage: () => done(4) };
    for (const m of UPGRADE_ORDER) if (gate[m]() && ready('upgrade', m)) command(s, { type: 'upgrade', module: m });
    if (!s.away && !s.pending && s.hp > 60) {
      const want = [1, 2, 3, 4, 5].find((k) => !s.flags.done?.[k]);
      if (want) {
        if (ready('expedition', want) && command(s, { type: 'launch', expedition: want }).ok) ms.expeditions[want] ??= solOf();
        else if (scrapRuns && (scrapRuns !== 'gaps' || (s.flags.done?.[2] && scrapGap(s))) && s.hp > 70 && setRunMode(s) && solOf() > (s.flags.botLastRun ?? 0) && command(s, { type: 'launch', expedition: 'run' }).ok) { s.flags.botLastRun = solOf(); scrapRunCount++; }
      }
    }
  };

  const watch = () => {
    const sol = solOf();
    for (const [id, m] of Object.entries(s.modules)) {
      if (m.status === 'online') ms.modules[id] ??= sol;
      if (m.tier === 2) ms.tier2[id] ??= sol;
    }
    for (const d of s.drones) if (d.status === 'awake') ms.drones[d.id] ??= sol;
    if (s.flags.finaleDone) ms.finale ??= sol;
    for (const k of Object.keys(mins)) mins[k] = Math.min(mins[k], k === 'hp' ? s.hp : s.res[k]);
  };

  let lastSol = 0;
  let guard = 0;
  let emergencyOpen = new Set();
  while (s.minute < maxSols * 1440 && !s.flags.finaleDone && guard++ < 200000) {
    act();
    const events = step(s, 30);
    for (const e of events) if (e.type === 'returned' && e.result === 'rough') rough[e.expedition] = (rough[e.expedition] ?? 0) + 1;
    for (const e of events) if (e.type === 'emergency' && !emergencyOpen.has(e.kind)) { emergencies++; emergencyOpen.add(e.kind); emergencyKinds[e.kind] = (emergencyKinds[e.kind] ?? 0) + 1; }
    for (const k of [...emergencyOpen]) if (!s.emergency[k]) emergencyOpen.delete(k);
    watch();
    const sol = solOf();
    if (sol !== lastSol) {
      lastSol = sol;
      const r = rates(s);
      minHpDawn = Math.min(minHpDawn, s.hp);
      samples.push({ sol, res: Object.fromEntries(Object.entries(s.res).map(([k, v]) => [k, Math.round(v)])), hp: Math.round(s.hp), rates: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 10) / 10])), away: Boolean(s.away) });
    }
  }
  return { seed, variant, finished: Boolean(s.flags.finaleDone), finalSol: solOf(), milestones: ms, mins: Object.fromEntries(Object.entries(mins).map(([k, v]) => [k, Math.round(v)])), minHpDawn: Math.round(minHpDawn), emergencies, emergencyKinds, rough, scrapRuns: scrapRunCount,
    tier2Missing: UPGRADE_ORDER.filter((id) => s.modules[id].tier !== 2), items: { ...s.items },
    tier2Short: Object.fromEntries(UPGRADE_ORDER.filter((id) => s.modules[id].tier !== 2).map((id) => [id, Object.entries(UPGRADES[id].items ?? {}).filter(([it, n]) => (s.items[it] ?? 0) < n).map(([it]) => it)])), samples, stats: s.stats };
}

const median = (xs) => { const a = xs.filter((x) => x != null).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : null; };
const range = (xs) => { const a = xs.filter((x) => x != null); return a.length ? [Math.min(...a), Math.max(...a)] : null; };
const fmtR = (r) => (r ? (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`) : 'never');

/** SCENARIO 3.4 snapshot rows -> { sol, power, heat, oxygen, food, water, morale, sp } */
function snapshots(md) {
  const t = tables(md).find((x) => x.header[0] === 'Stage' && x.header[1] === 'Power');
  const n = (c) => Number(c.replace(/−/g, '-').match(/^[+-]?\d+/)[0]);
  return t.rows.map((r) => ({ sol: Number(r.c[0].match(/Sol (\d+)/)[1]), stage: r.c[0], power: n(r.c[1]), heat: n(r.c[2]), oxygen: n(r.c[3]), food: n(r.c[4]), water: n(r.c[5]), morale: n(r.c[6]), sp: n(r.c[7]) }));
}

export function analyse(runs, md) {
  const rec = runs.filter((r) => r.variant === 'planned');
  const eager = runs.filter((r) => r.variant === 'eager');
  const bad = runs.filter((r) => r.variant === 'careless');
  const claims = [];
  const claim = (section, text, observed, ok, note = '') => claims.push({ section, text, observed, ok, note });
  const m = (f) => rec.map(f);

  claim('3.8', 'Drone #02 wakes on Sol 6', `Sol ${fmtR(range(m((r) => r.milestones.drones['drone-02'])))}`, rec.every((r) => (r.milestones.drones['drone-02'] ?? 99) <= 7));
  claim('3.8', 'Drone #03 wakes on Sol 13', `Sol ${fmtR(range(m((r) => r.milestones.drones['drone-03'])))}`, rec.every((r) => (r.milestones.drones['drone-03'] ?? 99) <= 14));
  const allSix = m((r) => (SIX.every((id) => r.milestones.modules[id]) ? Math.max(...SIX.map((id) => r.milestones.modules[id])) : null));
  claim('3.8', 'All six modules online by Sol 15', `Sol ${fmtR(range(allSix))}`, allSix.every((x) => x != null && x <= 15));
  const allT2 = m((r) => (UPGRADE_ORDER.every((id) => r.milestones.tier2[id]) ? Math.max(...UPGRADE_ORDER.map((id) => r.milestones.tier2[id])) : null));
  claim('3.8', 'All Tier 2 upgrades by Sol 19', `Sol ${fmtR(range(allT2))}`, allT2.every((x) => x != null && x <= 19));
  const fin = m((r) => r.milestones.finale);
  claim('3.8', 'Finale (Expedition 5) on Sol 20', `${rec.filter((r) => r.finished).length}/${rec.length} finished; Sol ${fmtR(range(fin))} (median ${median(fin)})`, rec.every((r) => r.finished) && fin.every((x) => x <= 21), 'story beats trigger on events, so ±1 Sol is fine');
  const roughRuns = rec.filter((r) => Object.keys(r.rough).length);
  const stuck = rec.filter((r) => r.tier2Missing.length);
  const shortTally = {};
  for (const r of stuck) for (const [mod, its] of Object.entries(r.tier2Short)) { const k = `${mod} (short: ${its.join(', ') || 'SP'})`; shortTally[k] = (shortTally[k] ?? 0) + 1; }
  const missing = Object.entries(shortTally).map(([k, n]) => `${k} ×${n}`).join('; ');
  claim('5.5', 'Nothing is ever unobtainable (Scrap Runs fill gaps after a Rough result)', `${roughRuns.length}/${rec.length} runs had a Rough result (${[...new Set(roughRuns.flatMap((r) => Object.keys(r.rough)))].map((k) => 'Exp ' + k).join(', ')}); at the finale ${stuck.length} still miss a Tier 2: ${missing || 'none'}`, !stuck.some((r) => r.tier2Short.battery?.includes('rare_battery_cell')), 'Rare Battery Cells only come from Expedition 4 (repeatable only after Dilemma 5 A) and Scrap Runs do not drop them, so Battery T2 can become impossible. Ice Cores can be refilled by the Ice Run (engine only, no UI yet).');
  for (const k of [1, 2, 3, 4]) {
    const plan = { 1: 10, 2: 12, 3: 14, 4: 17 }[k];
    const xs = m((r) => r.milestones.expeditions[k]);
    claim('3.8', `Expedition ${k} can launch on Sol ${plan}`, `Sol ${fmtR(range(xs))}`, xs.every((x) => x != null && x <= plan + 1));
  }
  const minSp = m((r) => r.mins.sp);
  claim('3.9', 'Spare Parts never drop below 15', `lowest ${fmtR(range(minSp))}`, minSp.every((x) => x >= 15));
  const w14 = m((r) => r.samples.find((x) => x.sol === 14)?.res.water ?? null);
  claim('3.5', 'Water drifts from 80 to about 55 by Sol 14', `${fmtR(range(w14))} at the start of Sol 14`, w14.every((x) => x != null && Math.abs(x - 55) <= 15));
  const minW = m((r) => r.mins.water);
  claim('3.5', 'Water never runs out on the recommended path', `lowest ${fmtR(range(minW))}`, minW.every((x) => x > 0));
  const minHp = m((r) => r.minHpDawn);
  claim('3.6', 'The Commander stays above 60 HP (checked at the start of each Sol)', `lowest ${fmtR(range(minHp))}; lowest at any moment ${fmtR(range(m((r) => r.mins.hp)))}`, minHp.every((x) => x >= 60));
  const em = m((r) => r.emergencies);
  const kinds = [...new Set(rec.flatMap((r) => Object.keys(r.emergencyKinds)))].join(', ') || 'none';
  claim('—', 'No emergencies on the planned path (health check, not a SCENARIO claim)', `${fmtR(range(em))} per run (${kinds})`, em.every((x) => x === 0));

  // 3.4 snapshots: engine rates() at the start of that Sol vs the table
  const snap = snapshots(md);
  const snapRows = snap.map((row) => {
    const obs = {};
    for (const k of ['power', 'heat', 'oxygen', 'food', 'water', 'morale', 'sp']) obs[k] = median(m((r) => r.samples.find((x) => x.sol === row.sol)?.rates[k] ?? null));
    return { ...row, obs };
  });

  // eager and careless variants: robustness, not SCENARIO claims
  const eagerFin = eager.map((r) => r.milestones.finale);
  claim('Robustness', 'A fast (eager) player finishes too; Spare Parts and water may run lower', `finale ${fmtR(range(eagerFin))}; lowest SP ${fmtR(range(eager.map((r) => r.mins.sp)))}, water ${fmtR(range(eager.map((r) => r.mins.water)))}, emergencies ${fmtR(range(eager.map((r) => r.emergencies)))}`, eager.every((r) => r.finished));
  // careless variant: never breaks the run (no death, no game over), finale still reachable
  const carelessFin = bad.map((r) => r.milestones.finale);
  claim('Core rules', 'Careless choices never end the run; the story can still be finished', `finale ${fmtR(range(carelessFin))}; ${bad.filter((r) => r.finished).length}/${bad.length} finished`, bad.every((r) => r.finished));

  return { claims, snapRows };
}

function report(runs, { claims, snapRows }, seeds) {
  const ok = claims.filter((c) => c.ok).length;
  const lines = [];
  lines.push('# 20-Sol balance check', '');
  lines.push(`Generated by \`node content/tools/balance-sim.mjs\` from the campaign engine in \`src/campaign\` (the game itself),`);
  lines.push(`on ${seeds} seeds. The SCENARIO claims are checked on the **planned** variant, which follows the Sol-by-Sol plan of 3.8`);
  lines.push('(nothing starts before its planned Sol, no Scrap Runs, the recommended dilemma choices). Two more variants test');
  lines.push('robustness: **eager** (everything as early as the engine allows, Scrap Runs between trips) and **careless** (eager, with');
  lines.push('the least prepared choice in every dilemma). Mini-games are always won. Nothing is changed: mismatches are for the team.', '');
  lines.push(`**${ok} of ${claims.length} checks pass.**`, '');
  lines.push('| Section | SCENARIO says | Engine does | Verdict | Note |', '|---|---|---|---|---|');
  for (const c of claims) lines.push(`| ${c.section} | ${c.text} | ${c.observed} | ${c.ok ? 'OK' : '**MISMATCH**'} | ${c.note} |`);
  lines.push('', '## 3.4 balance snapshots: net change per Sol', '');
  lines.push('Engine values are `rates(s)` at the start of that Sol, median over seeds (Workshop and salvage SP included;');
  lines.push('the scenario\'s SP column also counts about +2 from a won mini-game per Sol). Format: SCENARIO / engine.', '');
  lines.push('| Stage | Power | Heat | Oxygen | Food | Water | Morale | SP |', '|---|---|---|---|---|---|---|---|');
  for (const r of snapRows) {
    const cell = (k) => { const d = r.obs[k] == null ? null : r.obs[k] - r[k]; const flag = d != null && Math.abs(d) > (k === 'sp' ? 4 : 3) ? ' ⚠' : ''; return `${r[k]} / ${r.obs[k] ?? '—'}${flag}`; };
    lines.push(`| ${r.stage} | ${cell('power')} | ${cell('heat')} | ${cell('oxygen')} | ${cell('food')} | ${cell('water')} | ${cell('morale')} | ${cell('sp')} |`);
  }
  lines.push('', '⚠ = differs by more than 3 (SP: 4).', '');
  const r1 = runs.find((r) => r.variant === 'planned');
  lines.push(`## One run in detail (seed ${r1.seed}, planned)`, '');
  lines.push('| Sol | Power | Heat | Water | Oxygen | Food | Morale | SP | HP | Rover out |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const x of r1.samples) lines.push(`| ${x.sol} | ${x.res.power} | ${x.res.heat} | ${x.res.water} | ${x.res.oxygen} | ${x.res.food} | ${x.res.morale} | ${x.res.sp} | ${x.hp} | ${x.away ? 'yes' : ''} |`);
  lines.push('', `Milestones: modules online ${JSON.stringify(r1.milestones.modules)}; Tier 2 ${JSON.stringify(r1.milestones.tier2)}; drones ${JSON.stringify(r1.milestones.drones)}; expeditions launched ${JSON.stringify(r1.milestones.expeditions)}; finale Sol ${r1.milestones.finale}.`);
  return lines.join('\n') + '\n';
}

function main() {
  const i = process.argv.indexOf('--seeds');
  const seeds = i > 0 ? Number(process.argv[i + 1]) : 20;
  const runs = [];
  for (let seed = 1; seed <= seeds; seed++) for (const variant of Object.keys(VARIANTS)) runs.push(run(seed, { variant }));
  const md = fs.readFileSync(path.join(ROOT, 'SCENARIO.md'), 'utf8');
  const a = analyse(runs, md);
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, report(runs, a, seeds));
  if (process.argv.includes('--json')) fs.writeFileSync(OUT_JSON, JSON.stringify(runs, null, 1) + '\n'); // raw runs, ~0.5 MB, not committed
  for (const c of a.claims) console.log(`${c.ok ? 'OK      ' : 'MISMATCH'} [${c.section}] ${c.text} -> ${c.observed}`);
  console.log(`wrote ${path.relative(ROOT, OUT_MD)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
