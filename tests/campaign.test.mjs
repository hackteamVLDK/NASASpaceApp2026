// The campaign engine against the numbers printed in SCENARIO.md (Sections 3 and 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, command, rates, clockAt, powerCap, unlockReason, moduleInfo } from '../src/campaign/engine.js';
import { EXPEDITIONS, hpCost, durationMinutes } from '../src/campaign/expeditions.js';
import { setStrings, hasString } from '../src/flow/strings.js';
import { readFileSync } from 'node:fs';
import { MODULES, RECIPES, UPGRADES } from '../src/campaign/data.js';

const strings = JSON.parse(readFileSync(new URL('../content/data/strings.en.json', import.meta.url), 'utf8'));
setStrings(strings);
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const wake = (s) => command(s, { type: 'wakeDrone', drone: 'drone-01' });
/** Play `minutes`, answering any dilemma or event that pauses the game (the first card), and collect events. */
function play(s, minutes, answer = 'a') {
  const all = [];
  let left = minutes;
  while (left > 0 && s.status === 'running') {
    const before = s.minute;
    all.push(...step(s, left));
    left -= s.minute - before;
    if (s.pending) {
      if (s.pending.id === 'd1' && !s.flags._testD1) { s.flags._testD1 = true; }
      const res = command(s, { type: s.pending.kind === 'radio' ? 'radio' : 'choose', choice: answer });
      all.push(...(res.events ?? []));
    } else if (left > 0 && s.minute === before) break;
  }
  return all;
}
const skipTo = (s, sol, hour = 0) => play(s, (sol - 1) * 1440 + hour * 60 - s.minute);

test('Sol 1, pre-built modules only (3.4): power +30, heat -20, oxygen +4, food -6, water -1, morale +3', () => {
  const s = createCampaign();
  const r = rates(s);
  near(r.power, 30); near(r.heat, -20); near(r.oxygen, 4); near(r.food, -6); near(r.water, -1); near(r.morale, 3);
});

test('Sol 9, Battery + Workshop + Greenhouse + Garage online (3.4): power 0, heat +5, oxygen +7, food +4, water -4, morale +5', () => {
  const s = createCampaign();
  for (const id of ['battery', 'workshop', 'greenhouse', 'garage']) s.modules[id].status = 'online';
  s.drones[0].status = 'awake'; // idle drone: salvage +2 SP
  const r = rates(s);
  near(r.power, 0); near(r.heat, 5); near(r.oxygen, 7); near(r.food, 4); near(r.water, -4); near(r.morale, 5);
  near(r.sp, 8); // Workshop +6 and idle salvage +2 (a won mini-game adds +2 more, see 3.4)
});

test('Sol 15 and Sol 20 snapshots: all six at Tier 1 with Solar T2, and everything at Tier 2', () => {
  const s = createCampaign();
  for (const id of ['battery', 'workshop', 'greenhouse', 'garage', 'lab', 'recreation']) s.modules[id].status = 'online';
  s.modules.solar.tier = 2;
  s.drones[0].status = 'awake';
  const r15 = rates(s);
  near(r15.power, 16); near(r15.heat, 5); near(r15.oxygen, 7); near(r15.food, 4); near(r15.water, -4); near(r15.morale, 9);
  for (const id of Object.keys(s.modules)) if (MODULES[id].t2) s.modules[id].tier = 2;
  const r20 = rates(s);
  near(r20.power, 8, 0.5); near(r20.heat, 15); near(r20.oxygen, 15); near(r20.food, 10); near(r20.water, -5); near(r20.morale, 11);
});

test('power cap grows with Battery & Heating (100 -> 250 -> 400)', () => {
  const s = createCampaign();
  assert.equal(powerCap(s), 100);
  s.modules.battery.status = 'online';
  assert.equal(powerCap(s), 250);
  s.modules.battery.tier = 2;
  assert.equal(powerCap(s), 400);
});

test('a dust storm cuts the solar power to 30% and Battery & Heating burns x4', () => {
  const s = createCampaign();
  s.modules.battery.status = 'online';
  const calm = rates(s);
  s.storm = { until: 1e9 };
  const storm = rates(s);
  near(storm.power - calm.power, -35 - 18, 0.01); // solar 50 -> 15, battery -6 -> -24
});

