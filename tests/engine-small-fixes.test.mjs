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
