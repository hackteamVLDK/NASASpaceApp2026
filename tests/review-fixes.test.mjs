// Regressions found by a review of the playable campaign: logic that broke a rule of SCENARIO.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, command, rates, contributions, locationAt } from '../src/campaign/engine.js';
import { awayProgress } from '../src/campaign/expeditions.js';
import { at } from '../src/campaign/util.js';

const ready = (seed = 1) => {
  const s = createCampaign({ seed });
  command(s, { type: 'wakeDrone', drone: 'drone-01' });
  for (const d of s.drones) d.status = 'awake';
  for (const id of ['battery', 'workshop', 'greenhouse', 'garage', 'lab', 'recreation', 'roof']) s.modules[id].status = 'online';
  s.res.sp = 500;
  return s;
};
const answer = (s) => { if (s.pending) command(s, s.pending.kind === 'radio' ? { type: 'radio', choice: 'a' } : { type: 'choose', choice: 'a' }); };

test('a drone keeps at most 2 waiting jobs, even when the player picks that drone', () => {
  const s = ready();
  for (const id of ['battery', 'workshop', 'greenhouse', 'garage', 'lab', 'recreation', 'roof']) s.modules[id].status = 'unbuilt';
  s.modules.battery.status = 'online';
  s.items.dish_antenna = 1; s.items.titanium_plate = 1;
  s.modules.greenhouse.status = 'online'; s.modules.workshop.status = 'online'; s.modules.garage.status = 'online';
  assert.ok(command(s, { type: 'build', module: 'lab', drone: 'drone-02' }).ok);          // starts
  assert.ok(command(s, { type: 'build', module: 'recreation', drone: 'drone-02' }).ok);  // waits (1)
  assert.ok(command(s, { type: 'build', module: 'roof', drone: 'drone-02' }).ok);        // waits (2)
  s.modules.workshop.tier = 1;
  const third = command(s, { type: 'upgrade', module: 'solar', drone: 'drone-02' });
  assert.equal(third.ok, false, 'a third waiting job must be refused');
  assert.match(third.error, /2 jobs/);
  assert.equal(s.drones[1].queue.length, 2);
});

test('random events wait until the Commander is home (Base Autopilot, SCENARIO 2.1)', () => {
  const s = ready();
  s.minute = at(9, 9);
  s.timers.push({ at: at(9, 10), id: 'event:e2' }); // an event is due at 10:00 ...
  assert.ok(command(s, { type: 'launch', expedition: 1 }).ok); // ... but the Commander leaves at 09:00
  const evs = step(s, 120);
  assert.ok(!evs.some((e) => e.type === 'event'), 'no event card while the Rover is out');
  assert.equal(s.pending, null);
  // after the trip and the loot screen, the event arrives
  let seen = false;
  for (let i = 0; i < 40 && !seen; i++) { const e = step(s, 60); seen = e.some((x) => x.type === 'event'); if (s.pending && s.pending.kind !== 'event') answer(s); }
  assert.ok(seen, 'the postponed event still happens once the Commander is home');
  assert.equal(s.away, null);
});

test('one mini-game is never offered twice in the Tasks list', () => {
  const s = ready();
  s.minute = at(16, 19);
  s.flags.d4b = false;
  s.pending = { kind: 'dilemma', id: 'd4' };
  command(s, { type: 'choose', choice: 'b' });            // Call Earth: offers the antenna job
  s.tasks.push({ game: 'solar_wipe', why: 'x' });
  s.pending = { kind: 'dilemma', id: 'd4' };
  command(s, { type: 'choose', choice: 'b' });            // again, e.g. after the black box decoded
  const games = s.tasks.map((t) => t.game);
  assert.equal(new Set(games).size, games.length, `duplicate tasks: ${games}`);
});

test('0 Water pauses the Greenhouse and costs Morale; 0 Food costs Morale too (SCENARIO 3.1)', () => {
  const s = ready();
  const base = rates(s);
  s.res.water = 0;
  const dry = rates(s);
  assert.ok(dry.food < base.food - 5, 'the Greenhouse food stops');
  assert.ok(dry.morale < base.morale - 4.9, 'Morale -5 per Sol');
  assert.ok(contributions(s).some((l) => l.res === 'morale' && /water/i.test(l.label ?? '')));
  s.res.water = 50; s.res.food = 0;
  assert.ok(rates(s).morale <= base.morale - 4.9, 'no food: Morale -5 per Sol');
});

