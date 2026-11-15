import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, command, step, STATE_VERSION } from '../src/campaign/engine.js';
import { LIVES, SOL } from '../src/campaign/data.js';
import { takeCheckpoint, loseLife, STRINGS } from '../src/campaign/lives.js';
import { restoreSave } from '../src/campaign/save-migrate.js';
import { at } from '../src/campaign/util.js';

const clone = (s) => JSON.parse(JSON.stringify(s));
const dustDecision = (seed = 1) => {
  const s = createCampaign({ seed });
  s.minute = at(3, 20) - 1;
  s.hp = 40;
  step(s);
  assert.deepEqual(s.pending, { kind: 'dilemma', id: 'd1' });
  return s;
};
const exhaust = (s, minutes = 1) => {
  s.hp = 0;
  return step(s, minutes);
};

test('lives start at three with one non-nested Mission start checkpoint', () => {
  const s = createCampaign();
  assert.equal(s.lives, LIVES.start);
  assert.equal(s.livesMax, 3);
  assert.equal(s.stats.livesLost, 0);
  assert.equal(s.checkpoint.label, 'Mission start');
  const snap = JSON.parse(s.checkpoint.snap);
  assert.equal(Object.hasOwn(snap, 'checkpoint'), false);
  assert.deepEqual(snap.res, s.res);
  assert.equal(snap.minute, s.minute);
});

test('a dilemma takes a checkpoint with its open card; waiting never replaces it', () => {
  const s = dustDecision();
  const cp = s.checkpoint;
  assert.equal(cp.label, 'The Dust Storm decision');
  assert.equal(cp.kind, 'dilemma');
  assert.equal(cp.id, 'd1');
  assert.equal(cp.minute, at(3, 20));
  assert.deepEqual(JSON.parse(cp.snap).pending, s.pending);
  step(s, SOL);
  assert.equal(s.checkpoint, cp);
});

test('HP 0 restores every checkpoint field in place, including time, supplies, RNG and the open card', () => {
  const s = dustDecision();
  const reference = s;
  const cp = s.checkpoint;
  assert.ok(command(s, { type: 'choose', choice: 'b' }).ok);
  step(s, 10);
  s.extraAfterDecision = true;
  const events = exhaust(s, SOL);
  const expected = JSON.parse(cp.snap);
  Object.assign(expected, { lives: 2, livesMax: 3, checkpoint: cp, hp: LIVES.restoreHpMin });
  expected.stats.livesLost = 1;
  assert.equal(s, reference);
  assert.deepEqual(s, expected);
  assert.deepEqual(events.slice(-3), [
    { type: 'life-lost', livesLeft: 2, reason: 'hp', checkpoint: { sol: 3, label: cp.label } },
    { type: 'rewind', sol: 3, label: cp.label },
    { type: 'astra', lineId: 'astra.lives.rewind', mood: 'calm' },
  ]);
});

test('a Mission start rewind stops the requested time batch even without an open card', () => {
  const s = createCampaign();
  const minute = s.minute;
  const events = exhaust(s, SOL);
  assert.equal(s.minute, minute);
  assert.equal(s.lives, 2);
  assert.equal(events.filter((e) => e.type === 'rewind').length, 1);
});

test('third HP loss ends the run and emits Game Over exactly once', () => {
  const s = dustDecision();
  for (let lost = 1; lost <= 3; lost++) {
    assert.ok(command(s, { type: 'choose', choice: 'a' }).ok);
    const events = exhaust(s, 600);
    assert.equal(s.lives, 3 - lost);
    assert.equal(s.stats.livesLost, lost);
    assert.equal(events.filter((e) => e.type === 'gameover').length, lost === 3 ? 1 : 0);
    assert.equal(events.filter((e) => e.type === 'rewind').length, lost === 3 ? 0 : 1);
  }
  assert.equal(s.status, 'over');
  assert.equal(s.over.reason, 'hp');
  assert.equal(s.pending, null);
  assert.deepEqual(step(s, SOL), []);
  assert.equal(command(s, { type: 'surface', on: true }).ok, false);
});

