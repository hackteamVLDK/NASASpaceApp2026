import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, command, step, unlockReason, rates } from '../src/campaign/engine.js';
import { SOL, FOLLOWUPS } from '../src/campaign/data.js';
import { clockAt, at } from '../src/campaign/util.js';
import { storyMinute, runTimer, canFinale, onSol } from '../src/campaign/story.js';
import { EXPEDITIONS, finaleBlock, expectedLoot } from '../src/campaign/expeditions.js';
import { STRINGS, choicePreview } from '../src/campaign/choices-data.js';
import { restoreSave } from '../src/campaign/save-migrate.js';
import { STRATEGIES, play } from '../tools/balance/strategy-lab.mjs';

const clone = (s) => JSON.parse(JSON.stringify(s));
const quiet = () => {};
const split = (key) => [key.slice(0, -1), key.slice(-1)];
function base() {
  const s = createCampaign({ seed: 1 });
  s.minute = at(12, 12);
  for (const m of Object.values(s.modules)) m.status = 'online';
  for (const d of s.drones) d.status = 'awake';
  s.res = { power: 100, heat: 50, water: 50, oxygen: 50, food: 50, morale: 50, sp: 100 };
  s.hp = 70;
  s.upgrades = { titanium_wheels: true, deep_ice_drill: true, rover_shielding: true };
  s.items = { titanium_plate: 10, circuit_board: 10, solar_cell: 10, lab_sensor_kit: 1, weather_sensor: 1 };
  Object.assign(s.flags, { _d1: true, _d2: true, _d3: true, _d4: true, _stormBegin: true, _stormMid: true,
    breaks: { last: 100, due: {} } });
  return s;
}
function choose(s, key) {
  const [id, choice] = split(key);
  s.pending = { kind: id.startsWith('e') ? 'event' : 'dilemma', id };
  const result = command(s, { type: 'choose', choice });
  assert.equal(result.ok, true, `${key}: ${result.error}`);
  return result.events;
}
function story(s) {
  const events = [];
  storyMinute(s, (e) => events.push(e), clockAt(s.minute));
  return events;
}
function open(id) {
  const s = base();
  choose(s, FOLLOWUPS[id].parent);
  s.minute += FOLLOWUPS[id].delay * SOL;
  story(s);
  assert.deepEqual(s.pending, { kind: 'dilemma', id });
  return s;
}
function answer(s, c) {
  // Isolate the new card's changes from its parent's scenario cost.
  s.res.sp = 100; s.res.water = s.res.food = s.res.morale = 50; s.research = 0; s.hp = 70;
  const r = command(s, { type: 'choose', choice: c });
  assert.equal(r.ok, true, r.error);
  return r.events;
}
function win(s, game) {
  const r = command(s, { type: 'miniResult', game, win: true });
  assert.equal(r.ok, true, r.error);
}
function elapsed(s, sols) {
  s.minute += sols * SOL;
  for (const t of [...s.timers]) if (t.at <= s.minute) {
    s.timers = s.timers.filter((x) => x !== t);
    runTimer(s, t.id, quiet);
  }
  story(s);
}

