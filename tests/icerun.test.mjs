// The player asked for ice and the map never offered it: the Ice Run brings Ice Cores, the Scrap Run brings Spare Parts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, command } from '../src/campaign/engine.js';
import { EXPEDITIONS, expectedLoot } from '../src/campaign/expeditions.js';
import { at } from '../src/campaign/util.js';

const ready = () => {
  const s = createCampaign({ seed: 3 });
  command(s, { type: 'wakeDrone', drone: 'drone-01' });
  s.modules.garage.status = 'online';
  s.minute = at(14, 6);
  return s;
};
const finishTrip = (s) => { const seen = []; for (let i = 0; i < 4000 && s.away; i++) { seen.push(...step(s, 5)); if (s.pending) command(s, { type: s.pending.kind === 'radio' ? 'radio' : 'choose', choice: 'a' }); } return seen; };

test('the Ice Run needs the Deep Ice Drill and says so; the Scrap Run does not need it', () => {
  const s = ready();
  assert.match(EXPEDITIONS.ice.requires(s), /Deep Ice Drill/);
  assert.equal(EXPEDITIONS.run.requires(s), null);
  assert.equal(command(s, { type: 'launch', expedition: 'ice' }).ok, false);
  s.upgrades.deep_ice_drill = true;
  assert.equal(EXPEDITIONS.ice.requires(s), null);
});

test('the Ice Run brings two Ice Cores and no Spare Parts; the Scrap Run brings 15 Spare Parts and no ice', () => {
  const s = ready();
  s.upgrades.deep_ice_drill = true;
  const sp = s.res.sp;
  assert.deepEqual(expectedLoot(s, EXPEDITIONS.ice), { sp: 0, items: { ice_core: 2 } });
  assert.ok(command(s, { type: 'launch', expedition: 'ice' }).ok);
  const seen = finishTrip(s);
  assert.equal(s.items.ice_core, 2, 'two Ice Cores came home');
  assert.ok(seen.some((e) => e.type === 'returned' && e.expedition === 'ice' && e.loot.items.ice_core === 2));
  assert.equal(s.res.sp, sp, 'no Spare Parts from the Ice Run');
  // and then the Scrap Run
  s.minute += 1440; s.hp = 100;
  assert.ok(command(s, { type: 'launch', expedition: 'run' }).ok);
  finishTrip(s);
  assert.equal(s.items.ice_core, 2, 'no ice from the Scrap Run');
  assert.ok(s.res.sp >= sp + 15 - 1);
});
