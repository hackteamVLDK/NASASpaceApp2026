import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, command, step } from '../src/campaign/engine.js';
import { CAP, SOL } from '../src/campaign/data.js';
import { clockAt } from '../src/campaign/util.js';
import { nextRandom } from '../src/sim/rng.js';
import { jobFields, jobBoard, jobCommand, stepJobs, jobBuildMult, STRINGS } from '../src/campaign/jobs.js';

function state(seed = 1) {
  return Object.assign(createCampaign({ seed }), jobFields());
}
function available(s) {
  for (const id of ['greenhouse', 'lab', 'workshop']) s.modules[id].status = 'online';
  s.drones[0].status = 'awake';
  return s;
}
function building(s, id = 'battery', progress = 0) {
  Object.assign(s.modules[id], { status: 'building', progress, drone: s.drones[0].id });
  Object.assign(s.drones[0], { status: 'awake', task: { type: 'build', module: id } });
  return s.modules[id];
}
function send(s, cmd) {
  const events = [];
  const result = jobCommand(s, cmd, (e) => events.push(e));
  return { result, events };
}
function start(s, job) {
  const got = send(s, { type: 'startJob', job });
  assert.deepEqual(got.result, { ok: true });
  return got.events;
}
function finish(s, job, win = true) {
  const got = send(s, { type: 'jobResult', job, win });
  assert.deepEqual(got.result, { ok: true });
  return got.events;
}
function run(s, job, win = true) {
  start(s, job);
  return finish(s, job, win);
}
const offer = (s, id) => jobBoard(s).find((job) => job.id === id);

test('jobFields matches the integration contract and creates independent containers', () => {
  const a = jobFields();
  const b = jobFields();
  assert.deepEqual(a, { job: null, jobCooldowns: {}, jobStats: { done: 0, assists: 0 } });
  a.jobCooldowns.scrap_hunt = 100;
  a.jobStats.done++;
  assert.deepEqual(b, { job: null, jobCooldowns: {}, jobStats: { done: 0, assists: 0 } });
});

test('initial board shows only scrap; built room jobs appear only once their rooms are online', () => {
  const s = state();
  assert.deepEqual(jobBoard(s).map((job) => job.id), ['scrap_hunt']);
  s.modules.greenhouse.status = 'building';
  assert.deepEqual(jobBoard(s).map((job) => job.id), ['assist:greenhouse', 'scrap_hunt']);
  s.modules.greenhouse.status = 'online';
  assert.deepEqual(jobBoard(s).map((job) => job.id), ['scrap_hunt', 'tend_greenhouse']);
  available(s);
  assert.deepEqual(jobBoard(s).map((job) => job.id), ['scrap_hunt', 'tend_greenhouse', 'sample_scan', 'drone_tune']);
});

test('board is read-only, lists assists first, and supplies every UI contract field', () => {
  const s = available(state());
  building(s, 'garage');
  s.modules.solar.upgrading = { progress: 0, drone: s.drones[1].id };
  const before = JSON.stringify(s);
  const board = jobBoard(s);
  assert.deepEqual(board.slice(0, 2).map((job) => job.id), ['assist:solar', 'assist:garage']);
  for (const job of board) {
    assert.deepEqual(Object.keys(job).sort(), ['id', 'title', 'text', 'science', 'game', 'reward', 'hours', 'block', 'module'].sort());
    for (const key of ['id', 'title', 'text', 'science', 'game', 'reward']) assert.equal(typeof job[key], 'string');
    assert.ok(job.hours > 0);
    assert.equal(job.block, null);
  }
  assert.equal(JSON.stringify(s), before);
});

test('start emits the mini-game route and only one job can be open', () => {
  const s = available(state());
  const events = start(s, 'sample_scan');
  assert.deepEqual(s.job, { id: 'sample_scan', game: 'sample_scan', minute: s.minute });
  assert.deepEqual(events, [{ type: 'job-start', job: 'sample_scan', game: 'sample_scan' }]);
  assert.ok(jobBoard(s).every((job) => job.block === 'Finish the open job first.'));
  const before = JSON.stringify(s);
  assert.equal(send(s, { type: 'startJob', job: 'tend_greenhouse' }).result.ok, false);
  assert.equal(JSON.stringify(s), before);
});

