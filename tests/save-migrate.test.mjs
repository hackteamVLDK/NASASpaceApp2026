// B4: saves are checked and upgraded before Continue loads them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, command, step } from '../src/campaign/engine.js';
import { restoreSave } from '../src/campaign/save-migrate.js';

test('a current save loads unchanged', () => {
  const s = createCampaign();
  command(s, { type: 'wakeDrone', drone: 'drone-01' });
  step(s, 600);
  const r = restoreSave(JSON.parse(JSON.stringify(s)));
  assert.equal(r.ok, true);
  assert.equal(r.state.minute, s.minute);
  assert.equal(r.state.drones[0].status, 'awake');
});

test('an older save gets the missing fields and keeps what the player had', () => {
  const s = JSON.parse(JSON.stringify(createCampaign()));
  s.res.sp = 77;
  delete s.kits; delete s.order; delete s.version;
  for (const d of s.drones) delete d.queue;
  const r = restoreSave(s);
  assert.equal(r.ok, true);
  assert.equal(r.upgraded, true);
  assert.equal(r.state.res.sp, 77);
  assert.deepEqual(r.state.kits, {});
  assert.ok(r.state.drones.every((d) => Array.isArray(d.queue)));
});

test('broken, finished or newer saves are refused with a reason', () => {
  assert.equal(restoreSave(null).ok, false);
  assert.equal(restoreSave({ minute: 'x', res: {}, modules: {} }).ok, false);
  assert.equal(restoreSave({ ...createCampaign(), status: 'over' }).ok, false);
  assert.match(restoreSave({ ...createCampaign(), version: 99 }).reason, /newer/);
});

test('B11: after Dilemma 3 A or C the soil can be washed later from the Lab', async () => {
  const { createCampaign: cc, command: cmd, step: st } = await import('../src/campaign/engine.js');
  const s = cc();
  s.flags.washUnlocked = true;
  assert.equal(cmd(s, { type: 'washSoil' }).ok, false, 'needs the Lab');
  s.modules.lab.status = 'online';
  s.res.water = 50;
  assert.equal(cmd(s, { type: 'washSoil' }).ok, true);
  assert.equal(s.res.water, 30);
  assert.equal(cmd(s, { type: 'washSoil' }).ok, false, 'only once');
  assert.ok(!s.choices.includes('d3b'), 'the badge choice counts only when the washing is done');
  st(s, 3 * 1440);
  assert.equal(s.flags.soilBeds, true);
  assert.ok(s.choices.includes('d3b'));
});
