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
