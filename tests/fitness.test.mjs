/** Independent expectations from SCENARIO.md 3.10, 3.11 and the Strong Bones row of 8.3.
 * Expected numbers are deliberately literal: importing the engine's tuning as the oracle
 * would let the same mistake in the data and implementation pass these checks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, command, rates, locationAt } from '../src/campaign/engine.js';
import { PLANS, planHours, workSpeed, fitMult, fitnessPerHour, exercisePlace, blockAt } from '../src/campaign/plan.js';
import { hpCost, EXPEDITIONS } from '../src/campaign/expeditions.js';
import { BADGES } from '../src/campaign/logbook.js';

const SOL = 1440;
const at = (sol, hour = 0, minute = 0) => (sol - 1) * SOL + hour * 60 + minute;
const close = (actual, expected, tolerance = 1e-9) => assert.ok(
  Math.abs(actual - expected) <= tolerance,
  `expected ${expected} +/- ${tolerance}, got ${actual}`,
);

/** Like engine-fixes.test.mjs: isolate plan/fitness effects from story emergencies.
 * Recreation is opt-in so the pre-Recreation Bedroom workout is tested too.
 */
function readyBase({ sol = 2, hour = 7, minute = 0, recreation = 0, plan = 'balanced', fitness = 80 } = {}) {
  const s = createCampaign({ seed: 3 });
  const wake = command(s, { type: 'wakeDrone', drone: 'drone-01' });
  assert.equal(wake.ok, true, wake.error);
  for (const id of ['battery', 'workshop', 'greenhouse', 'garage', 'lab', 'roof']) s.modules[id].status = 'online';
  if (recreation) {
    s.modules.recreation.status = 'online';
    s.modules.recreation.tier = recreation;
  }
  s.res.power = 200;
  s.minute = at(sol, hour, minute);
  s.plan = plan;
  s.fitness = fitness;
  s.flags._stormBegin = true;
  for (const id of ['d1', 'd2', 'd3', 'd4']) s.flags[`_${id}`] = true;
  s.flags.lastEvent = { e1: 1000, e2: 1000, e3: 1000, e4: 1000 };
  s.flags.breaks = { last: 1000, due: {} };
  s.tasks = [];
  s.pending = null;
  return s;
}

/** Advance actual simulated minutes, recording exact event times and answering paused cards. */
function advance(s, minutes) {
  const end = s.minute + minutes;
  const events = [];
  while (s.minute < end) {
    if (s.pending) {
      const reply = command(s, { type: s.pending.kind === 'radio' ? 'radio' : 'choose', choice: 'a' });
      assert.equal(reply.ok, true, reply.error);
      events.push(...reply.events.map((e) => ({ ...e, at: s.minute })));
    }
    const before = s.minute;
    events.push(...step(s, 1).map((e) => ({ ...e, at: s.minute })));
    assert.equal(s.minute, before + 1, 'the campaign must keep advancing');
  }
  return events;
}

const lines = (events, id) => events.filter((e) => e.type === 'astra' && e.lineId === id);
const strongBones = BADGES.find((b) => b.id === 'strong_bones');

test('3.11: a fresh Commander starts at Fitness 80 with the Balanced plan', () => {
  const s = createCampaign();
  assert.equal(s.minute, at(1, 7));
  assert.equal(s.fitness, 80);
  assert.equal(s.plan, 'balanced');
  assert.equal(s.planNext, null);
  assert.deepEqual(Object.keys(PLANS).sort(), ['balanced', 'crunch', 'recover']);
});

