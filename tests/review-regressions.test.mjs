/**
 * Regression tests for the independent review of the simulation
 * (docs/ai-collaboration/records/20261114-113628-review-simulation-backend-logic-and-science.md).
 * One test per confirmed finding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, step, applyCommand, serialize, deserialize, SaveError, describeEvent, roomReport,
  shieldingReport, stormsFromDonki, evaluateObjectives,
  TUNING, MATERIALS, NASA, PROVENANCE, SOL_MINUTES,
} from '../src/sim/index.js';
import { makeStorm } from '../src/sim/space-weather.js';
import donki from '../src/data/nasa/donki-sep-2024.js';

const crewOf = (game, id) => game.crew.find((c) => c.id === id);
const runTo = (game, sol, hour = 0, minute = 0) => step(game, (sol - 1) * SOL_MINUTES + hour * 60 + minute - game.minute);
const quiet = (game) => {
  game.storms = [];
  return game;
};

// ---------------------------------------------------------------- finding 1: save validation

test('damaged saves are refused instead of crashing or corrupting the game later', () => {
  const base = createGame('L2-storm-season');
  applyCommand(base, { type: 'assign', crew: 'sci', job: 'explore' });
  step(base, 100); // 07:40 — people are walking, so `move` is populated
  assert.ok(base.crew.some((c) => c.move), 'test needs someone in transit');
  const good = serialize(base);
  assert.doesNotThrow(() => deserialize(good));

  const walker = base.crew.findIndex((c) => c.move);
  const tamper = (edit) => {
    const data = JSON.parse(good);
    edit(data.state);
    return JSON.stringify(data);
  };
  const cases = {
    'movement without a route': (s) => delete s.crew[walker].move.rest,
    'movement between unconnected rooms': (s) => (s.crew[walker].move.to = 'power'),
    'movement with impossible timing': (s) => (s.crew[walker].move.left = 9999),
    'movement to nowhere': (s) => (s.crew[walker].move.dest = 'toString'),
    'unknown storm class': (s) => (s.storms[0].class = 'apocalyptic'),
    'unknown storm status': (s) => (s.storms[0].status = 'brewing'),
    'missing storm dose': (s) => delete s.crew[0].stormDoseMsv,
    'missing counter': (s) => delete s.stats.foodGrownKg,
    'unknown project': (s) => (s.projects.deathStar = { status: 'active', hoursDone: 0, paid: true }),
    'project without paid flag': (s) => delete s.projects.berm.paid,
    'two active projects': (s) => {
      s.projects.berm.status = 'active';
      s.projects.waterRoof.status = 'active';
    },
    'inherited name as a level': (s) => (s.levelId = 'toString'),
    'inherited name as a job': (s) => (s.crew[0].job = 'constructor'),
    'stat out of range': (s) => (s.crew[0].stats.energy = 500),
    'text where a number belongs': (s) => (s.resources.o2Kg = '12'),
    'missing emergency record': (s) => delete s.emergencies.noO2,
    'missing episode flag': (s) => delete s.stormEpisode,
    'running game with a result': (s) => (s.result = { stars: 3 }),
  };
  for (const [name, edit] of Object.entries(cases)) {
    assert.throws(() => deserialize(tamper(edit)), (e) => e instanceof SaveError, `should refuse: ${name}`);
  }
});

test('derived shielding in a save is rebuilt, not trusted', () => {
  const g = createGame('L2-storm-season');
  g.projects.berm.status = 'done';
  g.projects.berm.paid = true;
  const data = JSON.parse(serialize(g));
  data.state.extraShielding = { surface: [{ material: 'kryptonite', thicknessM: 99 }] };
  const { state } = deserialize(JSON.stringify(data));
  assert.deepEqual(state.extraShielding, { surface: [{ material: 'regolith', thicknessM: 0.5 }] });
  assert.doesNotThrow(() => step(state, 10));
});

// ---------------------------------------------------------------- finding 2: oxygen before battery reserve

test('an empty oxygen tank overrides the battery reserve: the crew are not left to suffocate', () => {
  const g = quiet(createGame('L1-first-sols'));
  runTo(g, 2, 0); // midnight
  g.resources.o2Kg = 0;
  g.resources.waterL = 80;
  g.systems.o2GenEff = 1;
  g.resources.batteryKwh = TUNING.batteryKwh * (TUNING.reserveO2gen - 0.005); // just under the normal reserve
  step(g, 5);
  assert.equal(g.power.powered.o2gen, true, 'the generator runs despite the low battery');
  step(g, 200);
  assert.equal(g.status, 'running');
  assert.ok(g.crew.every((c) => c.stats.health > 99), 'nobody is harmed while there is power to make air');
  assert.ok(g.resources.o2Kg > 0, 'a healthy generator refills the tank');
});

test('thin air harms in proportion to how much is missing, not all at once', () => {
  const lossOver = (minutes, prepare) => {
    const g = quiet(createGame('L1-first-sols'));
    runTo(g, 1, 12);
    g.resources.o2Kg = 0;
    g.resources.batteryKwh = 200;
    prepare(g);
    for (let i = 0; i < minutes && g.status === 'running'; i++) {
      g.resources.o2Kg = Math.min(g.resources.o2Kg, 0.001); // keep the tank empty
      step(g, 1);
    }
    return 100 - Math.min(...g.crew.map((c) => c.stats.health));
  };
  const noAir = lossOver(30, (g) => (g.resources.waterL = 0)); // no water: the generator cannot run at all
  const thinAir = lossOver(30, (g) => (g.systems.o2GenEff = 0.6)); // generator covers most of the demand
  assert.ok(noAir > 25, `no air at all is an emergency within minutes (lost ${noAir})`);
  assert.ok(thinAir > 0 && thinAir < 0.4 * noAir, `a partly working generator buys time (lost ${thinAir} vs ${noAir})`);
});

test('with a healthy oxygen tank the generator still respects the battery reserve', () => {
  const g = quiet(createGame('L1-first-sols'));
  runTo(g, 2, 0);
  g.resources.o2Kg = 15;
  g.resources.batteryKwh = TUNING.batteryKwh * (TUNING.reserveO2gen - 0.005);
  step(g, 1);
  assert.ok(g.power.shed.includes('o2gen'));
});

// ---------------------------------------------------------------- findings 3 and 4: storm boundaries

test('a storm that was over before the level began never happens and earns nothing', () => {
  const g = quiet(createGame('L1-first-sols')); // starts at minute 360
  g.storms.push(makeStorm({ id: 'old', startMinute: 0, class: 'minor' }));
  g.storms[0].endMinute = 300;
  const events = step(g, 60);
  assert.equal(g.storms[0].status, 'done');
  assert.equal(g.stats.stormsTotal, 0);
  assert.equal(g.stats.stormsSheltered, 0);
  assert.ok(!events.some((e) => e.type.startsWith('storm')));
});

test('a storm already under way when the level begins is active from the first minute', () => {
  const g = quiet(createGame('L1-first-sols'));
  g.storms.push(makeStorm({ id: 'early', startMinute: 200, class: 'minor' }));
  const events = step(g, 1);
  assert.ok(events.some((e) => e.type === 'storm-start'));
  assert.ok(!events.some((e) => e.type === 'storm-warning'), 'too late for a warning');
  assert.equal(g.env.stormActive, true);
});

test('overlapping storms are one episode: no all-clear until the last one ends', () => {
  const g = quiet(createGame('L1-first-sols'));
  const first = makeStorm({ id: 'a', startMinute: 600, class: 'minor' });
  const second = makeStorm({ id: 'b', startMinute: first.endMinute - 60, class: 'minor' });
  g.storms.push(first, second);
  applyCommand(g, { type: 'shelter', on: true });

  let events = step(g, first.endMinute + 5 - g.minute);
  assert.ok(!events.some((e) => e.type === 'storm-end' || e.type === 'all-clear'), 'the first storm ending does not end the episode');
  assert.equal(g.shelterOrder, true);

  events = step(g, second.endMinute + 5 - g.minute);
  assert.equal(events.filter((e) => e.type === 'storm-end').length, 1);
  assert.ok(events.some((e) => e.type === 'all-clear'));
  assert.equal(g.stats.stormsTotal, 1);
  assert.equal(g.stats.stormsSheltered, 1);
  assert.equal(g.shelterOrder, false);
});

test('with automatic all-clear switched off the shelter order stays until the player lifts it', () => {
  const g = quiet(createGame('L1-first-sols'));
  const storm = makeStorm({ id: 'a', startMinute: 600, class: 'minor' });
  g.storms.push(storm);
  applyCommand(g, { type: 'autoAllClear', on: false });
  applyCommand(g, { type: 'shelter', on: true });
  const events = step(g, storm.endMinute + 10 - g.minute);
  assert.ok(events.some((e) => e.type === 'storm-end'));
  assert.equal(g.shelterOrder, true);
});

test('a storm still raging when the level ends is settled and counts if everyone was protected', () => {
  const g = quiet(createGame('L1-first-sols'));
  g.storms.push(makeStorm({ id: 'last', startMinute: g.endMinute - 200, class: 'minor' }));
  g.storms.push(makeStorm({ id: 'exact', startMinute: g.endMinute - 500, class: 'minor' }));
  g.storms[1].endMinute = g.endMinute; // ends exactly on the final boundary
  applyCommand(g, { type: 'shelter', on: true });
  while (g.status === 'running') step(g, 500);
  assert.ok(g.storms.every((s) => s.status === 'done'));
  assert.equal(g.stats.stormsTotal, 1);
  assert.equal(g.stats.stormsSheltered, 1);
  const sheltered = evaluateObjectives(g, true).find((o) => o.type === 'stormsSheltered');
  assert.equal(sheltered.status, 'done');
});

// ---------------------------------------------------------------- finding 5: inherited names as ids

test('commands with inherited property names are rejected, not crashed on', () => {
  const g = createGame('L2-storm-season');
  for (const id of ['toString', 'constructor', '__proto__', 'hasOwnProperty', '', null, 42, {}]) {
    assert.equal(applyCommand(g, { type: 'startProject', project: id }).ok, false, `project ${String(id)}`);
    assert.equal(applyCommand(g, { type: 'assign', crew: 'eng', job: id }).ok, false, `job ${String(id)}`);
    assert.equal(applyCommand(g, { type: 'assign', crew: id, job: 'farm' }).ok, false, `crew ${String(id)}`);
  }
  assert.throws(() => roomReport(g, 'toString'), /unknown room/);
  assert.throws(() => createGame('toString'), /unknown level/);
  assert.throws(() => createGame('__proto__'), /unknown level/);
});

// ---------------------------------------------------------------- finding 6: lab power follows the work

test('the lab draws power in exactly the minutes someone works in it', () => {
  const g = quiet(createGame('L1-first-sols'));
  applyCommand(g, { type: 'assign', crew: 'sci', job: 'research' });
  const sci = crewOf(g, 'sci');
  let firstWorkMinuteChecked = false;
  let checkedIdle = false;
  for (let i = 0; i < 700; i++) {
    const before = g.science;
    step(g, 1);
    const working = sci.activity === 'work' && sci.location === 'lab';
    assert.equal(g.power.powered.lab, working, `minute ${g.minute}: lab power must match work`);
    if (working && !firstWorkMinuteChecked) {
      assert.ok(g.science > before, 'science accrues from the very first minute of work');
      firstWorkMinuteChecked = true;
    }
    if (!working && firstWorkMinuteChecked) {
      assert.equal(g.science, before, 'no science while away from the bench');
      checkedIdle = true;
    }
  }
  assert.ok(firstWorkMinuteChecked && checkedIdle, 'the test must see both working and not working');
});

// ---------------------------------------------------------------- finding 7: material ordering at every thickness

test('for the same mass, better materials are never worse — thin or thick', () => {
  const order = ['polyethylene', 'water', 'regolith', 'aluminum'];
  for (const mass of [2, 5, 10, 20, 40, 80, 150, 300]) {
    const report = (material) => shieldingReport([{ material, thicknessM: mass / 100 / MATERIALS[material].density }]);
    for (let i = 0; i + 1 < order.length; i++) {
      const better = report(order[i]);
      const worse = report(order[i + 1]);
      assert.ok(better.gcr < worse.gcr, `${mass} g/cm2: ${order[i]} must beat ${order[i + 1]} against cosmic rays (${better.gcr} vs ${worse.gcr})`);
      assert.ok(better.spe < worse.spe, `${mass} g/cm2: ${order[i]} must beat ${order[i + 1]} against storms`);
    }
  }
  const thinMetal = shieldingReport([{ material: 'aluminum', thicknessM: 0.02 }]);
  assert.ok(thinMetal.gcr > 1, 'a thin metal wall alone slightly raises the cosmic-ray dose');
});

// ---------------------------------------------------------------- findings 8 and 9: honest wording and tags

test('storms dated from near-Earth detections are never presented as measured Mars events', () => {
  const storms = stormsFromDonki(donki, { startDateUtc: '2024-05-08T00:00Z', sols: 14 });
  for (const s of storms) {
    assert.match(s.about, /near Earth/);
    assert.match(s.about, /imagines/);
    assert.match(s.timing.note, /game assumption/);
    assert.doesNotMatch(s.label, /Mars/);
    for (const type of ['storm-warning', 'storm-start']) {
      const line = describeEvent({ type, class: s.class, label: s.label, minutesUntil: 120 });
      assert.doesNotMatch(line.text, /reached Mars|hit Mars|at Mars/i);
    }
  }
  assert.equal(describeEvent({ type: 'storm-start', class: 'extreme', label: 'x' }).text, 'The extreme solar storm has begun. Radiation on the surface is rising.');
});

test('the 20 May 2024 storm: real date, but its hour is tagged as our approximation', () => {
  const g = createGame('L2-storm-season');
  const may20 = g.storms.find((s) => s.id.startsWith('scripted'));
  assert.equal(may20.timing.provenance, PROVENANCE.APPROX);
  assert.match(may20.timing.note, /hour of day is not published/);
  assert.match(may20.about, /Curiosity/);
});

// ---------------------------------------------------------------- finding 10: reference values

test('NASA reference values match the sources they cite', () => {
  assert.equal(NASA.surfaceGravity.value, 3.73);
  assert.match(NASA.surfaceGravity.source, /Surface gravity \(mean\)/);
  assert.equal(NASA.crewFoodPerDay.derived, true);
  assert.match(NASA.crewFoodPerDay.source, /our subtraction/);
  assert.equal(NASA.solarIrradiance.value, 586.2);
  assert.equal(NASA.atmosphereCo2Percent.value, 95.1);
});
