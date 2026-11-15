#!/usr/bin/env node
/**
 * Extract every player-facing English line from SCENARIO.md into content/data/strings.en.json
 * ({ "line.id": "English text" }), and report problems.
 *
 *   node content/tools/extract-strings.mjs            write the file and print a report
 *   node content/tools/extract-strings.mjs --check    exit 1 if the file is out of date or there are errors
 *
 * No dependencies. Explicit IDs come from table rows whose first cell is a line ID
 * (astra.*, radio.*, intro.*, ui.*, card.*, report.*, badge.*, char.*, log.*) and from the
 * JSON in Section 7. Lines that have no ID in SCENARIO.md get a DERIVED ID by these rules
 * (also listed in SCENARIO.md, "How to use this file"):
 *
 *   Dilemma N           ui.dN.title · ui.dN.header · astra.dN.alert · ui.dN.<a|b|c>.label · astra.dN.<a|b|c>
 *   Event N             ui.eN.title · ui.eN.header · astra.eN.alert · astra.e1.watch (forecast)
 *                       ui.eN.<a|b|c>.label · astra.eN.<a|b|c> (Event 2 A: astra.e2.a.clean / .dusty)
 *   Mini-game 4.N       ui.mg.<id>.title · astra.mg.<id> · ui.mg.<id>.counter   (<id> as in Section 7, e.g. valve_balance)
 *   Expedition N        ui.expN.name · radio.expN.<pct> (0% -> "00") · astra.expN.return · astra.expN.at<pct>
 *   Scrap & Ice Run     ui.exp_run.name · radio.run.<pct>.<1..3>
 *   Modules (3.3)       ui.module.<slug>.name        Upgrades (5.4)  ui.upgrade.<slug>.name
 *   Components (5.5)    ui.item.<slug>.name          Resources (3.1) ui.res.<slug>.name
 *   Roles (2.1, 2.2)    ui.role.<slug>.name · ui.buff.<slug>.name · ui.buff.<slug>.text
 *   Logbook card        card.<card>.title · card.<card>.text
 *
 * "(fiction)" tags and similar writer notes in parentheses are stripped: the game never shows them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'SCENARIO.md');
const OUT = path.join(ROOT, 'content', 'data', 'strings.en.json');

const ID_RE = /^(astra|radio|intro|ui|card|report|badge|char|log)\.[A-Za-z0-9_.]+$/;
const MINIGAME_IDS = {
  '4.1': 'solar_wipe', '4.2': 'air_filter_scrub', '4.3': 'valve_balance', '4.4': 'water_sort',
  '4.5': 'heat_pump_reroute', '4.6': 'nutrient_match', '4.7': 'wheel_pebble_vacuum',
  '4.8': 'suit_seal_check', '4.9': 'dish_antenna_alignment',
};

export const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** Remove writer notes that must never reach the player. */
export function clean(text) {
  return text
    .replace(/\s*\((fiction|the canyon pocket is fiction)\)/g, '')
    .replace(/^"(.*)"$/s, '$1')
    .replace(/\\\|/g, '|')
    .trim();
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());