for (const [id, follow] of Object.entries(FOLLOWUPS)) {
  test(`${id}: only ${follow.parent} opens it, at +${follow.delay} Sols; away and pending defer it`, () => {
    const [parent, chosen] = split(follow.parent);
    for (const c of ['a', 'b', 'c']) {
      const s = base(); choose(s, `${parent}${c}`);
      s.minute += follow.delay * SOL - 1;
      story(s);
      assert.notEqual(s.pending?.id, id);
      s.minute++;
      const events = story(s);
      assert.equal(s.pending?.id === id, c === chosen);
      assert.equal(events.some((e) => e.type === 'dilemma' && e.id === id), c === chosen);
    }
    const s = base(); choose(s, follow.parent); s.minute += follow.delay * SOL;
    s.away = {}; story(s); assert.equal(s.pending, null);
    s.away = null; s.pending = { kind: 'event', id: 'e4' }; story(s);
    assert.equal(s.pending.id, 'e4');
    s.pending = null; story(s); assert.equal(s.pending.id, id);
    answer(s, 'c');
    assert.equal(s.path[id], 'c');
    assert.ok(s.choices.includes(`${id}c`));
    s.minute += SOL; story(s); assert.notEqual(s.pending?.id, id, 'answered card repeated');
  });

  test(`${id}: every card string and preview exists; empty supplies always leave a free choice`, () => {
    for (const key of [`ui.${id}.header`, `ui.${id}.title`, `astra.${id}.alert`, ...['a', 'b', 'c'].map((c) => `ui.${id}.${c}.label`)]) assert.ok(STRINGS[key], key);
    for (const c of ['a', 'b', 'c']) {
      const lines = choicePreview(id, c);
      assert.ok(lines.length && lines.length <= 3);
      for (const line of lines) assert.ok(line.split(/\s+/).length <= 10, line);
      lines.pop(); assert.notDeepEqual(lines, choicePreview(id, c));
    }
    const s = open(id); s.res.sp = s.res.water = s.res.food = 0;
    const before = clone(s);
    const paid = ['a', 'b', 'c'].find((c) => FOLLOWUPS[id][c].cost);
    if (paid) {
      const denied = command(s, { type: 'choose', choice: paid });
      assert.equal(denied.ok, false); assert.deepEqual(s, before);
    }
    const free = ['a', 'b', 'c'].find((c) => !FOLLOWUPS[id][c].cost);
    assert.equal(command(s, { type: 'choose', choice: free }).ok, true);
  });
}

test('Power Saver opens Recreation at the Workshop; other storm choices still need the Lab', () => {
  for (const c of ['a', 'b', 'c']) {
    const s = base(); s.modules.lab.status = s.modules.recreation.status = 'unbuilt';
    choose(s, `d1${c}`);
    assert.equal(unlockReason(s, 'recreation') === null, c === 'a');
    assert.equal(command(s, { type: 'build', module: 'recreation' }).ok, c === 'a');
  }
});

test('fixing the filter opens the roof before the Lab, with its ordinary materials cost', () => {
  for (const c of ['a', 'b', 'c']) {
    const s = base(); s.modules.lab.status = s.modules.roof.status = 'unbuilt';
    choose(s, `d2${c}`);
    assert.equal(command(s, { type: 'build', module: 'roof' }).ok, c === 'a');
    if (c === 'a') { assert.equal(s.items.titanium_plate, 9); assert.equal(s.res.sp, 78); }
  }
});

test('f1: paying parts, waiting with travel closed, or cancelling the plan have different costs', () => {
  const a = open('f1'); answer(a, 'a'); assert.equal(a.res.sp, 92);
  const b = open('f1'); const power = b.res.power; answer(b, 'b');
  assert.equal(b.res.power, power - 20);
  assert.ok(EXPEDITIONS[1].requires(b)); assert.equal(command(b, { type: 'upgrade', module: 'solar' }).ok, false);
  assert.match(unlockReason(b, 'solar', 'upgrade'), /tilt motor/);
  elapsed(b, 1); assert.equal(EXPEDITIONS[1].requires(b), null);
  assert.equal(command(b, { type: 'upgrade', module: 'solar' }).ok, true);
  const c = open('f1'); answer(c, 'c'); assert.equal(c.res.morale, 47);
  for (const s of [a, b, c]) assert.ok(s.flags.choiceEffects.d1.until <= s.minute);
});

