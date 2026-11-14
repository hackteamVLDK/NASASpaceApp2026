#!/usr/bin/env node
/**
 * Extract the game's numbers and structure from SCENARIO.md into content/data/game-data.json, and
 * report where the campaign engine (src/campaign/data.js) disagrees with the scenario.
 *
 *   node content/tools/extract-game-data.mjs            write the file and print a report
 *   node content/tools/extract-game-data.mjs --check    exit 1 if the file is out of date or inconsistent
 *
 * No dependencies. Player-facing text is never copied here: entries carry line IDs that resolve
 * in content/data/strings.en.json (same derived-ID rules as extract-strings.mjs). Prose effects of
 * dilemmas and events stay as text (`immediate`, `delayed`) because SCENARIO.md writes them as
 * sentences; Section 7 JSON is the shape engines use for them.
 *
 * Data labels (SCENARIO "How to use this file"): every number is `gameplay` unless listed in
 * `meta.labels`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slug, clean } from './extract-strings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'SCENARIO.md');
const OUT = path.join(ROOT, 'content', 'data', 'game-data.json');

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
const num = (s) => Number(String(s).replace(/−/g, '-').replace(/[^0-9.+-]/g, ''));
const RES_WORDS = { Power: 'power', Heat: 'heat', Water: 'water', Oxygen: 'oxygen', Food: 'food', Morale: 'morale', SP: 'sp', Research: 'research' };

/** Every Markdown table in the file, with the heading it sits under and its line number. */
export function tables(md) {
  const lines = md.split('\n');
  const out = [];
  let heading = '';
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    if (/^#{2,4} /.test(l)) { heading = l.replace(/^#+ /, '').trim(); continue; }
    if (l.startsWith('|') && lines[i + 1]?.startsWith('|---')) {
      const header = cells(l);
      const rows = [];
      let j = i + 2;
      for (; j < lines.length && lines[j].startsWith('|'); j++) rows.push({ c: cells(lines[j]), line: j + 1 });
      out.push({ heading, header, rows, line: i + 1 });
      i = j - 1;
    }
  }
  return out;
}
const find = (ts, first, second) => ts.find((t) => t.header[0] === first && (second === undefined || t.header[1] === second));

/** "+50 Power, −3 Water, Power cap 250, fresh crops +4 HP" -> { power: 50, water: -3, powerCap: 250, freshCropsHp: 4 } */
export function effects(text) {
  const e = {};
  const s = text.replace(/−/g, '-');
  for (const m of s.matchAll(/([+-]\d+(?:\.\d+)?)\s+(Power|Heat|Water|Oxygen|Food|Morale|SP|Research)\b/g)) e[RES_WORDS[m[2]]] = Number(m[1]);
  const cap = s.match(/Power cap (\d+)/); if (cap) e.powerCap = Number(cap[1]);
  const crops = s.match(/fresh crops \+(\d+) HP/); if (crops) e.freshCropsHp = Number(crops[1]);
  const sleep = s.match(/sleep \+(\d+) HP/); if (sleep) e.sleepHp = Number(sleep[1]);
  const rec = s.match(/(\d+)% water recycling/); if (rec) e.waterRecycling = Number(rec[1]) / 100;
  const crafts = s.match(/(\d+) crafts per Sol/); if (crafts) e.craftsPerSol = Number(crafts[1]);
  return e;
}

/** "15 SP + 10 Water + 1 Titanium Plate" -> { sp: 15, water: 10, items: { titanium_plate: 1 } } */
export function cost(text, itemIds) {
  const out = { sp: 0, water: 0, items: {} };
  if (!text || text === '—') return out;
  for (const part of text.split(' + ').map((p) => p.trim())) {
    let m = part.match(/^(\d+)\s+(SP|Water)$/);
    if (m) { out[m[2] === 'SP' ? 'sp' : 'water'] += Number(m[1]); continue; }
    m = part.match(/^(?:(\d+)\s+)?(.+)$/);
    const id = itemId(m[2], itemIds);
    out.items[id] = (out.items[id] ?? 0) + Number(m[1] ?? 1);
  }
  return out;
}

