// A small random-command fuzz of the campaign engine: whatever the player (or a bug) does, the state stays
// consistent. Seeds are fixed, so a failure is reproducible: the message names the seed and the Sol.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, command, clockAt } from '../src/campaign/engine.js';
import { MODULES, RES, CAP, RECIPES, ITEMS } from '../src/campaign/data.js';

const rngOf = (seed) => { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const MODS = Object.keys(MODULES);
const PLACES = ['bedroom', 'kitchen', 'lifesupport', 'workshop', 'lab', 'battery', 'garage', 'greenhouse', 'recreation', 'outside'];
const GAMES = ['solar_wipe', 'heat_pump', 'valve_balance', 'water_sort', 'nutrient_match', 'air_filter', 'antenna', 'wheel_vacuum', 'suit_seal'];

/** Everything that must always be true; returns the list of broken rules. */
function broken(s, manualSurface) {
  const v = [];
  for (const k of RES) {
    const x = s.res[k];
    if (!Number.isFinite(x) || x < -1e-9 || x > (k === 'power' ? 400 : CAP[k]) + 1e-9) v.push(`res.${k} = ${x}`);
  }
  if (!Number.isFinite(s.hp) || s.hp < -1e-9 || s.hp > s.hpMax + 1e-9) v.push(`hp = ${s.hp}`);
  if (!Number.isFinite(s.research)) v.push('research is not a number');
  for (const d of s.drones) {
    if (d.queue.length > 2) v.push(`${d.id} has ${d.queue.length} waiting jobs`);
    if (d.task && d.status !== 'awake') v.push(`${d.id} works while asleep`);
    if (!d.task && d.queue.length && d.status === 'awake') v.push(`${d.id} is idle with waiting jobs`);
    if (d.task?.type === 'build' && !(s.modules[d.task.module].status === 'building' && s.modules[d.task.module].drone === d.id)) v.push(`${d.id}'s build is not in the module`);
    if (d.task?.type === 'upgrade' && s.modules[d.task.module].upgrading?.drone !== d.id) v.push(`${d.id}'s upgrade is not in the module`);
  }
  for (const [id, m] of Object.entries(s.modules)) {
    if (m.status === 'building' && !s.drones.some((d) => d.task?.type === 'build' && d.task.module === id)) v.push(`${id} is built by nobody`);
    if (m.upgrading && !s.drones.some((d) => d.task?.type === 'upgrade' && d.task.module === id)) v.push(`${id} is upgraded by nobody`);
    if (!(m.progress >= 0 && m.progress <= 1 + 1e-9)) v.push(`${id} progress ${m.progress}`);
  }
  for (const [it, n] of Object.entries(s.items)) if (n < 0 || !Number.isInteger(n)) v.push(`item ${it} = ${n}`);
  if (Boolean(s.away) !== (s.where === 'away')) v.push(`away=${Boolean(s.away)} but where=${s.where}`);
  if (s.pending?.kind === 'radio' && !s.away) v.push('radio decision at home');
  if (s.pending?.kind === 'event' && s.away) v.push('random event while the Commander is away');
  if (s.flags.flare && !(s.pending && (s.pending.id === 'e1' || s.pending.id === 'd5'))) v.push('flare flag without a flare card');
  const games = s.tasks.map((t) => t.game);
  if (new Set(games).size !== games.length) v.push(`duplicate tasks ${games}`);
  if (s.order && s.order.until < s.minute) v.push('expired order');
  if (s.flags.outside && !s.order && !manualSurface) v.push('outside with no order');
  if (s.medRest && s.medRest.until < s.minute) v.push('expired Med-Rest');
  if (JSON.stringify(s) !== JSON.stringify(JSON.parse(JSON.stringify(s)))) v.push('state does not survive a JSON round trip');
  return v;
}

test('random commands never break the state (10 seeds, 25 Sols each)', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const rnd = rngOf(seed * 7919);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const s = createCampaign({ seed });
    command(s, { type: 'wakeDrone', drone: 'drone-01' });
    let manualSurface = false;
    for (let guard = 0; s.minute < 25 * 1440 && guard < 40000; guard++) {
      const r = rnd();
      let cmd = null;
      if (s.pending) cmd = s.pending.kind === 'radio' ? { type: 'radio', choice: pick(['a', 'b']) } : { type: 'choose', choice: pick(['a', 'b', 'c']) };
      else if (r < 0.12) cmd = { type: 'build', module: pick(MODS), drone: rnd() < 0.5 ? pick(s.drones).id : undefined };
      else if (r < 0.2) cmd = { type: 'upgrade', module: pick(MODS), drone: rnd() < 0.5 ? pick(s.drones).id : undefined };
      else if (r < 0.24) cmd = { type: 'unqueue', drone: pick(s.drones).id, index: Math.floor(rnd() * 3) };
      else if (r < 0.3) cmd = { type: 'order', place: pick(PLACES) };
      else if (r < 0.36) cmd = { type: 'craft', recipe: pick(Object.keys(RECIPES)) };
      else if (r < 0.4) { const d = pick(s.drones); cmd = { type: 'useKit', kit: d.id === 'drone-02' ? 'repair_kit' : 'reboot_kit', drone: d.id }; }
      else if (r < 0.46) cmd = { type: 'miniResult', game: pick(GAMES), win: rnd() < 0.6 };
      else if (r < 0.5) { cmd = { type: 'surface', on: rnd() < 0.5 }; manualSurface = cmd.on; }
      else if (r < 0.56) cmd = { type: 'launch', expedition: pick([1, 2, 3, 4, 5, 'run']) };
      else if (r < 0.6) cmd = { type: 'melt' };
      else if (r < 0.64) cmd = { type: 'wakeDrone', drone: pick(s.drones).id };
      else if (r < 0.68) { s.res.sp = Math.min(999, s.res.sp + 60); for (const it of ITEMS) if (rnd() < 0.4) s.items[it] = (s.items[it] ?? 0) + 1; } // loot, so deep states are reached
      if (cmd) command(s, cmd);
      let v = broken(s, manualSurface);
      assert.deepEqual(v, [], `seed ${seed}, Sol ${clockAt(s.minute).sol}, after ${JSON.stringify(cmd)}`);
      const events = step(s, 1 + Math.floor(rnd() * (rnd() < 0.2 ? 400 : 60)));
      if (events.some((e) => e.type === 'rewind')) manualSurface = Boolean(s.flags.outside); // rewind restores earlier commands too
      v = broken(s, manualSurface);
      assert.deepEqual(v, [], `seed ${seed}, Sol ${clockAt(s.minute).sol}, after stepping`);
      if (s.status !== 'running') break; // the final life stops play; refused commands cannot change the tracker
    }
  }
});
