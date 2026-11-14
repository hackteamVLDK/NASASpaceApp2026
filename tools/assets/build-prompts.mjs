#!/usr/bin/env node
/**
 * Builds the ready-to-paste image prompts from assets/manifests/asset-manifest.json.
 *
 *   node tools/assets/build-prompts.mjs            write assets/prompts/*.md
 *   node tools/assets/build-prompts.mjs --check    fail if the files are out of date
 *
 * The manifest is the single source of truth; the files in assets/prompts/ are generated.
 * The agent never generates images: the team pastes a prompt into an image tool and drops
 * the result into assets/incoming/.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestPath = join(root, 'assets', 'manifests', 'asset-manifest.json');
const outDir = join(root, 'assets', 'prompts');

export function loadManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

const size = ([w, h]) => `${w} x ${h} px`;

/** One complete prompt for one asset, ready to paste. */
export function promptFor(asset, manifest) {
  const anchor = asset.id === manifest.anchor;
  const lines = [];
  lines.push(`Create a pixel-art game asset: ${asset.title}.`);
  lines.push('');
  if (!anchor) {
    lines.push('STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.');
    lines.push('');
  }
  lines.push(`WHAT IT SHOWS: ${asset.subject}`);
  lines.push('');
  lines.push(`VIEW: ${asset.perspective}`);
  if (asset.layout) lines.push(`LAYOUT: ${asset.layout}`);
  if (asset.frames) lines.push(`FRAMES: ${asset.frames.columns} columns x ${asset.frames.rows} rows. ${typeof asset.frames.cell === 'string' ? asset.frames.cell : `Each cell ${asset.frames.cell[0]} x ${asset.frames.cell[1]} logical pixels.`} Order: ${asset.frames.order}.`);
  lines.push(`BACKGROUND: ${asset.background}.`);
  lines.push('');
  lines.push(`STYLE RULES: ${manifest.common.styleRules}`);
  lines.push(`AVOID: ${manifest.common.avoid}`);
  lines.push('');
  lines.push(`OUTPUT: ${asset.generate}. Logical size in the game: ${size(asset.logicalSize)} (the image is generated larger and scaled down by a whole-number factor, so keep every shape chunky).`);
  return lines.join('\n');
}

export function promptFile(asset, manifest) {
  const refs = asset.dependsOn.length ? asset.dependsOn.map((id) => `\`${id}\``).join(', ') : 'none (this one is generated first)';
  return [
    `# ${asset.id} — ${asset.title}`,
    '',
    '> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.',
    '',
    `- **Status:** ${asset.status}`,
    `- **Tier:** ${asset.tier}`,
    `- **Attach as reference images:** ${refs}`,
    `- **Save the result as:** \`${asset.incoming}\``,
    `- **Final location (after processing):** \`${asset.file}\``,
    `- **Used for:** ${asset.purpose}`,
    asset.notes ? `- **Notes:** ${asset.notes}` : null,
    '',
    asset.status === 'awaiting-lore' ? '**This asset cannot be generated yet.** The prompt below is a placeholder.\n' : null,
    '## Prompt',
    '',
    '```text',
    promptFor(asset, manifest),
    '```',
    '',
  ].filter((l) => l !== null).join('\n');
}

export function indexFile(manifest) {
  const rows = manifest.assets.map((a) => `| ${a.tier} | [${a.id}](${a.id}.md) | ${a.title} | ${a.status} | ${a.dependsOn.join(', ') || '—'} |`);
  const audio = (manifest.audio ?? []).map((a) => `| \`${a.id}\` | ${a.when} | ${a.what} | ${a.status} |`);
  return [
    '# Asset prompts — index',
    '',
    '> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.',
    '',
    'Order of work: **generate `style.anchor` first and choose one result together.** Every other',
    'asset is then generated with that image attached as the style reference. See',
    '[STYLE_GUIDE.md](STYLE_GUIDE.md) and [../../docs/ASSET_PIPELINE.md](../../docs/ASSET_PIPELINE.md).',
    '',
    '| Tier | Asset | What | Status | Needs first |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    '## Sound',
    '',
    '| Id | When | What | Status |',
    '|---|---|---|---|',
    ...audio,
    '',
  ].join('\n');
}

export function styleGuideFile(manifest) {
  const anchor = manifest.assets.find((a) => a.id === manifest.anchor);
  return [
    '# Style guide',
    '',
    '> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.',
    '',
    'One style for the whole game. The binding source for what is in the world is',
    '[SCENARIO.md](../../SCENARIO.md).',
    '',
    '## How the style is fixed',
    '',
    `1. Generate \`${anchor.id}\` (${anchor.title}) in several variants and pick **one** as a team.`,
    '2. Save the chosen image as `assets/art/style/anchor.png`.',
    '3. Generate everything else with it attached as the reference, using the prompt in this folder.',
    '',
    '## Rules',
    '',
    manifest.common.styleRules,
    '',
    '## Never',
    '',
    manifest.common.avoid,
    '',
    '## Sizes',
    '',
    `- World: ${manifest.world.units[0]} x ${manifest.world.units[1]} units, ${manifest.world.unitsPerArtPixel} units per art pixel, so ${size(manifest.world.artPixels)}.`,
    `- Screen window: ${size([manifest.canvas.logicalWidth, manifest.canvas.logicalHeight])}, scaled by a whole number.`,
    `- Module cell ${size(manifest.grid.moduleCell)}, shaft ${size(manifest.grid.shaftCell)}, crew frame ${size(manifest.grid.crewFrame)}, drone frame ${size(manifest.grid.droneFrame)}, tile ${size(manifest.grid.tile)}, icon ${size(manifest.grid.icon)}.`,
    '- Image tools do not give exact pixel art. Generate large, then scale down by a whole number and re-quantise the palette (see ASSET_PIPELINE.md).',
    '',
    '## Colour',
    '',
    '- Flat cyan `#00FFFF` on a crew sprite marks the part that is recoloured per person. Use it nowhere else.',
    '- Solid magenta `#FF00FF` is the background when the tool cannot make a transparent image; it is removed afterwards.',
    '- Martian Orange `#FF6B35` is the highlight colour of the intro (SCENARIO section 3). Intro background is `#05070A`.',
    '',
  ].join('\n');
}

/** Everything that should exist in assets/prompts/, as { filename: content }. */
export function buildAll(manifest = loadManifest()) {
  const files = { 'README.md': indexFile(manifest), 'STYLE_GUIDE.md': styleGuideFile(manifest) };
  for (const asset of manifest.assets) files[`${asset.id}.md`] = promptFile(asset, manifest);
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check');
  const files = buildAll();
  if (check) {
    const stale = Object.entries(files).filter(([name, text]) => !existsSync(join(outDir, name)) || readFileSync(join(outDir, name), 'utf8') !== text).map(([name]) => name);
    const extra = existsSync(outDir) ? readdirSync(outDir).filter((n) => n.endsWith('.md') && !(n in files)) : [];
    if (stale.length || extra.length) {
      console.error(`assets/prompts is out of date. Run: npm run assets:prompts\n  stale: ${stale.join(', ') || '-'}\n  extra: ${extra.join(', ') || '-'}`);
      process.exit(1);
    }
    console.log(`assets/prompts is up to date (${Object.keys(files).length} files).`);
  } else {
    mkdirSync(outDir, { recursive: true });
    for (const n of readdirSync(outDir)) if (n.endsWith('.md') && !(n in files)) rmSync(join(outDir, n));
    for (const [name, text] of Object.entries(files)) writeFileSync(join(outDir, name), text);
    console.log(`wrote ${Object.keys(files).length} files to assets/prompts/`);
  }
}
