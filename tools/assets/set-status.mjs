#!/usr/bin/env node
/**
 * Set the status of assets in the manifest without reformatting the file.
 *   node tools/assets/set-status.mjs received id1 id2 ...
 * Only the status line inside each asset's own block is changed. Then run npm run assets:prompts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadManifest } from './build-prompts.mjs';

const [status, ...ids] = process.argv.slice(2);
const manifest = loadManifest();
if (!status || !ids.length || !Object.hasOwn(manifest.statuses, status)) {
  console.error(`usage: set-status.mjs <${Object.keys(manifest.statuses).join('|')}> <asset-id>...`);
  process.exit(2);
}
const file = join(new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'assets', 'manifests', 'asset-manifest.json');
let text = readFileSync(file, 'utf8');
for (const id of ids) {
  const at = text.indexOf(`"id": "${id}"`);
  if (at < 0) { console.error(`unknown asset: ${id}`); process.exit(2); }
  const next = text.indexOf('"id":', at + 10);
  const end = next < 0 ? text.length : next;
  const block = text.slice(at, end);
  const changed = block.replace(/("status": )"[^"]*"/, `$1"${status}"`);
  if (changed === block && !block.includes(`"status": "${status}"`)) { console.error(`no status line in ${id}`); process.exit(2); }
  text = text.slice(0, at) + changed + text.slice(end);
}
JSON.parse(text);
writeFileSync(file, text);
console.log(`${ids.length} asset(s) -> ${status}`);