/** Item name (singular or plural) -> ledger id. Unknown names keep their slug and are reported. */
function itemId(name, itemIds) {
  const s = slug(name);
  if (!itemIds || itemIds.has(s)) return s;
  const single = s.replace(/s$/, '');
  return itemIds.has(single) ? single : s;
}

/** "15 SP, Probe Power Core, Circuit Board ×3" -> { sp: 15, items: { probe_power_core: 1, circuit_board: 3 } } */
export function loot(text, itemIds) {
  const out = { sp: 0, items: {} };
  for (const part of text.split(', ').map((p) => p.trim())) {
    const sp = part.match(/^(\d+) SP$/);
    if (sp) { out.sp += Number(sp[1]); continue; }
    const m = part.match(/^(.+?)(?:\s*×(\d+))?$/);
    const id = itemId(m[1], itemIds);
    out.items[id] = (out.items[id] ?? 0) + Number(m[2] ?? 1);
  }
  return out;
}

const pct = (s) => num(s) / 100;

const MINIGAME_IDS = {
  '4.1': 'solar_wipe', '4.2': 'air_filter_scrub', '4.3': 'valve_balance', '4.4': 'water_sort',
  '4.5': 'heat_pump_reroute', '4.6': 'nutrient_match', '4.7': 'wheel_pebble_vacuum',
  '4.8': 'suit_seal_check', '4.9': 'dish_antenna_alignment',
};

/**
 * Logbook "Unlocked by" cells are line IDs or descriptions of lines without IDs ("Dilemma 1, choice A
 * follow-up", "4.2 ASTRA", "Expedition 1 radio, 30%"). Map them to line IDs with the derived-ID
 * rules of extract-strings.mjs. Several triggers are separated by "; ".
 */
export function triggerIds(trigger) {
  return trigger.split(/;\s*/).map((t) => t.trim()).filter(Boolean).flatMap((t) => {
    let m;
    if (/^(astra|radio|crawl|ui|card|log)\./.test(t)) return [t];
    if ((m = t.match(/^Dilemma (\d) alert$/))) return [`astra.d${m[1]}.alert`];
    if ((m = t.match(/^Dilemma (\d), choice ([A-C]) follow-up$/))) return [`astra.d${m[1]}.${m[2].toLowerCase()}`];
    if ((m = t.match(/^Event (\d) alert$/))) return [`astra.e${m[1]}.alert`];
    if (t === 'Event 1 early warning') return ['astra.e1.watch'];
    if ((m = t.match(/^Event (\d), choice ([A-C]) follow-up$/))) return m[1] === '2' && m[2] === 'A' ? ['astra.e2.a.clean', 'astra.e2.a.dusty'] : [`astra.e${m[1]}.${m[2].toLowerCase()}`];
    if ((m = t.match(/^(4\.\d) ASTRA$/))) return [`astra.mg.${MINIGAME_IDS[m[1]]}`];
    if ((m = t.match(/^Expedition (\d), ASTRA on return$/))) return [`astra.exp${m[1]}.return`];
    if ((m = t.match(/^Expedition (\d), ASTRA at (\d+)%$/))) return [`astra.exp${m[1]}.at${m[2]}`];
    if ((m = t.match(/^Expedition (\d) radio, (\d+)%$/))) return [`radio.exp${m[1]}.${m[2] === '0' ? '00' : m[2]}`];
    return [`?${t}`];
  });
}

