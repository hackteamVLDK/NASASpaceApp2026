// node --test src/data/nasa/lightTime.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { earthMarsLink, earthMarsLinkForSol, solToDate, formatDelay, MARS_SOL_SECONDS } from './lightTime.js';

// Published closest approaches of Mars (NASA): date, distance in km.
const CLOSEST_APPROACHES = [
  ['2003-08-27T09:51:00Z', 55.76e6],
  ['2018-07-31T07:50:00Z', 57.59e6],
  ['2020-10-06T14:18:00Z', 62.07e6]
];

test('matches published Mars closest approaches within 0.5%', () => {
  for (const [date, km] of CLOSEST_APPROACHES) {
    const { distanceKm } = earthMarsLink(new Date(date));
    assert.ok(Math.abs(distanceKm - km) / km < 0.005, `${date}: ${distanceKm} vs ${km}`);
  }
});

test('one-way delay stays in the real 3-22.5 minute range (2025-2045)', () => {
  let min = Infinity, max = 0;
  for (let t = Date.UTC(2025, 0, 1); t < Date.UTC(2046, 0, 1); t += 86400000) {
    const m = earthMarsLink(new Date(t)).oneWayMinutes;
    min = Math.min(min, m); max = Math.max(max, m);
  }
  assert.ok(min > 3.0 && min < 3.5, `min ${min}`);
  assert.ok(max > 21.5 && max < 22.5, `max ${max}`);
});

test('near opposition the Sun is behind Earth (elongation ~180 deg)', () => {
  const { sunAngleDeg } = earthMarsLink(new Date('2020-10-13T23:00:00Z')); // Mars opposition 2020
  assert.ok(sunAngleDeg > 170, `angle ${sunAngleDeg}`);
});

test('campaign: about 13-15 minutes, rising, ~14 min when the Lab comes online', () => {
  const s1 = earthMarsLinkForSol(1).oneWayMinutes;
  const s15 = earthMarsLinkForSol(15).oneWayMinutes;
  const s20 = earthMarsLinkForSol(20).oneWayMinutes;
  assert.ok(s1 > 13 && s20 < 15, `${s1} .. ${s20}`);
  assert.ok(s1 < s15 && s15 < s20);
  assert.equal(formatDelay(earthMarsLinkForSol(15).oneWaySeconds).startsWith('14 min'), true);
});

test('sols are Mars days, not Earth days', () => {
  const d1 = solToDate(1).getTime();
  const d2 = solToDate(2).getTime();
  assert.equal((d2 - d1) / 1000, MARS_SOL_SECONDS);
});

test('formatDelay', () => {
  assert.equal(formatDelay(840), '14 min');
  assert.equal(formatDelay(851), '14 min 10 s');
  assert.equal(formatDelay(194), '3 min 10 s');
});