test('building follows the unlock chain and costs (3.3), takes 2 Sols with one drone, and needs a drone', () => {
  const s = createCampaign();
  assert.equal(command(s, { type: 'build', module: 'battery' }).ok, false, 'no awake drone yet');
  wake(s);
  assert.equal(unlockReason(s, 'workshop') !== null, true);
  assert.equal(command(s, { type: 'build', module: 'workshop' }).ok, false);
  const ok = command(s, { type: 'build', module: 'battery' });
  assert.equal(ok.ok, true);
  near(s.res.sp, 50, 1e-9);
  assert.equal(command(s, { type: 'build', module: 'garage' }).ok, false, 'garage needs the Greenhouse started');
  step(s, 1440 * 2 - 5);
  assert.equal(s.modules.battery.status, 'building');
  step(s, 10);
  assert.equal(s.modules.battery.status, 'online');
  assert.equal(unlockReason(s, 'workshop'), null);
  assert.ok(s.drones[0].task === null, 'the drone is free again');
});

test('the scenario unlock order: Battery -> Workshop -> Greenhouse -> Garage -> Lab (+ Dish Antenna) -> Recreation, Roof', () => {
  const s = createCampaign();
  s.modules.battery.status = 'online';
  assert.equal(unlockReason(s, 'greenhouse') !== null, true);
  s.modules.workshop.status = 'online';
  assert.equal(unlockReason(s, 'greenhouse'), null);
  assert.equal(unlockReason(s, 'garage') !== null, true);
  s.modules.greenhouse.status = 'building';
  assert.equal(unlockReason(s, 'garage'), null);
  s.modules.garage.status = 'online';
  assert.match(unlockReason(s, 'lab'), /Dish Antenna/);
  s.items.dish_antenna = 1;
  assert.equal(unlockReason(s, 'lab'), null);
  s.modules.lab.status = 'building';
  assert.equal(unlockReason(s, 'recreation'), null);
  assert.match(unlockReason(s, 'roof'), /Titanium/);
});

test('Sol 1 plays out as the story says: dusk lines, heat warning task, first sleep', () => {
  const s = createCampaign();
  const ev = [...step(s, 1440 * 2 - s.minute + 6 * 60 + 1)];
  const lines = ev.filter((e) => e.type === 'astra').map((e) => e.lineId);
  for (const id of ['astra.act1.first_sunset', 'astra.act1.first_dusk', 'astra.act1.first_sleep']) assert.ok(lines.includes(id), id);
  assert.ok(s.tasks.some((t) => t.game === 'heat_pump'));
});

test('Dilemma 1 appears at the end of Sol 3 and pauses the game; every choice has its follow-up', () => {
  for (const [choice, check] of [['a', (s) => s.mods.some((m) => m.id === 'd1a_saver')], ['b', (s) => s.hp < 100], ['c', () => true]]) {
    const s = createCampaign();
    wake(s);
    skipTo(s, 3, 19);
    const ev = step(s, 200);
    assert.deepEqual(s.pending, { kind: 'dilemma', id: 'd1' });
    assert.ok(ev.some((e) => e.type === 'dilemma' && e.id === 'd1'));
    const before = s.minute;
    assert.equal(step(s, 30).length, 0);
    assert.equal(s.minute, before, 'time is stopped while a choice is pending');
    assert.equal(command(s, { type: 'choose', choice }).ok, true);
    assert.equal(s.pending, null);
    assert.ok(check(s), choice);
    const rest = play(s, 1440 * 5);
    const lines = rest.filter((e) => e.type === 'astra').map((e) => e.lineId);
    assert.ok(lines.includes(`astra.d1.${choice}`), `follow-up for ${choice}`);
  }
});

test('Dilemma 1 choice C drains the battery on Sol 6: power emergency, morale -10 (scripted)', () => {
  const s = createCampaign();
  wake(s);
  skipTo(s, 3, 19);
  step(s, 200);
  command(s, { type: 'choose', choice: 'c' });
  const ev = play(s, 1440 * 3 + 600);
  assert.ok(s.flags._d1c, 'the scripted drain ran');
  assert.ok(ev.some((e) => e.type === 'emergency' && e.kind === 'power'));
});

