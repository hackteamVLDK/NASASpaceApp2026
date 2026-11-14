/**
 * Regression tests for the play-test of 2026-11-14 (tools/balance/strategy-lab.mjs) and the two
 * Codex reviews of the campaign (docs/ERRORS.md rows B6, B7, B8, B17, B20, A22).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, command, rates } from '../src/campaign/engine.js';
import { whereToFind, itemsWithoutSource } from '../src/campaign/sources.js';
import { EXPEDITIONS, durationMinutes, expectedLoot, finaleBlock } from '../src/campaign/expeditions.js';
import { play } from '../tools/balance/strategy-lab.mjs';
import { readFileSync } from 'node:fs';
import { setStrings, hasString } from '../src/flow/strings.js';

setStrings(JSON.parse(readFileSync(new URL('../content/data/strings.en.json', import.meta.url), 'utf8')));

/** A base where every room stands and the Rover has what a trip needs. */
function readyBase(extra = {}) {
  const s = createCampaign({ seed: 3 });
  for (const id of ['battery', 'workshop', 'greenhouse', 'garage', 'lab', 'recreation']) s.modules[id].status = 'online';
  Object.assign(s.upgrades, { titanium_wheels: true, deep_ice_drill: true, rover_shielding: true, suit_liner: true }, extra);
  s.res.power = 200;
  return s;
}
/** Run until the Rover is home, answering cards with `choice`. Returns every event. */
function trip(s, key, choice = 'b') {
  const first = command(s, { type: 'launch', expedition: key });
  assert.equal(first.ok, true, first.error);
  const events = [...first.events];
  for (let i = 0; i < 400 && s.away; i++) {
    if (s.pending) events.push(...command(s, s.pending.kind === 'radio' ? { type: 'radio', choice: choice === 'c' ? 'b' : choice } : { type: 'choose', choice }).events);
    events.push(...step(s, 30));
  }
  assert.equal(s.away, null, 'the Rover must come home');
  s.hp = 100;
  return events;
}

test('a story place is explored once; the runs can be repeated', () => {
  const s = readyBase();
  trip(s, 1);
  const again = command(s, { type: 'launch', expedition: 1 });
  assert.equal(again.ok, false);
  assert.match(again.error, /already explored/);
  assert.match(EXPEDITIONS[1].requires(s), /already explored/, 'the map shows it as locked');
  trip(s, 'run');
  trip(s, 'run');
  assert.equal(command(s, { type: 'launch', expedition: 'nowhere' }).ok, false);
});

test('Dilemma 5 A: the Delta Cliffs can be visited once more, for one Sol, for what was left', () => {
  const s = readyBase();
  trip(s, 4, 'a');
  assert.equal(s.items.rare_battery_cell, 2, 'raced home with two cells');
  assert.equal(s.flags.exp4Repeat, true);
  assert.equal(EXPEDITIONS[4].requires(s), null, 'open again');
  assert.equal(durationMinutes(s, EXPEDITIONS[4]), 1440, 'the second visit takes one Sol');
  assert.deepEqual(expectedLoot(s, EXPEDITIONS[4]).items.rare_battery_cell, 1);
  const events = trip(s, 4, 'a');
  assert.ok(!events.some((e) => e.type === 'dilemma'), 'no second space-weather dilemma');
  assert.equal(s.items.rare_battery_cell, 3, 'the third cell is home: Battery T2 and the Long-Range Battery are both possible');
  assert.equal(s.flags.exp4Repeat, false);
  assert.match(EXPEDITIONS[4].requires(s), /already explored/);
});

test('Dilemma 5 B brings everything home, so the Delta Cliffs stay closed afterwards', () => {
  const s = readyBase();
  trip(s, 4, 'b');
  assert.equal(s.items.rare_battery_cell >= 1, true);
  assert.equal(Boolean(s.flags.exp4Repeat), false);
  assert.equal(command(s, { type: 'launch', expedition: 4 }).ok, false);
});

test('the Ice Run brings two Ice Cores and needs the Deep Ice Drill', () => {
  const noDrill = readyBase({ deep_ice_drill: false });
  assert.match(command(noDrill, { type: 'launch', expedition: 'ice' }).error, /Deep Ice Drill/);
  const s = readyBase();
  const events = trip(s, 'ice');
  assert.equal(s.items.ice_core, 2);
  const radio = events.filter((e) => e.type === 'radio');
  assert.equal(radio.length, 3);
  for (const r of radio) assert.ok(hasString(r.id), `the radio line ${r.id} must be a real string`);
});

test('a Rough ride comes home half a Sol late; Bumpy and Rough both ask for a wheel check', () => {
  let rough = null;
  let bumpy = null;
  for (let seed = 1; seed < 60 && !(rough && bumpy); seed++) {
    const s = readyBase();
    s.rng = seed * 7919;
    const start = s.minute;
    const events = trip(s, 2);
    const back = events.find((e) => e.type === 'returned');
    if (back.result === 'rough' && !rough) rough = { s, late: s.minute - start, back };
    if (back.result === 'bumpy' && !bumpy) bumpy = { s };
  }
  assert.ok(rough && bumpy, 'some seed must give each result');
  assert.ok(rough.late >= 1440 + 720, `a Rough trip takes at least 1.5 Sols (took ${rough.late} minutes)`);
  assert.equal(rough.back.loot.items.dish_antenna, 1, 'story items always come home');
  assert.ok(rough.s.tasks.some((t) => t.game === 'wheel_vacuum'));
  assert.ok(bumpy.s.tasks.some((t) => t.game === 'wheel_vacuum'));
});