export function extractGameData(md) {
  const ts = tables(md);
  const problems = [];

  // ---- items (5.5 ledger) first: other tables refer to them
  const ledger = find(ts, 'Component', 'Found in');
  const itemIds = new Set(ledger.rows.map((r) => slug(r.c[0])));
  const items = ledger.rows.map((r) => {
    const [found, required] = r.c[3].split('/').map((x) => x.trim());
    const int = (s) => parseInt(s, 10);
    return {
      id: slug(r.c[0]), nameId: `ui.item.${slug(r.c[0])}.name`,
      foundIn: r.c[1], usedBy: r.c[2],
      ledger: { found: int(found), required: int(required), more: found.includes('+') },
    };
  });

  // ---- resources (3.1) and needs (3.2)
  const resources = find(ts, 'Resource', 'Solo start').rows.map((r) => {
    const name = r.c[0].replace(/ \(SP\)$/, '');
    const caps = [...r.c[2].matchAll(/\d+/g)].map((m) => Number(m[0]));
    const capWith = [...r.c[2].matchAll(/(\d+) with/g)].map((m) => Number(m[1])); // "100 (250 with Battery T1, 400 with T2)"
    const id = { 'Spare Parts': 'sp', 'Astronaut HP': 'hp' }[name] ?? slug(name);
    const res = { id, nameId: `ui.res.${slug(name)}.name`, start: num(r.c[1]), atZero: r.c[3] };
    if (id === 'hp') res.max = { commander: 100, roleRange: [caps[0], caps[1]] };
    else { res.cap = caps[0]; if (capWith.length === 2) res.capWith = { batteryT1: capWith[0], batteryT2: capWith[1] }; }
    return res;
  });
  const needRows = find(ts, 'Need', 'Amount').rows;
  const need = (name) => num(needRows.find((r) => r.c[0] === name).c[1]);
  const needs = {
    perAstronautPerSol: { oxygen: need('Oxygen'), food: need('Food'), water: need('Water'), morale: need('Morale'), power: need('Power') },
    pilotFood: num(needRows.find((r) => r.c[0] === 'Food').c[2].match(/−?\d+(\.\d+)?/)[0]),
    baseHeatLossPerSol: need('Base heat loss'),
    waterUsedPerAstronaut: num(needRows.find((r) => r.c[0] === 'Water').c[2].match(/(\d+) units/)[1]),
    recycler: { ok: 0.98, cracked: 0.7 },
  };

  // ---- modules (3.3)
  const modules = find(ts, 'Module', 'Unlocks when').rows.map((r) => {
    const name = r.c[0].replace(/ \((pre-built|base upgrade)[^)]*\)$/, '');
    const t2 = r.c[4];
    return {
      id: slug(name), nameId: `ui.module.${slug(name)}.name`,
      prebuilt: /pre-built/.test(r.c[0]), surface: /surface/.test(r.c[0]), baseUpgrade: /base upgrade/.test(r.c[0]),
      unlock: r.c[1], cost: cost(r.c[2], itemIds),
      t1: { effects: effects(r.c[3]), text: r.c[3] },
      t2: t2 === 'No tier' || t2 === '—' ? null : { effects: effects(t2), text: t2 },
    };
  });

  // ---- recipes: rover/suit/drone upgrades and module Tier 2 (5.4)
  const recipes = find(ts, 'Upgrade', 'Type').rows.map((r) => {
    const name = r.c[0].replace(/ \(= Garage T2\)$/, '');
    const tier2 = name.match(/^(.*) T2: (.*)$/);
    const display = tier2 ? tier2[2] : name;
    const of = tier2 ? modules.find((m) => m.id === slug(tier2[1]) || m.id.includes(slug(tier2[1])))?.id : null;
    if (tier2 && !of) problems.push(`recipe "${r.c[0]}" (line ${r.line}): no module matches "${tier2[1]}"`);
    const rec = { id: slug(display), nameId: `ui.upgrade.${slug(display)}.name`, type: r.c[1].toLowerCase(), cost: cost(r.c[2], itemIds), effect: r.c[3] };
    if (tier2) rec.tier2Of = of;
    if (/= Garage T2/.test(r.c[0])) rec.tier2Of = 'garage_and_airlock';
    return rec;
  });

  // ---- expeditions (5.2) and risk (5.1)
  const ROUTE = { 'Crater floor': 'floor', 'Crater rim': 'rim', Delta: 'delta', Canyon: 'canyon' };
  const expeditions = find(ts, '#', 'Target').rows.map((r) => {
    const route = r.c[4].match(/^(.+?) \(([\d.]+)\)$/);
    const repeat = r.c[0] === 'R';
    const e = {
      id: repeat ? 'run' : `exp${r.c[0]}`, nameId: repeat ? 'ui.exp_run.name' : `ui.exp${r.c[0]}.name`,
      fiction: /\(fiction\)/.test(r.c[1]),
      sol: repeat ? r.c[2] : r.c[2].includes('–') ? r.c[2].split('–').map(Number) : Number(r.c[2]),
      durationSols: num(r.c[3].match(/^\d+/)[0]),
      route: ROUTE[route[1]], routeFactor: Number(route[2]),
      requires: r.c[5], risk: r.c[6].toLowerCase(),
      commanderHpCost: num(r.c[7].match(/^\d+/)[0]),
    };
    if (repeat) {
      const scrap = r.c[8].match(/Scrap mode: (\d+) SP/);
      const ice = r.c[8].match(/Ice mode: Ice Core ×(\d+)/);
      e.modes = { scrap: { sp: Number(scrap[1]), randomItem: ['circuit_board', 'titanium_plate', 'solar_cell'] }, ice: { items: { ice_core: Number(ice[1]) } } };
      e.commanderHpCostShielded = num(r.c[7].match(/\((\d+) with/)[1]);
    } else e.loot = loot(r.c[8], itemIds);
    if (r.c[0] === '4') e.commanderHpCostNoLiner = num(r.c[7].match(/\((\d+) without/)[1]);
    if (r.c[0] === '5') e.durationSolsNoLongRange = num(r.c[3].match(/\((\d+) without/)[1]);
    return e;
  });
  const riskRows = find(ts, 'Risk').rows;
  const risk = Object.fromEntries(riskRows.map((r) => [r.c[0].toLowerCase(), { smooth: pct(r.c[1]), bumpy: pct(r.c[2]), rough: pct(r.c[3]) }]));

  // ---- radiation and HP (3.6)
  const shieldRows = find(ts, 'Where', 'Shielding (simplified gameplay values)').rows;
  const recoveryRows = find(ts, 'Source', 'Amount').rows;
  const radiation = {
    basePerSol: 20,
    routeFactor: { floor: 1.0, rim: 1.25, delta: 1.25, canyon: 1.5 },
    radiationResistance: { commander: 0.15, chief_engineer: 0.10, rover_pilot_and_geologist: 0.25, astro_botanist: 0, comms_and_science_officer: 0 },
    roleSurfaceMultiplier: { chief_engineer: 1.2, astro_botanist: 1.25, comms_and_science_officer: 1.3 },
    roverShielding: 0.6, suitLiner: 0.75, flare: 3,
    fitnessMultiplier: { atLeast40: 1.0, from16to39: 1.1, atMost15: 1.25 },
    rooms: shieldRows.map((r) => ({ where: r.c[0], factor: Number(r.c[2]), hpPerSol: num(r.c[3]), hpPerSolFlare: num(r.c[4]) })),
    recovery: recoveryRows.map((r) => ({ source: r.c[0], amount: r.c[1], condition: r.c[2] })),
    medRestHp: 50,
  };
  const hpCostRows = find(ts, 'Expedition', 'Upgrades at launch').rows;
  radiation.commanderHpCost = hpCostRows.map((r) => ({ expedition: r.c[0], upgrades: r.c[1], hp: r.c[2] }));

  // ---- roles (2.1, 2.2)
  const cmd = find(ts, 'Stat', 'Value').rows;
  const stat = (k) => cmd.find((r) => r.c[0].startsWith(k));
  const buffOf = (cell) => { const m = cell.match(/^([^:]+): (.*)$/); return m ? { id: slug(m[1]), nameId: `ui.buff.${slug(m[1])}.name`, textId: `ui.buff.${slug(m[1])}.text` } : null; };
  const roles = [{
    id: 'commander', mode: 'solo', nameId: 'ui.role.commander.name', blurbId: 'ui.role.commander.blurb',
    baseHp: num(stat('Base HP').c[1]), radiationResistance: pct(stat('Radiation Resistance').c[1].match(/\d+%/)[0]),
    buffs: cmd.filter((r) => /^Buff \d/.test(r.c[0])).map((r) => buffOf(r.c[0].replace(/^Buff \d: /, '') + ': ' + r.c[1])),
    limits: cmd.filter((r) => /^Mild limit/.test(r.c[0])).map((r) => buffOf(r.c[0].replace(/^Mild limit: /, '') + ': ' + r.c[1])),
  }];
  for (const r of find(ts, 'Role', 'Base HP').rows) {
    roles.push({
      id: slug(r.c[0]), mode: 'coop', nameId: `ui.role.${slug(r.c[0])}.name`,
      baseHp: num(r.c[1]), radiationResistance: pct(r.c[2]),
      buffs: [buffOf(r.c[3]), buffOf(r.c[4])], debuffs: [buffOf(r.c[5]), buffOf(r.c[6])],
    });
  }

  // ---- dilemmas and events (Section 6)
  const choiceTable = (t, prefix) => t.rows.map((r) => {
    const letter = r.c[0].match(/^([A-C])\./)[1].toLowerCase();
    return { id: letter, labelId: `ui.${prefix}.${letter}.label`, followUpId: `astra.${prefix}.${letter}`, immediate: clean(r.c[1]), delayed: clean(r.c[2]) };
  });
  const dilemmas = ts.filter((t) => /^Dilemma \d/.test(t.heading) && t.header[0] === 'Choice').map((t) => {
    const n = t.heading.match(/^Dilemma (\d)/)[1];
    const sol = Number(t.heading.match(/\(Sol (\d+)/)[1]);
    return { id: `d${n}`, sol, radioDecision: /radio decision/.test(t.heading), titleId: `ui.d${n}.title`, headerId: `ui.d${n}.header`, alertId: `astra.d${n}.alert`, choices: choiceTable(t, `d${n}`) };
  });
  const evRows = find(ts, 'Event', 'First possible').rows;
  const events = ts.filter((t) => /^Event \d/.test(t.heading) && t.header[0] === 'Choice').map((t, i) => {
    const n = t.heading.match(/^Event (\d)/)[1];
    const row = evRows[i];
    const ev = {
      id: `e${n}`, titleId: `ui.e${n}.title`, headerId: `ui.e${n}.header`, alertId: `astra.e${n}.alert`,
      firstSol: num(row.c[1]), chancePerSol: pct(row.c[2].match(/\d+%/)[0]), daytimeOnly: /daytime/.test(row.c[2]),
      cooldownSols: num(row.c[3]), warning: row.c[4], choices: choiceTable(t, `e${n}`),
    };
    if (n === '1') { ev.forecastId = 'astra.e1.watch'; ev.warningSols = { labT2OrComms: 1, both: 2 }; }
    if (n === '2') { delete ev.choices[0].followUpId; ev.choices[0].followUpIds = ['astra.e2.a.clean', 'astra.e2.a.dusty']; }
    if (row.c[0] && !slug(row.c[0])) problems.push(`event row without a name at line ${row.line}`);
    ev.name = row.c[0];
    return ev;
  });
  const eventRules = { maxPerSol: 1, notOnStoryDilemmaSol: true, notWhileCommanderAway: true };

  // ---- Logbook cards and badges (Section 8)
  const cardT = find(ts, 'Card', 'Tier');
  const logbook = cardT ? cardT.rows.map((r) => ({
    id: r.c[0], tier: r.c[1], trigger: r.c[2], triggerIds: triggerIds(r.c[2]), titleId: `card.${r.c[0]}.title`, textId: `card.${r.c[0]}.text`,
    mission: r.c[5], image: r.c[6], sources: r.c[7].split(' · ').map((s) => s.trim()).filter(Boolean),
  })) : [];
  const badgeT = find(ts, 'Badge');
  const badges = badgeT ? badgeT.rows.map((r) => ({ id: r.c[0], nameId: `badge.${r.c[0]}.name`, textId: `badge.${r.c[0]}.text`, earnedWhen: r.c[2], card: r.c[3] })) : [];

  return {
    data: {
      meta: {
        source: 'SCENARIO.md', generatedBy: 'content/tools/extract-game-data.mjs',
        note: 'Generated: edit SCENARIO.md and re-run the tool. Text lives in content/data/strings.en.json (resolve the *Id fields).',
        labels: {
          default: 'gameplay',
          nasa_measurement: ['needs.recycler.ok (ISS 98% water recovery)'],
          approximation: ['radiation.routeFactor', 'radiation.flare', 'events[e1] forecast', 'time.solRealSeconds (1 Sol = 24 h 39 m, played as 4 min)'],
        },
      },
      time: { solRealSeconds: 240, dayRealSeconds: 180, nightRealSeconds: 60, buildSolsOneDrone: 2, tier2InstallSols: 0.5, craftsPerSol: { t1: 1, t2: 2 } },
      power: { droneBuildingPerSol: -5, storm: { solarT1: 0.3, solarT2: 0.5, batteryPowerMult: 4 } },
      resources, needs, modules, recipes, items, expeditions, risk, radiation, roles,
      dilemmas, events, eventRules, logbook, badges,
    },
    problems,
  };
}

/** Internal consistency: recipes and loot use known items; the ledger adds up; line IDs exist. */
export function consistency(data, strings) {
  const out = [];
  const itemIds = new Set(data.items.map((i) => i.id));
  const known = (id, where) => { if (!itemIds.has(id)) out.push(`${where}: unknown item "${id}"`); };
  for (const m of data.modules) for (const id of Object.keys(m.cost.items)) known(id, `module ${m.id} cost`);
  for (const r of data.recipes) for (const id of Object.keys(r.cost.items)) known(id, `recipe ${r.id}`);
  for (const e of data.expeditions) for (const id of Object.keys(e.loot?.items ?? {})) if (!['canyon_samples', 'brine_sample'].includes(id)) known(id, `expedition ${e.id} loot`);

  // ledger: found = story expedition loot; required = recipes + module costs
  for (const it of data.items) {
    const found = data.expeditions.reduce((n, e) => n + (e.loot?.items?.[it.id] ?? 0), 0);
    // modules that are also Workshop recipes (the Roof Layer) are counted once, as a recipe
    const recipeIds = new Set(data.recipes.map((r) => r.id));
    const required = data.recipes.reduce((n, r) => n + (r.cost.items[it.id] ?? 0), 0)
      + data.modules.filter((m) => !recipeIds.has(m.id)).reduce((n, m) => n + (m.cost.items[it.id] ?? 0), 0);
    if (found !== it.ledger.found) out.push(`ledger ${it.id}: SCENARIO says found ${it.ledger.found}, expedition loot gives ${found}`);
    const storyOnly = it.id === 'black_box';
    if (!storyOnly && required !== it.ledger.required) out.push(`ledger ${it.id}: SCENARIO says required ${it.ledger.required}, recipes + costs need ${required}`);
    if (found < required) out.push(`ledger ${it.id}: found ${found} < required ${required}`);
  }
  // every *Id resolves to a string
  if (strings) {
    const walk = (o, p) => {
      if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${p}[${i}]`));
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
        if (/Id$/.test(k) && typeof v === 'string' && !(v in strings)) out.push(`${p}.${k}: "${v}" not in strings.en.json`);
        else if (k === 'followUpIds') v.forEach((id) => { if (!(id in strings)) out.push(`${p}.${k}: "${id}" not in strings.en.json`); });
        else walk(v, `${p}.${k}`);
      }
    };
    walk(data, 'data');
    for (const c of data.logbook) for (const id of c.triggerIds) if (!(id in strings)) out.push(`logbook ${c.id}: trigger "${c.trigger}" -> "${id}" is not a line ID`);
  }
  return out;
}

/** Where src/campaign/data.js (the engine) differs from SCENARIO.md. Report only. */
export async function engineDrift(data) {
  const out = [];
  let eng;
  try { eng = await import(path.join(ROOT, 'src', 'campaign', 'data.js')); } catch { return ['src/campaign/data.js could not be loaded']; }
  const byName = new Map(Object.values(eng.MODULES).map((m) => [m.nameId, m]));
  const cmp = (what, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${what}: SCENARIO ${JSON.stringify(a)} vs engine ${JSON.stringify(b)}`); };
  const pick = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => ['power', 'heat', 'water', 'oxygen', 'food', 'morale', 'sp', 'research'].includes(k)).sort());
  const sorted = (o) => Object.fromEntries(Object.entries(o ?? {}).sort());
  for (const m of data.modules) {
    const e = byName.get(m.nameId);
    if (!e) { out.push(`module ${m.id}: not in engine MODULES`); continue; }
    cmp(`module ${m.id} T1 per Sol`, pick(m.t1.effects), sorted(e.t1));
    if (m.t2) cmp(`module ${m.id} T2 per Sol`, pick(m.t2.effects), sorted(e.t2));
    const c = { sp: m.cost.sp, ...(m.cost.water ? { water: m.cost.water } : {}), ...(Object.keys(m.cost.items).length ? { items: m.cost.items } : {}) };
    if (!m.prebuilt) cmp(`module ${m.id} cost`, c, e.cost);
  }
  for (const r of eng.START_RES ? Object.entries(eng.START_RES) : []) {
    const s = data.resources.find((x) => x.id === r[0]);
    if (s && s.start !== r[1]) out.push(`start ${r[0]}: SCENARIO ${s.start} vs engine ${r[1]}`);
  }
  const recipeByName = new Map([...Object.values(eng.RECIPES ?? {}), ...Object.values(eng.UPGRADES ?? {})].map((r) => [r.nameId, r]));
  for (const r of data.recipes) {
    const e = recipeByName.get(r.nameId);
    if (!e) { if (r.id !== 'regolith_roof_layer') out.push(`recipe ${r.id}: not in engine RECIPES/UPGRADES`); continue; }
    cmp(`recipe ${r.id}`, { sp: r.cost.sp, water: r.cost.water, items: r.cost.items }, { sp: e.sp, water: e.water ?? 0, items: e.items ?? {} });
  }
  return out;
}

async function main() {
  const check = process.argv.includes('--check');
  const md = fs.readFileSync(SRC, 'utf8');
  const { data, problems } = extractGameData(md);
  const strings = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'data', 'strings.en.json'), 'utf8'));
  const issues = [...problems, ...consistency(data, strings)];
  const drift = await engineDrift(data);
  const json = JSON.stringify(data, null, 2) + '\n';
  console.log(`modules ${data.modules.length}, recipes ${data.recipes.length}, items ${data.items.length}, expeditions ${data.expeditions.length}, roles ${data.roles.length}, dilemmas ${data.dilemmas.length}, events ${data.events.length}, cards ${data.logbook.length}, badges ${data.badges.length}`);
  console.log(`scenario consistency problems: ${issues.length}`);
  for (const p of issues) console.log(`  ${p}`);
  console.log(`engine (src/campaign/data.js) differs from SCENARIO.md: ${drift.length}`);
  for (const d of drift) console.log(`  ${d}`);
  if (check) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current !== json) { console.error('game-data.json is out of date: run node content/tools/extract-game-data.mjs'); process.exit(1); }
    if (issues.length) process.exit(1);
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, json);
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
