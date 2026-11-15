import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, command, rates, step } from '../src/campaign/engine.js';
import { SOL } from '../src/campaign/data.js';
import { at, clockAt } from '../src/campaign/util.js';
import { applyChoice, rememberChoice, refreshChoiceEffects, runTimer, storyMinute, onMini } from '../src/campaign/story.js';
import { EXPEDITIONS, durationMinutes, hpCost, expectedLoot, radioChoice, startExpedition, expeditionMinute } from '../src/campaign/expeditions.js';
import { CHOICE_EFFECTS, CHOICE_RULES, choicePreview, STRINGS } from '../src/campaign/choices-data.js';
import { restoreSave } from '../src/campaign/save-migrate.js';
import { play } from '../tools/balance/strategy-lab.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const clone = (s) => JSON.parse(JSON.stringify(s));
function base() {
  const s = createCampaign({ seed: 1 });
  s.minute = at(12, 12);
  for (const m of Object.values(s.modules)) { m.status = 'online'; m.tier = 1; }
  for (const d of s.drones) d.status = 'awake';
  s.res = { power: 100, heat: 50, water: 50, oxygen: 50, food: 50, morale: 50, sp: 100 };
  s.hp = 70;
  s.flags._d1 = s.flags._d2 = s.flags._d3 = s.flags._d4 = true;
  s.flags._stormBegin = s.flags._stormMid = true;
  s.flags.breaks = { last: 100, due: {} };
  return s;
}
const split = (key) => [key.slice(0, -1), key.slice(-1)];
const pick = (s, key) => {
  const [id, choice] = split(key);
  if (id.startsWith('exp')) {
    const ex = id === 'exp2.60' ? 2 : 3;
    s.away = { id: ex, key: ex, start: s.minute - SOL / 2, end: s.minute + SOL / 2, hpTotal: 20, hpDone: 10, decisionDone: false, fired: [] };
    s.pending = { kind: 'radio', id };
    assert.equal(radioChoice(s, choice, () => {}), null);
    s.away = null;
  } else applyChoice(s, { kind: id.startsWith('d') ? 'dilemma' : 'event', id }, choice, () => {}, () => 0.1);
};

// Independent expectations: assert a real rate/route/cargo change, rather than just stored flags.
const lasting = {
  d1a: ['sp', -1.2], d1b: ['power', 10], d1c: ['sp', -1.8],
  d2a: ['sp', -1.2], d2b: ['scrap', 21], d2c: ['food', -2],
  d3a: ['food', -2], d3b: ['water', -2], d3c: ['food', 2],
  d4a: ['food', 3], d4b: ['power', -3], d4c: ['power', 2],
  d5a: ['time', 0.8], d5b: ['time', 1.2], d5c: ['scrap', 21],
  e1a: ['sp', -1.2], e1b: ['sp', 2.4], e1c: ['research', 1.5 / SOL],
  e2a: ['scrap', 19], e2b: ['power', -10], e2c: ['power', 10],
  e3a: ['oxygen', 2.8], e3b: ['scrap', 19], e3c: ['time', 1.2],
  'exp2.60a': ['time', 1.2], 'exp2.60b': ['scrap', 19],
  'exp3.85a': ['ice', 3], 'exp3.85b': ['time', 0.8],
};
const callbacks = {
  d1a: { morale: 4 }, d1b: { sp: 4 }, d1c: { research: 5 },
  d2a: { water: 8 }, d2b: { sp: 8 }, d2c: { water: 10 },
  d3a: { research: 8 }, d3b: { food: 8 }, d3c: { food: 8 },
  d4a: { food: 10 }, d4b: { research: 10 }, d4c: { power: 15 },
  d5a: { sp: 6 }, d5b: { research: 8 }, d5c: { sp: 10 },
  e1a: { food: 6 }, e1b: { sp: 6 }, e1c: { research: 8 },
  e2a: { sp: 6 }, e2b: { power: 15 }, e2c: { power: 15 },
  e3a: { oxygen: 10 }, e3b: { sp: 6 }, e3c: { water: 10 },
  'exp2.60a': { research: 6 }, 'exp2.60b': { sp: 8 },
  'exp3.85a': { water: 10 }, 'exp3.85b': { power: 15 },
};

