// The underground soil picture cites its NASA sources, each with a provenance tag (SCENARIO: scientific accuracy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOIL_SOURCES } from '../src/campaign/sources.js';
import { SOIL_ZONES } from '../src/render/soil-detail.js';

test('every soil element has a source with an https URL and a provenance tag', () => {
  for (const id of ['layers', 'colour', 'bedrock', 'boulders', 'veins', 'meteorite', 'ice']) {
    const list = SOIL_SOURCES[id];
    assert.ok(list?.length, id);
    for (const [what, url, tag] of list) {
      assert.ok(what.length > 5, id);
      assert.match(url, /^https:\/\//, id);
      assert.ok(['nasa_measurement', 'approximation', 'gameplay'].includes(tag), `${id}: ${tag}`);
    }
  }
  assert.equal(SOIL_SOURCES.ice[0][2], 'gameplay'); // ice under Jezero (~18 N) is a game simplification
});

test('soil zones run from the surface band down: lake layers, erosion surface, delta, basalt', () => {
  assert.ok(SOIL_ZONES.surfaceBand < SOIL_ZONES.erosion && SOIL_ZONES.erosion < SOIL_ZONES.basalt);
});