for (const [name, change, message] of [
  ['over', (s) => { s.status = 'over'; }, /mission/i],
  ['complete', (s) => { s.status = 'complete'; }, /mission/i],
  ['decision', (s) => { s.pending = { kind: 'dilemma', id: 'd1' }; }, /decision/i],
  ['away', (s) => { s.away = { id: 'run' }; }, /away/i],
  ['Med-Rest', (s) => { s.medRest = { until: s.minute + SOL }; }, /rest/i],
]) {
  test(`all jobs are blocked while ${name}, without mutating state`, () => {
    const s = available(state());
    building(s);
    change(s);
    const before = JSON.stringify(s);
    for (const job of jobBoard(s)) {
      assert.match(job.block, message);
      assert.equal(send(s, { type: 'startJob', job: job.id }).result.ok, false);
    }
    assert.equal(JSON.stringify(s), before);
  });
}

test('unknown, missing and unrelated commands are rejected or delegated without mutation', () => {
  const s = state();
  const before = JSON.stringify(s);
  for (const job of ['unknown', 'assist:unknown', 'sample_scan', 'assist:battery', '__proto__', null, 7]) {
    const got = send(s, { type: 'startJob', job });
    assert.equal(got.result.ok, false);
    assert.equal(got.events.length, 0);
  }
  assert.equal(send(s, { type: 'miniResult', game: 'nutrient_match', win: true }).result, null);
  assert.equal(send(s, null).result, null);
  assert.equal(JSON.stringify(s), before);
});

test('results require the matching open job and a boolean win; duplicate rewards cannot be claimed', () => {
  const s = available(state());
  assert.equal(send(s, { type: 'jobResult', job: 'sample_scan', win: true }).result.ok, false);
  start(s, 'sample_scan');
  const before = JSON.stringify(s);
  for (const cmd of [
    { job: 'drone_tune', win: true }, { job: 'unknown', win: true },
    { job: 'sample_scan' }, { job: 'sample_scan', win: 'false' }, { job: 'sample_scan', win: 1 },
  ]) assert.equal(send(s, { type: 'jobResult', ...cmd }).result.ok, false);
  assert.equal(JSON.stringify(s), before);
  finish(s, 'sample_scan');
  assert.equal(s.job, null);
  assert.equal(s.research, 6);
  assert.equal(send(s, { type: 'jobResult', job: 'sample_scan', win: true }).result.ok, false);
  assert.equal(s.research, 6);
});

test('an assist adds 25% and counts once, then blocks for three game hours', () => {
  const s = state();
  const m = building(s, 'battery', 0.1);
  const events = run(s, 'assist:battery');
  assert.equal(m.progress, 0.35);
  assert.equal(m.status, 'building');
  assert.equal(s.jobStats.assists, 1);
  assert.equal(s.jobStats.done, 1);
  assert.equal(s.jobCooldowns['assist:battery'], s.minute + 180);
  assert.deepEqual(events, [{ type: 'job-done', job: 'assist:battery', win: true, reward: 'Build +25%' }]);
  assert.equal(offer(s, 'assist:battery').block, 'Ready in 3 h');
  s.minute += 61;
  assert.equal(offer(s, 'assist:battery').block, 'Ready in 2 h');
  s.minute += 118;
  assert.equal(offer(s, 'assist:battery').block, 'Ready in 1 h');
  s.minute++;
  assert.equal(offer(s, 'assist:battery').block, null);
});

test('each module has its own assist cooldown and only two successful assists per build', () => {
  const s = state();
  building(s);
  building(s, 'workshop');
  run(s, 'assist:battery');
  assert.equal(offer(s, 'assist:workshop').block, null);
  s.minute += 180;
  run(s, 'assist:battery');
  s.minute += 180;
  assert.match(offer(s, 'assist:battery').block, /twice/);
  assert.equal(send(s, { type: 'startJob', job: 'assist:battery' }).result.ok, false);
  assert.equal(s.modules.battery.progress, 0.5);
  assert.equal(s.jobStats.assists, 2);
  assert.equal(offer(s, 'assist:workshop').block, null);
});

test('failed assists lose nothing, use one hour cooldown, and do not consume an assist or daily win', () => {
  const s = state();
  const m = building(s, 'battery', 0.2);
  const hp = s.hp;
  const resources = { ...s.res };
  run(s, 'assist:battery', false);
  assert.equal(m.progress, 0.2);
  assert.equal(s.hp, hp);
  assert.deepEqual(s.res, resources);
  assert.equal(s.jobCooldowns['assist:battery'], s.minute + 60);
  assert.equal(s.jobStats.done, 0);
  assert.equal(s.jobStats.assists, 0);
  s.minute += 60;
  run(s, 'assist:battery');
  assert.equal(s.jobStats.assists, 1);
  assert.equal(s.jobStats.winsToday, 1);
});

