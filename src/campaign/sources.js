/**
 * Where each campaign component can be found (SCENARIO 5.5, Component ledger).
 * The player-facing map uses expedition loot; the legacy summary also includes quantities.
 */
import { ITEMS } from './data.js';
import { EXPEDITIONS } from './expeditions.js';

const TRIP = { 1: 'Breeze-7 probe (Expedition 1)', 2: 'Pathfinder-X wreck (Expedition 2)', 3: 'Crater Rim Ice (Expedition 3)', 4: 'Delta Cliffs (Expedition 4)' };
const SCRAP = 'a Scrap Run (sometimes)';

/** item id -> list of [place, quantity] */
export const SOURCES = Object.freeze({
  circuit_board: [[TRIP[1], 3], [TRIP[2], 2], [TRIP[3], 1], [TRIP[4], 2], [SCRAP, 1]],
  titanium_scrap: [[TRIP[1], 2]],
  titanium_plate: [[TRIP[2], 3], [TRIP[3], 2], [TRIP[4], 1], [SCRAP, 1]],
  solar_cell: [[TRIP[2], 3], [SCRAP, 1]],
  ice_core: [[TRIP[3], 3], ['an Ice Run', 2]],
  rare_battery_cell: [[TRIP[4], 3]],
  probe_power_core: [[TRIP[1], 1]],
  weather_sensor: [[TRIP[1], 1]],
  dish_antenna: [[TRIP[2], 1]],
  black_box: [[TRIP[2], 1]],
  water_filter_membrane: [[TRIP[3], 1]],
  lab_sensor_kit: [[TRIP[4], 1]],
  mineral_sample: [[TRIP[4], 3]],
});

/** Items a Scrap Run can drop (one at random); a test keeps this aligned with expeditions.js. */
export const SCRAP_DROPS = Object.freeze(['circuit_board', 'titanium_plate', 'solar_cell']);

/** Every place an item can be found, in story order. */
export function sourcesOf(item) {
  const out = [];
  for (const id of [1, 2, 3, 4, 5]) {
    const ex = EXPEDITIONS[id];
    if (ex?.loot.items[item]) out.push({ id, nameId: ex.nameId, label: `Expedition ${id}`, repeatable: false });
  }
  if (EXPEDITIONS.ice?.loot.items[item]) out.push({ id: 'ice', label: 'Ice Run', repeatable: true });
  if (SCRAP_DROPS.includes(item)) out.push({ id: 'run', label: 'Scrap Run (random part)', repeatable: true });
  return out;
}

/** The items of a cost the player does not have yet: [{ item, need, have }]. */
export function missingItems(s, cost = {}) {
  return Object.entries(cost.items ?? {})
    .map(([item, need]) => ({ item, need, have: s.items?.[item] ?? 0 }))
    .filter((m) => m.have < m.need);
}

/** One kid-friendly line for the current map and inventory state. */
export function whereText(s, item, nameOf = (x) => x) {
  const list = sourcesOf(item).map((src) => {
    if (src.repeatable) return `a ${src.label}`;
    const visited = s.flags?.done?.[src.id] ? ', already visited' : '';
    return `${nameOf(src.nameId)} (${src.label}${visited})`;
  });
  if (!list.length) return 'it is made in the Workshop or found on the story trips';
  return `find it on ${list.length > 1 ? `${list.slice(0, -1).join(', ')} or ${list.at(-1)}` : list[0]}`;
}

/** One line with source quantities for a card. */
export function whereToFind(item) {
  const list = Object.hasOwn(SOURCES, item) ? SOURCES[item] : [];
  if (!list.length) return '';
  return `Find it at: ${list.map(([place, n]) => (n > 1 ? `${place} x${n}` : place)).join(', ')}`;
}

/** Every item the game knows must have a source. */
export const itemsWithoutSource = () => ITEMS.filter((it) => !Object.hasOwn(SOURCES, it));
