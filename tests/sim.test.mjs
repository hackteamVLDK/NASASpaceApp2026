import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, step, applyCommand, clockAt, roomReport, summary, serialize, warningLeadMinutes, batteryCapacity,
  evaluateObjectives, shortestPath, travelMinutes, sunFactor, depthMetres,
  TUNING, PROJECTS, LEVELS, LEVEL_BY_ID, ROOMS, EDGES, JOBS, CREW, DRONES, SOL_MINUTES,
} from '../src/sim/index.js';
import { evaluateObjective } from '../src/sim/objectives.js';

const L1 = 'L1-wake-the-station';
const L2 = 'L2-storm-season';
const L3 = 'L3-dust-and-darkness';

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ''} expected ${expected} +/- ${tolerance}, got ${actual}`);
const crewOf = (game, id) => game.crew.find((c) => c.id === id);
const ok = (game, cmd) => assert.equal(applyCommand(game, cmd).ok, true, `command failed: ${JSON.stringify(cmd)} — ${applyCommand(game, cmd).error ?? ''}`);
const assign = (game, jobs) => {
  for (const [crew, job] of Object.entries(jobs)) {
    const r = applyCommand(game, { type: 'assign', crew, job });
    assert.equal(r.ok, true, r.error);
  }
};
/** A game with no storms, for tests about something else. */
const quiet = (levelId) => {
  const g = createGame(levelId);
  g.storms = [];
  return g;
};
/** Advance until the mission clock reads sol/hour. */
const runTo = (game, sol, hour = 0, minute = 0) => step(game, (sol - 1) * SOL_MINUTES + hour * 60 + minute - game.minute);
/** Every number anywhere in the state must be finite. */
function assertFinite(value, path = 'state') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} is ${value}`);
  else if (Array.isArray(value)) value.forEach((v, i) => assertFinite(v, `${path}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) assertFinite(v, `${path}.${k}`);
}

// ---------------------------------------------------------------- data integrity

test('level data is internally consistent', () => {
  const types = ['survive', 'noEmergencies', 'droneAwake', 'moduleBuilt', 'modulesBuilt', 'scienceAtLeast', 'maxDoseBelow', 'resourceAtLeast', 'systemAtLeast', 'foodGrownAtLeast', 'stormsSheltered', 'projectDone'];
  assert.ok(LEVELS.length >= 3);
  for (const level of LEVELS) {
    const modules = [...level.modules.online, ...level.modules.unfinished];
    assert.equal(new Set(modules).size, modules.length, `${level.id}: a module is listed twice`);
    for (const id of modules) assert.ok(ROOMS[id]?.module, `${level.id}: ${id} is not a module`);
    for (const id of level.modules.unfinished) assert.ok(ROOMS[id].buildHours > 0, `${level.id}: ${id} needs buildHours`);
    for (const id of ['airlock', 'bedroom', 'dining', 'lifesupport']) assert.ok(level.modules.online.includes(id), `${level.id}: ${id} must be online`);
    for (const id of [...level.drones.awake, ...level.drones.dormant]) assert.ok(DRONES[id], `${level.id}: drone ${id}`);
    for (const [id, job] of Object.entries(level.crew)) assert.ok(CREW[id] && level.jobs.includes(job), `${level.id}: crew ${id} / job ${job}`);
    for (const job of level.jobs) assert.ok(JOBS[job], `${level.id}: job ${job}`);
    for (const p of level.projects) assert.ok(PROJECTS[p], `${level.id}: project ${p}`);
    for (const o of level.objectives) {
      assert.ok(types.includes(o.type), `${level.id}: objective type ${o.type}`);
      if (o.type === 'projectDone') assert.ok(level.projects.includes(o.project), `${level.id}: objective needs project ${o.project}`);
      if (o.type === 'moduleBuilt') assert.ok(modules.includes(o.module), `${level.id}: objective needs module ${o.module}`);
    }
    assert.ok(level.objectives.some((o) => o.primary) && level.objectives.some((o) => !o.primary), `${level.id}: needs primary and bonus objectives`);
    assert.equal(new Set(level.hints.map((h) => h.id)).size, level.hints.length, `${level.id}: duplicate hint ids`);
    if (level.unlocks) assert.ok(LEVEL_BY_ID[level.unlocks], `${level.id}: unlocks unknown level`);
    // Anything outside SCENARIO.md must say so.
    const proposed = modules.filter((id) => !ROOMS[id].inScenario);
    assert.deepEqual(proposed, level.usesProposedModules ?? [], `${level.id}: proposed modules must be declared`);
    if (proposed.length) assert.equal(level.beyondScenario, true);

    const game = createGame(level.id);
    for (const s of game.storms) assert.ok(s.startMinute >= 0 && s.startMinute < game.endMinute, `${level.id}: storm ${s.id} outside the level`);
    assert.doesNotThrow(() => evaluateObjectives(game));
  }
});

test('the base graph connects every room, and routes are the shortest', () => {
  for (const id of Object.keys(ROOMS)) assert.ok(shortestPath('bedroom', id).minutes >= 0);
  assert.deepEqual(shortestPath('away', 'dining').nodes, ['outside', 'airlock', 'shaft1', 'shaft2', 'dining']);
  assert.equal(travelMinutes('away', 'dining'), 60 + 10 + 10 + 5 + 6);
  assert.equal(travelMinutes('lab', 'garage'), travelMinutes('garage', 'lab'));
  assert.equal(travelMinutes('dining', 'dining'), 0);
  assert.throws(() => shortestPath('dining', 'moon'), /unknown room/);
  for (const [a, b, minutes] of EDGES) assert.ok(ROOMS[a] && ROOMS[b] && minutes > 0);
});

// ---------------------------------------------------------------- determinism and time

test('the clock follows Mars time', () => {
  assert.deepEqual({ ...clockAt(0) }, { sol: 1, hour: 0, minute: 0, minuteOfSol: 0, hourFloat: 0, isDay: false });
  const c = clockAt(SOL_MINUTES * 2 + 13 * 60 + 5);
  assert.equal(c.sol, 3);
  assert.equal(c.hour, 13);
  assert.equal(c.minute, 5);
  assert.equal(c.isDay, true);
  assert.equal(sunFactor(12), 1);
  assert.equal(sunFactor(3), 0);
  assert.equal(sunFactor(TUNING.sunriseHour), 0);
});

test('same level, seed and commands give exactly the same game', () => {
  const play = (seed) => {
    const g = createGame(L2, { seed });
    step(g, 500);
    applyCommand(g, { type: 'assign', crew: 'cmdr', job: 'build' });
    applyCommand(g, { type: 'startProject', project: 'antenna' });
    step(g, 3000);
    applyCommand(g, { type: 'shelter', on: true });
    step(g, 2500);
    return serialize(g);
  };
  assert.equal(play(7), play(7));
});

test('stepping in one go or minute by minute is the same', () => {
  const start = () => {
    const g = createGame(L1);
    ok(g, { type: 'wakeDrone', drone: 'drone-01' });
    ok(g, { type: 'buildModule', module: 'power' });
    assign(g, { cmdr: 'solar', eng: 'build' });
    return g;
  };
  const a = start();
  const b = start();
  step(a, 2000);
  for (let i = 0; i < 2000; i++) step(b, 1);
  assert.equal(serialize(a), serialize(b));
});

test('every level runs to the end without producing NaN or negative stores', () => {
  for (const level of LEVELS) {
    const g = createGame(level.id);
    while (g.status === 'running') {
      step(g, 720);
      assertFinite(g);
      for (const v of Object.values(g.resources)) assert.ok(v >= 0);
      for (const c of g.crew) for (const v of Object.values(c.stats)) assert.ok(v >= 0 && v <= 100);
    }
    assert.ok(g.result && ['complete', 'failed'].includes(g.status));
    assert.equal(step(g, 100).length, 0, 'a finished level does not advance');
  }
});

// ---------------------------------------------------------------- life support

test('four people breathe about 3.45 kg of oxygen per sol (NASA rate)', () => {
  const g = createGame(L1);
  g.resources.waterL = 0; // no water: the generator cannot run
  g.resources.batteryKwh = 0;
  const before = g.resources.o2Kg;
  step(g, 60);
  near(before - g.resources.o2Kg, (4 * 0.84 * (88775.244 / 86400)) / 24, 0.002);
});

test('the oxygen generator turns water into oxygen at the chemical ratio', () => {
  const run = (tankFull) => {
    const g = createGame(L1);
    g.resources.batteryKwh = 80;
    if (tankFull) g.resources.o2Kg = TUNING.o2TankKg;
    const before = { ...g.resources };
    step(g, 1);
    return { o2: g.resources.o2Kg - before.o2Kg, water: before.waterL - g.resources.waterL };
  };
  const making = run(false);
  const full = run(true);
  const breathed = (4 * TUNING.o2KgPerCrewDay * 88775.244) / 86400 / SOL_MINUTES;
  const made = making.o2 + breathed; // level 1 has no plants
  near(made, (TUNING.o2GenKgPerSol / SOL_MINUTES) * 0.8, 1e-5, 'level 1 starts with the generator at 80%');
  // With a full tank the generator is off, so the difference in water use is pure electrolysis.
  near(making.water - full.water, made * TUNING.electrolysisWaterPerO2, 1e-9, '1.125 L of water per kg of oxygen');
});

test('recycling keeps almost all the water; a worn recycler or no power loses it', () => {
  const lossOverOneHour = (prepare) => {
    const g = createGame(L1);
    g.resources.batteryKwh = 85;
    prepare(g);
    const before = g.resources.waterL;
    step(g, 60);
    return before - g.resources.waterL;
  };
  const used = (4 * TUNING.waterLPerCrewDay * 88775.244) / 86400 / 24; // litres per Mars-hour for four people
  const fresh = lossOverOneHour((g) => (g.systems.recyclerEff = 1));
  const worn = lossOverOneHour((g) => (g.systems.recyclerEff = 0.5));
  // Everything else (electrolysis) is identical, so the difference is pure recycling.
  near(worn - fresh, used * TUNING.waterRecoveryMax * 0.5, 0.01);
  const blackout = lossOverOneHour((g) => (g.resources.batteryKwh = 0));
  near(blackout, used, 0.01, 'with no power nothing is recovered');
  near(used, 0.65, 0.01);
});

test('power: the battery drains at night and charges at noon', () => {
  const g = quiet(L2);
  runTo(g, 1, 12);
  g.resources.batteryKwh = 100; // leave room to charge
  const noon = g.resources.batteryKwh;
  step(g, 60);
  assert.ok(g.resources.batteryKwh > noon, 'charging at midday');
  assert.ok(g.power.genKw > 30);
  runTo(g, 2, 1);
  const night = g.resources.batteryKwh;
  step(g, 60);
  assert.ok(g.resources.batteryKwh < night, 'draining at night');
  assert.equal(g.power.genKw, 0);
});

test('power: when the battery runs low the lab stops first and basic life support last', () => {
  const g = quiet(L3);
  runTo(g, 1, 10); // mid-morning: the scientist is working in the lab
  assert.equal(crewOf(g, 'sci').activity, 'work');
  const shedAt = (kwh) => {
    g.resources.batteryKwh = kwh;
    g.resources.o2Kg = 10; // the generator wants power, but the tank is not critically low
    step(g, 1);
    return [...g.power.shed].sort().join('+') || 'none';
  };
  const cap = batteryCapacity(g);
  assert.equal(cap, TUNING.batteryKwh);
  assert.equal(shedAt(cap * 0.5), 'none');
  assert.equal(shedAt(cap * (TUNING.reserveLab - 0.03)), 'lab');
  assert.equal(shedAt(cap * (TUNING.reserveGreenhouse - 0.02)), 'greenhouse+lab');
  assert.equal(shedAt(cap * (TUNING.reserveRecycler - 0.015)), 'greenhouse+lab+recycler');
  assert.equal(shedAt(cap * (TUNING.reserveO2gen - 0.05)), 'greenhouse+lab+o2gen+recycler');
  assert.equal(g.alerts.blackout, false, 'basic life support keeps running on the reserve');

  runTo(g, 2, 1); // night: no sun at all
  g.resources.batteryKwh = 0;
  step(g, 1);
  assert.ok(g.power.shed.includes('base'));
  assert.equal(g.alerts.blackout, true);
});

test('a flickering shortage counts as one emergency, not many', () => {
  const g = createGame(L1);
  for (let i = 0; i < 40; i++) {
    g.resources.foodKg = i % 2 ? 5 : 0; // pantry empty every other minute
    step(g, 1);
  }
  assert.equal(g.stats.emergencies, 1);
  g.resources.foodKg = 20;
  const events = step(g, TUNING.emergencyGraceMinutes + 5);
  assert.ok(events.some((e) => e.type === 'emergency-over' && e.kind === 'noFood'));
  g.resources.foodKg = 0;
  step(g, 1);
  assert.equal(g.stats.emergencies, 2, 'after a real recovery, a new shortage is a new emergency');
});

// ---------------------------------------------------------------- crew

test('the crew follow the daily schedule', () => {
  const g = quiet(L2);
  assign(g, { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'research' });
  runTo(g, 1, 6, 40);
  assert.ok(g.crew.every((c) => c.location === 'dining'), 'breakfast in the Dining Room');
  runTo(g, 1, 10);
  assert.deepEqual(g.crew.map((c) => c.location), ['outside', 'lifesupport', 'hydroponics', 'lab']);
  assert.ok(g.crew.every((c) => c.activity === 'work'));
  runTo(g, 1, 17, 45);
  assert.ok(g.crew.every((c) => c.activity === 'exercise'), 'exercise hour');
  runTo(g, 2, 2);
  assert.ok(g.crew.every((c) => c.activity === 'sleep' && c.location === 'bedroom'));
});

test('work changes the base: farming, maintenance, cleaning, research, ice', () => {
  const idle = quiet(L2);
  const busy = quiet(L2);
  assign(idle, { cmdr: 'rest', eng: 'rest', bot: 'rest', sci: 'rest' });
  assign(busy, { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'explore' });
  for (const g of [idle, busy]) g.systems.solarClean = 0.6;
  runTo(idle, 2, 0);
  runTo(busy, 2, 0);
  assert.ok(busy.stats.foodGrownKg > idle.stats.foodGrownKg + 1);
  assert.ok(busy.systems.o2GenEff > idle.systems.o2GenEff + 0.05);
  assert.ok(busy.systems.solarClean > idle.systems.solarClean + 0.05);
  assert.ok(busy.science > 5 && idle.science === 0);
  assert.ok(busy.stats.iceMinedL > 15);
});

test('specialists do their own job faster', () => {
  const run = (who) => {
    const g = quiet(L2);
    assign(g, { cmdr: 'rest', eng: 'rest', bot: 'rest', sci: 'rest', [who]: 'research' });
    runTo(g, 1, 17);
    return g.science;
  };
  const scientist = run('sci');
  const commander = run('cmdr');
  const engineer = run('eng');
  assert.ok(scientist > commander && commander > engineer);
  near(scientist / engineer, TUNING.skillBonus, 0.05);
});

test('a field explorer keeps eating and does not starve (regression)', () => {
  const g = quiet(L2);
  assign(g, { sci: 'explore' });
  runTo(g, 8, 0);
  const sci = crewOf(g, 'sci');
  assert.ok(sci.stats.nutrition > 50, `explorer nutrition ${sci.stats.nutrition}`);
  assert.equal(sci.stats.health, 100);
  assert.ok(g.science > 40);
});

test('without food the crew go hungry and health suffers', () => {
  const g = createGame(L1);
  for (let i = 0; i < 3 * SOL_MINUTES && g.status === 'running'; i++) {
    g.resources.foodKg = 0;
    step(g, 1);
  }
  assert.ok(g.crew.every((c) => c.stats.nutrition < 10));
  assert.ok(g.crew.some((c) => c.stats.health < 100));
});

// ---------------------------------------------------------------- radiation in play

test('shelter order: surface workers go below, underground workers keep working', () => {
  const g = quiet(L2);
  assign(g, { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'explore' });
  runTo(g, 1, 10);
  ok(g, { type: 'shelter', on: true });
  step(g, 120);
  assert.equal(crewOf(g, 'cmdr').location, 'dining', 'the panel cleaner waits in the Dining Room');
  assert.equal(crewOf(g, 'sci').location, 'dining', 'so does the explorer');
  assert.equal(crewOf(g, 'eng').location, 'lifesupport');
  assert.equal(crewOf(g, 'bot').location, 'hydroponics');
  assert.equal(crewOf(g, 'bot').activity, 'work', 'underground work carries on');
  ok(g, { type: 'shelter', on: false }); // it is noon: lunch first, then back to work
  step(g, 120);
  assert.equal(crewOf(g, 'cmdr').location, 'outside');
});

test('a recalled explorer turns around at once and reaches shelter', () => {
  const g = quiet(L2);
  assign(g, { sci: 'explore' });
  runTo(g, 1, 7, 50); // on the long leg out to the site
  const sci = crewOf(g, 'sci');
  assert.equal(sci.move.to, 'away');
  const walked = sci.move.total - sci.move.left;
  ok(g, { type: 'shelter', on: true });
  step(g, 1);
  assert.equal(sci.move.to, 'outside', 'turned back instead of finishing the outbound leg');
  step(g, walked + travelMinutes('outside', 'dining'));
  assert.equal(sci.location, 'dining');
});

test('solar storm: the shelter order protects the crew, ignoring it costs dose', () => {
  const play = (shelter) => {
    const g = createGame(L1);
    assign(g, { cmdr: 'solar', eng: 'lifesupport' });
    const seen = [];
    while (g.status === 'running') {
      for (const e of step(g, 5)) {
        seen.push(e.type);
        if (e.type === 'storm-warning' && shelter) applyCommand(g, { type: 'shelter', on: true });
      }
    }
    return { g, seen };
  };
  const safe = play(true);
  const exposed = play(false);
  assert.ok(safe.seen.includes('storm-warning') && safe.seen.includes('storm-start') && safe.seen.includes('storm-end'));
  assert.ok(safe.seen.includes('all-clear'), 'the shelter order lifts itself when the storm ends');
  assert.equal(safe.g.stats.stormsSheltered, 1);
  assert.equal(exposed.g.stats.stormsSheltered, 0);
  assert.ok(crewOf(exposed.g, 'cmdr').doseMsv > crewOf(safe.g, 'cmdr').doseMsv + 0.5, 'the panel cleaner caught outside takes a real dose');
  assert.ok(crewOf(exposed.g, 'eng').doseMsv < 1.2 * crewOf(safe.g, 'eng').doseMsv, 'the engineer underground is barely affected either way');
  assert.equal(safe.g.shelterOrder, false);
});

test('time above ground costs dose even on a quiet day', () => {
  const g = quiet(L2);
  assign(g, { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'research' });
  runTo(g, 3, 0);
  const dose = Object.fromEntries(g.crew.map((c) => [c.id, c.doseMsv]));
  assert.ok(dose.cmdr > 3 * dose.eng, 'the surface worker takes several times more than anyone underground');
  near(dose.eng, dose.bot, 0.002, 'everyone underground gets the same small dose');
  assert.ok(dose.sci > 0, 'never zero');
});

test('going over the radiation budget grounds an astronaut but does not make them sick', () => {
  const g = quiet(L2);
  assign(g, { sci: 'research' });
  runTo(g, 1, 9);
  const sci = crewOf(g, 'sci');
  sci.doseMsv = g.doseBudgetMsv * TUNING.doseWarningFraction - 0.0001;
  assert.ok(step(g, 60).some((e) => e.type === 'dose-warning' && e.crew === 'sci'));
  sci.doseMsv = g.doseBudgetMsv - 0.0001;
  const events = step(g, 60);
  assert.ok(events.some((e) => e.type === 'crew-grounded' && e.crew === 'sci'));
  assert.equal(sci.grounded, true);
  runTo(g, 2, 10);
  const science = g.science;
  step(g, 120);
  assert.equal(g.science, science, 'a grounded scientist does no research');
  assert.equal(sci.stats.health, 100, 'no invented radiation sickness');
  assert.equal(evaluateObjective(g, { type: 'maxDoseBelow', value: g.doseBudgetMsv }).status, 'failed');
});

// ---------------------------------------------------------------- commands

test('commands are validated', () => {
  const g = createGame(L1);
  assert.equal(applyCommand(g, { type: 'assign', crew: 'nobody', job: 'solar' }).ok, false);
  assert.equal(applyCommand(g, { type: 'assign', crew: 'eng', job: 'juggling' }).ok, false);
  assert.equal(applyCommand(g, { type: 'assign', crew: 'bot', job: 'farm' }).ok, false, 'there is no hydroponics bay in level 1');
  assert.match(applyCommand(g, { type: 'assign', crew: 'sci', job: 'research' }).error, /Research & Comms Lab, which is not finished/);
  assert.match(applyCommand(g, { type: 'assign', crew: 'sci', job: 'explore' }).error, /Rover Garage/);
  assert.equal(applyCommand(g, { type: 'startProject', project: 'berm' }).ok, false);
  assert.equal(applyCommand(g, { type: 'buildModule', module: 'bedroom' }).ok, false, 'already finished');
  assert.equal(applyCommand(g, { type: 'buildModule', module: 'hydroponics' }).ok, false, 'not part of level 1');
  assert.equal(applyCommand(g, { type: 'wakeDrone', drone: 'drone-99' }).ok, false);
  assert.equal(applyCommand(g, { type: 'pauseConstruction' }).ok, false);
  assert.equal(applyCommand(g, { type: 'teleport' }).ok, false);
  assert.equal(applyCommand(g, null).ok, false);
  ok(g, { type: 'assign', crew: 'eng', job: 'solar' });
  assert.equal(crewOf(g, 'eng').job, 'solar');
});

// ---------------------------------------------------------------- the scenario start: modules, drones, construction

test('level 1 begins exactly as SCENARIO.md describes the base', () => {
  const g = createGame(L1);
  const status = (id) => g.modules[id]?.status;
  for (const id of ['airlock', 'bedroom', 'dining', 'lifesupport']) assert.equal(status(id), 'online', `${id}: left wing and airlock are operational`);
  for (const id of ['workshop', 'lab', 'power', 'garage']) assert.equal(status(id), 'unfinished', `${id}: right wing is unfinished`);
  assert.equal(status('hydroponics'), undefined, 'nothing outside the scenario exists in level 1');
  assert.ok(g.drones.every((d) => d.status === 'dormant'), 'the drones went to sleep');
  assert.deepEqual(g.drones.map((d) => d.id), ['drone-01', 'drone-02', 'drone-03']);
  assert.ok(g.systems.solarClean <= 0.5, 'dust-covered solar panels');
  assert.equal(g.crew.length, 4, 'people arrived');
  assert.equal(batteryCapacity(g), TUNING.emergencyBatteryKwh, 'no battery bank until Battery & Heating is built');
});

test('people build; an awake drone helps, by daylight only', () => {
  const hoursAfter = (prepare, untilHour) => {
    const g = quiet(L1);
    ok(g, { type: 'buildModule', module: 'garage' }); // the biggest job: it will not finish during the test
    prepare(g);
    runTo(g, 1, untilHour);
    return g.modules.garage.hoursDone;
  };
  assert.equal(hoursAfter(() => {}, 18), 0, 'nobody assigned and no drone awake: nothing gets built');

  const drone = hoursAfter((g) => ok(g, { type: 'wakeDrone', drone: 'drone-01' }), 18);
  near(drone, 12, 0.1, 'one drone gives one work-hour per daylight hour (06:00 to 18:00)');
  const droneAtNight = hoursAfter((g) => ok(g, { type: 'wakeDrone', drone: 'drone-01' }), 23);
  near(droneAtNight, drone, 0.05, 'drones rest at night');

  const engineer = hoursAfter((g) => assign(g, { eng: 'build' }), 18);
  assert.ok(engineer > 8, `an engineer builds a good part of a day's work (${engineer})`);
  const both = hoursAfter((g) => {
    ok(g, { type: 'wakeDrone', drone: 'drone-01' });
    assign(g, { eng: 'build' });
  }, 18);
  near(both, drone + engineer, 0.2, 'people and drones add up');

  const botanist = hoursAfter((g) => assign(g, { bot: 'build' }), 18);
  near(engineer / botanist, TUNING.skillBonus, 0.05, 'the engineer is the best builder');
});

