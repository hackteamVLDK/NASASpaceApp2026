import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPOKEN } from '../src/ui/spoken-text.js';
import { STRINGS as LIVES } from '../src/campaign/lives.js';
import { STRINGS as JOBS } from '../src/campaign/jobs.js';
import { STRINGS as CHOICES } from '../src/campaign/choices-data.js';

const localized = JSON.parse(readFileSync(new URL('../content/data/strings.en.json', import.meta.url), 'utf8'));
const sources = [localized, LIVES, JOBS, CHOICES];
const astraEntries = sources.flatMap((strings) => Object.entries(strings).filter(([id]) => id.startsWith('astra.')));
// These are cross-references for writers, never lines for a speech engine.
// Exact source text is checked so a future real line cannot be silently skipped.
const skipped = {
  'astra.act1.storm_alert': 'See Dilemma 1 (Section 6).',
  'astra.act2.exp1_arrive': 'See Section 5, Expedition 1.',
};
const placeholders = (text) => [...text.matchAll(/\{[^{}]+\}/g)].map(([token]) => token).sort();
const withoutPlaceholders = (text) => text.replace(/\{[^{}]+\}/g, 'placeholder');

test('spoken map covers every real ASTRA line in all four sources, without unknown IDs', () => {
  const sourceMap = Object.fromEntries(astraEntries);
  for (const [id, full] of Object.entries(skipped)) assert.equal(sourceMap[id], full, id);
  const expected = [...new Set(astraEntries.map(([id]) => id))].filter((id) => !Object.hasOwn(skipped, id)).sort();
  assert.deepEqual(Object.keys(SPOKEN).sort(), expected);
  assert.ok(Object.isFrozen(SPOKEN), 'shared spoken text must be immutable');
});

test('each spoken line has one or two sentences and at most fifteen words', () => {
  for (const [id, spoken] of Object.entries(SPOKEN)) {
    assert.equal(typeof spoken, 'string', id);
    assert.equal(spoken, spoken.trim(), `${id}: surrounding whitespace`);
    assert.ok(spoken.length > 0, `${id}: empty line`);
    const text = withoutPlaceholders(spoken);
    const words = text.split(/\s+/);
    assert.ok(words.length <= 15, `${id}: ${words.length} words`);
    const sentences = text.split(/[.!?]+/).filter((part) => part.trim());
    assert.ok(sentences.length >= 1 && sentences.length <= 2, `${id}: ${sentences.length} sentences`);
  }
});

test('speech uses calm language, spoken numbers, and no unreadable symbols or writer notes', () => {
  const forbidden = /\b(?:die|dead|death|dying|kill|doom|failed|stupid|dumb)\b/i;
  // x means the standalone multiplication symbol, not the letter in "extra" or "oxygen".
  const symbols = /[%+\/()[\]×→]|->|\bx\b/i;
  for (const [id, spoken] of Object.entries(SPOKEN)) {
    const text = withoutPlaceholders(spoken);
    assert.doesNotMatch(text, forbidden, id);
    assert.doesNotMatch(text, symbols, id);
    assert.doesNotMatch(text, /[\d#&=<>]|\b(?:HP|LEDs?|ISS|CO2)\b|\p{Extended_Pictographic}/u, id);
    assert.doesNotMatch(text, /\bfiction\b/i, id);
  }
});

test('spoken alternatives preserve every source placeholder exactly, including repeated tokens', () => {
  for (const [id, full] of astraEntries) {
    if (Object.hasOwn(skipped, id)) continue;
    assert.deepEqual(placeholders(SPOKEN[id]), placeholders(full), id);
    assert.doesNotMatch(SPOKEN[id].replace(/\{[^{}]+\}/g, ''), /[{}]/, `${id}: malformed placeholder`);
  }
});

test('science summaries retain caveats about shielding, salts, and possible life', () => {
  for (const id of ['astra.intro.why_underground', 'astra.act3.roof_built', 'astra.rad.rover_shield']) {
    assert.match(SPOKEN[id], /some.*(?:through|radiation)|don't block it all/i, id);
  }
  assert.match(SPOKEN['astra.d3.b'], /some can remain/i);
  assert.match(SPOKEN['astra.finale.leopard'], /possible ancient life, not proof/i);
  assert.match(SPOKEN['astra.act2.surface_warning'], /radiation adds up over time/i);
  assert.match(SPOKEN['astra.act3.deep_scan'], /lowers water's freezing temperature/i);
});