export function extract(md) {
  const lines = md.split('\n');
  const entries = []; // { id, text, line, derived }
  const add = (id, text, line, derived) => { if (text) entries.push({ id, text: clean(text), line, derived }); };
  const referenced = new Set();
  const jsonLabels = []; // choice labels inside Section 7 JSON (no IDs of their own)

  let section = '';            // current "### " / "#### " heading text
  let header = null;           // current table header cells
  let ctx = {};                // { dilemma, event, mg, exp, run }
  let inCode = false, codeBuf = [], codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const n = i + 1;

    if (raw.startsWith('```')) {
      if (!inCode) { inCode = true; codeLang = raw.slice(3).trim(); codeBuf = []; }
      else {
        inCode = false;
        if (codeLang === 'json') {
          const walk = (o) => {
            if (Array.isArray(o)) return o.forEach(walk);
            if (o && typeof o === 'object') {
              if (typeof o.id === 'string' && typeof o.en === 'string' && ID_RE.test(o.id)) add(o.id, o.en, n, false);
              if (typeof o.id === 'string' && o.text && typeof o.text.lobbyBlurb === 'string') add(`ui.role.${o.id}.blurb`, o.text.lobbyBlurb, n, true);
              if (typeof o.label === 'string') jsonLabels.push({ label: o.label, line: n });
              Object.values(o).forEach(walk);
            }
          };
          try { walk(JSON.parse(codeBuf.join('\n'))); } catch { /* not JSON */ }
        }
      }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    // collect line IDs mentioned in prose/backticks, to report references to undefined IDs
    for (const m of raw.matchAll(/`((?:astra|radio|intro|ui|card|report|badge|char|log)\.[A-Za-z0-9_.]+)`|\b((?:astra|radio)\.[a-z0-9_]+\.[a-z0-9_.]+)\b/g)) {
      const id = (m[1] || m[2]).replace(/\.$/, '');
      if (!id.includes('*') && !id.includes('<') && !/(^|\.)(d|e|exp)N(\.|$)/.test(id)) referenced.add(id); // skip documented placeholders like astra.dN.alert
    }

    const h = raw.match(/^(#{2,4}) (.*)$/);
    if (h) {
      section = h[2];
      header = null;
      ctx = {};
      let m;
      if ((m = section.match(/^Dilemma (\d+): (.*?) \(/))) { ctx.dilemma = m[1]; add(`ui.d${m[1]}.title`, m[2], n, true); }
      else if ((m = section.match(/^Event (\d+): (.*)$/))) { ctx.event = m[1]; add(`ui.e${m[1]}.title`, m[2], n, true); }
      else if ((m = section.match(/^(4\.\d) (.*)$/))) { ctx.mg = MINIGAME_IDS[m[1]]; add(`ui.mg.${ctx.mg}.title`, m[2], n, true); }
      else if ((m = section.match(/^Expedition (\d+): (.*?)( \(|$)/)) && !section.includes('—')) { ctx.exp = m[1]; }
      else if (section.startsWith('Scrap & Ice Run')) { ctx.run = true; }
      continue;
    }
    const exp5 = raw.match(/^Expedition 5: Canyon Anomaly — /); if (exp5) continue;

    // ASTRA alerts / mini-game / expedition lines outside tables
    let m;
    if ((m = raw.match(/^ASTRA 6\.7 \/\/ ([A-Z ]+): (.*)$/))) {
      const scope = ctx.dilemma ? `d${ctx.dilemma}` : ctx.event ? `e${ctx.event}` : null;
      if (scope) {
        if (m[1] === 'SPACE WEATHER WATCH') add(`astra.${scope}.watch`, m[2], n, true);
        else { add(`ui.${scope}.header`, m[1], n, true); add(`astra.${scope}.alert`, m[2], n, true); }
      }
      continue;
    }
    if ((m = raw.match(/with a counter: "([^"]+)"/)) && ctx.mg) { add(`ui.mg.${ctx.mg}.counter`, m[1], n, true); continue; }
    if ((m = raw.match(/^\*\*ASTRA:\*\* (.*)$/)) && ctx.mg) { add(`astra.mg.${ctx.mg}`, m[1], n, true); continue; }
    if ((m = raw.match(/^ASTRA on return: (.*)$/)) && ctx.exp) { add(`astra.exp${ctx.exp}.return`, m[1], n, true); continue; }
    if ((m = raw.match(/^ASTRA at (\d+)%: (.*)$/)) && ctx.exp) { add(`astra.exp${ctx.exp}.at${m[1]}`, m[2], n, true); continue; }

    if (!raw.startsWith('|')) { header = null; continue; }
    if (/^\|\s*-/.test(raw)) continue;
    const c = cells(raw);
    if (!header) { header = c; continue; } // first row of a table is its header

    // 1. explicit line IDs
    if (ID_RE.test(c[0])) {
      const li = header.indexOf('Line');
      add(c[0], c[li >= 0 ? li : c.length - 1], n, false);
      continue;
    }
    // 2. Logbook cards
    if (header[0] === 'Card' && header.includes('Title') && header.includes('Text')) {
      add(`card.${c[0]}.title`, c[header.indexOf('Title')], n, true);
      add(`card.${c[0]}.text`, c[header.indexOf('Text')], n, true);
      continue;
    }
    // 3. dilemma / event choices
    if (header[0] === 'Choice' && (ctx.dilemma || ctx.event)) {
      const scope = ctx.dilemma ? `d${ctx.dilemma}` : `e${ctx.event}`;
      const cm = c[0].match(/^([A-C])\. (.*)$/);
      if (!cm) continue;
      const k = cm[1].toLowerCase();
      add(`ui.${scope}.${k}.label`, cm[2], n, true);
      const f = c[header.length - 1];
      const two = f.match(/^Clean: (".*?") Dusty: (".*")$/);
      if (two) { add(`astra.${scope}.${k}.clean`, two[1], n, true); add(`astra.${scope}.${k}.dusty`, two[2], n, true); }
      else add(`astra.${scope}.${k}`, f, n, true);
      continue;
    }
    // 4. expedition radio logs
    if (header[0] === '%' && ctx.exp && /^\d+$/.test(c[0])) {
      if (/^Radio decision: Dilemma/.test(c[1])) continue; // a pointer, not a line
      const key = `radio.exp${ctx.exp}.${c[0] === '0' ? '00' : c[0]}`;
      const dm = c[1].match(/^Radio decision: (.*?) \(A\) (.*?): .*? \(B\) (.*?)(?:: .*)?\.?$/);
      if (dm) { add(key, dm[1], n, true); add(`ui.exp${ctx.exp}.${c[0]}.a.label`, dm[2], n, true); add(`ui.exp${ctx.exp}.${c[0]}.b.label`, dm[3], n, true); }
      else add(key, c[1], n, true);
      continue;
    }
    if (header[0] === '%' && ctx.run && /^\d+$/.test(c[0])) {
      c[1].split(' / ').forEach((t, j) => add(`radio.run.${c[0]}.${j + 1}`, t, n, true));
      continue;
    }
    // 5. names: expeditions, modules, upgrades, items, resources, roles, buffs
    if (header[0] === '#' && header[1] === 'Target') {
      add(c[0] === 'R' ? 'ui.exp_run.name' : `ui.exp${c[0]}.name`, c[1].replace(/, \d+ km .*$/, '').replace(/ \(repeatable\)$/, ''), n, true);
      continue;
    }
    if (header[0] === 'Module' && header[1] === 'Unlocks when') {
      const name = c[0].replace(/ \((pre-built|base upgrade)[^)]*\)$/, '');
      add(`ui.module.${slug(name)}.name`, name, n, true);
      continue;
    }
    if (header[0] === 'Upgrade' && header[1] === 'Type') {
      const name = c[0].replace(/ \(= Garage T2\)$/, '');
      const tier2 = name.match(/^(.*) T2: (.*)$/);
      add(`ui.upgrade.${slug(tier2 ? tier2[2] : name)}.name`, tier2 ? tier2[2] : name, n, true);
      continue;
    }
    if (header[0] === 'Component' && header[1] === 'Found in') { add(`ui.item.${slug(c[0])}.name`, c[0], n, true); continue; }
    if (header[0] === 'Resource' && header[1] === 'Solo start') {
      const name = c[0].replace(/ \(SP\)$/, '');
      add(`ui.res.${slug(name)}.name`, name, n, true);
      continue;
    }
    if (header[0] === 'Role' && header[1] === 'Base HP') {
      add(`ui.role.${slug(c[0])}.name`, c[0], n, true);
      for (const cell of c.slice(3)) {
        const bm = cell.match(/^([^:]+): (.*)$/);
        if (bm) { add(`ui.buff.${slug(bm[1])}.name`, bm[1], n, true); add(`ui.buff.${slug(bm[1])}.text`, bm[2], n, true); }
      }
      continue;
    }
    if (header[0] === 'Stat' && header[1] === 'Value' && /^(Buff \d|Mild limit): /.test(c[0])) {
      const name = c[0].replace(/^(Buff \d|Mild limit): /, '');
      add(`ui.buff.${slug(name)}.name`, name, n, true);
      add(`ui.buff.${slug(name)}.text`, c[1], n, true);
      continue;
    }
  }
  if (!entries.some((e) => e.id === 'ui.role.commander.name')) entries.push({ id: 'ui.role.commander.name', text: 'Commander', line: 0, derived: true });

  // merge; detect duplicates
  const strings = {};
  const first = {};
  const conflicts = [];
  const sameDup = [];
  for (const e of entries) {
    if (!(e.id in strings)) { strings[e.id] = e.text; first[e.id] = e.line; continue; }
    if (strings[e.id] === e.text) sameDup.push(e.id);
    else conflicts.push({ id: e.id, a: { line: first[e.id], text: strings[e.id] }, b: { line: e.line, text: e.text } });
  }
  const missing = [...referenced].filter((id) => !(id in strings) && !Object.keys(strings).some((k) => k.startsWith(id + '.'))).sort();
  const values = new Set(Object.values(strings));
  const unlabelled = jsonLabels.filter((l) => !values.has(l.label));
  const sorted = Object.fromEntries(Object.keys(strings).sort().map((k) => [k, strings[k]]));
  return { strings: sorted, unlabelled, conflicts, sameDup: [...new Set(sameDup)], missing, derived: entries.filter((e) => e.derived).length };
}

function main() {
  const check = process.argv.includes('--check');
  const r = extract(fs.readFileSync(SRC, 'utf8'));
  const json = JSON.stringify(r.strings, null, 2) + '\n';
  const n = Object.keys(r.strings).length;
  console.log(`strings: ${n} (${r.derived} entries use derived IDs)`);
  console.log(`conflicting duplicates (same ID, different text): ${r.conflicts.length}`);
  for (const c of r.conflicts) console.log(`  ${c.id}\n    line ${c.a.line}: ${c.a.text}\n    line ${c.b.line}: ${c.b.text}`);
  console.log(`harmless duplicates (same ID, same text): ${r.sameDup.length}${r.sameDup.length ? ' — ' + r.sameDup.join(', ') : ''}`);
  console.log(`player-facing JSON labels with no matching line: ${r.unlabelled.length}`);
  for (const u of r.unlabelled) console.log(`  line ${u.line}: "${u.label}"`);
  console.log(`IDs referenced in SCENARIO.md but never defined: ${r.missing.length}${r.missing.length ? ' — ' + r.missing.join(', ') : ''}`);
  if (check) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current !== json) { console.error('strings.en.json is out of date: run node content/tools/extract-strings.mjs'); process.exit(1); }
    if (r.conflicts.length || r.missing.length || r.unlabelled.length) process.exit(1);
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, json);
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
