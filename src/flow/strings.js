/**
 * Player-facing text, by line ID (SCENARIO.md, "Localization keys").
 * The strings live in content/data/strings.en.json; the browser fetches it once at start
 * (`loadStrings`), tests and tools can call `setStrings` with the parsed file.
 * Code references IDs, never English text.
 */
let table = {};
let vars = {};

export function setStrings(obj) {
  table = obj;
}

/**
 * Values for `{name}` placeholders in the lines, e.g. `{ delay: '14 min 10 s' }` (the Earth-Mars
 * light time on the current Sol). Merged into the current set.
 */
export function setStringVars(obj) {
  vars = { ...vars, ...obj };
}

/**
 * English text for a line ID, with `{name}` placeholders filled from `setStringVars` and `extra`.
 * An unknown ID is returned as is, so a missing line is visible; an unknown placeholder stays visible too.
 */
export function t(id, extra) {
  if (!Object.hasOwn(table, id)) return id;
  const v = extra ? { ...vars, ...extra } : vars;
  return table[id].replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(v, k) ? String(v[k]) : m));
}

export const hasString = (id) => Object.hasOwn(table, id);

/** Browser only. */
export async function loadStrings(url = 'content/data/strings.en.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`cannot load ${url}: ${res.status}`);
  setStrings(await res.json());
}
