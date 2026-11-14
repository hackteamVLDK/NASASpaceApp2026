// A resource that runs low, or out, is never silent: the Threats strip, the gauges and the Resources screen agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, command, step, rates, contributions } from '../src/campaign/engine.js';
import { hazards, meterReport, LOW_LIMITS } from '../src/campaign/hazards.js';
import { missions } from '../src/campaign/missions.js';

const base = () => { const s = createCampaign({ seed: 1 }); command(s, { type: 'wakeDrone', drone: 'drone-01' }); return s; };
const ids = (s) => hazards(s).map((h) => h.id);

test('the limits are the ones of the scenario: Power 20, Water, Oxygen, Food 25, Morale 30, HP 40', () => {
  assert.deepEqual({ ...LOW_LIMITS }, { power: 20, water: 25, oxygen: 25, food: 25, morale: 30, hp: 40 });
});

test('a meter that runs low warns (amber) and names a place', () => {
  const s = base();
  assert.deepEqual(ids(s).filter((i) => i.startsWith('low-') || i.startsWith('empty-')), []);
  s.res.water = 24;
  const h = hazards(s).find((x) => x.id === 'low-water');
  assert.ok(h, 'Low water appears under 25');
  assert.equal(h.severity, 'warn');
  assert.equal(h.place, 'lifesupport');
  s.res.water = 26;
  assert.ok(!ids(s).includes('low-water'), 'and not above the limit');
});

test('a meter that is EMPTY raises an alarm: 0 Water was silent before (the test was "> 0")', () => {
  const s = base();
  s.res.water = 0;
  const h = hazards(s).find((x) => x.id === 'empty-water');
  assert.ok(h, 'No water is shown');
  assert.equal(h.severity, 'alarm');
  assert.match(h.detail, /Greenhouse/);
  assert.ok(!ids(s).includes('low-water'), 'one chip per meter, not two');
  s.res.food = 0;
  assert.equal(hazards(s).find((x) => x.id === 'empty-food').severity, 'alarm');
  s.res.morale = 0;
  assert.equal(hazards(s).find((x) => x.id === 'empty-morale').severity, 'alarm');
});

test('Power, Heat and Oxygen keep their emergency chip; no second "empty" chip appears for them', () => {
  const s = base();
  s.modules.lifesupport.status = 'unbuilt'; // nothing makes air, so the tank stays at 0
  s.res.oxygen = 0;
  step(s, 2); // the engine notices and raises the emergency
  assert.ok(ids(s).includes('emergency-oxygen'));
  assert.ok(!ids(s).includes('empty-oxygen'));
});

test('water that runs out of its own accord (nobody did anything) ends with a warning, then an alarm', () => {
  const s = base();
  s.modules.battery.status = 'online'; s.modules.greenhouse.status = 'online'; s.modules.workshop.status = 'online';
  s.res.water = 30;
  s.res.power = 100;
  let sawLow = false;
  let sawEmpty = false;
  for (let i = 0; i < 12 * 1440 && !sawEmpty; i++) { step(s, 1); if (s.pending) command(s, { type: 'choose', choice: 'a' }); const list = ids(s); sawLow ||= list.includes('low-water'); sawEmpty ||= list.includes('empty-water'); }
  assert.ok(sawLow, 'Low water came first');
  assert.ok(sawEmpty, 'and No water when the tank ran dry');
});

test('the Resources screen uses the real Power capacity (250 with a battery), not 100', () => {
  const s = base();
  s.modules.battery.status = 'online';
  s.res.power = 88;
  const lines = contributions(s);
  const rep = meterReport(s, 'power', lines, 10);
  assert.match(rep.outlook, /16\.2 Sols/, `time to full from 88 of 250 at +10 a Sol: ${rep.outlook}`);
  s.modules.battery.tier = 2;
  assert.match(meterReport(s, 'power', contributions(s), 10).outlook, /31\.2 Sols/, '400 with the upgrade');
});

test('optional goals belong to an Act, so the Missions window can list only the current Act', () => {
  const m = missions(base());
  assert.ok(m.side.every((x) => [1, 2, 3].includes(x.act)));
  assert.ok(m.side.some((x) => x.act === 1) && m.side.some((x) => x.act === 2) && m.side.some((x) => x.act === 3));
  assert.equal(m.currentAct, 1);
  assert.ok(m.main.filter((x) => x.act === 1).length >= 5);
  void rates;
});