for (const key of Object.keys(lasting)) {
  test(`${key}: its own lasting consequence still works after five Sols and expires after six`, () => {
    const s = base();
    pick(s, key);
    const [id, choice] = split(key);
    assert.equal(s.path[id], choice);
    assert.deepEqual(Object.keys(s.flags.choiceEffects), [id]);
    assert.equal(s.flags.choiceEffects[id].key, key);
    s.minute += 5 * SOL;
    // Remove the old, scenario-only effects to isolate the new long-term consequence.
    s.mods = [];
    s.tasks = [];
    s.mult.solar = s.mult.food = 1;
    const control = clone(s);
    delete control.flags.choiceEffects;
    refreshChoiceEffects(s);
    const [what, expected] = lasting[key];
    if (what === 'time') near(durationMinutes(s, EXPEDITIONS.run) / durationMinutes(control, EXPEDITIONS.run), expected);
    else if (what === 'scrap') assert.equal(expectedLoot(s, EXPEDITIONS.run).sp, expected);
    else if (what === 'ice') assert.equal(expectedLoot(s, EXPEDITIONS.ice).items.ice_core, expected);
    else if (what === 'research') {
      const before = s.research;
      storyMinute(s, () => {}, clockAt(s.minute));
      near(s.research - before, expected);
    } else near(rates(s)[what] - rates(control)[what], expected);
    s.minute += SOL;
    refreshChoiceEffects(s);
    assert.ok(!s.mods.some((m) => m.id.startsWith('choice:')));
    near(durationMinutes(s, EXPEDITIONS.run), durationMinutes(control, EXPEDITIONS.run));
    assert.deepEqual(expectedLoot(s, EXPEDITIONS.ice), expectedLoot(control, EXPEDITIONS.ice));
    assert.deepEqual(expectedLoot(s, EXPEDITIONS.run), expectedLoot(control, EXPEDITIONS.run));
  });

  test(`${key}: callback names this choice, changes supplies, fires once, and excludes other branches`, () => {
    const s = base(); pick(s, key);
    const timer = s.timers.find((t) => t.id.startsWith('choice:'));
    assert.equal(timer.at - s.minute, 3 * SOL);
    const events = [];
    runTimer(s, timer.id, () => assert.fail('callback was early'));
    s.minute = timer.at;
    const before = { ...s.res, research: s.research };
    runTimer(s, timer.id, (e) => events.push(e));
    assert.deepEqual(events, [{ type: 'astra', lineId: `astra.choice.${key}.callback`, mood: 'cheerful' }]);
    assert.ok(STRINGS[events[0].lineId].startsWith('Remember'));
    for (const [res, amount] of Object.entries(callbacks[key])) near((res === 'research' ? s.research : s.res[res]) - before[res], amount);
    const after = clone(s);
    runTimer(s, timer.id, (e) => events.push(e));
    assert.deepEqual(s, after);
    assert.equal(events.length, 1);
    // A timer from an option never selected must not apply that option's reward or line.
    const other = `${split(key)[0]}${key.endsWith('a') ? 'b' : 'a'}`;
    const unselected = base(); pick(unselected, other);
    unselected.minute = timer.at;
    const untouched = clone(unselected);
    runTimer(unselected, timer.id, (e) => assert.fail(`other branch emitted ${e.lineId}`));
    assert.deepEqual(unselected, untouched);
  });
}

test('all dilemma/event/radio previews are short, independent arrays; callbacks follow the voice guide', () => {
  for (const id of ['d1', 'd2', 'd3', 'd4', 'd5', 'e1', 'e2', 'e3', 'e4', 'exp2.60', 'exp3.85']) {
    for (const c of id.startsWith('exp') ? ['a', 'b'] : ['a', 'b', 'c']) {
      const preview = choicePreview(id, c);
      assert.ok(preview.length >= 1 && preview.length <= 3, `${id}${c}`);
      for (const text of preview) assert.ok(text.split(/\s+/).length <= 10, text);
      preview.pop();
      assert.notDeepEqual(preview, choicePreview(id, c));
    }
  }
  assert.deepEqual(choicePreview('unknown', 'a'), []);
  assert.deepEqual(choicePreview('d1', 'unknown'), []);
  for (const text of Object.values(STRINGS)) {
    assert.ok(text.split(/\s+/).length <= 25, text);
    assert.ok(!/\b(death|die|dying|kill|doom)\b|you failed/i.test(text), text);
    for (const sentence of text.split(/[.!?]/).filter((x) => x.trim())) assert.ok(sentence.trim().split(/\s+/).length < 20, sentence);
  }
  assert.equal(CHOICE_RULES.source, 'gameplay');
  assert.deepEqual(Object.keys(CHOICE_EFFECTS).sort(), Object.keys(lasting).sort());
});