test('finishing a module switches on what it is for', () => {
  const g = quiet(L1);
  for (const id of ['drone-01', 'drone-02', 'drone-03']) ok(g, { type: 'wakeDrone', drone: id });
  assign(g, { eng: 'build', cmdr: 'build' });
  const built = [];
  const buildNext = (module) => {
    ok(g, { type: 'buildModule', module });
    assert.equal(applyCommand(g, { type: 'buildModule', module: 'workshop' }).ok, false, 'one construction at a time');
    while (g.modules[module].status !== 'online' && g.status === 'running') {
      for (const e of step(g, 10)) if (e.type === 'module-built') built.push(e.module);
    }
  };

  assert.equal(batteryCapacity(g), TUNING.emergencyBatteryKwh);
  buildNext('power');
  assert.equal(batteryCapacity(g), TUNING.batteryKwh, 'Battery & Heating brings the full battery bank');

  const leadBefore = warningLeadMinutes(g);
  buildNext('lab');
  assert.equal(warningLeadMinutes(g), LEVEL_BY_ID[L1].warningLeadMinutes, 'the Comms Lab restores full storm warnings');
  assert.equal(leadBefore, Math.round(LEVEL_BY_ID[L1].warningLeadMinutes * TUNING.noCommsLeadFactor));
  assign(g, { sci: 'research' });

  buildNext('garage');
  assign(g, { bot: 'explore' });

  assert.equal(applyCommand(g, { type: 'startProject', project: 'antenna' }).ok, false, 'no upgrades in level 1');
  buildNext('workshop');
  assert.deepEqual(built, ['power', 'lab', 'garage', 'workshop']);
  assert.equal(g.stats.modulesBuilt, 4);
  assert.equal(g.construction, null);
  assert.ok(g.achievements.includes('builder') && g.achievements.includes('wake-up'));
  assert.equal(roomReport(g, 'lab').module.status, 'online');
});

