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

test('D-T17f: timed event effects last elapsed Sols, not until a calendar dawn', async () => {
  const { applyChoice } = await import('../src/campaign/story.js');
  const { SOL, MODULES } = await import('../src/campaign/data.js');
  const pick = (id, choice, setup = () => {}) => {
    const s = createCampaign();
    command(s, { type: 'wakeDrone', drone: 'drone-01' });
    step(s, 3 * 60); // 10:00 on Sol 1
    setup(s);
    applyChoice(s, { kind: 'event', id }, choice, () => {}, () => 0.1);
    return s;
  };
  const e2c = pick('e2', 'c');
  assert.equal(e2c.timers.find((t) => t.id === 'solar_normal').at - e2c.minute, 3 * SOL, 'E2 C: +10% for 3 whole Sols');
  const e3c = pick('e3', 'c');
  assert.equal(e3c.flags.noLaunchUntil - e3c.minute, SOL, 'E3 C: closed for 1 Sol');
  const e2b = pick('e2', 'b');
  assert.equal(e2b.timers.find((t) => t.id === 'solar_normal').at, 1 * SOL, 'E2 B: only the rest of this Sol');
  const d4c = pick('d4', 'c', (s) => { s.modules.greenhouse.status = 'online'; s.modules.greenhouse.tier = 2; });
  const m = d4c.mods.find((x) => x.id === 'd4c_food');
  assert.ok(Math.abs(m.perSol + 0.2 * MODULES.greenhouse.t2.food) < 1e-9, 'D4 C: -20% of the Greenhouse food');
  assert.equal(m.untilMinute - d4c.minute, SOL);
});
