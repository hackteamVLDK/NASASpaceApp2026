// node --test src/audio/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioDirector, musicFlags, SFX_NAMES, LEGACY_CUES, MINIGAME_CUES, VICTORY_SANDBOX_MS, CANYON_MS } from './audioDirector.js';
import { SoundManager } from './soundManager.js';
import { createCampaign } from '../campaign/engine.js';
import { at } from '../campaign/util.js';

function fakeSfx() {
  const calls = [];
  const music = [];
  const s = { calls, music, muted: false, musicVolume: 0.75, sfxVolume: 0.85 };
  for (const n of SFX_NAMES) s[n] = (...a) => calls.push(a.length ? `${n}(${a.join(',')})` : n);
  s.unlock = () => { calls.push('unlock'); return true; };
  s.updateMusic = (f) => { music.push({ ...f }); };
  s.stopMusic = () => { music.push('stop'); };
  s.toggleMute = () => { s.muted = !s.muted; return s.muted; };
  return s;
}
function clock(start = 0) { let t = start; const now = () => t; now.add = (ms) => { t += ms; }; return now; }

test('every sound the engine has is reachable from the director', () => {
  const engine = new SoundManager();
  for (const n of SFX_NAMES) assert.equal(typeof engine[n], 'function', n);
  for (const target of [...Object.values(LEGACY_CUES), ...Object.values(MINIGAME_CUES).flatMap(Object.values)]) {
    assert.ok(SFX_NAMES.includes(target), target);
  }
});

test('the campaign stays audio-free', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const roots = [path.join(here, '../campaign'), path.join(here, '../sim')];
  for (const r of roots) {
    for (const f of fs.readdirSync(r)) {
      if (!f.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(r, f), 'utf8');
      assert.ok(!/audio|soundManager|sfx\b/i.test(src.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), `${r}/${f} mentions audio`);
    }
  }
});

test('gesture unlocks; legacy and engine cue names both work; typed char is passed on', () => {
  const sfx = fakeSfx();
  const d = createAudioDirector({ sfx, now: clock() });
  d.gesture();
  d.cue('click'); d.cue('pipeRotate'); d.cue('nope'); d.typed('A'); d.flowCue({ type: 'sfx', id: 'type-blip', char: 'Y' });
  assert.deepEqual(sfx.calls, ['unlock', 'uiClick', 'pipeRotate', 'typewriterBlip(A)', 'typewriterBlip(Y)']);
});

test('lore cues by line ID; the black box starts the canyon music', () => {
  const sfx = fakeSfx();
  const now = clock();
  const d = createAudioDirector({ sfx, now });
  d.astraLine('log.pathfinder.02');
  d.radio('radio.exp5.03');
  d.radio('radio.exp5.04');
  d.astraLine('radio.exp5.05');
  assert.deepEqual(sfx.calls, ['canyonSeismicThump', 'radioPing', 'canyonSeismicThump', 'radioPing', 'brineGeyserFrost', 'brineGeyserFrost']);

  const s = createCampaign({ seed: 1 });
  s.minute = at(16, 8);
  d.tick({ s, mode: 'play' });
  d.astraLine('astra.act3.blackbox_decode_start', { slideIn: true });
  assert.equal(d.tick({ s, mode: 'play' }).canyon, true);
  d.astraLine('astra.act3.blackbox_react2');
  now.add(CANYON_MS.afterLast + 1);
  assert.equal(d.tick({ s, mode: 'play' }).canyon, false);
});

