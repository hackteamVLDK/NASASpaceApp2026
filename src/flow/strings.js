/**
 * Player-facing text, by line ID (SCENARIO.md, "Localization keys").
 * The strings live in content/data/strings.en.json; the browser fetches it once at start
 * (`loadStrings`), tests and tools can call `setStrings` with the parsed file.
 * Code references IDs, never English text.
 */
let table = {};
let vars = {};
let base = {}; // from SCENARIO.md (content/data/strings.en.json)
let extra = {};
let shortTable = {};

/** Presentation overrides only; the complete scenario strings are never replaced. */
export function setShortStrings(obj) {
  shortTable = { ...shortTable, ...obj };
}

export function short(id, extra) {
  if (!Object.hasOwn(shortTable, id)) return t(id, extra);
  const values = { ...vars, ...extra };
  return shortTable[id].replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}

let spokenTable = {};
/** ASTRA's spoken versions (src/ui/spoken-text.js): one or two short sentences, what her voice says and what More shows. */
export function setSpokenStrings(obj) {
  spokenTable = { ...spokenTable, ...obj };
}
export function spoken(id, extra) {
  if (!Object.hasOwn(spokenTable, id)) return t(id, extra);
  const values = { ...vars, ...extra };
  return spokenTable[id].replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}

export function setStrings(obj) {
  base = obj;
  table = { ...extra, ...base };
}

/**
 * Lines that are not in SCENARIO.md yet (a module's exported `STRINGS`, e.g. lives, jobs, decision callbacks).
 * They survive a later `setStrings`; a SCENARIO line with the same ID always wins.
 */
export function addStrings(obj) {
  extra = { ...extra, ...obj };
  table = { ...extra, ...base };
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
