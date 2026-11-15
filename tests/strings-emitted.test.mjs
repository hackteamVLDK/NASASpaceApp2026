// Every line the engine emits during a full campaign has an English string (no raw IDs such as "radio.exp4.60").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setStrings, addStrings, hasString } from '../src/flow/strings.js';
import { autoplay } from '../tools/balance/campaign-bot.mjs';
import { STRINGS as CHOICE_STRINGS } from '../src/campaign/choices-data.js';
import { STRINGS as LIVES_STRINGS } from '../src/campaign/lives.js';
import { STRINGS as JOB_STRINGS } from '../src/campaign/jobs.js';

setStrings(JSON.parse(readFileSync(new URL('../content/data/strings.en.json', import.meta.url), 'utf8')));
// lines that are not in SCENARIO.md yet: src/main.js adds the same modules' STRINGS at boot
addStrings({ ...CHOICE_STRINGS, ...LIVES_STRINGS, ...JOB_STRINGS });

/** The string IDs the UI looks up for one engine event (as src/main.js and src/ui/campaign-ui.js do). */
function idsOf(e) {
  const ids = [];
  if (e.lineId) ids.push(e.lineId);
  if (e.type === 'radio') ids.push(e.id);
  if (e.type === 'radio-decision') ids.push(`radio.${e.id}`);
  if (e.type === 'dilemma' || e.type === 'event') ids.push(`ui.${e.id}.title`);
  if (e.type === 'logbook' && e.card) ids.push(`card.${e.card}.title`);
  return ids;
}

test('every emitted line ID of a full campaign has a string', () => {
  const missing = new Set();
  let radio = 0;
  for (const seed of [1, 2, 3]) {
    autoplay(seed, { maxSols: 35, onEvents: (events) => {
      for (const e of events) {
        if (e.type === 'radio') radio++;
        for (const id of idsOf(e)) if (!hasString(id)) missing.add(id);
      }
    } });
  }
  assert.ok(radio > 20, `only ${radio} radio lines seen`);
  assert.deepEqual([...missing], []);
});
