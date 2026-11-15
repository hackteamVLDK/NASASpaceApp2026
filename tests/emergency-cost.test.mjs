// C6 (team decision): an open Emergency costs Morale at the end of each Sol; Sols with empty supplies cost stars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, command, step } from '../src/campaign/engine.js';
import { buildReport } from '../src/campaign/logbook.js';
import { SOL } from '../src/campaign/data.js';

test('SCENARIO mode: an Emergency left open for 3 Sols costs 15 Morale, and ASTRA warns once', () => {
  const run = (emergency) => {
    const s = createCampaign({ hpZeroEndsRun: false }); // this test checks the original no-HP-loss Emergency rule
    command(s, { type: 'wakeDrone', drone: 'drone-01' });
    step(s, 17 * 60 - 1); // to 23:59 on Sol 1
    s.res.oxygen = 5; // low in both runs (it rises about 4 a Sol and stays under 20, so an open Emergency stays open)
    if (emergency) s.emergency.oxygen = true;
    const ev = [];
    const end = s.minute + 3 * SOL;
    for (let g = 0; s.minute < end && g < 50; g++) { // decision cards stop the clock: answer them the same way in both runs
      if (s.pending) command(s, s.pending.kind === 'radio' ? { type: 'radio', choice: 'a' } : { type: 'choose', choice: 'a' });
      ev.push(...step(s, end - s.minute));
    }
    return { s, ev };
  };
  const calm = run(false), worried = run(true);
  assert.ok(Math.abs(calm.s.res.morale - worried.s.res.morale - 15) < 1e-6, `${calm.s.res.morale} vs ${worried.s.res.morale}`);
  assert.equal(worried.ev.filter((e) => e.lineId === 'astra.res.emergency_worry').length, 1);
  assert.equal(calm.ev.filter((e) => e.lineId === 'astra.res.emergency_worry').length, 0);
  assert.equal(worried.s.hp, calm.s.hp, 'no HP change');
});

test('Morale never goes below 0 from an open Emergency', () => {
  const s = createCampaign();
  step(s, 17 * 60 - 1);
  s.res.morale = 2; s.emergency.power = true;
  step(s, 2);
  assert.equal(s.res.morale >= 0, true);
});

test('the Mission Rating loses 1 star after more than 3 empty-supply Sols, 2 after more than 8', () => {
  const s = createCampaign();
  const base = buildReport(s);
  for (const [n, lost] of [[3, 0], [4, 1], [8, 1], [9, 2]]) {
    s.stats.zeroSols = n;
    const r = buildReport(s);
    assert.equal(r.zeroSols, n);
    assert.equal(r.starsLost, lost);
    assert.equal(base.total - r.total, Math.min(lost, base.total - 3), `${n} Sols`);
    for (const k of ['crew', 'base', 'science']) assert.ok(r.rating[k] >= 1, 'never zero stars');
  }
});

test('a Sol with Food at 0 counts once, at the end of the Sol', () => {
  const s = createCampaign();
  step(s, 60);
  s.res.food = 0;
  step(s, 10);
  s.res.food = 50;
  step(s, SOL);
  assert.equal(s.stats.zeroSols, 1);
});

test('a normal good run keeps its rating (no empty-supply Sols on the recommended path)', async () => {
  const { play } = await import('../tools/balance/strategy-lab.mjs');
  const r = play('recommended', 2);
  assert.ok(r.stars >= 7, `recommended path: ${r.stars} stars`);
});
