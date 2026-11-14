import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  arealDensity, effectiveDensity, gcrTransmission, speTransmission, shieldingReport, doseRateMsvPerHour, roomShielding,
  stormsFromDonki, stormRateMsvPerHour, classifyDetections,
  TUNING, TUNING_PROVENANCE, STORM_CLASSES, MATERIALS, NASA, PROVENANCE, SOL_MINUTES, EARTH_HOURS_PER_SIM_MINUTE,
} from '../src/sim/index.js';
import { makeStorm, minuteFromUtc } from '../src/sim/space-weather.js';
import donki from '../src/data/nasa/donki-sep-2024.js';

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ''} expected ${expected} +/- ${tolerance}, got ${actual}`);
const quiet = { gcrMsvPerHour: TUNING.gcrSurfaceMsvPerDay / 24, speMsvPerHour: 0 };
const storm = { gcrMsvPerHour: TUNING.gcrSurfaceMsvPerDay / 24, speMsvPerHour: 1 };

// ---------------------------------------------------------------- provenance

test('every tuning value has a provenance tag and a note', () => {
  const tags = new Set(Object.values(PROVENANCE));
  assert.deepEqual(Object.keys(TUNING_PROVENANCE).sort(), Object.keys(TUNING).sort());
  for (const [key, entry] of Object.entries(TUNING_PROVENANCE)) {
    assert.ok(tags.has(entry.tag), `${key} has an unknown tag`);
    assert.ok(entry.note.length > 10, `${key} needs a note`);
    assert.ok(Number.isFinite(TUNING[key]), `${key} must be a number`);
  }
  for (const group of [STORM_CLASSES, MATERIALS]) for (const [key, v] of Object.entries(group)) assert.ok(tags.has(v.tag) && v.note, `${key} needs a tag and a note`);
});

test('values tagged as NASA measurements are exactly the NASA reference values', () => {
  const nasaValues = new Set(Object.values(NASA).map((v) => v.value));
  for (const [key, entry] of Object.entries(TUNING_PROVENANCE)) {
    if (entry.tag === PROVENANCE.NASA) assert.ok(nasaValues.has(TUNING[key]), `${key} is tagged NASA but ${TUNING[key]} is not in the reference table`);
  }
  assert.equal(TUNING.gcrSurfaceMsvPerDay, 0.64);
  for (const v of Object.values(NASA)) assert.ok(v.source.length > 15 && v.provenance === PROVENANCE.NASA);
});

// ---------------------------------------------------------------- shielding physics

test('areal density is thickness times density', () => {
  near(arealDensity([{ material: 'regolith', thicknessM: 1 }]), 150, 1e-9);
  near(arealDensity([{ material: 'water', thicknessM: 0.25 }, { material: 'aluminum', thicknessM: 0.04 }]), 25 + 10.8, 1e-9);
  assert.throws(() => arealDensity([{ material: 'unobtainium', thicknessM: 1 }]), /unknown shielding material/);
  assert.throws(() => arealDensity([{ material: 'water', thicknessM: -1 }]), /invalid shielding thickness/);
});

test('cosmic rays: more shielding means less dose, but never zero', () => {
  assert.equal(gcrTransmission(0), 1);
  let previous = gcrTransmission(60);
  for (let x = 70; x <= 3000; x += 10) {
    const t = gcrTransmission(x);
    assert.ok(t <= previous + 1e-12, `transmission must not rise with depth at ${x} g/cm2`);
    previous = t;
  }
  assert.equal(gcrTransmission(100000), TUNING.gcrResidualFraction);
  assert.ok(gcrTransmission(100000) > 0, 'underground dose is never exactly zero');
});

test('cosmic rays: a thin shield helps little and can be slightly worse than none', () => {
  const thin = gcrTransmission(20);
  assert.ok(thin > 1 && thin < 1.1, `expected a small build-up above 1, got ${thin}`);
  assert.ok(gcrTransmission(150) < 0.55, 'one metre of regolith should roughly halve the cosmic-ray dose');
  assert.ok(gcrTransmission(150) > 0.3, 'one metre of regolith must not stop most cosmic rays');
});

test('solar storm particles are much easier to stop than cosmic rays', () => {
  assert.equal(speTransmission(0), 1);
  for (const x of [50, 150, 300, 600]) assert.ok(speTransmission(x) < gcrTransmission(x), `at ${x} g/cm2`);
  assert.ok(speTransmission(150) < 0.05, 'one metre of regolith stops almost all of a solar storm');
});

test('shielding material matters, not only thickness', () => {
  const same = 30; // g/cm2 of each material
  const of = (material) => effectiveDensity([{ material, thicknessM: same / 100 / MATERIALS[material].density }]);
  assert.ok(of('polyethylene') > of('water'));
  assert.ok(of('water') > of('regolith'));
  assert.ok(of('regolith') > of('aluminum'));
  const water = shieldingReport([{ material: 'water', thicknessM: 0.3 }]);
  const metal = shieldingReport([{ material: 'aluminum', thicknessM: 0.3 / 2.7 }]);
  near(water.arealDensity, metal.arealDensity, 1e-9);
  assert.ok(water.spe < metal.spe, 'for the same mass, water must let less storm radiation through than aluminium');
});

// ---------------------------------------------------------------- dose by place

test('quiet-day dose outdoors matches the Curiosity measurement', () => {
  const perSol = doseRateMsvPerHour(quiet, []) * EARTH_HOURS_PER_SIM_MINUTE * SOL_MINUTES;
  const expected = (NASA.gcrSurfaceDoseEquivalent.value + TUNING.rockBackgroundMsvPerDay) * (NASA.solSeconds.value / 86400);
  near(perSol, expected, 1e-9);
  near(perSol, 0.66, 0.01, 'about 0.66 mSv per sol');
});

test('deeper rooms are safer, and no room is at zero', () => {
  const rate = (room, env) => doseRateMsvPerHour(env, roomShielding(room));
  for (const env of [quiet, storm]) {
    assert.ok(rate('shelter', env) < rate('quarters', env), 'deep level beats upper level');
    assert.ok(rate('quarters', env) < rate('greenhouse', env), 'underground beats a surface module');
    assert.ok(rate('shelter', env) > 0, 'never exactly zero');
  }
  assert.ok(rate('greenhouse', storm) < rate('outside', storm), 'a hull is better than a suit in a storm');
  assert.ok(rate('quarters', storm) < 0.02 * rate('outside', storm), 'the upper level stops almost all of a storm');
  assert.ok(rate('shelter', quiet) < 0.1 * rate('outside', quiet), 'the deep level cuts cosmic rays more than tenfold');
});

test('surface upgrades add shielding, and regolith beats the water roof against storms', () => {
  const base = shieldingReport(roomShielding('greenhouse'));
  const berm = shieldingReport(roomShielding('greenhouse', { surface: [{ material: 'regolith', thicknessM: 0.5 }] }));
  const roof = shieldingReport(roomShielding('greenhouse', { surface: [{ material: 'water', thicknessM: 0.25 }] }));
  assert.ok(berm.spe < roof.spe && roof.spe < base.spe);
  assert.ok(berm.gcr < base.gcr);
  assert.deepEqual(roomShielding('shelter', { surface: [{ material: 'regolith', thicknessM: 0.5 }] }), roomShielding('shelter'), 'surface upgrades do not change underground rooms');
});

// ---------------------------------------------------------------- solar storms

test('a storm delivers exactly its class dose to an unshielded person', () => {
  for (const cls of Object.keys(STORM_CLASSES)) {
    const s = makeStorm({ id: 't', startMinute: 1000, class: cls });
    let total = 0;
    for (let m = s.startMinute - 5; m < s.endMinute + 5; m++) total += stormRateMsvPerHour(s, m) * EARTH_HOURS_PER_SIM_MINUTE;
    near(total, STORM_CLASSES[cls].surfaceDoseMsv, STORM_CLASSES[cls].surfaceDoseMsv * 0.01, cls);
    assert.equal(stormRateMsvPerHour(s, s.startMinute - 1), 0);
    assert.equal(stormRateMsvPerHour(s, s.endMinute), 0);
  }
});

test('the strong storm class is anchored to the May 2024 Curiosity measurement', () => {
  const measuredMgy = NASA.speMay2024AbsorbedDose.value / 1000;
  const impliedQuality = STORM_CLASSES.strong.surfaceDoseMsv / measuredMgy;
  assert.ok(impliedQuality > 1 && impliedQuality < 2, `quality factor ${impliedQuality} should be a plausible 1 to 2`);
  assert.equal(STORM_CLASSES.strong.tag, PROVENANCE.APPROX);
});

test('NASA DONKI dataset is intact and labelled honestly', () => {
  assert.equal(donki.provenance, PROVENANCE.NASA);
  assert.equal(donki.events.length, 119);
  for (const e of donki.events) {
    assert.match(e.time, /^2024-\d\d-\d\dT\d\d:\d\dZ$/);
    assert.ok(e.instruments.length > 0);
  }
  assert.match(donki.note, /not at Mars/);
});

test('DONKI detections become game storms on the real dates', () => {
  const storms = stormsFromDonki(donki, { startDateUtc: '2024-05-08T00:00Z', sols: 14 });
  assert.deepEqual(storms.map((s) => s.id), ['donki-2024-05-09', 'donki-2024-05-10', 'donki-2024-05-11', 'donki-2024-05-13']);
  assert.deepEqual(storms.map((s) => s.class), ['minor', 'moderate', 'strong', 'moderate']);
  // 9 May 13:59 UTC is 37.98 Earth hours after the start: sol 2, shortly before 13:00 Mars time.
  assert.equal(storms[0].startMinute, minuteFromUtc('2024-05-09T13:59Z', '2024-05-08T00:00Z'));
  near(storms[0].startMinute, 2218, 1);
  for (const s of storms) {
    assert.equal(s.timing.provenance, PROVENANCE.NASA, 'the date is real data');
    assert.equal(s.strength.provenance, PROVENANCE.GAME, 'the strength at Mars is a game value');
    assert.ok(s.endMinute > s.startMinute);
  }
  assert.equal(stormsFromDonki(donki, { startDateUtc: '2024-04-01T00:00Z', sols: 5 }).length, 0, 'a quiet window has no storms');
});

test('stronger particles seen means a stronger game storm', () => {
  assert.equal(classifyDetections(['GOES-P: SEISS >100 MeV', 'SOHO: COSTEP 15.8-39.8 MeV']), 'strong');
  assert.equal(classifyDetections(['GOES-P: SEISS >10 MeV']), 'moderate');
  assert.equal(classifyDetections(['STEREO A: IMPACT 13-100 MeV', 'MODEL: REleASE:ACE/EPAM 15.8-39.8 MeV']), 'minor');
});
