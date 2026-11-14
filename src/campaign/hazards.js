/**
 * Hazards (docs/GAMEPLAY_PLAN.md 3.7): everything that is going wrong or about to, as one list
 * computed from the campaign state, so the Threats strip, the world overlay and ASTRA read the same
 * thing. Pure. `place` says where the world draws the warning ('surface' = above the ground).
 * Severity: 'info' (blue), 'warn' (amber), 'alarm' (red).
 */
import { clockAt } from './util.js';
import { SOL, SHIELD } from './data.js';
import { awayProgress } from './expeditions.js';
import { powerCap } from './engine.js';

const solsLeft = (s, minute) => Math.max(0, (minute - s.minute) / SOL);

/**
 * Below these values a meter is LOW (SCENARIO 3.1 and the ASTRA lines "Water below 25", "Morale below 30" ...). The
 * Threats strip, the gauges in the top bar and ASTRA all use the same limits. Provenance: `gameplay`.
 */
export const LOW_LIMITS = Object.freeze({ power: 20, water: 25, oxygen: 25, food: 25, morale: 30, hp: 40 });
const METER_WORD = { power: 'power', water: 'water', oxygen: 'oxygen', food: 'food', morale: 'morale' };
const METER_PLACE = { power: 'surface', water: 'lifesupport', oxygen: 'lifesupport', food: 'greenhouse', morale: 'recreation' };
const EMPTY = {
  power: ['No power', 'The battery is empty. Everything except life support is off.', 'Wipe the solar panels (Tasks tab) and build Battery & Heating.'],
  water: ['No water', 'The tank is empty! The Greenhouse stops and Morale drops every Sol.', 'Fetch Ice Cores with the Rover and melt them (Workshop tab); fix a cracked filter.'],
  oxygen: ['No oxygen', 'The air is out. Everyone goes to the Bedroom, which has backup tanks.', 'Play Valve Balance (Tasks tab).'],
  food: ['No food', 'The pantry is empty! Morale drops every Sol and fresh crops stop helping.', 'Build the Greenhouse and keep the plants happy (Nutrient Match).'],
  morale: ['Morale is gone', 'The crew has lost heart: builds and crafts are 25% slower.', 'Build Recreation, call Earth, keep the base warm and lit.'],
};

/** Title and line for each empty meter (the old text said "everything except life support is off" for heat and oxygen too). */
const EMERGENCY = {
  power: ['No power', 'The batteries are empty. Everything except life support is off.'],
  heat: ['No heat', 'The heaters are off and the base is getting very cold.'],
  oxygen: ['No oxygen', 'Oxygen is at 0. Fix the air machine now.'],
};

export function hazards(s) {
  const h = [];
  const add = (id, severity, title, detail, place, counter) => h.push({ id, severity, title, detail, place, counter });

  if (s.storm) add('storm', 'warn', 'Dust storm', `Sunlight is about 30%. About ${solsLeft(s, s.storm.until).toFixed(1)} Sols left.`, 'surface', 'Save power, keep warm. Wipe the panels afterwards.');
  if (s.pending?.id === 'e1' || s.pending?.id === 'd5') add('flare', 'alarm', 'Solar flare', 'Fast particles reach Mars in under an hour. Anyone outside takes a big dose.', 'surface', 'Shelter in the Bedroom, or hide behind rock or the Rover shield.');
  if (s.flags.flareWarned && !s.pending) add('flare-watch', 'info', 'Space weather watch', 'The Sun has a stormy spot facing Mars. A flare may come soon.', 'surface', 'Get ready to shelter.');
  for (const [k, place] of [['power', 'surface'], ['heat', 'battery'], ['oxygen', 'lifesupport']]) {
    if (s.emergency[k]) add(`emergency-${k}`, 'alarm', EMERGENCY[k][0], EMERGENCY[k][1], place, 'Open the Tasks tab and play the job.');
  }
  if (s.recycleEta < 0.98) add('filter', 'warn', 'Cracked water filter', `The recycler saves only ${Math.round(s.recycleEta * 100)}% of the water.`, 'lifesupport', 'Fix it: Water Sort, or spare parts.');
  if (s.mods.some((m) => m.id === 'leak')) add('leak', 'warn', 'Airlock leak', 'A tiny leak costs Oxygen and Water every Sol.', 'surface', 'Hunt the leak with the Valve Balance job.');
  if (s.mult.food < 1) add('drift', 'warn', 'Plants drooping', `Food output is down to ${Math.round(s.mult.food * 100)}%.`, 'greenhouse', 'Fix the nutrient mix.');
  if (s.mult.solar > 1.05 || s.mult.solar < 0.95) add('solar', s.mult.solar < 1 ? 'warn' : 'info', 'Solar panels changed', `Power from the panels is at ${Math.round(s.mult.solar * 100)}%.`, 'surface', s.mult.solar < 1 ? 'Wipe the panels.' : 'A free boost for a few Sols.');
  if (s.tasks.some((t) => t.game === 'solar_wipe') && !s.emergency.power && !s.storm) add('dusty', 'info', 'Dusty panels', 'Dust is sticking to the panels. Clean them for more power.', 'surface', 'Tasks tab: Solar Panel Static Wipe.');
  if (s.flags.noLaunchUntil && s.minute < s.flags.noLaunchUntil) add('airlock', 'info', 'Airlock sealed', 'No trips for now while a drone fixes the leak.', 'garage', 'Wait a little.');
  if (s.medRest) add('medrest', 'info', 'Med-Rest', 'The Commander rests in the Bedroom for a Sol.', 'bedroom', 'The drones keep the base going.');
  // a meter that is low warns; a meter that is empty raises an alarm (the three with a real emergency have their own chip above)
  for (const k of Object.keys(METER_WORD)) {
    const v = s.res[k];
    if (v <= 0) { if (!s.emergency[k]) add(`empty-${k}`, 'alarm', EMPTY[k][0], EMPTY[k][1], METER_PLACE[k], EMPTY[k][2]); } else if (v < LOW_LIMITS[k] && !s.emergency[k]) add(`low-${k}`, 'warn', `Low ${METER_WORD[k]}`, `${k[0].toUpperCase()}${k.slice(1)} is getting low (${Math.round(v)}).`, METER_PLACE[k], 'Open the Resources screen for what helps.');
  }
  if (s.hp < LOW_LIMITS.hp && !s.medRest) add('low-hp', 'warn', 'Low HP', 'Rest and fresh food bring energy back.', 'bedroom', 'Sleep in the Bedroom, or eat a fresh meal.');
  if (s.away) add('away', 'info', 'Rover out', `The Rover is on its way (${Math.round(awayProgress(s.away, s.minute) * 100)}%).`, 'garage', 'Follow the radio log.');
  return h;
}

