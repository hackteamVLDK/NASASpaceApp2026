import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as shortText from '../src/ui/short-text.js';
import { STRINGS as lives } from '../src/campaign/lives.js';
import { STRINGS as jobs } from '../src/campaign/jobs.js';
import { STRINGS as choices } from '../src/campaign/choices-data.js';
import { STRINGS as livesUi } from '../src/ui/lives-ui.js';
import { createCampaign } from '../src/campaign/engine.js';
import { missions } from '../src/campaign/missions.js';
import { hazards } from '../src/campaign/hazards.js';
import { howTo } from '../src/ui/mission-hints.js';

const { SHORT } = shortText;
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const scenario = JSON.parse(read('../content/data/strings.en.json'));
const full = new Map();
const bodies = new Set();
const remember = (id, text) => {
  assert.equal(typeof text, 'string', `Full source text missing: ${id}`);
  if (!full.has(id)) full.set(id, new Set());
  full.get(id).add(text);
};

// Source data is read on each run, including generated follow-up keys and callbacks.
for (const [id, text] of Object.entries(scenario)) {
  if (id.startsWith('astra.') || id.startsWith('radio.')
    || /^ui\.(?:d[1-5]|e[1-4])\./.test(id)) remember(id, text);
}
for (const strings of [lives, jobs, choices, livesUi]) {
  for (const [id, text] of Object.entries(strings)) {
    if (/^(astra|ui)\./.test(id)) remember(id, text);
  }
}
// The radio card renderer constructs label IDs from radio decision body IDs.
// Discover these from the real labels, so new decisions cannot escape coverage.
for (const [id, text] of Object.entries({ ...scenario, ...choices })) {
  const match = /^ui\.(.+)\.([abc])\.label$/.exec(id);
  if (!match) continue;
  const radioId = `radio.${match[1]}`;
  if (scenario[radioId]) {
    remember(id, text);
    remember(radioId, scenario[radioId]);
    bodies.add(radioId);
  }
}
for (const id of full.keys()) {
  if (/^astra\.[def]\d+\.alert$/.test(id)) bodies.add(id);
}

const initial = createCampaign({ seed: 1 });
const allMissions = missions(initial);
for (const m of [...allMissions.main, ...allMissions.side]) {
  for (const field of ['title', 'why', 'how']) {
    if (typeof m[field] === 'string' && m[field]) remember(`mission.${m.id}.${field}`, m[field]);
  }
  // extras.js obtains tracker "how" text from this helper, not missions.js.
  const how = howTo(initial, { ...m, state: 'current' });
  if (how) remember(`mission.${m.id}.how`, how);
}

// Exercise hazard branches, including both zero and recovering emergencies,
// both solar directions, both upgrade hints, and every low/empty meter.
const seenHazards = new Set();
const sampleHazards = (change = () => {}) => {
  const s = structuredClone(initial);
  change(s);
  for (const h of hazards(s)) {
    seenHazards.add(h.id);
    remember(`hazard.${h.id}.title`, h.title);
    remember(`hazard.${h.id}.detail`, h.detail);
  }
};
sampleHazards();
sampleHazards((s) => { s.storm = { until: s.minute + 1 }; });
for (const id of ['e1', 'd5']) sampleHazards((s) => { s.pending = { id }; });
sampleHazards((s) => { s.flags.flareWarned = true; });
for (const key of Object.keys(initial.res)) {
  for (const value of [0, 1]) sampleHazards((s) => { s.res[key] = value; });
  for (const value of [0, 12]) sampleHazards((s) => { s.emergency[key] = true; s.res[key] = value; });
}
sampleHazards((s) => { s.recycleEta = 0.7; });
sampleHazards((s) => { s.mods.push({ id: 'leak' }); });
sampleHazards((s) => { s.mult.food = 0.6; });
for (const solar of [0.7, 1.2]) sampleHazards((s) => { s.mult.solar = solar; });
sampleHazards((s) => { s.tasks.push({ game: 'solar_wipe' }); });
sampleHazards((s) => { s.flags.noLaunchUntil = s.minute + 1; });
sampleHazards((s) => { s.medRest = { until: s.minute + 1 }; });
for (const cells of [0, 3]) sampleHazards((s) => { s.res.power = 40; s.items.solar_cell = cells; });
sampleHazards((s) => { s.hp = 1; });
sampleHazards((s) => { s.away = { start: s.minute, end: s.minute + 1, f0: 0 }; });