test('f2: trailer blocks only Scrap Runs, and every balance option reopens them', () => {
  for (const c of ['a', 'b', 'c']) {
    const s = open('f2');
    assert.ok(EXPEDITIONS.run.requires(s)); assert.equal(EXPEDITIONS[1].requires(s), null);
    answer(s, c);
    if (c === 'a') { assert.equal(s.res.sp, 92); assert.ok(EXPEDITIONS.run.requires(s)); win(s, 'wheel_vacuum'); }
    if (c === 'b') { elapsed(s, 2 - 1 / SOL); assert.ok(EXPEDITIONS.run.requires(s)); elapsed(s, 1 / SOL); }
    if (c === 'c') { assert.equal(s.res.morale, 47); assert.equal(expectedLoot(s, EXPEDITIONS.run).sp, 15); }
    assert.equal(EXPEDITIONS.run.requires(s), null);
    assert.equal(command(s, { type: 'launch', expedition: 'run' }).ok, true);
    assert.equal(s.flags.cargoTrailer, true, 'original Expedition 1 bonus remains');
  }
});

test('f3: farm expansion waits for cleaning, washed Soil Beds, or composting; hydroponics keeps running', () => {
  for (const c of ['a', 'b', 'c']) {
    const s = open('f3'); assert.equal(command(s, { type: 'upgrade', module: 'greenhouse' }).ok, false);
    assert.ok(rates(s).food > 0, 'existing hydroponics must keep growing'); answer(s, c);
    if (c === 'a') { assert.equal(s.res.water, 45); win(s, 'nutrient_match'); }
    if (c === 'b') {
      assert.equal(s.res.water, 30); assert.ok(!s.flags.soilBeds);
      elapsed(s, 2); assert.equal(s.flags.soilBeds, true);
      assert.equal(s.mods.find((m) => m.id === 'd3b_beds').perSol, 3);
      assert.ok(s.choices.includes('d3b'));
    }
    if (c === 'c') { assert.equal(s.res.morale, 45); assert.equal(s.research, 8); }
    assert.equal(command(s, { type: 'upgrade', module: 'greenhouse' }).ok, true);
  }
});

test('f4: separate wiring costs parts, a Heat Pump repair gates expansion, and removing trays ends their plan', () => {
  const a = open('f4'); answer(a, 'a'); assert.equal(a.res.sp, 90); assert.equal(a.research, 5);
  const b = open('f4'); answer(b, 'b'); assert.equal(command(b, { type: 'upgrade', module: 'greenhouse' }).ok, false);
  win(b, 'heat_pump'); assert.equal(command(b, { type: 'upgrade', module: 'greenhouse' }).ok, true);
  const c = open('f4'); answer(c, 'c'); assert.equal(c.research, 5);
  assert.ok(c.flags.choiceEffects.d3.until <= c.minute);
});

test('f5/f6: distinct route plans gate both the finale preview and actual launch, then always reopen', () => {
  for (const [id, c, sols] of [['f5', 'a', 1], ['f5', 'b', 3], ['f5', 'c', 0], ['f6', 'a', 0], ['f6', 'b', 4], ['f6', 'c', 2]]) {
    const s = open(id); s.modules.garage.tier = s.modules.lab.tier = 2;
    answer(s, c); s.research += 1000;
    if (id === 'f5' && c === 'c') assert.equal(s.res.food, 35);
    else {
      assert.ok(finaleBlock(s)); assert.equal(canFinale(s), false);
      assert.equal(command(s, { type: 'launch', expedition: 5 }).ok, false);
      if (id === 'f6' && c === 'a') { assert.equal(s.res.sp, 88); win(s, 'antenna'); }
      else {
        if (id === 'f6' && c === 'c') assert.equal(s.hp, 62);
        s.minute += sols * SOL - 1; story(s); assert.ok(finaleBlock(s));
        s.minute++; story(s);
      }
    }
    assert.equal(finaleBlock(s), null); assert.equal(canFinale(s), true);
    assert.equal(command(s, { type: 'launch', expedition: 5 }).ok, true);
  }
});

