import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, step, applyCommand, clockAt, roomReport, summary, serialize,
  evaluateObjectives, shortestPath, travelMinutes, sunFactor,
  TUNING, PROJECTS, LEVELS, LEVEL_BY_ID, ROOMS, EDGES, JOBS, CREW, SOL_MINUTES,
} from '../src/sim/index.js';
import { evaluateObjective } from '../src/sim/objectives.js';

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ''} expected ${expected} +/- ${tolerance}, got ${actual}`);
const crewOf = (game, id) => game.crew.find((c) => c.id === id);
const assign = (game, jobs) => {
  for (const [crew, job] of Object.entries(jobs)) assert.equal(applyCommand(game, { type: 'assign', crew, job }).ok, true);
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
  const types = ['survive', 'noEmergencies', 'scienceAtLeast', 'maxDoseBelow', 'resourceAtLeast', 'foodGrownAtLeast', 'stormsSheltered', 'projectDone'];
  assert.ok(LEVELS.length >= 3);
  for (const level of LEVELS) {
    for (const [id, job] of Object.entries(level.crew)) assert.ok(CREW[id] && level.jobs.includes(job), `${level.id}: crew ${id} / job ${job}`);
    for (const job of level.jobs) assert.ok(JOBS[job], `${level.id}: job ${job}`);
    for (const p of level.projects) assert.ok(PROJECTS[p], `${level.id}: project ${p}`);
    for (const o of level.objectives) {
      assert.ok(types.includes(o.type), `${level.id}: objective type ${o.type}`);
      if (o.type === 'projectDone') assert.ok(level.projects.includes(o.project), `${level.id}: objective needs project ${o.project}`);
    }
    assert.ok(level.objectives.some((o) => o.primary) && level.objectives.some((o) => !o.primary), `${level.id}: needs primary and bonus objectives`);
    assert.equal(new Set(level.hints.map((h) => h.id)).size, level.hints.length, `${level.id}: duplicate hint ids`);
    if (level.unlocks) assert.ok(LEVEL_BY_ID[level.unlocks], `${level.id}: unlocks unknown level`);
    assert.equal(level.lore.loreTbd, true, `${level.id}: story text is still a marked placeholder`);

    const game = createGame(level.id);
    for (const s of game.storms) assert.ok(s.startMinute >= 0 && s.startMinute < game.endMinute, `${level.id}: storm ${s.id} outside the level`);
    assert.doesNotThrow(() => evaluateObjectives(game));
  }
});

test('the base graph connects every room, and routes are the shortest', () => {
  for (const id of Object.keys(ROOMS)) assert.ok(shortestPath('quarters', id).minutes >= 0);
  assert.deepEqual(shortestPath('away', 'shelter').nodes, ['outside', 'airlock', 'hub0', 'hub1', 'hub2', 'shelter']);
  assert.equal(travelMinutes('away', 'shelter'), 60 + 10 + 6 + 8 + 8 + 8);
  assert.equal(travelMinutes('lab', 'greenhouse'), travelMinutes('greenhouse', 'lab'));
  assert.equal(travelMinutes('galley', 'galley'), 0);
  assert.throws(() => shortestPath('galley', 'moon'), /unknown room/);
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
    const g = createGame('L2-storm-season', { seed });
    step(g, 500);
    applyCommand(g, { type: 'assign', crew: 'cmdr', job: 'explore' });
    applyCommand(g, { type: 'startProject', project: 'berm' });
    step(g, 3000);
    applyCommand(g, { type: 'shelter', on: true });
    step(g, 2500);
    return serialize(g);
  };
  assert.equal(play(7), play(7));
});

test('stepping in one go or minute by minute is the same', () => {
  const a = createGame('L1-first-sols');
  const b = createGame('L1-first-sols');
  assign(a, { cmdr: 'solar', sci: 'explore' });
  assign(b, { cmdr: 'solar', sci: 'explore' });
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
    // Untouched, the first two levels limp to the end; the third one demands action.
    if (level.order <= 2) {
      assert.equal(g.minute, g.endMinute, `${level.id} should run its full length when untouched`);
      assert.equal(g.result.stars, 1);
    }
    assert.ok(g.result && ['complete', 'failed'].includes(g.status));
    assert.equal(step(g, 100).length, 0, 'a finished level does not advance');
  }
});

// ---------------------------------------------------------------- life support

test('four people breathe about 3.45 kg of oxygen per sol (NASA rate)', () => {
  const g = createGame('L1-first-sols');
  g.resources.waterL = 0; // no water: the generator cannot run
  g.resources.batteryKwh = 0;
  const before = g.resources.o2Kg;
  runTo(g, 1, 6, 0);
  step(g, 60);
  near(before - g.resources.o2Kg, (4 * 0.84 * (88775.244 / 86400)) / 24, 0.002);
});

test('the oxygen generator turns water into oxygen at the chemical ratio', () => {
  const run = (tankFull) => {
    const g = createGame('L1-first-sols');
    g.resources.batteryKwh = 200;
    if (tankFull) g.resources.o2Kg = TUNING.o2TankKg;
    const before = { ...g.resources };
    step(g, 1);
    return { o2: g.resources.o2Kg - before.o2Kg, water: before.waterL - g.resources.waterL };
  };
  const making = run(false);
  const full = run(true);
  const breathed = (4 * TUNING.o2KgPerCrewDay * 88775.244) / 86400 / SOL_MINUTES;
  const fromPlants = (TUNING.cropBaseKgPerSol / SOL_MINUTES) * TUNING.cropO2PerKgFood;
  const made = making.o2 + breathed - fromPlants;
  near(made, (TUNING.o2GenKgPerSol / SOL_MINUTES) * 0.8, 1e-5, 'level 1 starts with the generator at 80%');
  // With a full tank the generator is off, so the difference in water use is pure electrolysis.
  near(making.water - full.water, made * TUNING.electrolysisWaterPerO2, 1e-9, '1.125 L of water per kg of oxygen');
});

test('recycling keeps almost all the water; a worn recycler or no power loses it', () => {
  const lossOverOneHour = (prepare) => {
    const g = createGame('L1-first-sols');
    g.resources.batteryKwh = 250;
    prepare(g);
    const before = g.resources.waterL;
    step(g, 60);
    return before - g.resources.waterL;
  };
  const used = (4 * TUNING.waterLPerCrewDay * 88775.244) / 86400 / 24; // litres per Mars-hour for four people
  const fresh = lossOverOneHour((g) => (g.systems.recyclerEff = 1));
  const worn = lossOverOneHour((g) => (g.systems.recyclerEff = 0.5));
  // Everything else (electrolysis, greenhouse) is identical, so the difference is pure recycling.
  near(worn - fresh, used * TUNING.waterRecoveryMax * 0.5, 0.01);
  const blackout = lossOverOneHour((g) => (g.resources.batteryKwh = 0));
  near(blackout, used, 0.01, 'with no power nothing is recovered');
  near(used, 0.65, 0.01);
});

test('power: the battery drains at night and charges at noon', () => {
  const g = createGame('L1-first-sols');
  runTo(g, 1, 12);
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
  const g = createGame('L3-dust-and-darkness');
  runTo(g, 1, 10); // mid-morning: the scientist is working in the lab
  assert.equal(crewOf(g, 'sci').activity, 'work');
  const shedAt = (kwh) => {
    g.resources.batteryKwh = kwh;
    g.resources.o2Kg = 10; // the generator wants power, but the tank is not critically low
    step(g, 1);
    return [...g.power.shed].sort().join('+') || 'none';
  };
  const cap = TUNING.batteryKwh;
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
  const g = createGame('L1-first-sols');
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
  const g = createGame('L1-first-sols');
  assign(g, { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'research' });
  runTo(g, 1, 6, 40);
  assert.ok(g.crew.every((c) => c.location === 'galley'), 'breakfast in the galley');
  runTo(g, 1, 10);
  assert.deepEqual(g.crew.map((c) => c.location), ['outside', 'lifesupport', 'greenhouse', 'lab']);
  assert.ok(g.crew.every((c) => c.activity === 'work'));
  runTo(g, 1, 17, 45);
  assert.ok(g.crew.every((c) => c.activity === 'exercise'), 'exercise hour');
  runTo(g, 2, 2);
  assert.ok(g.crew.every((c) => c.activity === 'sleep' && c.location === 'quarters'));
});

test('work changes the base: farming, maintenance, cleaning, research, ice', () => {
  const idle = createGame('L1-first-sols');
  const busy = createGame('L1-first-sols');
  assign(busy, { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'explore' });
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
    const g = createGame('L1-first-sols');
    assign(g, { [who]: 'research' });
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
  const g = createGame('L2-storm-season');
  assign(g, { sci: 'explore' });
  for (const s of g.storms) s.status = 'done'; // quiet weather
  runTo(g, 8, 0);
  const sci = crewOf(g, 'sci');
  assert.ok(sci.stats.nutrition > 50, `explorer nutrition ${sci.stats.nutrition}`);
  assert.equal(sci.stats.health, 100);
  assert.ok(g.science > 40);
});

test('without food the crew go hungry and health suffers', () => {
  const g = createGame('L1-first-sols');
  g.resources.foodKg = 0;
  g.power.powered.greenhouse = false;
  for (let i = 0; i < 3 * SOL_MINUTES && g.status === 'running'; i++) {
    g.resources.foodKg = 0;
    step(g, 1);
  }
  assert.ok(g.crew.every((c) => c.stats.nutrition < 10));
  assert.ok(g.crew.some((c) => c.stats.health < 100));
});

// ---------------------------------------------------------------- radiation in play

test('shelter order: surface workers go below, underground workers keep working', () => {
  const g = createGame('L1-first-sols');
  assign(g, { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'research' });
  runTo(g, 1, 10);
  assert.equal(applyCommand(g, { type: 'shelter', on: true }).ok, true);
  step(g, 60);
  assert.equal(crewOf(g, 'cmdr').location, 'shelter');
  assert.equal(crewOf(g, 'bot').location, 'shelter');
  assert.equal(crewOf(g, 'eng').location, 'lifesupport');
  assert.equal(crewOf(g, 'sci').location, 'lab');
  assert.equal(crewOf(g, 'sci').activity, 'work');
  applyCommand(g, { type: 'shelter', on: false });
  step(g, 60);
  assert.equal(crewOf(g, 'bot').location, 'greenhouse');
});

test('a recalled explorer turns around at once and reaches shelter', () => {
  const g = createGame('L1-first-sols');
  assign(g, { sci: 'explore' });
  runTo(g, 1, 7, 50); // on the long leg out to the site
  const sci = crewOf(g, 'sci');
  assert.equal(sci.move.to, 'away');
  const walked = sci.move.total - sci.move.left;
  applyCommand(g, { type: 'shelter', on: true });
  step(g, 1);
  assert.equal(sci.move.to, 'outside', 'turned back instead of finishing the outbound leg');
  step(g, walked + travelMinutes('outside', 'shelter'));
  assert.equal(sci.location, 'shelter');
});

test('solar storm: the shelter order protects the crew, ignoring it costs dose', () => {
  const play = (shelter) => {
    const g = createGame('L1-first-sols');
    assign(g, { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'explore' });
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
  assert.ok(crewOf(exposed.g, 'sci').doseMsv > crewOf(safe.g, 'sci').doseMsv + 0.5, 'the explorer caught outside takes a real dose');
  assert.ok(crewOf(exposed.g, 'eng').doseMsv < 1.2 * crewOf(safe.g, 'eng').doseMsv, 'the engineer underground is barely affected either way');
  assert.equal(safe.g.shelterOrder, false);
});

test('time above ground costs dose even on a quiet day', () => {
  const g = createGame('L1-first-sols');
  assign(g, { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'research' });
  runTo(g, 3, 0);
  const dose = Object.fromEntries(g.crew.map((c) => [c.id, c.doseMsv]));
  assert.ok(dose.cmdr > dose.eng && dose.bot > dose.eng, 'surface workers take more than the engineer underground');
  assert.ok(dose.eng > dose.sci, 'the deep lab is better shielded than the upper level');
  assert.ok(dose.sci > 0);
});

test('going over the radiation budget grounds an astronaut but does not make them sick', () => {
  const g = createGame('L1-first-sols');
  assign(g, { sci: 'research' });
  runTo(g, 1, 9);
  const sci = crewOf(g, 'sci');
  sci.doseMsv = g.doseBudgetMsv * TUNING.doseWarningFraction - 0.0001;
  assert.ok(step(g, 60).some((e) => e.type === 'dose-warning' && e.crew === 'sci'));
  sci.doseMsv = g.doseBudgetMsv - 0.0001;
  const events = step(g, 30);
  assert.ok(events.some((e) => e.type === 'crew-grounded' && e.crew === 'sci'));
  assert.equal(sci.grounded, true);
  runTo(g, 2, 10);
  const science = g.science;
  step(g, 120);
  assert.equal(g.science, science, 'a grounded scientist does no research');
  assert.equal(sci.stats.health, 100, 'no invented radiation sickness');
  assert.equal(evaluateObjective(g, { type: 'maxDoseBelow', value: g.doseBudgetMsv }).status, 'failed');
});

// ---------------------------------------------------------------- commands, projects, objectives

test('commands are validated', () => {
  const g = createGame('L1-first-sols');
  assert.equal(applyCommand(g, { type: 'assign', crew: 'nobody', job: 'farm' }).ok, false);
  assert.equal(applyCommand(g, { type: 'assign', crew: 'eng', job: 'juggling' }).ok, false);
  assert.equal(applyCommand(g, { type: 'assign', crew: 'eng', job: 'build' }).ok, false, 'building is not unlocked in level 1');
  assert.equal(applyCommand(g, { type: 'startProject', project: 'berm' }).ok, false);
  assert.equal(applyCommand(g, { type: 'teleport' }).ok, false);
  assert.equal(applyCommand(g, null).ok, false);
  assert.equal(applyCommand(g, { type: 'assign', crew: 'eng', job: 'solar' }).ok, true);
  assert.equal(crewOf(g, 'eng').job, 'solar');
});

test('projects: cost is paid once, work finishes them, shielding improves', () => {
  const g = createGame('L2-storm-season');
  const water = g.resources.waterL;
  assert.equal(applyCommand(g, { type: 'startProject', project: 'waterRoof' }).ok, true);
  assert.equal(g.resources.waterL, water - PROJECTS.waterRoof.costs.waterL);
  assert.equal(applyCommand(g, { type: 'startProject', project: 'berm' }).ok, false, 'one project at a time');
  assert.equal(applyCommand(g, { type: 'pauseProject' }).ok, true);
  assert.equal(applyCommand(g, { type: 'startProject', project: 'waterRoof' }).ok, true);
  assert.equal(g.resources.waterL, water - PROJECTS.waterRoof.costs.waterL, 'resuming does not charge again');

  const before = roomReport(g, 'greenhouse').shielding.spe;
  assign(g, { eng: 'build', cmdr: 'build' });
  for (const s of g.storms) s.status = 'done';
  const events = step(g, SOL_MINUTES);
  assert.ok(events.some((e) => e.type === 'project-done' && e.project === 'waterRoof'));
  assert.equal(g.projects.waterRoof.status, 'done');
  assert.ok(roomReport(g, 'greenhouse').shielding.spe < before);
  assert.equal(roomReport(g, 'shelter').shielding.layers.length, 2, 'underground rooms are unchanged');

  const poor = createGame('L2-storm-season');
  poor.resources.waterL = 20;
  assert.match(applyCommand(poor, { type: 'startProject', project: 'waterRoof' }).error, /Not enough water/);
  assert.equal(poor.resources.waterL, 20);
});

test('the storm-watch antenna doubles the warning time', () => {
  const warningLead = (withAntenna) => {
    const g = createGame('L2-storm-season');
    if (withAntenna) g.projects.stormWatch.status = 'done';
    for (;;) {
      const w = step(g, 1).find((e) => e.type === 'storm-warning');
      if (w) return w.minutesUntil;
    }
  };
  assert.equal(warningLead(false), LEVEL_BY_ID['L2-storm-season'].warningLeadMinutes);
  assert.equal(warningLead(true), 2 * LEVEL_BY_ID['L2-storm-season'].warningLeadMinutes);
});

test('level 1: doing nothing earns one star, playing well earns three', () => {
  const idle = createGame('L1-first-sols');
  while (idle.status === 'running') step(idle, 600);
  assert.equal(idle.status, 'complete');
  assert.equal(idle.result.stars, 1);

  const good = createGame('L1-first-sols');
  assign(good, { cmdr: 'research', eng: 'lifesupport', bot: 'farm', sci: 'explore' });
  while (good.status === 'running') {
    for (const e of step(good, 5)) if (e.type === 'storm-warning') applyCommand(good, { type: 'shelter', on: true });
    if (good.systems.solarClean < 0.85) applyCommand(good, { type: 'assign', crew: 'cmdr', job: 'solar' });
  }
  assert.equal(good.result.stars, 3, JSON.stringify(good.result.objectives.map((o) => [o.id, o.status, o.detail])));
  assert.ok(good.result.score.total > idle.result.score.total);
  assert.ok(good.achievements.includes('storm-safe') && good.achievements.includes('first-science'));
});

test('the mission is aborted if an astronaut reaches zero health', () => {
  const g = createGame('L1-first-sols');
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
  const g = createGame('L1-first-sols');
  const hints = [];
  while (g.status === 'running') for (const e of step(g, 30)) if (e.type === 'hint') hints.push(e.id);
  assert.equal(new Set(hints).size, hints.length, 'no hint is shown twice');
  for (const id of ['welcome', 'meals', 'o2gen', 'storm', 'storm-over']) assert.ok(hints.includes(id), `missing hint ${id}`);
  assert.ok(g.log.length > 5 && g.log.every((l) => typeof l.text === 'string' && l.text.length > 0));
});

test('summary and room report expose what the UI needs', () => {
  const g = createGame('L2-storm-season');
  step(g, 300);
  const s = summary(g);
  assert.equal(s.crew.length, 4);
  assert.ok(s.reserves.o2Sols > 1 && s.reserves.foodSols > 1);
  const deep = roomReport(g, 'shelter');
  const top = roomReport(g, 'greenhouse');
  assert.ok(deep.doseRateMsvPerHour < top.doseRateMsvPerHour);
  assert.ok(deep.shielding.arealDensity > 500);
  assert.equal(deep.zoneLabel, 'Underground, deep level');
  assert.throws(() => roomReport(g, 'attic'), /unknown room/);
});