test('SHORT is the only export, is frozen, and covers every source ID', () => {
  assert.deepEqual(Object.keys(shortText), ['SHORT']);
  assert.ok(Object.isFrozen(SHORT));
  const missing = [...full.keys()].filter((id) => !Object.hasOwn(SHORT, id));
  assert.deepEqual(missing, [], `Missing short text: ${missing.join(', ')}`);
});

test('hazard fixtures exercise every literal ID in hazards.js', () => {
  const source = read('../src/campaign/hazards.js');
  const ids = [...source.matchAll(/\badd\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(ids.length > 0, 'Hazard ID discovery must not be empty');
  for (const id of ids) assert.ok(seenHazards.has(id), `Add a fixture for hazard ${id}`);
  for (const match of source.matchAll(/\badd\(`([^`]+)`/g)) {
    const pattern = match[1].replace(/\$\{k\}/g, '[a-z]+');
    assert.ok([...seenHazards].some((id) => new RegExp(`^${pattern}$`).test(id)),
      `Add fixtures for hazard family ${match[1]}`);
  }
});

test('every short text is nonempty, calm, and within its word limit', () => {
  for (const [id, text] of Object.entries(SHORT)) {
    assert.equal(typeof text, 'string', id);
    assert.ok(text.trim(), `Empty short text: ${id}`);
    assert.equal(text, text.trim(), `Outer whitespace: ${id}`);
    assert.doesNotMatch(text, /\s{2,}|[\t\r\n]/, `Use single spaces: ${id}`);
    const limit = bodies.has(id) ? 6 : 4;
    assert.ok(text.split(' ').length <= limit, `${id}: max ${limit} words, got "${text}"`);
    assert.doesNotMatch(text, /\b(?:die|dead|death|dying|kill|doom|fail|failed|stupid|dumb)\b/i, id);
  }
});

test('short versions introduce no placeholders absent from their full source', () => {
  for (const [id, text] of Object.entries(SHORT)) {
    assert.ok(full.has(id), `Short ID has no discovered source: ${id}`);
    for (const token of text.match(/\{[^{}]+\}/g) ?? []) {
      for (const original of full.get(id)) {
        assert.ok(original.includes(token), `${id}: ${token} is absent from the full text`);
      }
    }
  }
});

test('displayed placeholders also fit the word limit', () => {
  const values = { left: 2, max: 3, sol: 12, count: 4, block: scenario['ui.plan.free'] };
  for (const [id, text] of Object.entries(SHORT)) {
    const rendered = text.replace(/\{(\w+)\}/g, (_, key) => {
      assert.ok(Object.hasOwn(values, key), `Add a display example for ${key}`);
      return values[key];
    });
    assert.ok(rendered.split(' ').length <= (bodies.has(id) ? 6 : 4), `${id}: ${rendered}`);
  }
});

test('shielding hooks keep radiation reduction distinct from total protection', () => {
  for (const id of ['astra.intro.why_underground', 'astra.act3.roof_built',
    'astra.rad.rover_shield', 'astra.d5.b', 'mission.shield.why']) {
    assert.match(SHORT[id], /reduc|less/i, id);
    assert.doesNotMatch(SHORT[id], /\ball\b|\bzero\b|100%|\bsafe\b/i, id);
  }
  assert.match(SHORT['astra.finale.leopard'], /not proof/i);
});