test('build assist caps progress at one and the engine finishes normally on its next tick', () => {
  const s = state();
  const m = building(s, 'battery', 0.99);
  run(s, 'assist:battery');
  assert.equal(m.progress, 1);
  assert.equal(m.status, 'building');
  assert.equal(s.stats.builds, 0);
  assert.ok(step(s).some((e) => e.type === 'built' && e.module === 'battery'));
  assert.equal(m.status, 'online');
  assert.equal(s.stats.builds, 1);
  assert.equal(s.drones[0].task, null);
  assert.equal(offer(s, 'assist:battery'), undefined);
});

test('upgrade progress is assisted separately from its earlier build, with its own two-assist limit', () => {
  const s = state();
  const m = building(s);
  run(s, 'assist:battery');
  s.minute += 180;
  run(s, 'assist:battery');
  s.minute += 180;
  m.status = 'online'; m.progress = 1;
  s.minute = SOL + 420;
  m.upgrading = { progress: 0, drone: s.drones[0].id };
  s.drones[0].task = { type: 'upgrade', module: 'battery' };
  assert.equal(offer(s, 'assist:battery').block, null);
  run(s, 'assist:battery');
  assert.equal(m.upgrading.progress, 0.25);
  assert.equal(m.progress, 1);
  s.minute += 180;
  run(s, 'assist:battery');
  s.minute += 180;
  assert.match(offer(s, 'assist:battery').block, /twice/);
  assert.equal(s.jobStats.assists, 4);
});

test('an upgrade assist reaches one, then the engine upgrades and releases the drone next tick', () => {
  const s = state();
  const m = s.modules.solar;
  m.upgrading = { progress: 0.9, drone: s.drones[0].id };
  Object.assign(s.drones[0], { status: 'awake', task: { type: 'upgrade', module: 'solar' } });
  run(s, 'assist:solar');
  assert.equal(m.upgrading.progress, 1);
  assert.equal(m.tier, 1);
  assert.ok(step(s).some((e) => e.type === 'upgraded' && e.module === 'solar'));
  assert.equal(m.tier, 2);
  assert.equal(m.upgrading, null);
  assert.equal(s.drones[0].task, null);
});

test('an assist cannot reward a room that finished or a different upgrade started while the job was open', () => {
  for (const upgrade of [false, true]) {
    const s = state();
    const m = building(s);
    start(s, 'assist:battery');
    m.status = 'online'; m.progress = 1;
    if (upgrade) m.upgrading = { progress: 0, drone: s.drones[0].id };
    assert.equal(send(s, { type: 'jobResult', job: 'assist:battery', win: true }).result.ok, false);
    assert.equal(s.job, null);
    assert.equal(m.upgrading?.progress ?? 0, 0);
    assert.equal(s.jobStats.done, 0);
  }
});

test('scrap reward follows the seeded RNG exactly, including the optional Mineral Sample', () => {
  const outcomes = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const s = state(seed);
    const expected = { rng: s.rng };
    const parts = 4 + Math.floor(nextRandom(expected) * 5);
    const sample = nextRandom(expected) < 0.25;
    const beforeParts = s.res.sp;
    const beforeHp = s.hp;
    run(s, 'scrap_hunt');
    assert.equal(s.res.sp - beforeParts, parts);
    assert.equal(s.hp, beforeHp - 2);
    assert.equal(s.items.mineral_sample ?? 0, sample ? 1 : 0);
    assert.equal(s.rng, expected.rng);
    assert.equal(s.jobCooldowns.scrap_hunt, s.minute + 480);
    outcomes.add(parts);
  }
  assert.deepEqual([...outcomes].sort(), [4, 5, 6, 7, 8]);
});

test('identical command sequences and a JSON round-trip preserve deterministic scrap outcomes', () => {
  const a = state('jobs-save');
  const b = state('jobs-save');
  const aEvents = [], bEvents = [];
  for (let sol = 1; sol <= 8; sol++) {
    a.minute = b.minute = (sol - 1) * SOL + 420;
    aEvents.push(...run(a, 'scrap_hunt'));
    bEvents.push(...run(b, 'scrap_hunt'));
    Object.assign(b, JSON.parse(JSON.stringify(b)));
  }
  assert.deepEqual(a, b);
  assert.deepEqual(aEvents, bEvents);
});