test('music: flags from state, updateMusic only on change, victory falls back after sandbox', () => {
  const sfx = fakeSfx();
  const now = clock();
  const d = createAudioDirector({ sfx, now });
  const s = createCampaign({ seed: 1 });
  s.minute = at(3, 12);
  d.tick({ s, mode: 'intro' });
  assert.equal(sfx.music.length, 0, 'no music during the intro');
  d.tick({ s, mode: 'play' });
  d.tick({ s, mode: 'play' });
  assert.equal(sfx.music.length, 1, 'unchanged flags do not restart the music');
  s.storm = { until: at(6) };
  d.tick({ s, mode: 'play' });
  assert.equal(sfx.music.at(-1).storm, true);
  s.storm = null;
  s.away = { id: 5 };
  assert.deepEqual(d.tick({ s, mode: 'play' }), { victory: false, storm: false, emergency: false, canyon: true, expedition: true, night: false });
  s.away = null;
  d.campaignEvents([{ type: 'finale' }]);
  assert.equal(d.tick({ s, mode: 'play' }).victory, true);
  d.campaignEvents([{ type: 'sandbox' }]);
  now.add(VICTORY_SANDBOX_MS - 1);
  assert.equal(d.tick({ s, mode: 'play' }).victory, true);
  now.add(2);
  assert.equal(d.tick({ s, mode: 'play' }).victory, false);
});

test('dawn chime when night turns to day; drone work is paced', () => {
  const sfx = fakeSfx();
  const now = clock();
  const d = createAudioDirector({ sfx, now });
  const s = createCampaign({ seed: 1 });
  s.minute = at(2, 5);
  d.tick({ s, mode: 'play' });
  s.minute = at(2, 6);
  d.tick({ s, mode: 'play' });
  assert.equal(sfx.calls.filter((c) => c === 'solDawnChime').length, 1);
  s.drones[0].status = 'awake'; s.drones[0].task = { type: 'build', module: 'battery' };
  for (let i = 0; i < 10; i++) { now.add(500); d.tick({ s, mode: 'play' }); }
  assert.equal(sfx.calls.filter((c) => c === 'droneBuildTick').length, 2);
});

test('campaign events map to sounds; urgent alerts are emergencies', () => {
  const sfx = fakeSfx();
  const now = clock();
  const d = createAudioDirector({ sfx, now });
  d.campaignEvents([
    { type: 'built' }, { type: 'drone-awake' }, { type: 'emergency', kind: 'heat' }, { type: 'storm', on: true },
    { type: 'event', id: 'e1' }, { type: 'dilemma', id: 'd2' }, { type: 'chosen' }, { type: 'launched' },
    { type: 'astra', lineId: 'astra.hp.zero_base' }, { type: 'sol' },
  ]);
  now.add(1000); d.decisionShown('e1'); now.add(1000); d.decisionShown('d2');
  assert.deepEqual(sfx.calls, ['moduleComplete', 'droneWake', 'alertEmergency', 'alertWarning',
    'airlockCycle', 'roverDepart', 'medRestActivate', 'alertEmergency', 'alertWarning']);
});

test('mini-games: actions map per game, moves are throttled', () => {
  const sfx = fakeSfx();
  const now = clock();
  const d = createAudioDirector({ sfx, now });
  d.minigame('wheel_vacuum', 'pebble');
  d.minigame('wheel_vacuum', 'move'); d.minigame('wheel_vacuum', 'move');
  now.add(200); d.minigame('wheel_vacuum', 'move');
  d.minigame('antenna', 'lock'); d.minigame('heat_pump', 'rotate'); d.minigame('suit_seal', 'win');
  assert.deepEqual(sfx.calls, ['pebblePop', 'vacuumHum', 'vacuumHum', 'antennaLock', 'pipeRotate', 'minigameWin']);
});

test('musicFlags is safe before the campaign exists', () => {
  assert.deepEqual(musicFlags(null), { victory: false, storm: false, emergency: false, canyon: false, expedition: false, night: false });
});

test('one-shot sounds reported twice at once play once', () => {
  const sfx = fakeSfx();
  const now = clock();
  const d = createAudioDirector({ sfx, now });
  d.flowCue({ type: 'sfx', id: 'astra-chime' });
  d.astraLine('astra.intro.landing', { slideIn: true });
  d.campaignEvents([{ type: 'built' }, { type: 'built' }]);
  now.add(1000);
  d.campaignEvents([{ type: 'built' }]);
  assert.deepEqual(sfx.calls, ['astraSlideIn', 'moduleComplete', 'moduleComplete']);
});