for (const [plan, expected] of Object.entries({
  balanced: { sleep: 8, work: 9, exercise: 1, free: 3, meal: 3 },
  crunch: { sleep: 8, work: 11, exercise: 1, free: 1, meal: 3 },
  recover: { sleep: 9, work: 6, exercise: 2, free: 4, meal: 3 },
})) {
  test(`3.10: ${plan} has the preset table's hours and meals at 06, 12, 18`, () => {
    assert.equal(PLANS[plan].length, 24);
    assert.deepEqual(planHours(plan), expected);
    const slots = Array.from({ length: 24 }, (_, hour) => blockAt({ plan }, hour));
    for (const [block, hours] of Object.entries(expected)) {
      assert.equal(slots.filter((b) => b === block).length, hours, block);
    }
    assert.deepEqual(slots.flatMap((block, hour) => block === 'meal' ? [hour] : []), [6, 12, 18]);
  });
}

test('3.10: Sol 1 refuses a preset without queuing it', () => {
  const s = readyBase({ sol: 1 });
  for (const plan of ['crunch', 'recover']) {
    assert.equal(command(s, { type: 'setPlan', plan }).ok, false);
    assert.equal(s.plan, 'balanced');
    assert.equal(s.planNext, null);
  }
});

for (const plan of ['crunch', 'recover']) {
  test(`3.10: choosing ${plan} on Sol 2 takes effect only at the next midnight`, () => {
    const s = readyBase();
    const result = command(s, { type: 'setPlan', plan });
    assert.equal(result.ok, true, result.error);
    assert.equal(s.plan, 'balanced');
    assert.equal(s.planNext, plan);
    advance(s, at(3) - s.minute - 1);
    assert.equal(s.plan, 'balanced', 'still Balanced at 23:59');
    assert.equal(s.planNext, plan);
    advance(s, 1);
    assert.equal(s.minute, at(3));
    assert.equal(s.plan, plan);
    assert.equal(s.planNext, null);
  });
}

test('3.10: an unknown preset is refused without replacing the queued plan', () => {
  const s = readyBase();
  assert.equal(command(s, { type: 'setPlan', plan: 'recover' }).ok, true);
  const before = structuredClone(s);
  assert.equal(command(s, { type: 'setPlan', plan: 'unknown' }).ok, false);
  assert.deepEqual(s, before);
});

test('3.11: low gravity removes about 10 Fitness per Sol when exercise is overridden', () => {
  const s = readyBase();
  advance(s, at(2, 16) - s.minute);
  assert.equal(command(s, { type: 'order', place: 'kitchen' }).ok, true);
  advance(s, at(3, 7) - s.minute);
  close(s.fitness, 70, 0.1);
});

for (const [recreation, place, gain] of [[0, 'bedroom', 10], [1, 'recreation', 20], [2, 'recreation', 25]]) {
  test(`3.11: an exercise hour in ${place} (Recreation tier ${recreation}) adds about ${gain}`, () => {
    const s = readyBase({ recreation, fitness: 50, hour: 16, minute: 59 });
    assert.equal(exercisePlace(s), place);
    assert.equal(fitnessPerHour(s), gain);
    advance(s, 1);
    assert.equal(locationAt(s), place);
    advance(s, 59);
    // One hour also incurs 1/24 of the scenario's -10 per-Sol drain.
    close(s.fitness, 50 + gain - 10 / 24, 0.1);
  });

  test(`3.11: a whole Balanced Sol nets about ${gain - 10} Fitness with Recreation tier ${recreation}`, () => {
    const s = readyBase({ recreation, fitness: 50 });
    advance(s, SOL);
    close(s.fitness, 50 + gain - 10, 0.1);
  });
}

test('3.11: Recover rebuilds Fitness faster than Balanced once Recreation exists', () => {
  const balanced = readyBase({ recreation: 1, fitness: 40 });
  const recover = readyBase({ recreation: 1, fitness: 40, plan: 'recover' });
  advance(balanced, SOL);
  advance(recover, SOL);
  close(balanced.fitness, 50, 0.1);
  close(recover.fitness, 70, 0.1);
  assert.ok(recover.fitness > balanced.fitness);
});

test('3.11: Fitness stays in the 0..100 range during drain and exercise', () => {
  const low = readyBase({ fitness: 0 });
  advance(low, 60);
  assert.equal(low.fitness, 0);
  const high = readyBase({ recreation: 2, fitness: 99, hour: 16, minute: 59 });
  advance(high, 60);
  assert.equal(high.fitness, 100);
});