test('surface HP is paid once on starting scrap even if the hunt is lost or abandoned', () => {
  const s = state();
  const rng = s.rng;
  const parts = s.res.sp;
  start(s, 'scrap_hunt');
  assert.equal(s.hp, 98);
  finish(s, 'scrap_hunt', false);
  assert.equal(s.hp, 98);
  assert.equal(s.rng, rng);
  assert.equal(s.res.sp, parts);
  assert.equal(s.jobStats.done, 0);
  assert.equal(s.jobCooldowns.scrap_hunt, s.minute + 480);
  s.minute += 480;
  start(s, 'scrap_hunt');
  s.minute += 121;
  stepJobs(s, () => {}, clockAt(s.minute));
  assert.equal(s.hp, 96);
  assert.equal(s.job, null);
});

test('scrap HP and Spare Parts stay within their existing bounds', () => {
  const s = state();
  s.hp = 1;
  s.res.sp = CAP.sp - 1;
  const events = run(s, 'scrap_hunt');
  assert.equal(s.hp, 0);
  assert.equal(s.res.sp, CAP.sp);
  assert.match(events[0].reward, /^Spare Parts \+1(?:,|$)/);
});

for (const [name, change, message] of [
  ['storm', (s) => { s.storm = { until: s.minute + SOL }; }, /dust storm/],
  ['flare', (s) => { s.flags.flare = true; }, /solar flare/],
  ['night before dawn', (s) => { s.minute = 359; }, /dark/],
  ['night after dusk', (s) => { s.minute = 1320; }, /dark/],
]) {
  test(`scrap is blocked during ${name}, but indoor jobs remain available`, () => {
    const s = available(state());
    change(s);
    assert.match(offer(s, 'scrap_hunt').block, message);
    assert.equal(send(s, { type: 'startJob', job: 'scrap_hunt' }).result.ok, false);
    assert.equal(s.hp, 100);
    assert.equal(offer(s, 'sample_scan').block, null);
  });
}

test('scrap daylight uses campaign boundaries: 06:00 inclusive, 22:00 exclusive', () => {
  const s = state();
  for (const minute of [360, 1319]) {
    s.minute = minute;
    assert.equal(offer(s, 'scrap_hunt').block, null);
  }
});

test('greenhouse tending gives eight Food and two Morale with a twelve-hour cooldown', () => {
  const s = available(state());
  s.res.food = 50; s.res.morale = 50;
  const events = run(s, 'tend_greenhouse');
  assert.equal(s.res.food, 58);
  assert.equal(s.res.morale, 52);
  assert.equal(s.jobCooldowns.tend_greenhouse, s.minute + 720);
  assert.deepEqual(events, [{ type: 'job-done', job: 'tend_greenhouse', win: true, reward: 'Food +8, Morale +2' }]);
});

test('greenhouse rewards respect caps and report the amount actually added', () => {
  const s = available(state());
  s.res.food = 99; s.res.morale = 100;
  const events = run(s, 'tend_greenhouse');
  assert.equal(s.res.food, CAP.food);
  assert.equal(s.res.morale, CAP.morale);
  assert.equal(events[0].reward, 'Food +1, Morale +0');
});

test('reward text stays readable with fractional resource meters and partial rewards', () => {
  const s = available(state());
  s.res.food = 60.23; s.res.morale = 99.75;
  const events = run(s, 'tend_greenhouse');
  assert.equal(s.res.food, 60.23 + 8);
  assert.equal(s.res.morale, CAP.morale);
  assert.equal(events[0].reward, 'Food +8, Morale +0.25');
});

test('sample scans give six Research, need no inventory item, and have a twelve-hour cooldown', () => {
  const s = available(state());
  s.research = 10;
  run(s, 'sample_scan');
  assert.equal(s.research, 16);
  assert.deepEqual(s.items, {});
  assert.equal(s.jobCooldowns.sample_scan, s.minute + 720);
});

