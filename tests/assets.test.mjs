// The asset manifest must stay valid, match the world in src/data/base-layout.js, and its
// generated prompts in assets/prompts/ must be up to date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadManifest, buildAll } from '../tools/assets/build-prompts.mjs';
import { WORLD, ROOMS } from '../src/data/base-layout.js';

const manifest = loadManifest();
const byId = Object.fromEntries(manifest.assets.map((a) => [a.id, a]));
const root = new URL('../', import.meta.url);

test('ids are unique and every dependency exists, with no cycles', () => {
  assert.equal(Object.keys(byId).length, manifest.assets.length, 'duplicate asset id');
  assert.ok(byId[manifest.anchor], 'anchor asset exists');
  assert.deepEqual(byId[manifest.anchor].dependsOn, []);
  for (const a of manifest.assets) for (const d of a.dependsOn) assert.ok(byId[d], `${a.id} depends on unknown ${d}`);
  const visit = (id, trail = []) => {
    assert.ok(!trail.includes(id), `dependency cycle: ${[...trail, id].join(' -> ')}`);
    for (const d of byId[id].dependsOn) visit(d, [...trail, id]);
  };
  for (const a of manifest.assets) visit(a.id);
  for (const a of manifest.assets) if (a.id !== manifest.anchor) assert.ok(a.dependsOn.length > 0, `${a.id} must name a style reference`);
});

test('every asset has the fields the prompt needs, honest status and unique paths', () => {
  const need = ['id', 'tier', 'title', 'purpose', 'kind', 'perspective', 'logicalSize', 'generate', 'background', 'subject', 'dependsOn', 'incoming', 'file', 'status', 'notes'];
  const incoming = new Set();
  const files = new Set();
  for (const a of manifest.assets) {
    for (const k of need) assert.ok(a[k] !== undefined && a[k] !== '' || k === 'notes', `${a.id} is missing ${k}`);
    assert.ok(Object.hasOwn(manifest.statuses, a.status), `${a.id}: unknown status ${a.status}`);
    assert.ok(a.incoming.startsWith('assets/incoming/') && a.file.startsWith('assets/art/'));
    assert.ok(!incoming.has(a.incoming) && !files.has(a.file), `${a.id}: duplicate path`);
    incoming.add(a.incoming);
    files.add(a.file);
    // AGENTS.md: never mark an asset final/integrated without a real image file.
    if (['processed', 'integrated', 'final'].includes(a.status)) assert.ok(existsSync(new URL(a.file, root)), `${a.id} is ${a.status} but ${a.file} does not exist`);
    if (a.status === 'received') assert.ok(existsSync(new URL(a.incoming, root)), `${a.id} is received but ${a.incoming} does not exist`);
  }
});

test('sprite sheets are exactly columns x rows of their cell', () => {
  for (const a of manifest.assets.filter((x) => x.frames && Array.isArray(x.frames.cell))) {
    const [cw, ch] = a.frames.cell;
    assert.deepEqual(a.logicalSize, [cw * a.frames.columns, ch * a.frames.rows], `${a.id}: logicalSize does not match its grid`);
    assert.ok(a.frames.order.length > 10, `${a.id}: describe the frame order`);
  }
});

test('manifest scale and cells follow the world in SCENARIO.md and base-layout.js', () => {
  const w = manifest.world;
  assert.deepEqual(w.units, [WORLD.width, WORLD.height]);
  assert.equal(w.unitsPerArtPixel, WORLD.unitsPerArtPixel);
  assert.deepEqual(w.artPixels, [WORLD.width / w.unitsPerArtPixel, WORLD.height / w.unitsPerArtPixel]);
  assert.equal(w.groundLineArtY, WORLD.groundY / w.unitsPerArtPixel);
  assert.deepEqual([manifest.canvas.logicalWidth, manifest.canvas.logicalHeight], [WORLD.viewWidth / w.unitsPerArtPixel, WORLD.viewHeight / w.unitsPerArtPixel]);
  assert.deepEqual(manifest.grid.moduleCell, [WORLD.wingWidth / w.unitsPerArtPixel, WORLD.floorHeight / w.unitsPerArtPixel]);
  assert.deepEqual(manifest.grid.shaftCell, [WORLD.shaftWidth / w.unitsPerArtPixel, WORLD.floorHeight / w.unitsPerArtPixel]);
  assert.equal(ROOMS.bedroom.rect.w / w.unitsPerArtPixel, manifest.grid.moduleCell[0]);
  for (const a of manifest.assets.filter((x) => x.kind === 'room')) assert.deepEqual(a.logicalSize, manifest.grid.moduleCell, `${a.id} must be one module cell`);
});

test('every scenario module has art (or is clearly marked as a proposal)', () => {
  const sceneIds = manifest.assets.map((a) => a.id).join(' ');
  for (const id of ['bedroom', 'dining', 'lifesupport']) assert.ok(sceneIds.includes(`module.${id}`), `missing module art for ${id}`);
  const unfinished = byId['module.unfinished'].frames.order;
  for (const name of ['Workshop', 'Research & Comms Lab', 'Battery & Heating', 'Rover Garage']) assert.ok(unfinished.includes(name), `unfinished frames lack ${name}`);
  for (const [id, room] of Object.entries(ROOMS)) if (room.module && !room.inScenario) assert.ok(/PROPOSAL/.test(byId[`room.${id}`]?.notes ?? ''), `${id} is not in the scenario, so its asset must say PROPOSAL`);
});

test('scenario items from section 4 all appear in the anchor and the sound list covers every sfx cue', () => {
  const subject = byId[manifest.anchor].subject.toLowerCase();
  for (const word of ['airlock', 'solar panels', 'antenna', 'regolith', 'drone', 'bedroom', 'dining room', 'life support', 'workshop', 'comms lab', 'battery', 'rover garage', 'red led']) {
    assert.ok(subject.includes(word), `style.anchor does not mention: ${word}`);
  }
  const audioIds = manifest.audio.map((a) => a.id);
  for (const id of ['type-blip', 'bass-boom', 'wind-hum', 'parachute-deploy', 'retro-rocket-roar', 'landing-thud', 'airlock-hiss', 'astra-chime']) assert.ok(audioIds.includes(`sfx.${id}`), `no sound entry for ${id}`);
});

test('assets/prompts is generated from the manifest and up to date', () => {
  for (const [name, text] of Object.entries(buildAll(manifest))) {
    const file = new URL(`assets/prompts/${name}`, root);
    assert.ok(existsSync(file), `missing assets/prompts/${name} — run: npm run assets:prompts`);
    assert.equal(readFileSync(file, 'utf8'), text, `assets/prompts/${name} is stale — run: npm run assets:prompts`);
  }
});
