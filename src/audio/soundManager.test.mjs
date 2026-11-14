// node --test src/audio/soundManager.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal fake Web Audio API: counts created contexts and oscillators.
function installFakeBrowser() {
  const stats = { contexts: 0, oscillators: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), Q: param(),
    threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
    start() {}, stop() {}, type: '', buffer: null, loop: false, onended: null });
  class FakeCtx {
    constructor() { stats.contexts++; this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = node(); }
    createDynamicsCompressor() { return node(); }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createOscillator() { stats.oscillators++; return node(); }
    createBufferSource() { return node(); }
    createConvolver() { return node(); }
    createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
  }
  globalThis.window = { AudioContext: FakeCtx };
  globalThis.document = { hidden: false, addEventListener() {} };
  return stats;
}

test('importing in Node does not touch window', async () => {
  delete globalThis.window;
  const mod = await import('./soundManager.js?node');
  assert.equal(typeof mod.sfx.playMusic, 'function');
  mod.sfx.uiClick(); // must not throw without a browser
  assert.equal(mod.sfx.ctx, null);
});

test('no AudioContext before unlock; music is deferred until unlock', async () => {
  const stats = installFakeBrowser();
  const { SoundManager } = await import('./soundManager.js?fake1');
  const s = new SoundManager();
  s.uiClick(); s.droneWake(); s.playMusic('base_day');
  assert.equal(stats.contexts, 0);
  assert.equal(s.wantedMusic, 'base_day');
  s.unlock();
  assert.equal(stats.contexts, 1);
  assert.equal(s.currentMusic, 'base_day');
  s.stopMusic();
});

test('muted: sound effects create no oscillators', async () => {
  const stats = installFakeBrowser();
  const { SoundManager } = await import('./soundManager.js?fake2');
  const s = new SoundManager();
  s.unlock();
  const before = stats.oscillators;
  s.setMuted(true);
  s.moduleComplete();
  assert.equal(stats.oscillators, before);
  s.setMuted(false);
  s.moduleComplete();
  assert.ok(stats.oscillators > before);
});

test('typewriter blips: spaces silent, rate capped', async () => {
  const stats = installFakeBrowser();
  const { SoundManager } = await import('./soundManager.js?fake3');
  const s = new SoundManager();
  s.unlock();
  const before = stats.oscillators;
  for (const ch of 'Hello Mars, this is ASTRA!') s.typewriterBlip(ch);
  assert.equal(stats.oscillators - before, 1); // same millisecond burst -> one blip
  s.typewriterBlip(' ');
  assert.equal(stats.oscillators - before, 1);
});

test('music priority', async () => {
  const { resolveMusicTrack } = await import('./soundManager.js?prio');
  assert.equal(resolveMusicTrack({}), 'base_day');
  assert.equal(resolveMusicTrack({ night: true }), 'base_night');
  assert.equal(resolveMusicTrack({ expedition: true, night: true }), 'expedition');
  assert.equal(resolveMusicTrack({ canyon: true, expedition: true }), 'canyon_mystery');
  assert.equal(resolveMusicTrack({ storm: true, canyon: true }), 'storm_alert');
  assert.equal(resolveMusicTrack({ emergency: true }), 'storm_alert');
  assert.equal(resolveMusicTrack({ victory: true, storm: true }), 'victory');
});

test('A23: actionDenied is soft and does not stack on repeated taps', async () => {
  const stats = installFakeBrowser();
  const { SoundManager } = await import('./soundManager.js?denied');
  const s = new SoundManager();
  s.unlock();
  const before = stats.oscillators;
  s.actionDenied(); s.actionDenied(); s.actionDenied();
  assert.equal(stats.oscillators - before, 2); // one "uh-uh" (two notes), the rest throttled
});

test('C15: master and music volume are saved and loaded again', async () => {
  installFakeBrowser();
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  const { SoundManager } = await import('./soundManager.js?fake-volume');
  const a = new SoundManager();
  a.setMasterVolume(0.4); a.setMusicVolume(0.2); a.setMasterVolume(7);
  assert.equal(a.masterVolume, 1, 'clamped to 0..1');
  a.setMasterVolume(0.4);
  const b = new SoundManager();
  assert.equal(b.masterVolume, 0.4);
  assert.equal(b.musicVolume, 0.2);
  b.unlock();
  assert.equal(b.masterGain.gain.value, 0.4, 'the master gain uses the saved volume');
  delete globalThis.localStorage;
});