test('recurring upkeep starts after two Sols, a win clears its penalty, and it returns two Sols later', () => {
  for (const [key, game, res, penalty] of [['d1b', 'solar_wipe', 'power', -6], ['e2c', 'solar_wipe', 'power', -8], ['e1b', 'suit_seal', 'hp', -4], ['e3b', 'valve_balance', 'water', -2]]) {
    const s = base(); rememberChoice(s, ...split(key));
    const first = s.minute + 2 * SOL;
    s.minute = first - 1; storyMinute(s, () => {}, clockAt(s.minute));
    assert.ok(!s.tasks.some((t) => t.game === game));
    const net = s.mods.filter((m) => m.id.startsWith('choice:') && m.res === res).reduce((n, m) => n + m.perSol, 0);
    s.minute++; storyMinute(s, () => {}, clockAt(s.minute));
    assert.ok(s.tasks.some((t) => t.game === game));
    near(s.mods.filter((m) => m.id.startsWith('choice:') && m.res === res).reduce((n, m) => n + m.perSol, 0) - net, penalty);
    onMini(s, { game, win: true }, () => {});
    assert.ok(!s.tasks.some((t) => t.game === game));
    s.minute += 2 * SOL; storyMinute(s, () => {}, clockAt(s.minute));
    assert.equal(s.tasks.filter((t) => t.game === game).length, 1);
  }
});

test('tray/forecast plans occupy a drone repeatedly without duplicating queued work, and wait while away', () => {
  for (const [id, c, job] of [['d4', 'c', 'warm_trays'], ['e1', 'c', 'forecast_check']]) {
    const s = base(); rememberChoice(s, id, c);
    s.minute += 2 * SOL;
    s.away = {}; storyMinute(s, () => {}, clockAt(s.minute));
    assert.ok(s.drones.every((d) => !d.task));
    s.away = null; storyMinute(s, () => {}, clockAt(s.minute));
    assert.equal(s.drones[0].task.id, job);
    near(s.drones[0].task.until - s.minute, 0.25 * SOL);
    s.minute += 2 * SOL; storyMinute(s, () => {}, clockAt(s.minute));
    assert.equal(s.drones.filter((d) => d.task?.id === job).length, 1);
    assert.ok(s.drones.every((d) => d.queue.length === 0));
  }
});

test('tier changes, darkness from a storm, a dry greenhouse, and power outages affect choice production too', () => {
  const s = base(); rememberChoice(s, 'd3', 'c');
  near(rates(s).food, 6); // 10 * 1.2 - 6 meals
  s.modules.greenhouse.tier = 2; refreshChoiceEffects(s);
  near(rates(s).food, 13.2); // 16 * 1.2 - 6 meals
  s.res.water = 0; refreshChoiceEffects(s); near(rates(s).food, -6);
  s.res.water = 50; s.res.power = 0; refreshChoiceEffects(s); near(rates(s).food, -6);
  const p = base(); rememberChoice(p, 'd1', 'b');
  p.storm = { until: p.minute + SOL }; refreshChoiceEffects(p);
  near(p.mods.find((m) => m.id === 'choice:d1b:power').perSol, 3); // 20% of 50 * 0.3
  const saver = base(); rememberChoice(saver, 'd1', 'a');
  saver.storm = { until: saver.minute + SOL }; refreshChoiceEffects(saver);
  near(saver.mods.find((m) => m.id === 'choice:d1a:power').perSol, 16); // also saves 20% of the storm heater load
});

