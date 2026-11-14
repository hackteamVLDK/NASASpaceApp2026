#!/usr/bin/env node
/**
 * Generate one asset with the local Codex CLI (its built-in image tool, ChatGPT login).
 * No OpenAI API and no API key: the script refuses to run if OPENAI_API_KEY is set.
 *
 *   node tools/assets/generate.mjs <asset-id> [--variant N] [--fix "what to change"]
 *
 * Output: assets/incoming/<id>.png, or assets/incoming/<id>.v<N>.png with --variant
 * (used for the style anchor, where the team picks one candidate).
 * Reference images (the asset's `dependsOn`) are attached with -i. The asset file of a
 * reference is used if it exists, otherwise its incoming file.
 */
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadManifest, promptFor } from './build-prompts.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const args = process.argv.slice(2);
const flag = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const id = args.find((a) => !a.startsWith('--') && a !== flag('variant') && a !== flag('fix'));
if (!id) { console.error('usage: generate.mjs <asset-id> [--variant N] [--fix "text"]'); process.exit(2); }
if (process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY is set. This project never uses the OpenAI API: unset it.'); process.exit(2); }

const manifest = loadManifest();
const asset = manifest.assets.find((a) => a.id === id);
if (!asset) { console.error(`unknown asset: ${id}`); process.exit(2); }
if (asset.status === 'awaiting-lore') { console.error(`${id} is awaiting-lore: nothing to generate yet.`); process.exit(2); }

const refs = [];
for (const dep of asset.dependsOn) {
  const d = manifest.assets.find((a) => a.id === dep);
  const found = [d.file, d.incoming].map((p) => join(root, p)).find((p) => existsSync(p));
  if (!found) { console.error(`reference ${dep} has no image yet (${d.file}). Generate and approve it first.`); process.exit(2); }
  refs.push(found);
}

for (const r of asset.references ?? []) {
  if (!existsSync(join(root, r))) { console.error(`design reference missing: ${r}`); process.exit(2); }
  refs.push(join(root, r));
}

const variant = flag('variant');
const out = join(root, 'assets', 'incoming', variant ? `${id}.v${variant}.png` : `${id}.png`);
mkdirSync(join(root, 'assets', 'incoming'), { recursive: true });

const work = mkdtempSync(join(tmpdir(), 'asset-gen-'));
let prompt = promptFor(asset, manifest);
if (flag('fix')) prompt += `\n\nCORRECTION to the previous attempt: ${flag('fix')}`;
const task = `Use your built-in image generation tool to create exactly ONE image from the brief below, then save it into the current directory as out.png. ${refs.length ? 'The attached image(s) are the style reference(s). ' : ''}Do not use any API key and do not write any other files. Reply with one short line about what you made.\n\nBRIEF:\n${prompt}\n`;

const cliArgs = ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', work, ...refs.flatMap((r) => ['-i', r]), '-'];
console.log(`generating ${id}${variant ? ` (variant ${variant})` : ''} with ${refs.length} reference(s)...`);
const child = spawn('codex', cliArgs, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', (d) => (log += d));
child.stderr.on('data', (d) => (log += d));
child.stdin.end(task);
child.on('close', (code) => {
  const produced = existsSync(join(work, 'out.png')) ? join(work, 'out.png') : readdirSync(work).filter((f) => f.endsWith('.png')).map((f) => join(work, f))[0];
  if (/usage limit/i.test(log)) {
    const when = log.match(/try again at ([0-9: APM]+)/i);
    console.error('RATE_LIMIT: ' + (when ? when[1].trim() : 'later'));
    process.exit(3);
  }
  if (code !== 0 || !produced) { console.error(`failed (exit ${code}). Last output:\n${log.split('\n').slice(-15).join('\n')}`); process.exit(1); }
  copyFileSync(produced, out);
  console.log(`saved ${out}`);
});
