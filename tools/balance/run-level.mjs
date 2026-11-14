#!/usr/bin/env node
/**
 * Play a level headlessly with a simple policy and print one line per sol.
 * A balancing aid for level designers: no browser, runs in a second.
 *
 *   node tools/balance/run-level.mjs [levelId] [--policy idle|shelter|smart] [--seed N]
 *
 * Policies:
 *   idle     never touch anything: the level's starting job assignments, no shelter orders
 *   shelter  starting assignments, but give the shelter order on every storm warning
 *   smart    shelter on warnings, plus rotate the engineer and commander between
 *            maintenance, panel cleaning and ice mining when gauges run low
 */
import { createGame, step, applyCommand, summary, LEVELS, evaluateObjectives } from '../../src/sim/index.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const levelId = args.find((a) => !a.startsWith('--') && a !== flag('policy') && a !== flag('seed')) || LEVELS[0].id;
const policy = flag('policy', 'shelter');
const game = createGame(levelId, { seed: Number(flag('seed', 1)) });

const f = (n, d = 1) => n.toFixed(d).padStart(6);
console.log(`level ${levelId}, policy ${policy}`);
console.log('sol |   O2 kg  water L  food kg  batt kWh | o2gen  recyc  solar | science  maxDose  minHealth minMorale | events');

let notes = [];
while (game.status === 'running') {
  const events = step(game, 10);
  for (const e of events) {
    if (e.type === 'storm-warning' && policy !== 'idle') applyCommand(game, { type: 'shelter', on: true });
    if (['storm-warning', 'storm-end', 'emergency', 'crew-grounded', 'dust-storm-start', 'project-done', 'dust-devil'].includes(e.type)) {
      notes.push(e.type === 'storm-end' ? `storm-end(${e.sheltered ? 'safe' : e.maxDoseMsv.toFixed(2) + ' mSv'})` : e.type === 'emergency' ? `EMERGENCY:${e.kind}` : e.type === 'storm-warning' ? `warning:${e.class}` : e.type);
    }
  }
  if (policy === 'smart') {
    const s = game.systems;
    const r = game.resources;
    const storm = game.shelterOrder || game.storms.some((x) => x.status === 'warned' || x.status === 'active');
    // Wake every sleeping drone (in the game the player does the tutorial battery step).
    for (const d of game.drones) if (d.status !== 'awake') applyCommand(game, { type: 'wakeDrone', drone: d.id });
    // Finish unfinished modules in scenario order (power first), then the level's upgrades.
    if (!game.construction) {
      const order = ['power', 'workshop', 'lab', 'garage', 'hydroponics'];
      const module = order.find((id) => game.modules[id] && game.modules[id].status !== 'online');
      const project = Object.keys(game.projects).find((id) => game.projects[id].status !== 'done');
      if (module) applyCommand(game, { type: 'buildModule', module });
      else if (project) applyCommand(game, { type: 'startProject', project });
    }
    const building = Boolean(game.construction);
    const canFarm = game.modules.hydroponics ? game.modules.hydroponics.status === 'online' : true;
    applyCommand(game, { type: 'assign', crew: 'bot', job: building && game.levelId.startsWith('L1') ? 'build' : canFarm ? 'farm' : 'rest' });
    // The scientist explores in quiet weather and moves to the deep lab when a storm is about.
    applyCommand(game, { type: 'assign', crew: 'sci', job: storm ? 'research' : 'explore' });
    applyCommand(game, { type: 'assign', crew: 'eng', job: Math.min(s.o2GenEff, s.recyclerEff) < 0.75 ? 'lifesupport' : building ? 'build' : s.solarClean < 0.85 ? 'solar' : 'lifesupport' });
    applyCommand(game, { type: 'assign', crew: 'cmdr', job: s.solarClean < 0.85 ? 'solar' : r.waterL < 60 ? 'explore' : 'research' });
  }
  if (game.minute % 1440 < 10 || game.status !== 'running') {
    const v = summary(game);
    const sol = Math.round(game.minute / 1440); // sols completed
    console.log(
      `${String(sol).padStart(3)} | ${f(v.resources.o2Kg)} ${f(v.resources.waterL)}  ${f(v.resources.foodKg)}   ${f(v.resources.batteryKwh)} | ${f(v.systems.o2GenEff, 2)} ${f(v.systems.recyclerEff, 2)} ${f(v.systems.solarClean, 2)} | ${f(v.science)}  ${f(Math.max(...v.crew.map((c) => c.doseMsv)), 2)}    ${f(Math.min(...v.crew.map((c) => c.health)), 0)}    ${f(Math.min(...v.crew.map((c) => c.morale)), 0)} | ${notes.join(', ')}`,
    );
    notes = [];
  }
}

console.log(`\nresult: ${game.status} — ${game.result.reason}  stars: ${game.result.stars}  score: ${game.result.score.total}`);
for (const p of game.result.score.parts) console.log(`  ${p.label.padEnd(28)} ${String(p.points).padStart(6)}`);
console.log('objectives:');
for (const o of evaluateObjectives(game, true)) console.log(`  [${o.status.padEnd(6)}] ${o.primary ? 'primary' : 'bonus  '}  ${o.text}  (${o.detail})`);
console.log('crew:');
for (const c of game.crew) console.log(`  ${c.name.padEnd(6)} ${c.role.padEnd(10)} dose ${c.doseMsv.toFixed(2)} mSv  health ${c.stats.health.toFixed(0)}  morale ${c.stats.morale.toFixed(0)}  energy ${c.stats.energy.toFixed(0)}  food ${c.stats.nutrition.toFixed(0)}  fitness ${c.stats.fitness.toFixed(0)}${c.grounded ? '  GROUNDED' : ''}`);