test('SCENARIO mode keeps Med-Rest, with no checkpoint, life loss or empty-meter HP penalty', () => {
  const s = createCampaign({ hpZeroEndsRun: false });
  assert.equal(s.checkpoint, null);
  s.hp = 0;
  s.res.morale = 0;
  const events = step(s);
  assert.ok(s.medRest);
  assert.equal(s.lives, 3);
  assert.equal(s.stats.livesLost, 0);
  assert.ok(events.some((e) => e.lineId === 'astra.hp.zero_base'));
  const full = createCampaign({ hpZeroEndsRun: false });
  full.hp = 80;
  full.res.morale = 0;
  const empty = clone(full);
  for (const meter of Object.keys(LIVES.emptyMeterHpPerSol)) empty.res[meter] = 0;
  empty.flags.filterClog = 0.01;
  assert.deepEqual(step(empty).filter((e) => e.lineId?.startsWith('astra.lives.')), []);
  step(full);
  assert.equal(empty.hp, full.hp);
});

for (const [meter, loss] of Object.entries(LIVES.emptyMeterHpPerSol)) {
  test(`empty ${meter} drains ${loss} HP per Sol and warns once per empty stretch`, () => {
    const s = createCampaign();
    s.hp = 80;
    s.res.morale = 0;
    s.res[meter] = 0;
    if (meter === 'oxygen') s.flags.filterClog = 0.01; // net Oxygen stays negative
    const control = clone(s);
    control.rules.hpZeroEndsRun = false;
    const events = step(s, 10);
    step(control, 10);
    assert.ok(Math.abs(control.hp - s.hp - loss * 10 / SOL) < 1e-10);
    const lineId = `astra.lives.danger_${meter}`;
    assert.equal(events.filter((e) => e.lineId === lineId).length, 1);
    s.res[meter] = 20;
    step(s);
    s.res[meter] = 0;
    assert.equal(step(s).filter((e) => e.lineId === lineId).length, 1);
  });
}

test('several empty meters add their HP drain and existing emergencies still open', () => {
  const s = createCampaign();
  s.hp = 80;
  s.flags.filterClog = 0.01;
  for (const meter of Object.keys(LIVES.emptyMeterHpPerSol)) s.res[meter] = 0;
  const control = clone(s);
  control.rules.hpZeroEndsRun = false;
  const events = step(s);
  step(control);
  const total = Object.values(LIVES.emptyMeterHpPerSol).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(control.hp - s.hp - total / SOL) < 1e-10);
  assert.ok(events.some((e) => e.type === 'emergency' && e.kind === 'oxygen'));
  assert.ok(events.some((e) => e.type === 'emergency' && e.kind === 'heat'));
});

const launch = (s) => {
  s.minute = at(10, 8);
  s.modules.garage.status = 'online';
  s.flags._d1 = true;
  assert.ok(command(s, { type: 'launch', expedition: 'run' }).ok);
};

test('empty base meters do not drain the Commander on a trip', () => {
  const s = createCampaign();
  launch(s);
  s.hp = 80;
  s.res.morale = 0;
  s.flags.filterClog = 0.01;
  const control = clone(s);
  for (const meter of Object.keys(LIVES.emptyMeterHpPerSol)) s.res[meter] = 0;
  const events = step(s, 10);
  step(control, 10);
  assert.equal(s.hp, control.hp);
  assert.ok(!events.some((e) => e.lineId?.startsWith('astra.lives.danger_')));
});

test('trip HP 0 loses a life and restores the checkpoint without rescue loot or Med-Rest', () => {
  const s = createCampaign();
  launch(s);
  s.hp = 0.001;
  s.away.hpTotal = 400;
  const events = step(s, 5);
  assert.equal(s.lives, 2);
  assert.equal(s.stats.livesLost, 1);
  assert.equal(s.status, 'running');
  assert.equal(s.away, null);
  assert.equal(s.medRest, null);
  assert.equal(s.stats.medRests, 0);
  assert.equal(s.stats.expeditions, 0);
  assert.equal(events.find((e) => e.type === 'life-lost').reason, 'trip');
  assert.ok(!events.some((e) => e.type === 'returned' || e.lineId === 'astra.hp.zero_expedition'));
});

test('SCENARIO mode still rescues a worn out Commander on a trip', () => {
  const s = createCampaign({ hpZeroEndsRun: false });
  launch(s);
  s.hp = 0.001;
  s.away.hpTotal = 400;
  const events = step(s);
  assert.equal(s.lives, 3);
  assert.equal(s.stats.livesLost, 0);
  assert.equal(s.away, null);
  assert.ok(s.medRest);
  assert.ok(events.some((e) => e.lineId === 'astra.hp.zero_expedition'));
  assert.ok(events.some((e) => e.type === 'returned'));
});