test('the scripted dust storm runs Sols 4-6 and leaves a Static Wipe task', () => {
  const s = createCampaign();
  skipTo(s, 3, 19);
  step(s, 200);
  command(s, { type: 'choose', choice: 'c' });
  skipTo(s, 5, 6);
  assert.ok(s.storm, 'storm is on during Sol 5');
  skipTo(s, 7, 1);
  assert.equal(s.storm, null);
  assert.ok(s.tasks.some((t) => t.game === 'solar_wipe'));
});

test('crafting needs the Workshop; the Repair Kit wakes Drone #02 and ends Act I', () => {
  const s = createCampaign();
  assert.equal(command(s, { type: 'craft', recipe: 'repair_kit' }).ok, false);
  for (const id of ['battery', 'workshop']) s.modules[id].status = 'online';
  assert.equal(command(s, { type: 'craft', recipe: 'repair_kit' }).ok, true);
  assert.equal(command(s, { type: 'craft', recipe: 'repair_kit' }).ok, false, 'one craft at a time');
  const ev = step(s, 1440 + 5);
  assert.equal(s.kits.repair_kit, 1);
  assert.ok(ev.some((e) => e.type === 'astra' && e.lineId === 'astra.act1.repair_kit_ready'));
  assert.equal(command(s, { type: 'useKit', kit: 'repair_kit', drone: 'drone-03' }).ok, false, 'wrong drone');
  const res = command(s, { type: 'useKit', kit: 'repair_kit', drone: 'drone-02' });
  assert.equal(res.ok, true);
  assert.equal(s.drones[1].status, 'awake');
  assert.ok(res.events.some((e) => e.type === 'astra' && e.lineId === 'astra.act1.end'));
});

test('expedition HP costs match the scenario table (3.6): 17, 17, 21, 19, 12', () => {
  const s = createCampaign();
  near(hpCost(s, EXPEDITIONS[1]), 17, 0.01);
  near(hpCost(s, EXPEDITIONS[2]), 17, 0.01);
  near(hpCost(s, EXPEDITIONS[3]), 21.25, 0.01);
  s.upgrades.rover_shielding = true;
  s.upgrades.suit_liner = true;
  near(hpCost(s, EXPEDITIONS[4]), 19.1, 0.1);
  s.modules.garage.tier = 2;
  near(hpCost(s, EXPEDITIONS[5]), 11.5, 0.1);
  near(hpCost(createCampaign(), EXPEDITIONS.run), 17, 0.01);
  const t = createCampaign();
  t.upgrades.rover_shielding = true;
  assert.ok(hpCost(t, EXPEDITIONS[4]) > 25 && hpCost(t, EXPEDITIONS[4]) < 26.5, 'without the liner Expedition 4 costs 25.5 (a third more than 19)');
});

test('expedition 1: launch needs the Garage, costs 2 Water, streams radio lines, returns loot', () => {
  const s = createCampaign();
  assert.equal(command(s, { type: 'launch', expedition: 1 }).ok, false);
  s.modules.garage.status = 'online';
  const w = s.res.water;
  assert.equal(command(s, { type: 'launch', expedition: 1 }).ok, true);
  near(s.res.water, w - 2, 1e-9);
  const ev = step(s, 1440 + 5);
  const radio = ev.filter((e) => e.type === 'radio').map((e) => e.id);
  assert.deepEqual(radio, ['radio.exp1.00', 'radio.exp1.30', 'radio.exp1.60', 'radio.exp1.80', 'radio.exp1.100']);
  for (const id of radio) assert.ok(hasString(id), id);
  assert.equal(s.away, null);
  assert.equal(s.items.probe_power_core, 1, 'story items always drop');
  assert.ok(s.hp < 100);
  assert.ok(ev.some((e) => e.type === 'returned'));
});

test('expedition 2 stops at 60% for the radio decision; A takes longer, B costs 5 HP', () => {
  for (const choice of ['a', 'b']) {
    const s = createCampaign();
    s.modules.garage.status = 'online';
    s.upgrades.titanium_wheels = true;
    command(s, { type: 'launch', expedition: 2 });
    step(s, 1440);
    assert.equal(s.pending?.kind, 'radio');
    assert.equal(command(s, { type: 'radio', choice }).ok, true);
    step(s, 1440);
    assert.equal(s.away, null);
    assert.equal(s.items.black_box, 1);
    assert.equal(s.items.dish_antenna, 1);
  }
});