/** Radiation factor of each place (3.6), for the radiation view: 1.0 is the open surface. */
export function shieldingByPlace(s) {
  const right = s.modules.roof.status === 'online' ? SHIELD.left : SHIELD.rightBeforeRoof;
  return { surface: SHIELD.surface, bedroom: SHIELD.bedroom, kitchen: SHIELD.left, lifesupport: SHIELD.left, workshop: right, lab: right, battery: right, garage: right, greenhouse: right, recreation: right };
}

/** What the Resources screen tells the player about one meter. */
export function meterReport(s, key, lines, net) {
  const own = lines.filter((l) => l.res === key);
  const value = key === 'hp' ? s.hp : s.res[key];
  const cap = key === 'sp' ? null : key === 'power' ? powerCap(s) : key === 'hp' ? s.hpMax : 100; // Power holds 250 with a battery, 400 with the upgrade
  let outlook = 'Steady.';
  if (net < -0.01 && value > 0) outlook = `Runs out in about ${(value / -net).toFixed(1)} Sols.`;
  else if (net > 0.01 && cap && value < cap) outlook = `Full in about ${((cap - value) / net).toFixed(1)} Sols.`;
  else if (net > 0.01) outlook = 'Growing.';
  return { key, value, net, outlook, sources: own.filter((l) => l.amount > 0), sinks: own.filter((l) => l.amount < 0), sol: clockAt(s.minute).sol };
}

/** Short "what can I do about it" lists per meter (docs/GAMEPLAY_PLAN.md 3.6). */
export const METER_HELP = {
  power: ['Wipe the solar panels (Tasks tab).', 'Upgrade the Solar Array to Clean-Sweep Panels (3 Solar Cells).', 'Build Battery & Heating for a bigger battery.', 'Before a storm: save power or top up the panels.'],
  heat: ['Build Battery & Heating.', 'Play Heat Pump Pipe Reroute when it is cold.', 'Upgrade it to the Deep Cell Bank.'],
  water: ['Fetch Ice Cores on the Rover (Ice Run or the crater rim) and melt them.', 'Fix a cracked filter (Water Sort).', 'Upgrade Life Support: it melts ice by itself.'],
  oxygen: ['Life Support makes oxygen. Upgrade it for more.', 'The Greenhouse adds a little.', 'Play Valve Balance when it is low.'],
  food: ['Build the Greenhouse.', 'Keep the plants happy (Nutrient Match).', 'Upgrade it to the Vertical LED Farm.'],
  morale: ['Build Recreation & Storage.', 'Call Earth when the Lab is ready.', 'Do not keep the crew in the dark and cold.'],
  sp: ['Build the Workshop (+6 a Sol).', 'Keep a drone free to salvage (+2 a Sol).', 'Win mini-games (+2 each).', 'Bring loot home from the Rover.'],
};
