/**
 * Build the saves the trailer starts from, by PLAYING the game's own engine (src/campaign) with the
 * commands the UI sends. Nothing is drawn or faked: each save is a real game state at a real moment.
 *
 *   node capture/saves.mjs        -> capture/saves/<name>.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCampaign, step, command, clockAt } from '../../src/campaign/engine.js';
import { unlockFor, checkBadges } from '../../src/campaign/logbook.js';
import { STRATEGIES } from '../../tools/balance/strategy-lab.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'saves');
fs.mkdirSync(OUT, { recursive: true });
const SOL = 1440;
const at = (sol, hour, min = 0) => (sol - 1) * SOL + hour * 60 + min;

/** A game played like the UI: commands plus the Logbook triggers main.js runs on events. */
function newGame(seed = 1) {
  const s = createCampaign({ seed });
  const absorb = (events) => {
    for (const e of events) {
      if (e.type === 'astra') unlockFor(s, e.lineId);
      else if (e.type === 'chosen') unlockFor(s, `C:${e.id}${e.choice}`);
      else if (e.type === 'dilemma') unlockFor(s, `D:${e.id}`);
      else if (e.type === 'radio') unlockFor(s, `R:${e.id}`);
    }
  };
  const send = (cmd) => { const r = command(s, cmd); if (r.ok) absorb(r.events); return r; };
  for (const id of ['astra.intro.landing', 'astra.intro.why_underground', 'astra.tut.hp_intro', 'astra.tut.solar_done', 'astra.tut.done']) unlockFor(s, id);
  s.flags.panelsCleaned = true; // the tutorial's Static Wipe
  send({ type: 'wakeDrone', drone: 'drone-01' });
  const run = (until, acts = [], { choice = 'a' } = {}) => {
    for (let g = 0; g < 200000 && s.minute < until; g++) {
      if (s.pending) { const p = s.pending; if (p.kind === 'radio') send({ type: 'radio', choice: 'a' }); else for (const c of [choice, 'a', 'b', 'c']) if (send({ type: 'choose', choice: c }).ok) break; }
      for (const act of acts) act(s, send);
      absorb(step(s, Math.min(10, until - s.minute)));
      checkBadges(s);
    }
  };
  return { s, send, run };
}

function save(name, s, note) {
  const file = path.join(OUT, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(s));
  const c = clockAt(s.minute);
  console.log(`${name.padEnd(12)} Sol ${c.sol} ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}  power ${s.res.power.toFixed(1)}  ${note}`);
}

const rec = STRATEGIES.recommended.acts;
const noDecisions = rec.slice(1); // the recommended player, but dilemmas are left open for the camera

// 1. Alarm: the dust storm (Sols 4-6) with the batteries nearly empty -> a Power Emergency within seconds
{
  const g = newGame(1);
  g.run(at(3, 19, 50), [(s, send) => send({ type: 'build', module: 'battery' })]);
  g.send({ type: 'choose', choice: 'c' }); // nothing pending yet; harmless
  g.run(at(5, 10), [], { choice: 'c' }); // "Keep everything running" through the storm
  g.s.res.power = 0.6; // the storm has drained the batteries (the D1 C story), so the alarm comes within seconds
  g.s.emergency.power = false;
  g.s.tasks = g.s.tasks.filter((t) => t.game !== 'solar_wipe');
  save('alarm', g.s, 'storm on, power about to hit 0');
}

// 2. Decision: Dilemma 1 "The Dust Storm" opens at 20:00 on Sol 3
{
  const g = newGame(1);
  g.run(at(3, 19, 30), [(s, send) => send({ type: 'build', module: 'battery' })]);
  g.s.res.power = 52;
  save('decision', g.s, 'Dilemma 1 opens at 20:00');
}

// 3. Mini-game: after the storm with "Keep everything running", power is 0 and the panels need the Static Wipe
{
  const g = newGame(1);
  g.run(at(3, 19, 50), [(s, send) => send({ type: 'build', module: 'battery' })]);
  g.run(at(6, 7), [], { choice: 'c' });
  save('wipe', g.s, `tasks: ${g.s.tasks.map((t) => t.game).join(', ')}; emergency ${JSON.stringify(g.s.emergency)}`);
}

// 4a. A drone order: Battery & Heating stands, Pip is free, the Workshop frame is waiting
{
  const g = newGame(1);
  g.run(at(3, 9), [(s, send) => send({ type: 'build', module: 'battery' })]);
  save('build', g.s, `battery ${g.s.modules.battery.status}, workshop ${g.s.modules.workshop.status}, drones ${g.s.drones.map((d) => `${d.status}/${d.task?.module ?? '-'}`).join(' ')}`);
}

// 4b. The Rover: the Garage stands, Expedition 1 is open
{
  const g = newGame(1);
  const noTrips = noDecisions.slice(0, -1); // the Rover stays home: the trailer shows its launch
  for (let k = 0; k < 40 && g.s.modules.garage.status !== 'online'; k++) g.run(g.s.minute + SOL / 2, noTrips);
  g.run(g.s.minute + 30, []);
  save('rover', g.s, `garage ${g.s.modules.garage.status}, trip 1 done: ${Boolean(g.s.flags.done?.[1])}, cards ${g.s.logbook.length}`);
}

// 5. End shot: the recommended path until the base is complete
{
  const g = newGame(1);
  g.run(at(20, 10), rec);
  save('end', g.s, `modules ${Object.values(g.s.modules).filter((m) => m.status === 'online').length}, tier 2: ${Object.values(g.s.modules).filter((m) => m.tier === 2).length}, cards ${g.s.logbook.length}`);
}
