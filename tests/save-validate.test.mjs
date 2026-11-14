// B4 / D-T9: every part of a save is checked before Continue loads it. Two promises are tested:
//   1. a good save is never refused (saves taken at many points of many random games load back unchanged);
//   2. a damaged save never throws: it is refused with a reason, or repaired so that the game keeps running.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, command } from '../src/campaign/engine.js';
import { MODULES, RECIPES, ITEMS } from '../src/campaign/data.js';
import { restoreSave, validateState } from '../src/campaign/save-migrate.js';

const rngOf = (seed) => { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const MODS = Object.keys(MODULES);
const PLACES = ['bedroom', 'kitchen', 'lifesupport', 'workshop', 'lab', 'battery', 'garage', 'greenhouse', 'recreation', 'outside'];
const GAMES = ['solar_wipe', 'heat_pump', 'valve_balance', 'water_sort', 'nutrient_match', 'air_filter', 'antenna', 'wheel_vacuum', 'suit_seal'];
const clone = (x) => JSON.parse(JSON.stringify(x));

/** Play a random game and hand out a JSON snapshot every `every` minutes (the same kind of random play as campaign-fuzz.test.mjs). */
function snapshots(seed, sols = 22, every = 700) {
  const rnd = rngOf(seed * 7919);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const s = createCampaign({ seed });
  command(s, { type: 'wakeDrone', drone: 'drone-01' });
  const out = [];
  let next = every;
  for (let guard = 0; s.minute < sols * 1440 && guard < 40000; guard++) {
    const r = rnd();
    let cmd = null;
    if (s.pending) cmd = s.pending.kind === 'radio' ? { type: 'radio', choice: pick(['a', 'b']) } : { type: 'choose', choice: pick(['a', 'b', 'c']) };
    else if (r < 0.12) cmd = { type: 'build', module: pick(MODS), drone: rnd() < 0.5 ? pick(s.drones).id : undefined };
    else if (r < 0.2) cmd = { type: 'upgrade', module: pick(MODS) };
    else if (r < 0.3) cmd = { type: 'order', place: pick(PLACES) };
    else if (r < 0.36) cmd = { type: 'craft', recipe: pick(Object.keys(RECIPES)) };
    else if (r < 0.4) { const d = pick(s.drones); cmd = { type: 'useKit', kit: d.id === 'drone-02' ? 'repair_kit' : 'reboot_kit', drone: d.id }; }
    else if (r < 0.46) cmd = { type: 'miniResult', game: pick(GAMES), win: rnd() < 0.6 };
    else if (r < 0.56) cmd = { type: 'launch', expedition: pick([1, 2, 3, 4, 5, 'run']) };
    else if (r < 0.68) { s.res.sp = Math.min(999, s.res.sp + 60); for (const it of ITEMS) if (rnd() < 0.4) s.items[it] = (s.items[it] ?? 0) + 1; }
    if (cmd) command(s, cmd);
    step(s, 1 + Math.floor(rnd() * (rnd() < 0.2 ? 400 : 60)));
    if (s.status !== 'running') break;
    if (s.minute >= next) { out.push(clone(s)); next = s.minute + every; }
  }
  return out;
}

test('a good save is never refused: snapshots of 8 random games load back unchanged', () => {
  let n = 0;
  const seen = { away: 0, pending: 0, crafting: 0, droneTask: 0, queue: 0, tasks: 0, mods: 0, timers: 0 };
  for (let seed = 1; seed <= 8; seed++) {
    for (const snap of snapshots(seed)) {
      const r = restoreSave(clone(snap));
      assert.equal(r.ok, true, `seed ${seed}, minute ${snap.minute}: refused (${r.reason})`);
      assert.deepStrictEqual(r.state, snap, `seed ${seed}, minute ${snap.minute}: changed by loading`);
      assert.equal(validateState(snap), null);
      n++;
      seen.away += snap.away ? 1 : 0; seen.pending += snap.pending ? 1 : 0; seen.crafting += snap.crafting ? 1 : 0;
      seen.droneTask += snap.drones.some((d) => d.task) ? 1 : 0; seen.queue += snap.drones.some((d) => d.queue.length) ? 1 : 0;
      seen.tasks += snap.tasks.length ? 1 : 0; seen.mods += snap.mods.length ? 1 : 0; seen.timers += snap.timers.length ? 1 : 0;
    }
  }
  assert.ok(n >= 80, `only ${n} snapshots`);
  // the snapshots must really contain the hard cases, or the test proves little
  for (const [what, count] of Object.entries(seen)) assert.ok(count > 0, `no snapshot had ${what}`);
});

/** A mid-game state that has a trip, jobs, tasks and so on to damage. */
function richSnapshot() {
  const s = createCampaign({ seed: 3 });
  command(s, { type: 'wakeDrone', drone: 'drone-01' });
  s.res.sp = 300; s.items.circuit_board = 4; s.items.titanium_plate = 2; s.items.solar_cell = 3;
  s.modules.battery.status = 'online'; s.modules.workshop.status = 'online'; s.modules.greenhouse.status = 'online';
  assert.ok(command(s, { type: 'build', module: 'garage' }).ok);
  assert.ok(command(s, { type: 'craft', recipe: 'repair_kit' }).ok);
  s.tasks.push({ game: 'heat_pump', why: 'x' });
  s.timers.push({ at: s.minute + 500, id: 'd1a' });
  s.mods.push({ id: 'x', res: 'power', perSol: 2, untilMinute: s.minute + 900 });
  s.drones[1].status = 'awake';
  step(s, 200);
  return clone(s);
}

/** [what is damaged, how, what must happen]: 'refuse' = ok false with a reason; 'repair' = loads and keeps running. */
const DAMAGE = [
  ['a null drone', (s) => { s.drones[1] = null; }, 'refuse'],
  ['a drone that is a number', (s) => { s.drones[0] = 7; }, 'refuse'],
  ['the drones are not a list', (s) => { s.drones = { a: 1 }; }, 'refuse'],
  ['only two drones', (s) => { s.drones.pop(); }, 'refuse'],
  ['a drone with a wrong id', (s) => { s.drones[0].id = 'drone-09'; }, 'refuse'],
  ['a drone with a status that does not exist', (s) => { s.drones[2].status = 'flying'; }, 'refuse'],
  ['a build job on a room that does not exist', (s) => { s.drones[0].task = { type: 'build', module: 'xyz' }; }, 'refuse'],
  ['a job of an unknown type', (s) => { s.drones[0].task = { type: 'teleport', module: 'lab' }; }, 'refuse'],
  ['a job that is a string', (s) => { s.drones[0].task = 'build'; }, 'refuse'],
  ['a chore with no end time', (s) => { s.drones[0].task = { type: 'chore', id: 'x', module: 'lab', sols: 1 }; }, 'refuse'],
  ['a queue that is not a list', (s) => { s.drones[0].queue = 'nothing'; }, 'refuse'],
  ['a queue that is too long', (s) => { s.drones[0].queue = Array.from({ length: 12 }, () => ({ type: 'build', module: 'lab' })); }, 'refuse'],
  ['a queued job on an unknown room', (s) => { s.drones[0].queue = [{ type: 'upgrade', module: 'nope' }]; }, 'refuse'],
  ['a queued job that is null', (s) => { s.drones[0].queue = [null]; }, 'refuse'],
  ['a room that does not exist', (s) => { s.modules.xyz = { status: 'online', tier: 1, progress: 0, drone: null, upgrading: null }; }, 'refuse'],
  ['a room that is null', (s) => { s.modules.battery = null; }, 'refuse'],
  ['a room with a status that does not exist', (s) => { s.modules.lab.status = 'weird'; }, 'refuse'],
  ['a room at tier 3', (s) => { s.modules.lab.tier = 3; }, 'refuse'],
  ['a room whose progress is a string', (s) => { s.modules.garage.progress = 'half'; }, 'refuse'],
  ['a room whose progress is 9', (s) => { s.modules.garage.progress = 9; }, 'refuse'],
  ['a room built by a drone that does not exist', (s) => { s.modules.garage.drone = 'drone-77'; }, 'refuse'],
  ['an upgrade that is a number', (s) => { s.modules.battery.upgrading = 5; }, 'refuse'],
  ['a task for a game that does not exist', (s) => { s.tasks.push({ game: 'xyz', why: 'x' }); }, 'refuse'],
  ['a task that is null', (s) => { s.tasks.push(null); }, 'refuse'],
  ['the tasks are a number', (s) => { s.tasks = 3; }, 'refuse'],
  ['a timer with no time', (s) => { s.timers.push({ id: 'd1a' }); }, 'refuse'],
  ['a modifier on a meter that does not exist', (s) => { s.mods.push({ id: 'x', res: 'luck', perSol: 1, untilMinute: null }); }, 'refuse'],
  ['a modifier with no amount', (s) => { s.mods.push({ id: 'x', res: 'power' }); }, 'refuse'],
  ['a card of an unknown kind', (s) => { s.pending = { kind: 'quiz', id: 'd1' }; }, 'refuse'],
  ['a trip to a place that does not exist', (s) => { s.away = { key: 'zzz', start: 0, end: 5, hpTotal: 1, hpDone: 0, fired: [] }; }, 'refuse'],
  ['a trip with no end', (s) => { s.away = { key: 1, start: 0, hpTotal: 1, hpDone: 0, fired: [] }; }, 'refuse'],
  ['a Workshop job for a recipe that does not exist', (s) => { s.crafting = { recipe: 'zzz', progress: 0 }; }, 'refuse'],
  ['negative items', (s) => { s.items.circuit_board = -3; }, 'refuse'],
  ['items that are not numbers', (s) => { s.items.circuit_board = 'two'; }, 'refuse'],
  ['kits that are not an object', (s) => { s.kits = []; }, 'refuse'],
  ['the flags are a string', (s) => { s.flags = 'oops'; }, 'refuse'],
  ['the stats are a list', (s) => { s.stats = []; }, 'refuse'],
  ['the logbook is not a list', (s) => { s.logbook = 5; }, 'refuse'],
  ['the choices are not a list', (s) => { s.choices = { d1: 'a' }; }, 'refuse'],
  ['the order is damaged', (s) => { s.order = { place: 5 }; }, 'refuse'],
  ['the sun multiplier is not a number', (s) => { s.mult.solar = 'bright'; }, 'refuse'],
  ['the minute is a string', (s) => { s.minute = 'noon'; }, 'refuse'],
  ['a save from a newer version', (s) => { s.version = 99; }, 'refuse'],
  ['a meter that is not a number', (s) => { s.res.water = 'lots'; }, 'repair'],
  ['a meter that is missing', (s) => { delete s.res.oxygen; }, 'repair'],
  ['hp that is null', (s) => { s.hp = null; }, 'repair'],
  ['research that is a string', (s) => { s.research = 'a lot'; }, 'repair'],
];

test('a damaged save is refused with a reason, or repaired, and it never throws', () => {
  const base = richSnapshot();
  assert.equal(restoreSave(clone(base)).ok, true, 'the undamaged snapshot loads');
  for (const [what, damage, expected] of DAMAGE) {
    const s = clone(base);
    damage(s);
    let r;
    assert.doesNotThrow(() => { r = restoreSave(s); }, `${what}: restoreSave threw`);
    if (expected === 'refuse') {
      assert.equal(r.ok, false, `${what}: should have been refused`);
      assert.ok(typeof r.reason === 'string' && r.reason.length > 3, `${what}: no reason`);
    } else {
      assert.equal(r.ok, true, `${what}: should have been repaired (${r.reason})`);
      assert.doesNotThrow(() => step(r.state, 3 * 1440), `${what}: the repaired game stops running`);
      for (const v of Object.values(r.state.res)) assert.ok(Number.isFinite(v), `${what}: a meter is still not a number`);
      assert.ok(Number.isFinite(r.state.hp));
    }
  }
});

test('the two failures of the ticket: a null drone and an unknown build room', () => {
  const s = richSnapshot();
  s.drones[1] = null;
  assert.equal(restoreSave(s).ok, false);
  const t = richSnapshot();
  t.drones[0].task = { type: 'build', module: 'not-a-room' };
  const r = restoreSave(t);
  assert.equal(r.ok, false);
  assert.match(r.reason, /unknown room/);
});

test('a save cannot reach the prototype: "__proto__" keys are ignored', () => {
  const raw = JSON.stringify(richSnapshot()).replace('"version":', '"__proto__":{"polluted":true},"flags":{"__proto__":{"polluted":true}},"version":');
  const parsed = JSON.parse(raw);
  const r = restoreSave(parsed);
  assert.equal(r.ok, true);
  assert.equal({}.polluted, undefined, 'Object.prototype was changed');
  assert.equal(r.state.polluted, undefined);
  assert.equal(r.state.flags.polluted, undefined);
});

test('random damage anywhere in a save never throws, and what loads keeps running (400 random cases)', () => {
  const rnd = rngOf(424242);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const junk = () => pick([null, 'x', '', -1, 1e9, 0, true, [], {}, [1], { a: 1 }, 0.5, 'drone-01']);
  const bases = [richSnapshot(), ...snapshots(2, 12, 2000).slice(0, 4)];
  /** Every path into a JSON value (keys and indexes), to choose one to damage. */
  const paths = (v, prefix = [], out = [], depth = 0) => {
    if (depth > 4 || v === null || typeof v !== 'object') return out;
    for (const k of Object.keys(v)) { out.push([...prefix, k]); paths(v[k], [...prefix, k], out, depth + 1); }
    return out;
  };
  let refused = 0;
  let loaded = 0;
  for (let i = 0; i < 400; i++) {
    const s = clone(pick(bases));
    const all = paths(s);
    for (let n = 1 + Math.floor(rnd() * 3); n > 0; n--) {
      const path = pick(all);
      let node = s;
      for (const k of path.slice(0, -1)) node = node?.[k];
      if (node && typeof node === 'object') node[path[path.length - 1]] = junk();
    }
    let r;
    assert.doesNotThrow(() => { r = restoreSave(clone(s)); }, `case ${i}: restoreSave threw`);
    if (!r.ok) { refused++; assert.ok(typeof r.reason === 'string'); continue; }
    loaded++;
    // a save that was let in must not break later: a long run, a few commands, and it must still be plain JSON
    assert.doesNotThrow(() => {
      const g = r.state;
      step(g, 3 * 1440);
      command(g, { type: 'build', module: 'lab' });
      command(g, { type: 'craft', recipe: 'repair_kit' });
      step(g, 2 * 1440);
      JSON.stringify(g);
    }, `case ${i}: a loaded save broke the game later`);
  }
  assert.ok(refused > 50 && loaded > 50, `refused ${refused}, loaded ${loaded}: the damage must be varied enough to hit both outcomes`);
});
