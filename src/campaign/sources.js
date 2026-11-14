/**
 * Where each part comes from (SCENARIO 5.5, "Component ledger"), so a mission or an upgrade
 * card can answer "where do I get 3 Solar Cells?" (docs/ERRORS.md A18).
 * First draft made by the local model from the ledger table, checked row by row against 5.5.
 * Scrap Runs can also drop a Circuit Board, a Titanium Plate or a Solar Cell (5.2, row R).
 */
import { ITEMS } from './data.js';

const TRIP = { 1: 'Breeze-7 probe (Expedition 1)', 2: 'Pathfinder-X wreck (Expedition 2)', 3: 'Crater Rim Ice (Expedition 3)', 4: 'Delta Cliffs (Expedition 4)' };
const SCRAP = 'a Scrap Run (sometimes)';

/** item id -> list of [place, how many] */
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

/** One line for a card: "Find it at: Pathfinder-X wreck (Expedition 2) x3, a Scrap Run (sometimes)". */
export function whereToFind(item) {
  const list = Object.hasOwn(SOURCES, item) ? SOURCES[item] : [];
  if (!list.length) return '';
  return `Find it at: ${list.map(([place, n]) => (n > 1 ? `${place} x${n}` : place)).join(', ')}`;
}

/** Every item the game knows must have a source. */
export const itemsWithoutSource = () => ITEMS.filter((it) => !Object.hasOwn(SOURCES, it));
