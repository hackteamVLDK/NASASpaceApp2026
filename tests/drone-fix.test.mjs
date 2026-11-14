// B2 / SCENARIO section 4 "Rules for all mini-games": after 3 failures in a row a drone offers to auto-fix it (1 Sol of drone time).
// The offer itself is drawn by the mini-game; the engine side is the command `droneFix` and the check `droneFixBlock`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, command, step, droneFixBlock } from '../src/campaign/engine.js';
import { restoreSave } from '../src/campaign/save-migrate.js';

const SOL = 1440;
const awake = (s, ...ids) => { for (const id of ids) s.drones.find((d) => d.id === id).status = 'awake'; };
const task = (s, game) => s.tasks.push({ game, why: 'x' });
const clone = (x) => JSON.parse(JSON.stringify(x));

function base() {
  const s = createCampaign({ seed: 5 });
  awake(s, 'drone-01');
  s.flags.panelsCleaned = true;
  return s;
}

test('droneFixBlock: nothing to fix, no drone awake, every drone busy, already on it', () => {
  const s = createCampaign({ seed: 5 });
  assert.match(droneFixBlock(s, 'heat_pump'), /nothing for a drone to fix/);
  task(s, 'heat_pump');
  assert.match(droneFixBlock(s, 'heat_pump'), /No drone is awake/);
  awake(s, 'drone-01');
  assert.equal(droneFixBlock(s, 'heat_pump'), null);
  assert.match(droneFixBlock(s, 'not_a_game'), /nothing for a drone to fix/);
  assert.match(droneFixBlock(s, 'valve_balance'), /nothing for a drone to fix/, 'that system is not down');
  assert.equal(droneFixBlock(s, 'suit_seal'), null, 'the prep before a trip can be done by a drone too');
  s.res.sp = 100; // one drone, busy building
  assert.ok(command(s, { type: 'build', module: 'battery' }).ok);
  assert.match(droneFixBlock(s, 'heat_pump'), /busy/);
});

test('a system that is down is fixed when the Sol is over, without the player\'s reward', () => {
  const s = base();
  task(s, 'heat_pump');
  s.res.heat = 10; s.emergency.heat = true;
  const sp = s.res.sp;
  const wins = s.stats.miniWins;
  const r = command(s, { type: 'droneFix', game: 'heat_pump' });
  assert.equal(r.ok, true);
  assert.ok(r.events.some((e) => e.type === 'drone-fix' && e.deferred === true));
  const d = s.drones[0];
  assert.deepEqual([d.task.type, d.task.fix, d.task.deferred, d.task.module], ['chore', 'heat_pump', true, null]);
  assert.equal(d.task.until, s.minute + SOL, 'one Sol of drone time');
  assert.ok(s.tasks.some((t) => t.game === 'heat_pump'), 'still down until the drone is done');
  step(s, SOL - 5);
  assert.ok(s.tasks.some((t) => t.game === 'heat_pump'), 'not before the Sol is over');
  assert.ok(d.task, 'the drone is still busy');
  const events = step(s, 10);
  assert.ok(events.some((e) => e.type === 'drone-fixed' && e.game === 'heat_pump'));
  assert.ok(!s.tasks.some((t) => t.game === 'heat_pump'), 'fixed');
  assert.equal(s.emergency.heat, false);
  assert.equal(d.task, null, 'and the drone is free again');
  assert.equal(s.stats.miniWins, wins, 'a drone did it: no win is counted');
  assert.ok(s.res.sp <= sp + 12, 'no +2 SP reward (only what the Workshop and salvage give)');
});

test('the same fix is not applied twice when the player wins the game meanwhile', () => {
  const s = base();
  task(s, 'heat_pump');
  s.res.heat = 20;
  assert.ok(command(s, { type: 'droneFix', game: 'heat_pump' }).ok);
  step(s, 100);
  assert.ok(command(s, { type: 'miniResult', game: 'heat_pump', win: true }).ok, 'the player fixes it first');
  assert.ok(!s.tasks.some((t) => t.game === 'heat_pump'));
  const events = step(s, SOL);
  assert.ok(!events.some((e) => e.type === 'drone-fixed'), 'nothing left to fix: the drone only finishes its time');
  assert.equal(s.drones[0].task, null);
});

test('the prep before a trip counts at once, and the drone is busy for a Sol', () => {
  const s = base();
  const wins = s.stats.miniWins;
  const r = command(s, { type: 'droneFix', game: 'suit_seal' });
  assert.equal(r.ok, true);
  assert.equal(r.events.find((e) => e.type === 'drone-fix').deferred, false);
  assert.equal(s.flags.prepSuit, true, 'the Rover can go');
  assert.equal(s.drones[0].task.fix, 'suit_seal');
  assert.equal(s.stats.miniWins, wins);
  awake(s, 'drone-02');
  assert.ok(command(s, { type: 'droneFix', game: 'wheel_vacuum' }).ok);
  assert.equal(s.flags.prepWheel, 'ok');
});

test('one drone cannot be sent twice, two drones can take two systems, a busy drone cannot be borrowed', () => {
  const s = base();
  task(s, 'heat_pump'); task(s, 'valve_balance');
  assert.ok(command(s, { type: 'droneFix', game: 'heat_pump' }).ok);
  const again = command(s, { type: 'droneFix', game: 'heat_pump' });
  assert.equal(again.ok, false);
  assert.match(again.error, /already on it/);
  const busy = command(s, { type: 'droneFix', game: 'valve_balance' });
  assert.equal(busy.ok, false, 'the only drone is on the first job');
  assert.match(busy.error, /busy/);
  awake(s, 'drone-02');
  assert.ok(command(s, { type: 'droneFix', game: 'valve_balance' }).ok);
  assert.deepEqual(s.drones.map((d) => d.task?.fix ?? null), ['heat_pump', 'valve_balance', null]);
});

test('a drone on a fix cannot build, and its waiting jobs start when it is done', () => {
  const s = base();
  task(s, 'heat_pump');
  s.res.sp = 100;
  assert.ok(command(s, { type: 'droneFix', game: 'heat_pump' }).ok);
  const r = command(s, { type: 'build', module: 'battery' });
  assert.equal(r.ok, false, 'no free drone');
  assert.ok(command(s, { type: 'build', module: 'battery', drone: 'drone-01' }).ok, 'but a job may wait in its queue (Drone Link)');
  assert.equal(s.drones[0].queue.length, 1);
  step(s, SOL + 5);
  assert.equal(s.drones[0].task?.type, 'build', 'the queued build started when the fix was done');
});

test('a save taken while a drone is on a fix loads back, and the fix still lands', () => {
  const s = base();
  task(s, 'heat_pump');
  assert.ok(command(s, { type: 'droneFix', game: 'heat_pump' }).ok);
  step(s, 300);
  const r = restoreSave(clone(s));
  assert.equal(r.ok, true, r.reason);
  assert.deepEqual(r.state.drones[0].task, s.drones[0].task);
  step(r.state, SOL);
  assert.ok(!r.state.tasks.some((t) => t.game === 'heat_pump'));
});

test('a refused command changes nothing', () => {
  const s = base();
  const before = JSON.stringify(s);
  assert.equal(command(s, { type: 'droneFix', game: 'heat_pump' }).ok, false);
  assert.equal(command(s, { type: 'droneFix' }).ok, false);
  assert.equal(command(s, { type: 'droneFix', game: 'constructor' }).ok, false);
  assert.equal(JSON.stringify(s), before);
});
