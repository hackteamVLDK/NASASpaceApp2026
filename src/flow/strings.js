/**
 * Player-facing text, by line ID (SCENARIO.md, "Localization keys").
 * The strings live in content/data/strings.en.json; the browser fetches it once at start
 * (`loadStrings`), tests and tools can call `setStrings` with the parsed file.
 * Code references IDs, never English text.
 */
let table = {};

export function setStrings(obj) {
  table = obj;
}

/** English text for a line ID. An unknown ID is returned as is, so a missing line is visible. */
export function t(id) {
  return Object.hasOwn(table, id) ? table[id] : id;
}

export const hasString = (id) => Object.hasOwn(table, id);

/** Browser only. */
export async function loadStrings(url = 'content/data/strings.en.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`cannot load ${url}: ${res.status}`);
  setStrings(await res.json());
}