test('f7: parts or testing enable a real early forecast before Lab T2; research alone does not', () => {
  for (const c of ['a', 'b', 'c']) {
    const s = open('f7'); answer(s, c);
    if (c === 'a') assert.equal(s.res.sp, 94);
    if (c === 'b') {
      assert.equal(s.flags.branchForecast, undefined);
      assert.equal(command(s, { type: 'upgrade', module: 'lab' }).ok, false);
      elapsed(s, 2); assert.equal(command(s, { type: 'upgrade', module: 'lab' }).ok, true);
    }
    if (c === 'c') assert.equal(s.research, 8);
    s.minute = at(20); s.flags.lastEvent = {};
    onSol(s, quiet, clockAt(s.minute), () => 0);
    assert.equal(Boolean(s.flags.flareWarned), c !== 'c');
    assert.equal(s.timers.find((t) => t.id === 'event:e1').at, at(c === 'c' ? 20 : 21, 10));
  }
});

test('e2 B needs panel deployment; e3 A needs the leak repair, only on their own paths', () => {
  for (const c of ['a', 'b', 'c']) {
    const panels = base(); choose(panels, `e2${c}`);
    assert.equal(Boolean(EXPEDITIONS.run.requires(panels)), c === 'b');
    if (c === 'b') {
      assert.equal(command(panels, { type: 'upgrade', module: 'solar' }).ok, false);
      win(panels, 'solar_wipe'); assert.equal(EXPEDITIONS.run.requires(panels), null);
      assert.equal(command(panels, { type: 'upgrade', module: 'solar' }).ok, true);
    }
    const leak = base(); leak.modules.roof.status = 'unbuilt'; choose(leak, `e3${c}`);
    assert.equal(unlockReason(leak, 'roof') !== null, c === 'a');
    assert.equal(Boolean(EXPEDITIONS[4].requires(leak)), c === 'a');
    if (c === 'a') {
      assert.match(unlockReason(leak, 'roof'), /Valve Balance/); win(leak, 'valve_balance');
      assert.equal(command(leak, { type: 'build', module: 'roof' }).ok, true);
      assert.equal(EXPEDITIONS[4].requires(leak), null);
    }
  }
});

test('f8: permanent seal, closed-airlock repair, and recurring tape checks have different recovery routes', () => {
  const a = open('f8'); answer(a, 'a'); assert.equal(a.res.sp, 92);
  assert.ok(EXPEDITIONS[1].requires(a)); win(a, 'valve_balance'); assert.equal(EXPEDITIONS[1].requires(a), null);
  const b = open('f8'); runTimer(b, 'leak_returns', quiet); answer(b, 'b');
  assert.ok(!b.mods.some((m) => m.id === 'leak')); assert.ok(EXPEDITIONS.ice.requires(b));
  elapsed(b, 2); assert.equal(EXPEDITIONS.ice.requires(b), null);
  const c = open('f8'); answer(c, 'c'); elapsed(c, 2);
  assert.equal(c.mods.find((m) => m.id === 'branch:tape').perSol, -6);
  win(c, 'valve_balance'); assert.ok(!c.mods.some((m) => m.id === 'branch:tape'));
});

for (const [key, id, game, res, penalty] of [['e1b', 'suit', 'suit_seal', 'hp', -24], ['e2c', 'panels', 'solar_wipe', 'power', -18]]) {
  test(`${key}: extra ${game} care outlives six Sols, is temporarily cleared by play, and permanently repaired at Workshop T2`, () => {
    const s = base(); choose(s, key);
    elapsed(s, 2); assert.ok(s.tasks.some((t) => t.game === game));
    assert.equal(s.mods.find((m) => m.id === `branch:${id}`).perSol, penalty);
    win(s, game); assert.ok(!s.mods.some((m) => m.id === `branch:${id}`));
    elapsed(s, 6); assert.equal(s.mods.find((m) => m.id === `branch:${id}`).res, res);
    assert.equal(s.tasks.filter((t) => t.game === game).length, 1);
    s.modules.workshop.tier = 2; story(s);
    assert.ok(!s.mods.some((m) => m.id === `branch:${id}`));
    win(s, game); elapsed(s, 2); assert.ok(!s.tasks.some((t) => t.game === game));
    for (const c of ['a', 'b', 'c'].filter((c) => c !== key.slice(-1))) {
      const other = base(); choose(other, `${key.slice(0, -1)}${c}`);
      assert.ok(!other.flags.branches?.upkeep[id]);
    }
  });
}