test('tuning needs an awake drone; a busy awake builder can be tuned', () => {
  const s = state();
  s.modules.workshop.status = 'online';
  assert.match(offer(s, 'drone_tune').block, /Wake a drone/);
  assert.equal(send(s, { type: 'startJob', job: 'drone_tune' }).result.ok, false);
  building(s);
  assert.equal(offer(s, 'drone_tune').block, null);
  start(s, 'drone_tune');
  assert.deepEqual(s.drones[0].task, { type: 'build', module: 'battery' });
});

test('tuning gives exactly 20% build speed for twelve hours with a one-Sol cooldown', () => {
  const s = available(state());
  assert.equal(jobBuildMult(s), 1);
  run(s, 'drone_tune');
  assert.equal(jobBuildMult(s), 1.2);
  assert.equal(s.jobCooldowns.drone_tune, s.minute + SOL);
  const before = JSON.stringify(s);
  jobBuildMult(s);
  assert.equal(JSON.stringify(s), before);
  s.minute += 719;
  assert.equal(jobBuildMult(s), 1.2);
  s.minute++;
  assert.equal(jobBuildMult(s), 1);
  assert.match(offer(s, 'drone_tune').block, /Ready in 12 h/);
  s.minute += 720;
  assert.equal(offer(s, 'drone_tune').block, null);
  run(s, 'drone_tune');
  assert.equal(jobBuildMult(s), 1.2);
});

for (const [id, hours] of [['tend_greenhouse', 12], ['sample_scan', 12], ['drone_tune', 24]]) {
  test(`losing ${id} gives no reward and applies its ${hours}-hour cooldown`, () => {
    const s = available(state());
    const res = { ...s.res };
    const rng = s.rng;
    const events = run(s, id, false);
    assert.deepEqual(s.res, res);
    assert.equal(s.research, 0);
    assert.equal(s.hp, 100);
    assert.equal(jobBuildMult(s), 1);
    assert.equal(s.rng, rng);
    assert.equal(s.jobStats.done, 0);
    assert.equal(s.job, null);
    assert.equal(s.jobCooldowns[id], s.minute + hours * 60);
    assert.equal(events[0].win, false);
    assert.match(events[0].reward, /Good try/);
  });
}

test('four successful jobs cap the whole board, then a new Sol resets the count without erasing cooldowns', () => {
  const s = available(state());
  building(s);
  for (const id of ['assist:battery', 'scrap_hunt', 'tend_greenhouse', 'sample_scan']) run(s, id);
  assert.equal(s.jobStats.done, 4);
  assert.equal(s.jobStats.winsToday, 4);
  assert.ok(jobBoard(s).every((job) => /4 jobs won this Sol/.test(job.block)));
  assert.equal(send(s, { type: 'startJob', job: 'drone_tune' }).result.ok, false);
  s.minute = SOL;
  assert.equal(offer(s, 'drone_tune').block, null);
  run(s, 'drone_tune');
  assert.equal(s.jobStats.done, 5);
  assert.equal(s.jobStats.winsToday, 1);
  assert.equal(s.jobStats.winsSol, 2);
  s.minute = 2 * SOL;
  assert.equal(offer(s, 'drone_tune').block, null);
});

test('a job started before midnight counts on the Sol it is won; old cooldowns cross midnight', () => {
  const s = available(state());
  s.minute = SOL - 30;
  run(s, 'tend_greenhouse');
  start(s, 'sample_scan');
  s.minute = SOL;
  finish(s, 'sample_scan');
  assert.equal(s.jobStats.winsToday, 1);
  assert.equal(s.jobStats.winsSol, 2);
  assert.equal(offer(s, 'tend_greenhouse').block, 'Ready in 12 h');
});

test('job wins and failures never complete repair/prep tasks or give their generic mini-game rewards', () => {
  const s = available(state());
  s.tasks = [{ game: 'nutrient_match', why: 'Plants need help.' }, { game: 'wheel_vacuum', why: 'Prepare the Rover.' }];
  s.mult.food = 0.6;
  s.flags.freshOff = true;
  const tasks = structuredClone(s.tasks);
  const stats = structuredClone(s.stats);
  const parts = s.res.sp;
  run(s, 'tend_greenhouse');
  run(s, 'drone_tune');
  run(s, 'sample_scan', false);
  assert.deepEqual(s.tasks, tasks);
  assert.deepEqual(s.stats, stats);
  assert.equal(s.mult.food, 0.6);
  assert.equal(s.flags.freshOff, true);
  assert.equal(s.res.sp, parts);
});

