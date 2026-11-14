/** Small shared helpers for the simulation. */

/**
 * True when `key` is a real entry of a lookup table.
 * Plain `table[key]` would also "find" inherited names such as "toString" or "__proto__",
 * which matters because ids arrive from player commands and from save files.
 */
export const has = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);

export const clamp = (value, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, value));

export const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** Call `visit(path, value)` for every number anywhere inside a value. */
export function forEachNumber(value, visit, path = 'state') {
  if (typeof value === 'number') visit(path, value);
  else if (Array.isArray(value)) value.forEach((v, i) => forEachNumber(v, visit, `${path}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) forEachNumber(v, visit, `${path}.${k}`);
}
