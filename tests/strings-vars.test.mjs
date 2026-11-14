import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setStrings, setStringVars, t } from '../src/flow/strings.js';
import { earthMarsLinkForSol, formatDelay } from '../src/data/nasa/lightTime.js';

const strings = JSON.parse(fs.readFileSync(new URL('../content/data/strings.en.json', import.meta.url)));

test('{delay} is filled with the light time of the current Sol', () => {
  setStrings(strings);
  setStringVars({ delay: formatDelay(earthMarsLinkForSol(15).oneWaySeconds) });
  assert.match(t('astra.act3.earth_reply'), /^Message from Earth, sent 14 min( \d+ s)? ago:/);
  assert.match(t('astra.finale.earth'), /sent 1\d min/);
  assert.equal(t('ui.mg.dish_antenna_alignment.counter', { delay: '3 min' }), 'Arriving in 3 min...');
});

test('no player-facing line keeps a fixed "14 minutes"', () => {
  for (const [id, text] of Object.entries(strings)) assert.ok(!/14 minutes/.test(text), id);
});

test('unknown placeholders and IDs stay visible', () => {
  setStrings({ a: 'x {nope} y' });
  assert.equal(t('a'), 'x {nope} y');
  assert.equal(t('missing.id'), 'missing.id');
});