test('result rechecks availability if the Commander leaves or a surface hazard appears', () => {
  for (const change of [
    (s) => { s.away = { id: 'run' }; },
    (s) => { s.pending = { id: 'e1' }; },
    (s) => { s.medRest = { until: s.minute + SOL }; },
    (s) => { s.status = 'over'; },
    (s) => { s.storm = { until: s.minute + SOL }; },
    (s) => { s.flags.flare = true; },
    (s) => { s.minute = 1320; s.job.minute = 1319; },
  ]) {
    const s = state();
    start(s, 'scrap_hunt');
    const sp = s.res.sp, rng = s.rng;
    change(s);
    assert.equal(send(s, { type: 'jobResult', job: 'scrap_hunt', win: true }).result.ok, false);
    assert.equal(s.res.sp, sp);
    assert.equal(s.rng, rng);
    assert.equal(s.jobStats.done, 0);
    assert.equal(s.job, null);
  }
});

test('a room going offline while its job is open cannot produce a reward', () => {
  const s = available(state());
  start(s, 'sample_scan');
  s.modules.lab.status = 'unbuilt';
  assert.equal(send(s, { type: 'jobResult', job: 'sample_scan', win: true }).result.ok, false);
  assert.equal(s.research, 0);
  assert.equal(s.job, null);
});

test('jobs stay open for two hours exactly and expire after that without rewards or wins', () => {
  const s = available(state());
  start(s, 'sample_scan');
  s.minute += 120;
  stepJobs(s, () => {}, clockAt(s.minute));
  assert.ok(s.job);
  const saved = JSON.parse(JSON.stringify(s));
  finish(saved, 'sample_scan');
  assert.equal(saved.research, 6);
  s.minute++;
  stepJobs(s, () => {}, clockAt(s.minute));
  assert.equal(s.job, null);
  assert.equal(s.jobStats.done, 0);
  assert.equal(s.research, 0);
  assert.equal(send(s, { type: 'jobResult', job: 'sample_scan', win: true }).result.ok, false);
  start(s, 'sample_scan');
});

test('an overdue result is rejected even if stepJobs has not run, and expired assists clear their target', () => {
  const s = state();
  building(s);
  start(s, 'assist:battery');
  s.minute += 121;
  assert.equal(send(s, { type: 'jobResult', job: 'assist:battery', win: true }).result.ok, false);
  assert.equal(s.job, null);
  assert.equal(s.jobStats.assistTarget, undefined);
  assert.equal(s.modules.battery.progress, 0);
  start(s, 'assist:battery');
  s.minute += 121;
  stepJobs(s, () => {});
  assert.equal(s.jobStats.assistTarget, undefined);
});

test('ASTRA introduces helping only once per run, on the first building module', () => {
  const s = state();
  const events = [];
  const emit = (e) => events.push(e);
  stepJobs(s, emit, clockAt(s.minute));
  assert.deepEqual(events, []);
  building(s);
  stepJobs(s, emit, clockAt(s.minute));
  stepJobs(s, emit, clockAt(s.minute));
  building(s, 'workshop');
  stepJobs(s, emit, clockAt(s.minute));
  const restored = JSON.parse(JSON.stringify(s));
  stepJobs(restored, emit, clockAt(restored.minute));
  assert.deepEqual(events, [{ type: 'astra', lineId: 'astra.jobs.intro', mood: 'cheerful' }]);
  assert.equal(s.flags.jobsIntro, true);
  assert.equal(STRINGS['astra.jobs.intro'], 'While the drones build, you can help! Open Jobs and pick one.');
  assert.ok(Object.isFrozen(STRINGS));
});

test('intro waits for a running mission and ignores upgrades alone', () => {
  const s = state();
  const events = [];
  s.modules.solar.upgrading = { progress: 0, drone: s.drones[0].id };
  stepJobs(s, (e) => events.push(e));
  assert.equal(events.length, 0);
  building(s);
  s.status = 'over';
  stepJobs(s, (e) => events.push(e));
  assert.equal(events.length, 0);
  s.status = 'running';
  stepJobs(s, (e) => events.push(e));
  assert.equal(events.length, 1);
});

test('existing engine commands are left for the engine to handle', () => {
  const s = state();
  assert.equal(send(s, { type: 'wakeDrone', drone: 'drone-01' }).result, null);
  assert.equal(command(s, { type: 'wakeDrone', drone: 'drone-01' }).ok, true);
});
