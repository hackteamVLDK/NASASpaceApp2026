// node --test content/tools/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extract } from './extract-strings.mjs';

const md = fs.readFileSync(new URL('../../SCENARIO.md', import.meta.url), 'utf8');
const r = extract(md);

test('strings.en.json is up to date with SCENARIO.md', () => {
  const file = JSON.parse(fs.readFileSync(new URL('../data/strings.en.json', import.meta.url), 'utf8'));
  assert.deepEqual(file, r.strings, 'run: node content/tools/extract-strings.mjs');
});
test('no line ID is used twice with different text', () => assert.deepEqual(r.conflicts, []));
test('every line ID referenced in SCENARIO.md is defined', () => assert.deepEqual(r.missing, []));
test('every choice label in the Section 7 JSON matches a line', () => assert.deepEqual(r.unlabelled, []));
test('no player-facing text contains a writer note', () => {
  for (const [id, text] of Object.entries(r.strings)) assert.ok(!/\(fiction\)/.test(text), id);
});
