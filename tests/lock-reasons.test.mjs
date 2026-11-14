// A29: every module lock says what to do and why it comes first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, unlockReason } from '../src/campaign/engine.js';

test('each lock reason says what to do and why (has a ":" and stays short)', () => {
  const s = createCampaign();
  for (const id of ['workshop', 'greenhouse', 'garage', 'lab', 'recreation', 'roof']) {
    const r = unlockReason(s, id);
    assert.ok(r, `${id} should be locked at the start`);
    assert.match(r, /: /, `${id}: no "why" part in "${r}"`);
    assert.ok(r.split(' ').length <= 20, `${id}: too long for ages 7-12 (${r.split(' ').length} words)`);
  }
  assert.equal(unlockReason(s, 'battery'), null);
});

test('the greenhouse explains that the Workshop makes its parts', () => {
  assert.match(unlockReason(createCampaign(), 'greenhouse'), /Workshop first: it makes the pumps, pipes and LED panels/);
});

test('C9: worn-out Rover shielding is re-crafted for 15 SP only (SCENARIO Dilemma 5 C)', async () => {
  const { recipeCost } = await import('../src/campaign/engine.js');
  const s = createCampaign();
  assert.deepEqual(recipeCost(s, 'rover_shielding').items, { titanium_plate: 1 });
  s.flags.shieldCrafted = true;
  const again = recipeCost(s, 'rover_shielding');
  assert.equal(again.sp, 15);
  assert.deepEqual(again.items, {});
});
