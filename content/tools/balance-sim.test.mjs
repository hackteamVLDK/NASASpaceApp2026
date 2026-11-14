// node --test content/tools/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { run, PLAN, VARIANTS } from './balance-sim.mjs';

test('the planned path reaches the finale and records every Sol', () => {
  const r = run(1, { variant: 'planned' });
  assert.equal(r.finished, true);
  assert.ok(r.samples.length >= 20);
  assert.equal(r.samples[0].sol, 1);
  for (const [k, sol] of Object.entries(PLAN.expedition)) if (k !== '5') assert.ok(r.milestones.expeditions[k] >= sol, `Expedition ${k} not before Sol ${sol}`);
});

test('variants are defined for every dilemma and event', () => {
  for (const v of Object.values(VARIANTS)) for (const id of ['d1', 'd2', 'd3', 'd4', 'd5', 'e1', 'e2', 'e3', 'e4']) assert.ok(v.choices[id], id);
});
