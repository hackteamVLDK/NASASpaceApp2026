// node --test content/tools/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractGameData, consistency, effects, cost, loot, triggerIds } from './extract-game-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const md = fs.readFileSync(path.join(ROOT, 'SCENARIO.md'), 'utf8');
const strings = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'data', 'strings.en.json'), 'utf8'));
const { data, problems } = extractGameData(md);

test('game-data.json is up to date with SCENARIO.md', () => {
  const file = fs.readFileSync(path.join(ROOT, 'content', 'data', 'game-data.json'), 'utf8');
  assert.equal(file, JSON.stringify(data, null, 2) + '\n', 'run: node content/tools/extract-game-data.mjs');
});

test('SCENARIO.md is internally consistent (items, ledger, line IDs)', () => {
  assert.deepEqual([...problems, ...consistency(data, strings)], []);
});

test('parsers', () => {
  assert.deepEqual(effects('−10 Power, +10 Food, +3 Oxygen, −3 Water, +2 Morale, fresh crops +4 HP'),
    { power: -10, food: 10, oxygen: 3, water: -3, morale: 2, freshCropsHp: 4 });
  assert.deepEqual(effects('−6 Power, +35 Heat, Power cap 400'), { power: -6, heat: 35, powerCap: 400 });
  const ids = new Set(['ice_core', 'circuit_board', 'water_filter_membrane', 'titanium_plate']);
  assert.deepEqual(cost('Water Filter Membrane + 2 Ice Cores + 1 Circuit Board + 1 Titanium Plate + 10 SP', ids),
    { sp: 10, water: 0, items: { water_filter_membrane: 1, ice_core: 2, circuit_board: 1, titanium_plate: 1 } });
  assert.deepEqual(cost('15 SP + 10 Water', ids), { sp: 15, water: 10, items: {} });
  assert.deepEqual(loot('20 SP, Ice Core ×3, Circuit Board', ids), { sp: 20, items: { ice_core: 3, circuit_board: 1 } });
  assert.deepEqual(triggerIds('Dilemma 5 alert; Event 1 alert'), ['astra.d5.alert', 'astra.e1.alert']);
  assert.deepEqual(triggerIds('Expedition 1 radio, 30%'), ['radio.exp1.30']);
  assert.deepEqual(triggerIds('4.2 ASTRA'), ['astra.mg.air_filter_scrub']);
});

test('key numbers match SCENARIO Sections 3 and 5', () => {
  const mod = (id) => data.modules.find((m) => m.id === id);
  assert.equal(mod('battery_and_heating').cost.sp, 10);
  assert.equal(mod('research_and_comms_lab').cost.items.dish_antenna, 1);
  assert.equal(mod('solar_array').t1.effects.power, 50);
  assert.deepEqual(data.resources.find((r) => r.id === 'power').capWith, { batteryT1: 250, batteryT2: 400 });
  assert.equal(data.needs.perAstronautPerSol.oxygen, -10);
  const exp = (id) => data.expeditions.find((e) => e.id === id);
  assert.equal(exp('exp4').durationSols, 2);
  assert.equal(exp('exp3').routeFactor, 1.25);
  assert.equal(exp('exp2').loot.items.titanium_plate, 3);
  for (const [k, r] of Object.entries(data.risk)) assert.ok(Math.abs(r.smooth + r.bumpy + r.rough - 1) < 1e-9, k);
  assert.equal(data.events.find((e) => e.id === 'e2').daytimeOnly, true);
  assert.equal(data.roles.find((r) => r.id === 'rover_pilot_and_geologist').baseHp, 120);
});

test('every module Tier 2 recipe points at a module that has a Tier 2', () => {
  for (const r of data.recipes.filter((x) => x.tier2Of)) {
    const m = data.modules.find((x) => x.id === r.tier2Of);
    assert.ok(m, r.id);
    assert.ok(m.t2, `${r.id} -> ${m.id} has no Tier 2 row in 3.3`);
  }
});
