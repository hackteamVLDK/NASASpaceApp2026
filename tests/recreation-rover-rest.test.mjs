// C13: Recreation & Storage emergency stores (SCENARIO 3.3). C14: sleeping in the Rover, +6 HP a night (3.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, command, step } from '../src/campaign/engine.js';
import { SOL, STORAGE_REFILL, HP } from '../src/campaign/data.js';

test('no emergency stores without the Recreation room', () => {
  const s = createCampaign();
  s.res.water = 5;
  const ev = step(s, 1);
  assert.ok(s.res.water < 10);
  assert.ok(!ev.some((e) => e.type === 'storageRefill'));
});

test('Recreation T1 refills the lowest of Water, Food, Oxygen once, then waits 5 Sols', () => {
  const s = createCampaign();
  s.modules.recreation.status = 'online';
  s.res.water = 5; s.res.food = 8;
  const ev = step(s, 1);
  const r = ev.find((e) => e.type === 'storageRefill');
  assert.equal(r?.res, 'water', 'the lowest one gets the spares');
  assert.ok(s.res.water > 30);
  assert.ok(ev.some((e) => e.type === 'astra' && e.lineId === 'astra.res.storage_save'));
  assert.equal(s.flags.storageReadyAt - s.minute, 5 * SOL);
  s.res.food = 3;
  assert.ok(!step(s, 1).some((e) => e.type === 'storageRefill'), 'closed during the cooldown');
  s.minute = s.flags.storageReadyAt - 1;
  s.res.food = 3;
  assert.ok(step(s, 1).some((e) => e.type === 'storageRefill' && e.res === 'food'), 'open again after 5 Sols');
});

test('Recreation T2 (Habitat Lounge) waits only 3 Sols', () => {
  const s = createCampaign();
  s.modules.recreation.status = 'online';
  s.modules.recreation.tier = 2;
  s.res.oxygen = 4;
  step(s, 1);
  assert.equal(s.flags.storageReadyAt - s.minute, STORAGE_REFILL.cooldownSols[2] * SOL);
});

test('camping in the Rover gives +6 HP over the 8 night hours', () => {
  const s = createCampaign(); // Sol 1, 07:00
  s.modules.garage.status = 'online';
  s.hp = 60;
  assert.equal(command(s, { type: 'launch', expedition: 1 }).ok, true);
  step(s, 4 * 60); // 11:00
  let h = s.hp; step(s, 60); const day = s.hp - h; // 11:00-12:00
  step(s, 11 * 60); // 23:00
  h = s.hp; step(s, 60); const night = s.hp - h; // 23:00-00:00
  assert.ok(Math.abs(night - day - HP.roverSleepPerHour) < 1e-6, `night ${night} vs day ${day}`);
  assert.equal(HP.roverSleepPerHour * 8, 6);
});