test('the finale plays both science lines, at 75% and 85% of the trip', () => {
  const s = readyBase();
  s.modules.garage.tier = 2;
  s.modules.lab.tier = 2;
  assert.equal(finaleBlock(s), null);
  const lines = trip(s, 5).filter((e) => e.type === 'astra').map((e) => e.lineId);
  assert.ok(lines.includes('astra.finale.leopard') && lines.includes('astra.finale.methane'), lines.join(', '));
  assert.ok(lines.indexOf('astra.finale.leopard') < lines.indexOf('astra.finale.methane'));
});

test('the map says exactly what the finale still needs', () => {
  const s = readyBase();
  s.flags.exp4Repeat = true;
  const why = EXPEDITIONS[5].requires(s);
  assert.match(why, /Long-Range Battery/);
  assert.match(why, /Delta Cliffs/);
  assert.match(why, /Lab Deep Scan/);
});

test('a choice needs what it costs, and the Cargo Trailer needs a Garage', () => {
  const s = createCampaign();
  s.pending = { kind: 'dilemma', id: 'd2' };
  s.res.sp = 5;
  assert.match(command(s, { type: 'choose', choice: 'a' }).error, /Spare Parts/);
  assert.ok(s.pending, 'the card stays open');
  s.res.sp = 40;
  assert.match(command(s, { type: 'choose', choice: 'b' }).error, /Garage/);
  assert.equal(command(s, { type: 'choose', choice: 'c' }).ok, true, 'the free choice always works');
  const radio = createCampaign();
  radio.pending = { kind: 'radio', id: 'exp2.60' };
  assert.equal(command(radio, { type: 'choose', choice: 'a' }).ok, false, 'a radio decision is answered on the radio');
});

test('Top Up before the storm adds to a big battery instead of cutting it to 100', () => {
  const s = createCampaign();
  s.modules.battery.status = 'online';
  s.res.power = 200;
  s.pending = { kind: 'dilemma', id: 'd1' };
  command(s, { type: 'choose', choice: 'b' });
  assert.equal(s.res.power, 240);
});

test('base jobs wait while the Commander is away', () => {
  const s = readyBase();
  s.tasks.push({ game: 'heat_pump', why: 'test' });
  command(s, { type: 'launch', expedition: 'run' });
  const heat = s.res.heat;
  const r = command(s, { type: 'miniResult', game: 'heat_pump', win: true });
  assert.equal(r.ok, false);
  assert.equal(s.res.heat, heat);
});

test('breakdowns: about one per two Sols, at most two open, and each weakens its system until fixed', () => {
  const s = readyBase();
  s.minute = 8 * 1440 + 7 * 60; // Sol 9, morning
  const opened = [];
  for (let i = 0; i < 12 * 24; i++) for (const e of step(s, 60)) if (e.type === 'breakdown') opened.push([e.kind, Math.floor(s.minute / 1440) + 1]);
  assert.ok(opened.length >= 2, 'breakdowns happen');
  assert.equal(s.tasks.filter((t) => ['valve_balance', 'air_filter', 'solar_wipe', 'water_sort'].includes(t.game)).length, 2, 'never more than two open when nobody repairs');
  for (let i = 1; i < opened.length; i++) assert.ok(opened[i][1] - opened[i - 1][1] >= 2, 'at least two Sols apart');
  assert.deepEqual(opened.map((o) => o[0]), ['valve_balance', 'air_filter']);

  const o2 = (st) => rates(st).oxygen;
  const fresh = readyBase();
  const base = o2(fresh);
  assert.ok(o2(s) < base - 8, `a stuck valve and a clogged filter cut Oxygen output (${o2(s)} against ${base} per Sol)`);
  command(s, { type: 'miniResult', game: 'air_filter', win: false });
  const afterFail = o2(s);
  assert.ok(afterFail > o2({ ...s, flags: { ...s.flags, filterClog: 0.5 } }), 'a failed try still cleans part of the filter');
  command(s, { type: 'miniResult', game: 'air_filter', win: true });
  command(s, { type: 'miniResult', game: 'valve_balance', win: true });
  assert.equal(o2(s), base, 'fixed: full output again');
});

test('breakdowns wait while the Commander is away and start when the Rover is home', () => {
  const s = readyBase();
  s.minute = 8 * 1440 + 7 * 60;
  command(s, { type: 'launch', expedition: 'run' });
  const events = [];
  while (s.away) events.push(...step(s, 30));
  const at = events.findIndex((e) => e.type === 'breakdown');
  const home = events.findIndex((e) => e.type === 'returned');
  assert.ok(at > home, 'the first breakdown comes only after the Rover is back');
});

test('every part has a place where it can be found', () => {
  assert.deepEqual(itemsWithoutSource(), []);
  assert.match(whereToFind('solar_cell'), /Pathfinder-X wreck \(Expedition 2\) x3/);
  assert.equal(whereToFind('unobtainium'), '');
});

test('play-test: the all-A path is no longer a dead end', () => {
  for (const seed of [1, 2, 3]) {
    const run = play('recommended', seed);
    assert.ok(run.choices.includes('d5a'), 'this path races home on Dilemma 5');
    assert.notEqual(run.finaleSol, null, `seed ${seed}: the story must reach the Canyon Anomaly`);
    assert.equal(run.stalled, null);
  }
});