test('a Rover radio decision is checkpointed with the trip and readable label', () => {
  const s = createCampaign();
  s.minute = at(10, 8);
  s.modules.garage.status = 'online';
  s.flags._d1 = true;
  s.upgrades.titanium_wheels = true;
  assert.ok(command(s, { type: 'launch', expedition: 2 }).ok);
  for (let i = 0; i < 2000 && !s.pending; i++) step(s);
  assert.deepEqual(s.pending, { kind: 'radio', id: 'exp2.60' });
  assert.equal(s.checkpoint.label, 'A radio call from the Rover');
  const cp = s.checkpoint;
  assert.ok(command(s, { type: 'radio', choice: 'b' }).ok);
  exhaust(s);
  assert.deepEqual(s.pending, { kind: 'radio', id: 'exp2.60' });
  assert.deepEqual(s.away, JSON.parse(cp.snap).away);
});

test('a repeated event with the same ID takes a fresh checkpoint when it appears again', () => {
  const s = createCampaign();
  s.minute = at(2, 10);
  s.pending = { kind: 'event', id: 'e2' };
  step(s);
  const old = s.checkpoint;
  assert.ok(command(s, { type: 'choose', choice: 'a' }).ok);
  s.timers.push({ at: s.minute + 1, id: 'event:e2' });
  step(s);
  assert.equal(s.checkpoint.id, 'e2');
  assert.notEqual(s.checkpoint, old);
  assert.equal(s.checkpoint.minute, old.minute + 1);
  assert.equal(Object.hasOwn(JSON.parse(s.checkpoint.snap), 'checkpoint'), false);
});

test('old saves migrate to three lives and checkpoint the current state on the first step', () => {
  const saved = clone(createCampaign());
  saved.version = 1;
  saved.minute = at(3, 20);
  saved.res.sp = 123;
  saved.pending = { kind: 'dilemma', id: 'd1' };
  for (const key of ['lives', 'livesMax', 'checkpoint']) delete saved[key];
  delete saved.stats.livesLost;
  const r = restoreSave(saved);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.upgraded, true);
  assert.equal(r.state.version, STATE_VERSION);
  assert.equal(r.state.lives, 3);
  assert.equal(r.state.livesMax, 3);
  assert.equal(r.state.stats.livesLost, 0);
  assert.equal(r.state.checkpoint, null);
  step(r.state);
  assert.equal(r.state.checkpoint.minute, saved.minute);
  assert.equal(JSON.parse(r.state.checkpoint.snap).res.sp, 123);
  assert.equal(r.state.checkpoint.id, 'd1');
});

test('a checkpoint survives save/load and restores safely after a life loss', () => {
  const s = dustDecision();
  command(s, { type: 'choose', choice: 'a' });
  const loaded = restoreSave(clone(s));
  assert.equal(loaded.ok, true, loaded.reason);
  assert.deepEqual(loaded.state.checkpoint, s.checkpoint);
  exhaust(loaded.state);
  assert.equal(loaded.state.lives, 2);
  assert.equal(loaded.state.pending.id, 'd1');
});

test('broken or nested checkpoint snapshots are refused before they can replace live state', () => {
  for (const snap of ['{', '{}', JSON.stringify({ ...createCampaign() }), 'null']) {
    const s = createCampaign();
    s.checkpoint.snap = snap;
    assert.equal(restoreSave(s).ok, false);
  }
  const s = createCampaign();
  const snap = JSON.parse(s.checkpoint.snap);
  snap.modules.battery.status = 'broken';
  s.checkpoint.snap = JSON.stringify(snap);
  assert.equal(restoreSave(s).ok, false);
});

test('same seed and commands produce identical states and events after a rewind', () => {
  const play = () => {
    const s = dustDecision(42);
    const events = [];
    command(s, { type: 'choose', choice: 'b' });
    events.push(...step(s, 30), ...exhaust(s));
    command(s, { type: 'choose', choice: 'a' });
    events.push(...step(s, 100));
    return { s, events };
  };
  assert.deepEqual(play(), play());
});

test('lives helpers export calm English for every new ASTRA event', () => {
  assert.equal(Object.keys(STRINGS).length, 5);
  for (const text of Object.values(STRINGS)) assert.doesNotMatch(text, /\b(death|die|dying|kill|doom)\b|you failed/i);
  const s = createCampaign();
  takeCheckpoint(s, 'Mission start');
  const events = [];
  assert.equal(loseLife(s, (e) => events.push(e), 'hp'), true);
  assert.ok(STRINGS[events.find((e) => e.type === 'astra').lineId]);
});
