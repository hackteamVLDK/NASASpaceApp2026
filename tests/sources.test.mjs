// A18: every component needed for a craft or an upgrade says where it can be found.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECIPES, UPGRADES } from '../src/campaign/data.js';
import { sourcesOf, missingItems, whereText, SCRAP_DROPS } from '../src/campaign/sources.js';

test('every item used in a recipe or an upgrade has at least one source', () => {
  const used = new Set();
  for (const c of [...Object.values(RECIPES), ...Object.values(UPGRADES)]) for (const it of Object.keys(c.items ?? {})) used.add(it);
  for (const it of used) assert.ok(sourcesOf(it).length > 0, `${it} has no source`);
});

test('solar cells: Expedition 2 and the Scrap Run', () => {
  const ids = sourcesOf('solar_cell').map((x) => x.id);
  assert.deepEqual(ids, [2, 'run']);
  const s = { items: { solar_cell: 1 }, flags: { done: { 2: true } } };
  assert.deepEqual(missingItems(s, { items: { solar_cell: 3 } }), [{ item: 'solar_cell', need: 3, have: 1 }]);
  assert.match(whereText(s, 'solar_cell', (id) => id), /Expedition 2, already visited\) or a Scrap Run/);
});

test('SCRAP_DROPS matches the Scrap Run pool in expeditions.js', () => {
  const src = readFileSync(new URL('../src/campaign/expeditions.js', import.meta.url), 'utf8');
  const m = src.match(/const pool = \[([^\]]+)\]/);
  assert.ok(m, 'Scrap Run pool not found');
  const pool = m[1].split(',').map((x) => x.trim().replace(/['"]/g, ''));
  assert.deepEqual(pool, [...SCRAP_DROPS]);
});