test('upgrades need the Workshop, are paid for once, and improve shielding or warning time', () => {
  const g = quiet(L2);
  const water = g.resources.waterL;
  ok(g, { type: 'startProject', project: 'waterRoof' });
  assert.equal(g.resources.waterL, water - PROJECTS.waterRoof.costs.waterL);
  assert.equal(applyCommand(g, { type: 'startProject', project: 'berm' }).ok, false, 'one construction at a time');
  ok(g, { type: 'pauseConstruction' });
  ok(g, { type: 'startProject', project: 'waterRoof' });
  assert.equal(g.resources.waterL, water - PROJECTS.waterRoof.costs.waterL, 'resuming does not charge again');

  const before = roomReport(g, 'airlock').shielding.spe;
  const deep = roomReport(g, 'bedroom').shielding.arealDensity;
  assign(g, { eng: 'build', cmdr: 'build' });
  const events = step(g, SOL_MINUTES);
  assert.ok(events.some((e) => e.type === 'project-done' && e.project === 'waterRoof'));
  assert.equal(g.projects.waterRoof.status, 'done');
  assert.ok(roomReport(g, 'airlock').shielding.spe < before, 'the dome is better shielded');
  assert.equal(roomReport(g, 'bedroom').shielding.arealDensity, deep, 'underground rooms are unchanged');

  const lead = warningLeadMinutes(g);
  ok(g, { type: 'startProject', project: 'antenna' });
  step(g, SOL_MINUTES);
  assert.equal(g.projects.antenna.status, 'done');
  assert.equal(warningLeadMinutes(g), 2 * lead, 'the repaired antenna doubles the warning time');

  const poor = quiet(L2);
  poor.resources.waterL = 20;
  assert.match(applyCommand(poor, { type: 'startProject', project: 'waterRoof' }).error, /Not enough water/);
  assert.equal(poor.resources.waterL, 20);

  const noWorkshop = quiet(L2);
  noWorkshop.modules.workshop.status = 'unfinished';
  assert.match(applyCommand(noWorkshop, { type: 'startProject', project: 'antenna' }).error, /Workshop/);
});