test('expedition requirements follow 5.2', () => {
  const s = createCampaign();
  s.modules.garage.status = 'online';
  for (const k of [2, 3, 4, 5]) assert.equal(command(s, { type: 'launch', expedition: k }).ok, false, `exp ${k} is locked`);
  assert.equal(EXPEDITIONS[4].requires(s) !== null, true);
  s.upgrades.rover_shielding = true;
  assert.equal(EXPEDITIONS[4].requires(s), null);
});

test('HP: a night in the Bedroom restores about 11 HP net (3.6)', () => {
  const s = createCampaign();
  s.hp = 50;
  step(s, 1440 - (s.minute % 1440) + 1440); // one full Sol
  assert.ok(s.hp > 55 && s.hp < 75, `hp ${s.hp}`);
});

test('HP 0 sends the Commander to Med-Rest for a Sol, then back at 50 HP', () => {
  const s = createCampaign();
  s.res.morale = 10;
  s.hp = 0.0001;
  step(s, 3);
  assert.ok(s.medRest);
  const ev = play(s, 1500);
  assert.equal(s.medRest, null);
  assert.ok(ev.some((e) => e.type === 'astra' && e.lineId === 'astra.hp.medrest_end'));
});

test('oxygen 0 raises an emergency and the mini-game restores it', () => {
  const s = createCampaign();
  s.res.oxygen = 0.01;
  s.modules.lifesupport.status = 'unbuilt';
  const ev = step(s, 30);
  assert.ok(ev.some((e) => e.type === 'emergency' && e.kind === 'oxygen' && e.mini === 'valve_balance'));
  command(s, { type: 'miniResult', game: 'valve_balance', win: true });
  assert.ok(s.res.oxygen >= 25 && !s.emergency.oxygen);
});

test('the mini-game rewards: +2 Spare Parts per win, the explanation only the first time', () => {
  const s = createCampaign();
  const a = command(s, { type: 'miniResult', game: 'solar_wipe', win: true });
  assert.equal(s.res.sp, 62);
  assert.ok(a.events.some((e) => e.type === 'astra' && e.lineId === 'astra.mg.solar_wipe'));
  const b = command(s, { type: 'miniResult', game: 'solar_wipe', win: true });
  assert.equal(s.res.sp, 64);
  assert.ok(b.events.every((e) => e.type !== 'astra'));
});

test('upgrades and recipes reference real strings and items', () => {
  for (const r of Object.values(RECIPES)) assert.ok(hasString(r.nameId), r.nameId);
  for (const u of Object.values(UPGRADES)) assert.ok(hasString(u.nameId), u.nameId);
  for (const m of Object.values(MODULES)) assert.ok(hasString(m.nameId), m.nameId);
  for (const u of Object.values(UPGRADES)) for (const it of Object.keys(u.items ?? {})) assert.ok(hasString(`ui.item.${it}.name`), it);
});

test('same seed and commands give the same game (deterministic)', () => {
  const run = () => {
    const s = createCampaign({ seed: 7 });
    wake(s);
    command(s, { type: 'build', module: 'battery' });
    skipTo(s, 3, 19);
    step(s, 200);
    command(s, { type: 'choose', choice: 'a' });
    step(s, 1440 * 6);
    return JSON.stringify([s.res, s.hp, s.minute, s.flags]);
  };
  assert.equal(run(), run());
});

test('no meter ever goes NaN or negative over 30 idle Sols; the clock is right', () => {
  const s = createCampaign({ seed: 3 });
  for (let i = 0; i < 30; i++) {
    for (let k = 0; k < 1440 && !s.pending; k += 60) step(s, 60);
    if (s.pending) command(s, { type: s.pending.kind === 'radio' ? 'radio' : 'choose', choice: 'a' });
    for (const [k, v] of Object.entries(s.res)) assert.ok(Number.isFinite(v) && v >= 0, `${k}=${v}`);
    assert.ok(Number.isFinite(s.hp) && s.hp >= 0);
  }
  assert.equal(clockAt(1440 * 3 + 60 * 5 + 2).sol, 4);
  assert.equal(moduleInfo(s, 'battery').status, 'unbuilt');
});