test('the Lab produces Research (5 a Sol at Tier 1)', () => {
  const s = createCampaign({ seed: 1 });
  s.modules.lab.status = 'online';
  s.res.power = 100;
  assert.equal(rates(s).research, 5);
  step(s, 1440);
  assert.ok(s.research > 4.5 && s.research < 5.5, `research ${s.research}`);
});

test('the trip progress never runs backwards when a decision makes the trip longer or shorter', () => {
  const s = ready();
  s.minute = at(12, 6);
  s.upgrades.titanium_wheels = true;
  assert.ok(command(s, { type: 'launch', expedition: 2 }).ok);
  let last = 0;
  let sawDecision = false;
  for (let i = 0; i < 3000 && s.away; i++) {
    step(s, 5);
    if (s.pending?.kind === 'radio') { sawDecision = true; const before = awayProgress(s.away, s.minute); command(s, { type: 'radio', choice: 'a' }); assert.ok(awayProgress(s.away, s.minute) >= before - 1e-9, 'a longer trip must not move the bar back'); }
    if (s.away) { const p = awayProgress(s.away, s.minute); assert.ok(p >= last - 1e-9, `progress fell from ${last} to ${p}`); last = p; }
  }
  assert.ok(sawDecision && !s.away);
});

test('the Commander is back in the base the moment the Rover is home (no ghost "away" state)', () => {
  const s = ready();
  assert.ok(command(s, { type: 'launch', expedition: 1 }).ok);
  assert.equal(s.where, 'away');
  for (let i = 0; i < 3000 && s.away; i++) step(s, 1);
  assert.equal(s.away, null);
  assert.notEqual(s.where, 'away');
  assert.equal(s.where, locationAt(s));
});

test('an order moves the Commander at once, even while the game is paused', () => {
  const s = ready();
  assert.ok(command(s, { type: 'order', place: 'greenhouse' }).ok);
  assert.equal(s.where, 'greenhouse');
  const t = ready();
  command(t, { type: 'surface', on: true });
  assert.equal(t.where, 'outside');
});

test('SCENARIO rule (hpZeroEndsRun off): a rescue after HP 0 on the trip counts as a Med-Rest', () => {
  const s = ready();
  s.rules.hpZeroEndsRun = false;
  s.upgrades.rover_shielding = true;
  s.hp = 30;
  assert.ok(command(s, { type: 'launch', expedition: 4 }).ok);
  s.away.hpTotal = 200; // a brutal trip
  for (let i = 0; i < 3000 && s.away; i++) { step(s, 5); if (s.pending) answer(s); }
  assert.equal(s.away, null);
  assert.ok(s.medRest, 'the rescued Commander rests');
  assert.equal(s.stats.medRests, 1);
});

test('the sky shows a solar flare while its card is open, and clears afterwards', () => {
  const s = ready();
  s.pending = null;
  s.minute = at(9, 9);
  s.timers.push({ at: at(9, 10), id: 'event:e1' });
  step(s, 90);
  assert.equal(s.pending?.id, 'e1');
  assert.equal(s.flags.flare, true);
  command(s, { type: 'choose', choice: 'a' });
  assert.equal(s.flags.flare, false);
});

test('ASTRA warns once when the Commander first enters a right-wing room without the Roof Layer', () => {
  const s = createCampaign({ seed: 1 });
  command(s, { type: 'wakeDrone', drone: 'drone-01' });
  s.modules.battery.status = 'online'; s.modules.workshop.status = 'online';
  const lines = [];
  for (let i = 0; i < 4 && lines.length < 2; i++) {
    s.order = null;
    command(s, { type: 'order', place: i % 2 ? 'kitchen' : 'workshop' });
    for (const e of step(s, 5)) if (e.type === 'astra' && e.lineId === 'astra.rad.partial_room') lines.push(e);
  }
  const first = command(s, { type: 'order', place: 'workshop' });
  assert.ok(first.ok);
  assert.ok(lines.length <= 1, 'the warning is said once');
});