// ---------------------------------------------------------------- objectives and results

test('level 1: doing nothing earns one star, playing well earns three', () => {
  const idle = createGame(L1);
  while (idle.status === 'running') step(idle, 600);
  assert.equal(idle.status, 'complete', 'level 1 cannot be lost by doing nothing');
  assert.equal(idle.result.stars, 1);

  const good = createGame(L1);
  ok(good, { type: 'wakeDrone', drone: 'drone-01' });
  assign(good, { cmdr: 'solar', eng: 'build', bot: 'lifesupport', sci: 'build' });
  const order = ['power', 'workshop', 'lab', 'garage'];
  while (good.status === 'running') {
    if (!good.construction) {
      const next = order.find((id) => good.modules[id].status !== 'online');
      if (next) ok(good, { type: 'buildModule', module: next });
      else assign(good, { eng: 'lifesupport', sci: 'research', bot: 'solar' });
    }
    for (const e of step(good, 5)) if (e.type === 'storm-warning') applyCommand(good, { type: 'shelter', on: true });
  }
  assert.equal(good.result.stars, 3, JSON.stringify(good.result.objectives.map((o) => [o.id, o.status, o.detail])));
  assert.ok(good.result.score.total > idle.result.score.total);
  assert.ok(good.achievements.includes('storm-safe') && good.achievements.includes('builder'));
});

