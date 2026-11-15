// C11 / SCENARIO 4.9 step 1: a dust storm bends the dish (when a dish exists), and the next Earth call straightens it.
// The swipe itself is the mini-game (src/ui/minigames2.js); the engine only keeps the `dishBent` flag that tells it to start with that step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, command } from '../src/campaign/engine.js';

function labWithStorm() {
  const s = createCampaign({ seed: 3 });
  s.modules.lab.status = 'online';
  s.flags.panelsCleaned = true;
  s.storm = { until: s.minute + 10 }; // a storm that is about to end
  return s;
}

test('a storm that ends while the Lab (and its dish) is online leaves the dish bent', () => {
  const s = labWithStorm();
  step(s, 20);
  assert.equal(s.storm, null, 'the storm ended');
  assert.equal(s.flags.dishBent, true);
});

test('a storm before there is a dish bends nothing (the scripted storm of Sols 4-6 comes before the Lab)', () => {
  const s = createCampaign({ seed: 3 });
  assert.notEqual(s.modules.lab.status, 'online');
  s.storm = { until: s.minute + 10 };
  step(s, 20);
  assert.equal(s.storm, null);
  assert.ok(!s.flags.dishBent, 'no dish, nothing to bend');
});

test('a won Earth call straightens the dish; a lost one leaves it bent', () => {
  const s = labWithStorm();
  step(s, 20);
  s.tasks.push({ game: 'antenna', why: 'Earth is listening. Point the dish.' });
  const lost = command(s, { type: 'miniResult', game: 'antenna', win: false });
  assert.equal(lost.ok, true);
  assert.equal(s.flags.dishBent, true, 'still bent after a failed try');
  const won = command(s, { type: 'miniResult', game: 'antenna', win: true });
  assert.equal(won.ok, true);
  assert.equal(s.flags.dishBent, false, 'the call went out: the dish is straight');
  assert.ok(!s.tasks.some((t) => t.game === 'antenna'), 'the task is done');
});

test('the flag survives a save (it is plain data) and a second storm bends the straight dish again', () => {
  const s = labWithStorm();
  step(s, 20);
  const copy = JSON.parse(JSON.stringify(s));
  assert.equal(copy.flags.dishBent, true);
  s.tasks.push({ game: 'antenna', why: 'x' });
  command(s, { type: 'miniResult', game: 'antenna', win: true });
  assert.equal(s.flags.dishBent, false);
  s.storm = { until: s.minute + 10 };
  step(s, 20);
  assert.equal(s.flags.dishBent, true, 'the next storm bends it again');
});
