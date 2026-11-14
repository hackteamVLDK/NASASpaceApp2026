/**
 * Shortest walking routes through the base (Dijkstra on the small room graph).
 */
import { EDGES, ROOMS } from '../data/base-layout.js';

const graph = new Map(Object.keys(ROOMS).map((id) => [id, new Map()]));
for (const [a, b, minutes] of EDGES) {
  graph.get(a).set(b, minutes);
  graph.get(b).set(a, minutes);
}

const cache = new Map();

function solve(from) {
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const open = new Set(graph.keys());
  while (open.size) {
    let best = null;
    for (const id of open) {
      if (dist.has(id) && (best === null || dist.get(id) < dist.get(best))) best = id;
    }
    if (best === null) break;
    open.delete(best);
    for (const [next, minutes] of graph.get(best)) {
      const d = dist.get(best) + minutes;
      if (!dist.has(next) || d < dist.get(next)) {
        dist.set(next, d);
        prev.set(next, best);
      }
    }
  }
  return { dist, prev };
}

/** Minutes to walk the single connection between two neighbouring rooms. */
export function edgeMinutes(a, b) {
  const m = graph.get(a)?.get(b);
  if (m === undefined) throw new Error(`rooms are not connected: ${a} - ${b}`);
  return m;
}

/**
 * Route from one room to another.
 * @returns {{ nodes: string[], minutes: number }} rooms to pass through, excluding `from`.
 */
export function shortestPath(from, to) {
  if (!graph.has(from) || !graph.has(to)) throw new Error(`unknown room: ${graph.has(from) ? to : from}`);
  if (!cache.has(from)) cache.set(from, solve(from));
  const { dist, prev } = cache.get(from);
  if (!dist.has(to)) throw new Error(`no route from ${from} to ${to}`);
  const nodes = [];
  for (let at = to; at !== from; at = prev.get(at)) nodes.unshift(at);
  return { nodes, minutes: dist.get(to) };
}

export const travelMinutes = (from, to) => shortestPath(from, to).minutes;
