/**
 * Where does a component come from? (docs/ERRORS.md A18, SCENARIO 5.5 Component ledger)
 * Pure functions over the expedition loot tables, so the hint stays right when loot changes.
 */
import { EXPEDITIONS } from './expeditions.js';

/** Items a Scrap Run can drop (one at random). Mirrors the pool in expeditions.js (Scrap Run branch); a test keeps them equal. */
export const SCRAP_DROPS = Object.freeze(['circuit_board', 'titanium_plate', 'solar_cell']);

/**
 * Every place an item can be found, in story order.
 * @returns {{ id: string|number, nameId?: string, label: string, repeatable: boolean }[]}
 */
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

/**
 * One kid-friendly line: "find it on Pathfinder-X Wreck (Expedition 2) or a Scrap Run (random part)".
 * `nameOf(nameId)` turns a line ID into text; visited story trips are marked so the player looks elsewhere.
 */
export function whereText(s, item, nameOf = (x) => x) {
  const list = sourcesOf(item).map((src) => {
    if (src.repeatable) return `a ${src.label}`;
    const visited = s.flags?.done?.[src.id] ? ', already visited' : '';
    return `${nameOf(src.nameId)} (${src.label}${visited})`;
  });
  if (!list.length) return 'it is made in the Workshop or found on the story trips';
  return `find it on ${list.length > 1 ? `${list.slice(0, -1).join(', ')} or ${list.at(-1)}` : list[0]}`;
}
