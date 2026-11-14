// Missions, hazards and the resource breakdown (docs/GAMEPLAY_PLAN.md steps 1-3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setStrings } from '../src/flow/strings.js';
import { createCampaign, command, step, rates, contributions } from '../src/campaign/engine.js';
import { missions, tracker } from '../src/campaign/missions.js';
import { hazards, meterReport, shieldingByPlace, METER_HELP } from '../src/campaign/hazards.js';
import { autoplay } from '../tools/balance/campaign-bot.mjs';

setStrings(JSON.parse(readFileSync(new URL('../content/data/strings.en.json', import.meta.url), 'utf8')));

test('the mission list starts at "Wake Drone #01" and shows the current three', () => {
  const s = createCampaign();
  const m = missions(s);
  assert.equal(m.main.length, 19);
  assert.equal(m.main[0].state, 'current');
  assert.equal(m.main[0].title, 'Wake Drone #01');
  assert.equal(m.currentAct, 1);
  assert.deepEqual(tracker(s).map((x) => x.id), ['wake-pip', 'battery', 'storm-ready']);
  command(s, { type: 'wakeDrone', drone: 'drone-01' });
  assert.equal(missions(s).main[0].done, true);
  assert.equal(tracker(s)[0].id, 'battery');
});

test('building progress shows as a mission progress bar', () => {
  const s = createCampaign();
  command(s, { type: 'wakeDrone', drone: 'drone-01' });
  command(s, { type: 'build', module: 'battery' });
  step(s, 1440);
  const cur = missions(s).main.find((x) => x.id === 'battery');
  assert.equal(cur.state, 'current');
  assert.ok(cur.progress[0] > 40 && cur.progress[0] < 60, `progress ${cur.progress}`);
});

test('every main mission and side mission is done after the autopilot finishes the story', () => {
  const { s } = autoplay(1, { maxSols: 35 });
  const m = missions(s);
  assert.equal(m.finished, true);
  assert.deepEqual(m.main.filter((x) => !x.done).map((x) => x.id), []);
  assert.ok(m.side.some((x) => x.done));
  for (const x of m.main) assert.ok(x.title && x.why && x.reward, x.id);
});

test('mission states are exclusive and ordered: done, one current, a few next, then later', () => {
  const s = createCampaign();
  const states = missions(s).main.map((x) => x.state);
  assert.equal(states.filter((x) => x === 'current').length, 1);
  assert.ok(states.indexOf('current') < states.indexOf('later'));
});

test('the resource breakdown adds up to the rates the simulation uses', () => {
  const s = createCampaign();
  for (const id of ['battery', 'workshop', 'greenhouse']) s.modules[id].status = 'online';
  s.storm = { until: 1e9 };
  s.drones[0].status = 'awake';
  const r = rates(s);
  const lines = contributions(s);
  for (const k of Object.keys(r)) assert.ok(Math.abs(lines.filter((l) => l.res === k).reduce((a, l) => a + l.amount, 0) - r[k]) < 1e-9, k);
  assert.ok(lines.every((l) => l.label || l.nameId), 'every line has a name');
  const power = meterReport(s, 'power', lines, r.power);
  assert.ok(power.sources.length >= 1 && power.sinks.length >= 3);
});

test('the report says when a meter runs out, and what helps', () => {
  const s = createCampaign();
  s.res.water = 30;
  const r = rates(s);
  const rep = meterReport(s, 'water', contributions(s), -5);
  assert.match(rep.outlook, /Runs out in about 6\.0 Sols/);
  assert.match(meterReport(s, 'power', contributions(s), r.power).outlook, /Full in|Growing|Steady/);
  for (const k of ['power', 'heat', 'water', 'oxygen', 'food', 'morale', 'sp']) assert.ok(METER_HELP[k].length >= 3, k);
});

test('hazards: none at the start; storm, filter, leak, drift and emergencies appear with a place and a counter', () => {
  const s = createCampaign();
  assert.deepEqual(hazards(s), []);
  s.storm = { until: s.minute + 2 * 1440 };
  s.recycleEta = 0.7;
  s.mods.push({ id: 'leak', res: 'oxygen', perSol: -2, untilMinute: null });
  s.mult.food = 0.6;
  s.emergency.heat = true;
  s.pending = { kind: 'event', id: 'e1' };
  const ids = hazards(s).map((h) => h.id);
  for (const id of ['storm', 'filter', 'leak', 'drift', 'emergency-heat', 'flare']) assert.ok(ids.includes(id), id);
  for (const h of hazards(s)) assert.ok(['info', 'warn', 'alarm'].includes(h.severity) && h.title && h.detail, h.id);
  assert.ok(hazards(s).find((h) => h.id === 'storm').detail.includes('2.0 Sols'));
});

test('radiation view: Bedroom is the safest, the surface the worst, the roof layer protects the right wing', () => {
  const s = createCampaign();
  const a = shieldingByPlace(s);
  assert.ok(a.bedroom < a.kitchen && a.kitchen < a.workshop && a.workshop < a.surface);
  s.modules.roof.status = 'online';
  assert.equal(shieldingByPlace(s).workshop, a.kitchen);
  assert.ok(shieldingByPlace(s).bedroom > 0, 'underground is never exactly zero');
});
