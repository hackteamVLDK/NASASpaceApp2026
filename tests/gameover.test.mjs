// HP 0 ends the mission with a Game Over (the player's wish, docs/ERRORS.md A28). SCENARIO says Med-Rest instead; one switch, RULES.hpZeroEndsRun.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, command, endsRunAtZeroHp } from '../src/campaign/engine.js';
import { RULES } from '../src/campaign/data.js';
import { at } from '../src/campaign/util.js';

const ready = (opts) => {
  const s = createCampaign({ seed: 1, ...opts });
  command(s, { type: 'wakeDrone', drone: 'drone-01' });
  for (const d of s.drones) d.status = 'awake';
  for (const id of ['battery', 'workshop', 'greenhouse', 'garage', 'lab']) s.modules[id].status = 'online';
  s.res.sp = 300;
  return s;
};

test('the rule is on by default: the player asked for a Game Over when HP runs out', () => {
  assert.equal(RULES.hpZeroEndsRun, true);
  assert.equal(endsRunAtZeroHp(createCampaign()), true);
  assert.equal(endsRunAtZeroHp(createCampaign({ hpZeroEndsRun: false })), false);
  assert.equal(endsRunAtZeroHp({}), true, 'a save from before the rule uses the default');
});

test('HP 0 in the base ends the mission: status over, one gameover event, nothing moves, commands are refused', () => {
  const s = ready();
  s.res.morale = 10;
  s.hp = 0.0001;
  const events = step(s, 3);
  assert.equal(s.status, 'over');
  assert.deepEqual(s.over, { reason: 'hp', sol: 1, minute: s.minute });
  assert.equal(events.filter((e) => e.type === 'gameover').length, 1);
  assert.equal(s.medRest, null, 'no Med-Rest');
  assert.ok(!events.some((e) => e.lineId === 'astra.hp.zero_base'), 'ASTRA does not say "into Med-Rest"');
  const minute = s.minute;
  assert.deepEqual(step(s, 600), [], 'time is stopped');
  assert.equal(s.minute, minute);
  for (const cmd of [{ type: 'build', module: 'roof' }, { type: 'order', place: 'lab' }, { type: 'launch', expedition: 'run' }, { type: 'wakeDrone', drone: 'drone-02' }]) {
    const res = command(s, cmd);
    assert.equal(res.ok, false);
    assert.match(res.error, /over/i);
  }
});

test('HP 0 on a Rover trip ends the mission too: no rescue drone, no loot screen, and the Commander is no longer "away"', () => {
  const s = ready();
  s.minute = at(10, 8);
  assert.ok(command(s, { type: 'launch', expedition: 'run' }).ok);
  s.away.hpTotal = 400; // a brutal trip
  s.hp = 30;
  const seen = [];
  for (let i = 0; i < 2000 && s.status === 'running'; i++) seen.push(...step(s, 5));
  assert.equal(s.status, 'over');
  assert.equal(s.over.reason, 'trip');
  assert.ok(!seen.some((e) => e.type === 'returned'), 'no loot screen for a Commander who did not come home');
  assert.ok(!seen.some((e) => e.lineId === 'astra.hp.zero_expedition'), 'no "rescue drone" line');
  assert.equal(s.away, null);
  assert.notEqual(s.where, 'away');
  assert.equal(s.medRest, null);
  assert.equal(s.stats.medRests, 0, 'the rescue that started the Med-Rest does not count');
});

test('a solar flare met outside with too little HP ends the mission at the next minute', () => {
  const s = ready();
  s.minute = at(10, 9);
  s.hp = 20;
  command(s, { type: 'surface', on: true });
  s.pending = { kind: 'event', id: 'e1' };
  assert.ok(command(s, { type: 'choose', choice: 'b' }).ok); // "stay outside": -30 HP
  assert.equal(s.hp, 0);
  assert.equal(s.status, 'running', 'the card itself does not end it: the clock does, at the next minute');
  step(s, 2);
  assert.equal(s.status, 'over');
  assert.equal(s.pending, null);
});

test('SCENARIO rule (switch off): the same HP 0 means Med-Rest and the game goes on', () => {
  const s = ready({ hpZeroEndsRun: false });
  s.res.morale = 10;
  s.hp = 0.0001;
  step(s, 3);
  assert.equal(s.status, 'running');
  assert.ok(s.medRest);
});

test('a finished mission survives a JSON round trip and stays finished', () => {
  const s = ready();
  s.hp = 0.0001; s.res.morale = 10;
  step(s, 3);
  const copy = JSON.parse(JSON.stringify(s));
  assert.equal(copy.status, 'over');
  assert.equal(copy.over.reason, 'hp');
  assert.equal(copy.rules.hpZeroEndsRun, true);
  assert.equal(command(copy, { type: 'order', place: 'lab' }).ok, false);
});

test('a Commander who stays in the base and rests never reaches 0 HP over 12 idle Sols', () => {
  const s = ready();
  for (let i = 0; i < 12 * 24 && s.status === 'running'; i++) { step(s, 60); if (s.pending) command(s, { type: 'choose', choice: 'a' }); }
  assert.equal(s.status, 'running');
  assert.ok(s.hp > 50);
});