test('the mission is aborted if an astronaut reaches zero health', () => {
  const g = createGame(L1);
  g.resources.o2Kg = 0;
  g.resources.waterL = 0;
  let events = [];
  while (g.status === 'running') events = events.concat(step(g, 30));
  assert.equal(g.status, 'failed');
  assert.equal(g.result.stars, 0);
  assert.ok(events.some((e) => e.type === 'emergency' && e.kind === 'noO2'));
  assert.ok(events.some((e) => e.type === 'level-failed'));
  assert.ok(g.minute < g.endMinute);
});

test('hints fire once, in response to what is happening', () => {
  const g = createGame(L1);
  ok(g, { type: 'wakeDrone', drone: 'drone-01' });
  const first = applyCommand(g, { type: 'buildModule', module: 'power' });
  assert.ok(first.events.some((e) => e.type === 'construction-started'));
  const hints = [];
  while (g.status === 'running') for (const e of step(g, 30)) if (e.type === 'hint') hints.push(e.id);
  assert.equal(new Set(hints).size, hints.length, 'no hint is shown twice');
  for (const id of ['panels', 'meals', 'first-night', 'o2gen']) assert.ok(hints.includes(id), `missing hint ${id}`);
  assert.ok(g.log.length > 5 && g.log.every((l) => typeof l.text === 'string' && l.text.length > 0));
});

test('summary and room report expose what the UI needs', () => {
  const g = createGame(L2);
  step(g, 300);
  const s = summary(g);
  assert.equal(s.crew.length, 4);
  assert.ok(s.reserves.o2Sols > 1 && s.reserves.foodSols > 1);
  assert.equal(s.modules.lab, 'online');
  assert.deepEqual(s.drones.map((d) => d.status), ['awake', 'dormant', 'dormant']);
  const below = roomReport(g, 'bedroom');
  const dome = roomReport(g, 'airlock');
  assert.ok(below.doseRateMsvPerHour < 0.1 * dome.doseRateMsvPerHour);
  near(below.depthMetres, 5.1, 1e-9, 'the first floor lies under 5.1 m of soil');
  assert.equal(depthMetres('garage'), 13.2);
  assert.ok(below.shielding.arealDensity > 700);
  assert.equal(below.zoneLabel, 'Underground');
  assert.equal(dome.zoneLabel, 'On the surface, inside the dome');
  assert.throws(() => roomReport(g, 'attic'), /unknown room/);
});
