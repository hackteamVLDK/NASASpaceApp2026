/**
 * Sound effects, synthesised with the Web Audio API (no audio files yet). The cue names are the
 * ones in src/flow/intro.js (SFX_CUES) and assets/manifests/asset-manifest.json (audio).
 * Browsers only allow sound after a click, so `unlock()` is called from the start button.
 */
let ctx = null;
let master = null;
let windNode = null;

export function unlock() {
  if (ctx) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
}

function tone({ freq, to = freq, dur = 0.1, type = 'square', gain = 0.3, delay = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.5, gain = 0.3, lowpass = 800, delay = 0, loop = false }) {
  if (!ctx) return null;
  const t0 = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  if (!loop) g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
  return { src, g };
}

const CUES = {
  'type-blip': () => tone({ freq: 1500 + Math.random() * 500, dur: 0.035, gain: 0.06 }),
  'bass-boom': () => { tone({ freq: 90, to: 34, dur: 1.1, type: 'sine', gain: 0.8 }); noise({ dur: 0.6, gain: 0.25, lowpass: 200 }); },
  'wind-hum': () => { if (windNode) return; windNode = noise({ dur: 4, gain: 0.07, lowpass: 380, loop: true }); },
  'parachute-deploy': () => noise({ dur: 0.5, gain: 0.3, lowpass: 1600 }),
  'retro-rocket-roar': () => { noise({ dur: 2.2, gain: 0.45, lowpass: 700 }); tone({ freq: 70, to: 55, dur: 2.2, type: 'sawtooth', gain: 0.12 }); },
  'landing-thud': () => { tone({ freq: 110, to: 40, dur: 0.35, type: 'triangle', gain: 0.7 }); noise({ dur: 0.25, gain: 0.4, lowpass: 3000 }); },
  'airlock-hiss': () => noise({ dur: 0.9, gain: 0.22, lowpass: 5000 }),
  'astra-chime': () => [660, 880, 1320].forEach((f, i) => tone({ freq: f, dur: 0.35, type: 'sine', gain: 0.25, delay: i * 0.11 })),
  chirp: () => { tone({ freq: 700, to: 1400, dur: 0.12, gain: 0.2 }); tone({ freq: 900, to: 1700, dur: 0.12, gain: 0.2, delay: 0.14 }); },
  zap: () => tone({ freq: 1800, to: 500, dur: 0.12, type: 'sawtooth', gain: 0.15 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.25, delay: i * 0.09 })),
  click: () => tone({ freq: 520, dur: 0.05, gain: 0.12 }),
  alert: () => { tone({ freq: 880, dur: 0.15, gain: 0.2 }); tone({ freq: 660, dur: 0.15, gain: 0.2, delay: 0.18 }); },
};

export function play(id) {
  if (CUES[id]) CUES[id]();
}

export function stopWind() {
  if (windNode) { try { windNode.src.stop(); } catch { /* already stopped */ } windNode = null; }
}