test('a follow-up is checkpointed, saved, and restored with the same decision, gates and repair work', () => {
  const s = open('f6'); step(s, 1);
  assert.equal(s.checkpoint.id, 'f6');
  const restored = restoreSave(clone(s)); assert.equal(restored.ok, true, restored.reason);
  assert.deepEqual(restored.state, s);
  for (const g of [s, restored.state]) { answer(g, 'b'); step(g, 30); }
  assert.deepEqual(restored.state, s);
});

test('a repeated event cancels its unshown follow-up when a different choice replaces it', () => {
  const s = base(); choose(s, 'e1c'); choose(s, 'e1a'); elapsed(s, 2);
  assert.notEqual(s.pending?.id, 'f7');
});

test('extension flags damaged by older save validators do not break later repairs or decisions', () => {
  for (const junk of [null, '', true, 0, [], [1], { x: null }]) {
    for (const field of [null, 'followups', 'gates', 'upkeep']) {
      const s = open('f8');
      if (field) s.flags.branches[field] = clone(junk); else s.flags.branches = clone(junk);
      s.pending = null;
      assert.doesNotThrow(() => { story(s); choose(s, 'e1b'); win(s, 'suit_seal'); });
    }
  }
});

test('ignoring the working-through-a-flare seal checks costs a life; maintaining the same base costs none', () => {
  for (const careful of [false, true]) {
    const s = base();
    s.modules.solar.tier = s.modules.battery.tier = 2;
    Object.assign(s.res, { power: 400, heat: 100, water: 100, oxygen: 100, food: 100, morale: 100 });
    s.flags.lastEvent = { e1: 100, e2: 100, e3: 100, e4: 100 };
    s.pending = { kind: 'event', id: 'e1' };
    step(s, 0); // capture the real decision checkpoint before answering
    assert.equal(command(s, { type: 'choose', choice: 'b' }).ok, true);
    for (let i = 0; i < 16 * 48 && !s.stats.livesLost; i++) {
      if (careful) for (const t of [...s.tasks]) win(s, t.game);
      step(s, 30);
    }
    assert.equal(s.stats.livesLost, careful ? 0 : 1);
    if (careful) assert.equal(s.hp, 100);
    else {
      assert.equal(s.pending.id, 'e1', 'the player can replay the decision more carefully');
      assert.equal(command(s, { type: 'choose', choice: 'a' }).ok, true);
      assert.equal(s.status, 'running');
    }
  }
});

test('careful A/B/C finish 8/8 seeds with visibly distinct outcomes; neglecting a bold path costs lives', () => {
  const runs = ['recommended', 'always-b', 'always-c'].map((name) => Array.from({ length: 8 }, (_, i) => play(name, i + 1)));
  for (const group of runs) for (const r of group) assert.ok(r.finaleSol !== null && r.finaleSol <= 30, `${r.name} seed ${r.seed}: ${r.finaleSol}`);
  assert.ok(runs[0].some((a, i) => {
    const paths = runs.map((group) => group[i]);
    return Math.max(...paths.map((r) => r.finaleSol)) - Math.min(...paths.map((r) => r.finaleSol)) >= 3
      || new Set(paths.map((r) => `${r.modules}:${r.tier2}:${r.cards}:${r.badges}`)).size > 1;
  }));
  let livesLost = 0;
  const observe = (s) => { livesLost = Math.max(livesLost, s.stats.livesLost); };
  STRATEGIES['branch-sloppy-c'] = { ...STRATEGIES['idle-c'], acts: [...STRATEGIES['idle-c'].acts, observe] };
  try { play('branch-sloppy-c', 1); } finally { delete STRATEGIES['branch-sloppy-c']; }
  assert.ok(livesLost > 0, `lives lost: ${livesLost}`);
});
