// The whole story can be finished: an autopilot plays the recommended path (SCENARIO 3.8) to the finale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setStrings, hasString } from '../src/flow/strings.js';
import { autoplay } from '../tools/balance/campaign-bot.mjs';
import { clockAt } from '../src/campaign/engine.js';
import { EXPEDITIONS } from '../src/campaign/expeditions.js';

setStrings(JSON.parse(readFileSync(new URL('../content/data/strings.en.json', import.meta.url), 'utf8')));

test('the autopilot reaches the Canyon Anomaly finale on several seeds', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { s } = autoplay(seed, { maxSols: 35 });
    assert.ok(s.flags.finaleDone, `seed ${seed}: finale not reached by Sol ${clockAt(s.minute).sol}`);
    assert.ok(clockAt(s.minute).sol <= 30, `seed ${seed}: took until Sol ${clockAt(s.minute).sol}`);
    assert.equal(s.stats.expeditions >= 5, true);
    for (const [k, v] of Object.entries(s.res)) assert.ok(Number.isFinite(v) && v >= 0, `${k}=${v}`);
    assert.ok(s.hp > 0);
  }
});

test('every radio line of every expedition exists as a string', () => {
  for (const ex of Object.values(EXPEDITIONS)) {
    if (ex.id === 'run') continue;
    for (const mark of ex.radio) {
      const suffix = ex.radioIdMap ? ex.radioIdMap[mark] : String(mark).padStart(2, '0');
      const id = `radio.exp${ex.id}.${suffix}`;
      // radio decisions (60% of Expedition 2 and 4, 85% of 3) have their text under the same ID or ui.*
      assert.ok(hasString(id) || hasString(`ui.exp${ex.id}.${mark}.a.label`) || ex.decision?.at === mark, id);
    }
    assert.ok(hasString(ex.nameId), ex.nameId);
  }
});