test('3.10/3.11: work speed follows preset hours and the below-40 penalty', () => {
  for (const [plan, speed] of [['balanced', 1], ['crunch', 1.22], ['recover', 0.67]]) {
    close(workSpeed({ plan, fitness: 80 }), speed);
    close(workSpeed({ plan, fitness: 40 }), speed);
    close(workSpeed({ plan, fitness: 39.99 }), speed * 0.8);
    close(workSpeed({ plan, fitness: 15 }), speed * 0.8);
  }
});

test('3.11: expedition Fitness multipliers change below 40 and at 15, capped at 1.25', () => {
  for (const [fitness, expected] of [[100, 1], [40, 1], [39.99, 1.10], [15.01, 1.10], [15, 1.25], [1, 1.25], [0, 1.25]]) {
    close(fitMult(fitness), expected);
  }
  for (let fitness = 0; fitness <= 100; fitness++) assert.ok(fitMult(fitness) <= 1.25);
  const s = readyBase();
  const normalCost = hpCost(s, EXPEDITIONS[1]);
  assert.ok(normalCost > 0, 'the ratio must compare real HP costs');
  s.fitness = 39;
  close(hpCost(s, EXPEDITIONS[1]), normalCost * 1.10);
  s.fitness = 15;
  close(hpCost(s, EXPEDITIONS[1]), normalCost * 1.25);
  s.fitness = 0;
  close(hpCost(s, EXPEDITIONS[1]), normalCost * 1.25);
});

test('3.11: sustained critical Fitness costs about 2 extra HP over an otherwise equal Sol', () => {
  const healthy = readyBase({ fitness: 50 });
  const critical = structuredClone(healthy);
  critical.fitness = 5; // Stays <=15 even after the Bedroom workout; avoids the zero clamp.
  healthy.hp = critical.hp = 50; // Headroom avoids hiding HP differences at the maximum.
  advance(healthy, SOL);
  advance(critical, SOL);
  assert.ok(critical.fitness <= 15);
  assert.ok(critical.hp < healthy.hp);
  close(healthy.hp - critical.hp, 2, 0.05);
  assert.equal(critical.medRest, null);
});

test('3.10: Crunch costs 4 Morale per Sol against Balanced; Recover has the same plan Morale', () => {
  const s = readyBase();
  const balanced = rates(s).morale;
  s.plan = 'crunch';
  close(rates(s).morale, balanced - 4);
  s.plan = 'recover';
  close(rates(s).morale, balanced);
});

// The engine omits the scenario's good-Fitness Morale contribution.
test('3.11: Fitness 70 or more adds 1 Morale per Sol', {
  todo: 'SCENARIO conflict, team decision: 3.11 +1 Morale at Fitness 70+ is not in the 3.4 snapshots (docs/ERRORS.md B12)',
}, () => {
  const s = readyBase({ fitness: 69.99 });
  const below = rates(s).morale;
  s.fitness = 70;
  close(rates(s).morale, below + 1);
  s.fitness = 100;
  close(rates(s).morale, below + 1);
});

test('3.11: ASTRA introduces exercise in the first hour and Mars gravity in the second, once each', () => {
  const s = readyBase();
  const events = advance(s, 3 * SOL);
  const intro = lines(events, 'astra.fit.intro');
  const mars = lines(events, 'astra.fit.mars');
  assert.equal(intro.length, 1);
  assert.equal(mars.length, 1);
  assert.ok(intro[0].at >= at(2, 17) && intro[0].at < at(2, 18));
  assert.ok(mars[0].at >= at(3, 17) && mars[0].at < at(3, 18));
});

