#!/usr/bin/env node
/**
 * An autopilot that plays the campaign along the scenario's recommended path (3.8) using only
 * public commands. Used by tests/campaign-run.test.mjs to prove the story can be finished, and
 * as a balancing aid:  node tools/balance/campaign-bot.mjs [seed]
 */
import { readFileSync } from 'node:fs';
import { createCampaign, step, command, clockAt } from '../../src/campaign/engine.js';
import { canFinale } from '../../src/campaign/story.js';

const BUILD_ORDER = ['battery', 'workshop', 'greenhouse', 'garage', 'lab', 'recreation', 'roof'];
const CRAFT_ORDER = ['repair_kit', 'reboot_kit', 'titanium_wheels', 'deep_ice_drill', 'rover_shielding', 'suit_liner'];
const UPGRADE_ORDER = ['solar', 'greenhouse', 'lifesupport', 'battery', 'workshop', 'lab', 'recreation', 'garage'];
const CHOICES = { d1: 'a', d2: 'a', d3: 'c', d4: 'c', d5: 'b', e1: 'a', e2: 'c', e3: 'a', e4: 'a' };

export function autoplay(seed = 1, { maxSols = 40, verbose = false, onEvents = null } = {}) {
  const s = createCampaign({ seed });
  const log = [];
  const note = (m) => { log.push(`Sol ${clockAt(s.minute).sol} ${String(clockAt(s.minute).hour).padStart(2, '0')}:00  ${m}`); if (verbose) console.log(log.at(-1)); };
  command(s, { type: 'wakeDrone', drone: 'drone-01' });

  const act = () => {
    // pending decisions
    if (s.pending) {
      if (s.pending.kind === 'radio') command(s, { type: 'radio', choice: 'a' });
      else command(s, { type: 'choose', choice: CHOICES[s.pending.id] ?? 'a' });
      note(`decided ${s.pending?.id ?? ''}`);
    }
    // mini-games on offer
    for (const t of [...s.tasks]) { command(s, { type: 'miniResult', game: t.game, win: true }); }
    for (const k of Object.keys(s.emergency)) if (s.emergency[k]) command(s, { type: 'miniResult', game: { power: 'solar_wipe', heat: 'heat_pump', oxygen: 'valve_balance' }[k], win: true });
    if (s.res.water < 60 && (s.items.ice_core ?? 0) > 2) command(s, { type: 'melt' }); // keep two cores for the Life Support upgrade
    if (s.res.water < 40) command(s, { type: 'melt' });
    // kits wake drones
    if (s.kits.repair_kit && s.drones[1].status === 'dormant') { command(s, { type: 'useKit', kit: 'repair_kit', drone: 'drone-02' }); note('Drone #02 awake'); }
    if (s.kits.reboot_kit && s.drones[2].status === 'dormant') { command(s, { type: 'useKit', kit: 'reboot_kit', drone: 'drone-03' }); note('Drone #03 awake'); }
    // build, craft, upgrade
    for (const id of BUILD_ORDER) if (s.modules[id].status === 'unbuilt' && command(s, { type: 'build', module: id }).ok) note(`build ${id}`);
    if (!s.crafting) {
      for (const r of CRAFT_ORDER) {
        if (r === 'repair_kit' && s.drones[1].status === 'awake') continue;
        if (r === 'reboot_kit' && s.drones[2].status === 'awake') continue;
        if (r === 'suit_liner' && s.upgrades.suit_liner) continue;
        if (command(s, { type: 'craft', recipe: r }).ok) { note(`craft ${r}`); break; }
      }
    }
    // Tier 2 upgrades in the order the scenario plans them (3.8): each waits for the loot that pays for it
    const done = (k) => Boolean(s.flags.done?.[k]);
    const gate = { solar: () => done(2), greenhouse: () => done(3), lifesupport: () => done(3), battery: () => done(4), workshop: () => done(4), lab: () => done(4), recreation: () => done(4), garage: () => done(4) };
    for (const m of UPGRADE_ORDER) {
      if (!gate[m]()) continue;
      if (command(s, { type: 'upgrade', module: m }).ok) note(`upgrade ${m}`);
    }
    // expeditions
    if (!s.away && !s.pending && s.hp > 60) {
      const want = [1, 2, 3, 4, 5].find((k) => !s.flags.done?.[k]);
      if (want) {
        if (command(s, { type: 'launch', expedition: want }).ok) note(`launch expedition ${want}`);
        else if (s.hp > 70 && clockAt(s.minute).sol > (s.flags.botLastRun ?? 0) && command(s, { type: 'launch', expedition: 'run' }).ok) { s.flags.botLastRun = clockAt(s.minute).sol; note('scrap run'); }
      }
    }
  };

  let guard = 0;
  while (s.minute < maxSols * 1440 && !s.flags.finaleDone && guard++ < 200000) {
    act();
    const ev = step(s, 30);
    onEvents?.(ev);
  }
  // let the finale lines play
  for (let i = 0; i < 4 && s.flags.finaleDone; i++) { act(); onEvents?.(step(s, 60)); }
  return { s, log, finaleReady: canFinale(s) };
}

if (process.argv[1] && process.argv[1].endsWith('campaign-bot.mjs')) {
  const strings = JSON.parse(readFileSync(new URL('../../content/data/strings.en.json', import.meta.url), 'utf8'));
  void strings;
  const { s, log } = autoplay(Number(process.argv[2]) || 1, { verbose: true });
  const c = clockAt(s.minute);
  console.log(`\nfinished: ${s.flags.finaleDone ? 'YES' : 'no'} on Sol ${c.sol}; HP ${s.hp.toFixed(0)}; ${JSON.stringify(Object.fromEntries(Object.entries(s.res).map(([k, v]) => [k, Math.round(v)])))}`);
  console.log(`builds ${s.stats.builds}, mini-game wins ${s.stats.miniWins}, expeditions ${s.stats.expeditions}`);
  void log;
}
