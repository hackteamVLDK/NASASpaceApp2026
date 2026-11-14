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

const SIZES = [
  { ratio: 1, text: '1:1', size: '1024x1024' },
  { ratio: 1.5, text: '3:2 landscape', size: '1536x1024' },
  { ratio: 2 / 3, text: '2:3 portrait', size: '1024x1536' },
];
const nearestSize = (r) => SIZES.reduce((best, s) => (Math.abs(Math.log(r / s.ratio)) < Math.abs(Math.log(r / best.ratio)) ? s : best));

/**
 * How to ask the image tool for this asset. The tool only makes 1:1, 3:2 and 2:3 images, so
 * wide or tall sprite sheets are re-flowed into a grid whose overall shape fits one of them
 * (frames keep reading order); processing later puts the frames back into the logical grid.
 * Single pictures are generated in the nearest format and cropped afterwards.
 */
export function generationPlan(asset) {
  const f = asset.frames;
  if (f && Array.isArray(f.cell)) {
    const [cw, ch] = f.cell;
    const total = f.columns * f.rows;
    let best = null;
    for (let columns = 1; columns <= total; columns++) {
      const rows = Math.ceil(total / columns);
      const canvas = (columns * cw) / (rows * ch);
      const fmt = nearestSize(canvas);
      const score = Math.abs(Math.log(canvas / fmt.ratio)) + ((columns * rows - total) / total) * 0.4;
      if (!best || score < best.score) best = { columns, rows, canvas, fmt, score };
    }
    return { sheet: true, columns: best.columns, rows: best.rows, reflowed: best.columns !== f.columns || best.rows !== f.rows, format: best.fmt, crop: false, cell: f.cell };
  }
  const ratio = asset.logicalSize[0] / asset.logicalSize[1];
  const fmt = nearestSize(ratio);
  return { sheet: false, format: fmt, crop: Math.abs(Math.log(ratio / fmt.ratio)) > 0.05, ratio };
}


/** One complete prompt for one asset, ready to paste. */
export function promptFor(asset, manifest) {
  const anchor = asset.id === manifest.anchor;
  const lines = [];
  lines.push(`Create a pixel-art game asset: ${asset.title}.`);
  lines.push('');
  if (asset.references?.length) {
    lines.push('SURFACE REFERENCE: One attached image is the design reference of the team for the Mars surface (habitat with a central airlock dome and lit windows, dish, lattice radio tower with a red beacon, boxy yellow-white rover, red-brown mountains, violet-pink dusty sky). Copy its design language, shapes and palette for everything on the surface; do not copy it pixel for pixel, and follow the brief below where it differs.');
    lines.push('');
  }
  if (!anchor) {
    lines.push('STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.');
    lines.push('');
  }
  lines.push(`WHAT IT SHOWS: ${asset.subject}`);
  lines.push('');
  lines.push(`VIEW: ${asset.perspective}`);
  if (asset.layout) lines.push(`LAYOUT: ${asset.layout}`);
  const plan = generationPlan(asset);
  if (asset.frames) {
    if (plan.sheet) {
      const order = plan.reflowed ? asset.frames.order.replace(/row \d+( \([^)]*\))?:\s*/g, '') : asset.frames.order;
      lines.push(`FRAMES: a strict grid of ${plan.columns} columns x ${plan.rows} rows of EQUAL cells that exactly fill the image, each cell with the proportions ${plan.cell[0]}:${plan.cell[1]}. ${plan.reflowed ? 'Read the cells left to right, then top to bottom. ' : ''}Cell contents in order: ${order}. Any unused trailing cells stay empty background.`);
    } else lines.push(`FRAMES: ${asset.frames.order}.`);
  }
  lines.push(`BACKGROUND: ${asset.background}.`);
  lines.push('');
  lines.push(`STYLE RULES: ${manifest.common.styleRules}`);
  lines.push(`AVOID: ${manifest.common.avoid}`);
  lines.push('');
  lines.push(`OUTPUT: ${plan.format.text} image, ${plan.format.size}. Logical size in the game: ${size(asset.logicalSize)}; the image is scaled down later, so keep every shape chunky.${plan.crop ? ` The picture will be cropped to a ${asset.logicalSize[0]}:${asset.logicalSize[1]} band, so keep everything important in the middle band and let the top and bottom edges continue plainly.` : ''}`);
  return lines.join('\n');
}

export function promptFile(asset, manifest) {
  const refs = [...asset.dependsOn.map((id) => `\`${id}\``), ...(asset.references ?? []).map((r) => `\`${r}\``)].join(', ') || 'none (this one is generated first)';
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