// A normal Balanced Sol 1 currently consumes the introduction intended for Sol 2.
test('3.11: the first exercise introduction is reserved for Sol 2', {
  
}, () => {
  const s = readyBase({ sol: 1 });
  const events = advance(s, at(2, 18) - s.minute);
  const intro = lines(events, 'astra.fit.intro');
  assert.equal(intro.length, 1);
  assert.equal(Math.floor(intro[0].at / SOL) + 1, 2);
});

// The unlock currently comes from the midnight transition, six hours before dawn.
test('3.10: ASTRA unlocks the Sol Plan at dawn (06:00) on Sol 2', {
  
}, () => {
  const s = readyBase({ sol: 1 });
  const events = advance(s, at(3, 7) - s.minute);
  assert.deepEqual(lines(events, 'astra.plan.unlock').map((e) => e.at), [at(2, 6)]);
});

test('3.11: ASTRA warns once as Fitness falls below 40, without repeating while it stays low', () => {
  const s = readyBase({ fitness: 40.1 });
  assert.equal(lines(advance(s, 14), 'astra.fit.low').length, 0);
  assert.ok(s.fitness >= 40);
  const crossing = advance(s, 1);
  assert.ok(s.fitness < 40);
  assert.equal(lines(crossing, 'astra.fit.low').length, 1);
  assert.equal(lines(advance(s, 180), 'astra.fit.low').length, 0);
});

test('3.11/8.3: Strong Bones is false after nine qualifying Sols and true after ten', () => {
  const s = readyBase({ hour: 0 });
  assert.ok(strongBones, 'the badge must exist');
  assert.equal(strongBones.test(s), false);
  for (let sol = 1; sol <= 10; sol++) {
    advance(s, SOL);
    assert.equal(strongBones.test(s), sol === 10, `after ${sol} qualifying Sols`);
  }
});

test('3.11/8.3: a low-Fitness Sol breaks the Strong Bones streak', () => {
  const s = readyBase({ hour: 0 });
  advance(s, 9 * SOL);
  s.fitness = 50;
  advance(s, SOL);
  s.fitness = 80;
  advance(s, 9 * SOL);
  assert.equal(strongBones.test(s), false, 'nine new qualifying Sols are insufficient');
  advance(s, SOL);
  assert.equal(strongBones.test(s), true);
});

// Only midnight Fitness is checked, so a workout can hide a below-70 interval.
test('3.11/8.3: dipping below 70 during a Sol breaks the Strong Bones streak even if Fitness recovers', {
  
}, () => {
  const s = readyBase({ hour: 0 });
  advance(s, 9 * SOL);
  s.fitness = 72;
  advance(s, 16 * 60);
  assert.ok(s.fitness < 70, 'low-gravity drain takes Fitness below 70 before exercise');
  advance(s, 8 * 60);
  assert.ok(s.fitness >= 70, 'the Bedroom workout restores Fitness before midnight');
  assert.equal(strongBones.test(s), false, 'Fitness must stay >=70 throughout each qualifying Sol');
});

test('3.10/3.11: an away Commander never exercises, even on Recover with Recreation T2', () => {
  const s = readyBase({ plan: 'recover', recreation: 2, fitness: 60 });
  const launch = command(s, { type: 'launch', expedition: 'run' });
  assert.equal(launch.ok, true, launch.error);
  const events = [];
  let previous = s.fitness;
  // Stop one minute before the earliest possible return, covering both Recover exercise hours.
  for (let elapsed = 0; elapsed < SOL - 1;) {
    const minutes = Math.min(60, SOL - 1 - elapsed);
    events.push(...advance(s, minutes));
    elapsed += minutes;
    assert.ok(s.away, 'the Commander must still be on the trip');
    assert.equal(locationAt(s), 'away');
    assert.ok(s.fitness < previous, 'Fitness only falls while away');
    previous = s.fitness;
  }
  close(s.fitness, 60 - 10 * (SOL - 1) / SOL, 0.1);
  assert.equal(lines(events, 'astra.fit.intro').length, 0);
  assert.equal(lines(events, 'astra.fit.mars').length, 0);
});
