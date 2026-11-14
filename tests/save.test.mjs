import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, step, applyCommand, serialize, deserialize, SaveError,
  newProfile, recordResult, serializeProfile, deserializeProfile, FIRST_LEVEL_ID, STATE_VERSION,
} from '../src/sim/index.js';

test('a saved game continues exactly as if it had never been saved', () => {
  const original = createGame('L2-storm-season', { seed: 42 });
  applyCommand(original, { type: 'startProject', project: 'berm' });
  applyCommand(original, { type: 'assign', crew: 'eng', job: 'build' });
  step(original, 2345);

  const { state: loaded, savedAt } = deserialize(serialize(original, { savedAt: '2026-11-14T12:00:00Z' }));
  assert.equal(savedAt, '2026-11-14T12:00:00Z');
  assert.notEqual(loaded, original);
  assert.deepEqual(loaded, JSON.parse(JSON.stringify(original)));

  applyCommand(original, { type: 'shelter', on: true });
  applyCommand(loaded, { type: 'shelter', on: true });
  step(original, 4000);
  step(loaded, 4000);
  assert.equal(serialize(loaded), serialize(original));
});

test('a finished level can be saved and loaded', () => {
  const g = createGame('L1-first-sols');
  while (g.status === 'running') step(g, 1000);
  const { state } = deserialize(serialize(g));
  assert.equal(state.status, 'complete');
  assert.equal(state.result.stars, g.result.stars);
});

test('unusable saves are rejected with a message for the player', () => {
  const good = serialize(createGame('L1-first-sols'));
  const tamper = (edit) => {
    const data = JSON.parse(good);
    edit(data);
    return JSON.stringify(data);
  };
  const cases = [
    ['not json {', /damaged/],
    ['"just a string"', /not a Mars colony save/],
    [JSON.stringify({ format: 'something-else', version: 1, state: {} }), /not a Mars colony save/],
    [tamper((d) => (d.version = STATE_VERSION + 1)), /different version/],
    [tamper((d) => (d.state.levelId = 'L99-nowhere')), /unknown level/],
    [tamper((d) => (d.state.resources.o2Kg = -5)), /resources\.o2Kg/],
    [tamper((d) => (d.state.resources.waterL = null)), /resources\.waterL/],
    [tamper((d) => (d.state.systems.solarClean = 7)), /systems\.solarClean/],
    [tamper((d) => (d.state.crew = [])), /crew/],
    [tamper((d) => (d.state.crew[0].location = 'the moon')), /crew location/],
    [tamper((d) => (d.state.crew[0].job = 'pirate')), /crew job/],
    [tamper((d) => delete d.state.storms), /storms/],
    [tamper((d) => (d.state.minute = 1.5)), /minute/],
  ];
  for (const [text, pattern] of cases) {
    assert.throws(() => deserialize(text), (e) => e instanceof SaveError && pattern.test(e.message), `case: ${text.slice(0, 60)}`);
  }
});

test('the campaign profile tracks best results and unlocks the next level', () => {
  const profile = newProfile();
  assert.deepEqual(profile.unlocked, [FIRST_LEVEL_ID]);

  const idle = createGame('L1-first-sols');
  while (idle.status === 'running') step(idle, 1000);
  const first = recordResult(profile, idle);
  assert.equal(first.unlocked, 'L2-storm-season');
  assert.ok(profile.unlocked.includes('L2-storm-season'));
  assert.equal(profile.levels['L1-first-sols'].stars, 1);
  assert.equal(profile.levels['L1-first-sols'].attempts, 1);

  const again = recordResult(profile, idle);
  assert.equal(again.unlocked, null, 'unlocking happens once');
  assert.equal(again.newBestScore, false);
  assert.equal(profile.levels['L1-first-sols'].attempts, 2);

  const failed = createGame('L2-storm-season');
  failed.resources.o2Kg = 0;
  failed.resources.waterL = 0;
  while (failed.status === 'running') step(failed, 100);
  recordResult(profile, failed);
  assert.equal(profile.levels['L2-storm-season'].completed, false);
  assert.ok(!profile.unlocked.includes('L3-dust-and-darkness'), 'a failed level unlocks nothing');
  assert.throws(() => recordResult(profile, createGame('L1-first-sols')), /finished level/);

  assert.deepEqual(deserializeProfile(serializeProfile(profile)), profile);
});

test('a damaged profile falls back to a fresh one instead of crashing', () => {
  for (const text of ['', 'garbage', '{"format":"other"}', 'null', '[]']) assert.deepEqual(deserializeProfile(text), newProfile());
  const cleaned = deserializeProfile(JSON.stringify({ format: 'mars-colony-profile', version: 1, unlocked: ['L99-nowhere'], levels: { 'L1-first-sols': { stars: 99, bestScore: 'lots' }, bogus: {} } }));
  assert.deepEqual(cleaned.unlocked, [FIRST_LEVEL_ID]);
  assert.deepEqual(cleaned.levels, { 'L1-first-sols': { completed: false, stars: 3, bestScore: 0, attempts: 0 } });
});