test('route HP reductions are effort/exposure modifiers, stack within bounds, and do not remove radiation', () => {
  const s = base(), control = base();
  rememberChoice(s, 'e1', 'a');
  near(hpCost(s, EXPEDITIONS.run) / hpCost(control, EXPEDITIONS.run), 0.8);
  for (const [id, c] of [['e2', 'b'], ['d5', 'b'], ['exp2.60', 'a']]) rememberChoice(s, id, c);
  assert.ok(hpCost(s, EXPEDITIONS.run) > 0);
  assert.ok(durationMinutes(s, EXPEDITIONS.run) <= SOL * CHOICE_RULES.maxTripTime);
});

test('repeatable cargo preview matches return rewards even when the plan expires mid-trip; rough still halves loot', () => {
  for (const rough of [false, true]) {
    const s = base(); rememberChoice(s, 'd2', 'b');
    const loot = expectedLoot(s, EXPEDITIONS.run);
    assert.equal(startExpedition(s, 'run', () => {}), null);
    s.minute = s.away.end + 7 * SOL;
    s.away.result = rough ? 'rough' : 'smooth';
    const events = [];
    expeditionMinute(s, (e) => events.push(e));
    assert.equal(events.find((e) => e.type === 'returned').loot.sp, Math.floor(loot.sp * (rough ? 0.5 : 1)));
  }
});

test('choice paths, pending callbacks and effects survive a save; old saves need no new fields', () => {
  const s = base(); rememberChoice(s, 'd1', 'a');
  const loaded = restoreSave(clone(s));
  assert.equal(loaded.ok, true, loaded.reason);
  assert.deepEqual(loaded.state, s);
  const a = clone(s), b = clone(loaded.state);
  assert.deepEqual(step(a, 60), step(b, 60)); assert.deepEqual(a, b);
  const old = base(); assert.equal(restoreSave(old).ok, true);
});

test('repeated events replace only their own plan and stale callbacks cannot pay another option', () => {
  const s = base(); rememberChoice(s, 'e2', 'a');
  const stale = s.timers[0];
  s.minute += SOL; rememberChoice(s, 'e2', 'b');
  rememberChoice(s, 'd1', 'a');
  assert.equal(s.path.e2, 'b');
  assert.equal(Object.keys(s.flags.choiceEffects).length, 2);
  runTimer(s, stale.id, () => assert.fail('stale callback'));
  assert.ok(!s.mods.some((m) => m.id.startsWith('choice:e2a:')));
});

test('new decision records repair malformed fields accepted by older save validators', () => {
  for (const junk of [null, '', 'x', 0, true, [], [1]]) {
    const s = base(); s.path = clone(junk); s.flags.choiceEffects = clone(junk);
    assert.doesNotThrow(() => rememberChoice(s, 'd2', 'a'));
    assert.equal(s.path.d2, 'a');
    assert.equal(s.flags.choiceEffects.d2.key, 'd2a');
    assert.doesNotThrow(() => refreshChoiceEffects(s));
  }
});

test('public commands record radio history and paths, including choices without extended effects', () => {
  const s = base(); s.pending = { kind: 'event', id: 'e4' };
  assert.equal(command(s, { type: 'choose', choice: 'b' }).ok, true);
  assert.equal(s.path.e4, 'b'); assert.ok(s.choices.includes('e4b'));
  s.pending = { kind: 'radio', id: 'exp2.60' };
  s.away = { id: 2, end: s.minute + SOL, start: s.minute - SOL, hpTotal: 20 };
  assert.equal(command(s, { type: 'radio', choice: 'b' }).ok, true);
  assert.equal(s.path['exp2.60'], 'b'); assert.ok(s.choices.includes('exp2.60b'));
});

test('always A/B/C still reach the finale and produce different timing or Research', () => {
  const runs = ['recommended', 'always-b', 'always-c'].map((name) => play(name, 1));
  for (const r of runs) assert.ok(r.finaleSol !== null && r.finaleSol <= 30, `${r.name}: ${r.finaleSol}`);
  assert.equal(new Set(runs.map((r) => `${r.finaleSol}:${r.research}`)).size, 3);
});
