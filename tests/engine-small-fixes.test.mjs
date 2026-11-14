// D-T17c (only Drone #01 wakes without a kit) and D-T17d (the Suit Liner also works on foot outside).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, command, step } from '../src/campaign/engine.js';

test('D-T17c: wakeDrone is only for Drone #01; the others need their kit', () => {
  const s = createCampaign();
  assert.equal(command(s, { type: 'wakeDrone', drone: 'drone-02' }).ok, false);
  assert.equal(command(s, { type: 'wakeDrone', drone: 'drone-03' }).ok, false);
  assert.equal(command(s, { type: 'wakeDrone', drone: 'drone-01' }).ok, true);
  assert.equal(s.drones[1].status, 'dormant');
});

test('D-T17d: outside, the Suit Liner cuts the HP loss to 0.75', () => {
  const loss = (liner) => {
    const s = createCampaign();
    s.hp = 80; s.res.morale = 50; // no high-morale bonus
    if (liner) s.upgrades.suit_liner = true;
    assert.equal(command(s, { type: 'order', place: 'outside' }).ok, true);
    assert.equal(s.where, 'outside');
    const before = s.hp; step(s, 60);
    return before - s.hp;
  };
  const a = loss(false), b = loss(true);
  assert.ok(a > 0);
  assert.ok(Math.abs(b / a - 0.75) < 1e-6, `${b} / ${a}`);
});

test('D-T17b: a dry Greenhouse gives no food, no fresh-crop HP, no Soil Beds bonus and no harvest', async () => {
  const { greenhouseWorking, rates } = await import('../src/campaign/engine.js');
  const s = createCampaign();
  s.modules.greenhouse.status = 'online';
  s.flags.soilBeds = true; s.mods.push({ id: 'd3b_beds', res: 'food', perSol: 3 });
  s.res.food = 80; s.res.morale = 0; s.hp = 50;
  assert.equal(greenhouseWorking(s), true);
  const wet = rates(s).food;
  s.res.water = 0;
  assert.equal(greenhouseWorking(s), false);
  assert.ok(rates(s).food < wet - 3 - 1e-9, 'food from the Greenhouse and the Soil Beds both stop');
  command(s, { type: 'order', place: 'kitchen' });
  const hp = s.hp, harvest = s.stats.harvest ?? 0;
  step(s, 60);
  assert.ok(s.hp <= hp, `no fresh-crop healing (${hp} -> ${s.hp})`);
  assert.equal(s.stats.harvest ?? 0, harvest, 'nothing harvested');
});

test('D-T17e: Dilemma 3 B, 4 C and Event 3 C take a drone for 1, 0.5 and 1 Sol', async () => {
  const { applyChoice } = await import('../src/campaign/story.js');
  const { SOL } = await import('../src/campaign/data.js');
  for (const [id, choice, sols] of [['d3', 'b', 1], ['d4', 'c', 0.5], ['e3', 'c', 1]]) {
    const s = createCampaign();
    command(s, { type: 'wakeDrone', drone: 'drone-01' });
    s.res.water = 90;
    const ev = [];
    applyChoice(s, { kind: 'dilemma', id }, choice, (e) => ev.push(e), () => 0.5);
    const d = s.drones[0];
    assert.equal(d.task?.type, 'chore', `${id}${choice}: the drone is busy`);
    assert.equal(command(s, { type: 'build', module: 'battery', drone: 'drone-01' }).ok, true, 'a build order waits in the queue');
    assert.equal(d.queue.length, 1);
    step(s, Math.round(sols * SOL) - 5);
    assert.equal(d.task?.type, 'chore', `${id}${choice}: still busy just before ${sols} Sol`);
    step(s, 10);
    assert.equal(d.task?.type, 'build', `${id}${choice}: free after ${sols} Sol, the waiting build starts`);
  }
});

test('D-T17e: with every drone busy, the chore waits first in a queue', async () => {
  const { droneChore } = await import('../src/campaign/story.js');
  const s = createCampaign();
  command(s, { type: 'wakeDrone', drone: 'drone-01' });
  command(s, { type: 'build', module: 'battery' });
  droneChore(s, () => {}, 'leak', 'garage', 1);
  assert.equal(s.drones[0].task.type, 'build');
  assert.equal(s.drones[0].queue[0].type, 'chore');
});
