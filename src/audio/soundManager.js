// src/audio/soundManager.js
// ARES-KIDS Complete Procedural Audio Engine (Web Audio API)
//
// Safe to import in Node (no window access at import time; every call is a no-op without a
// browser). No AudioContext is created before unlock(), which must run inside a user gesture.
// Volumes and mute are saved in localStorage. Game code should call updateMusic(state) and let
// resolveMusicTrack pick the track, instead of choosing tracks itself.
// Aesthetic: Warm Terraria-inspired Soft Marimba & Bouncy Bass + Stereo Space Reverb (Zero Ear Fatigue)
// Includes SpaceAmbient / Ken Lusk - Chronicles style swells for Dust Storms & Solar Flares

const SETTINGS_KEY = 'ares-kids.audio';
const BLIP_MIN_GAP_MS = 35;   // typewriter: at most ~28 blips per second
const TICK_MIN_GAP_MS = 120;  // drone build ticks

const now_ms = () => (globalThis.performance && typeof globalThis.performance.now === 'function'
  ? globalThis.performance.now() : Date.now());

/**
 * Music priority, highest first: victory > storm/emergency > canyon > expedition > night > day.
 * @param {{victory?:boolean, storm?:boolean, emergency?:boolean, canyon?:boolean, expedition?:boolean, night?:boolean}} state
 */
export function resolveMusicTrack(state = {}) {
  if (state.victory) return 'victory';
  if (state.storm || state.emergency) return 'storm_alert';
  if (state.canyon) return 'canyon_mystery';
  if (state.expedition) return 'expedition';
  if (state.night) return 'base_night';
  return 'base_day';
}

function loadSettings() {
  try {
    const raw = globalThis.localStorage && globalThis.localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSettings(s) {
  try {
    if (globalThis.localStorage) {
      globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: s.muted, musicVolume: s.musicVolume, sfxVolume: s.sfxVolume }));
    }
  } catch { /* private mode or blocked storage: settings just aren't remembered */ }
}

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.compressor = null;
    this.musicReverb = null; // each category has its own reverb send, so its volume also scales the reverb
    this.sfxReverb = null;

    this.muted = false;
    this.musicVolume = 0.75;
    this.sfxVolume = 0.85;

    this.currentMusic = 'off';
    this.wantedMusic = 'off';
    this.musicTimer = null;
    this.ambientNodes = [];
    this.unlocked = false;
    this.hidden = false; // tab in the background: nothing is scheduled, the context is suspended
    this._trackGen = 0;  // bumped on every stop, so old storm-echo timeouts never play into a new track
    this._lastBlip = -Infinity;
    this._lastTick = -Infinity;

    const saved = loadSettings();
    if (saved) {
      this.muted = Boolean(saved.muted);
      if (Number.isFinite(saved.musicVolume)) this.musicVolume = Math.max(0, Math.min(1, saved.musicVolume));
      if (Number.isFinite(saved.sfxVolume)) this.sfxVolume = Math.max(0, Math.min(1, saved.sfxVolume));
    }
  }

  /** True once a context exists and sound may play. */
  get ready() {
    return this.unlocked && this.ctx !== null;
  }

  /**
   * Call from the first user gesture (click/tap/key). Creates the AudioContext, resumes it,
   * and starts any music requested before the unlock. Safe to call many times.
   */
  unlock() {
    const win = globalThis.window;
    if (!win) return false;
    if (!(win.AudioContext || win.webkitAudioContext)) return false;
    this.unlocked = true;
    this.init();
    if (!this._visibilityHooked && globalThis.document && typeof globalThis.document.addEventListener === 'function') {
      this._visibilityHooked = true;
      globalThis.document.addEventListener('visibilitychange', () => {
        this.hidden = Boolean(globalThis.document.hidden);
        if (!this.ctx) return;
        if (this.hidden) { try { this.ctx.suspend(); } catch { /* ignore */ } }
        else { try { this.ctx.resume(); } catch { /* ignore */ } }
      });
    }
    if (this.wantedMusic !== 'off' && this.currentMusic !== this.wantedMusic) {
      this._startTrack(this.wantedMusic);
    }
    return true;
  }

  init() {
    if (!this.unlocked) return;
    if (!this.ctx) {
      const win = globalThis.window;
      const AudioCtx = win && (win.AudioContext || win.webkitAudioContext);
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.01;
      this.compressor.release.value = 0.2;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1.0;

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume * 0.9;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume * 0.9;

      this.musicReverb = this._createStereoReverb(2.4, 2.6);
      this.sfxReverb = this.ctx.createConvolver();
      this.sfxReverb.buffer = this.musicReverb.buffer;
      for (const [rev, bus] of [[this.musicReverb, this.musicGain], [this.sfxReverb, this.sfxGain]]) {
        const wetGain = this.ctx.createGain();
        wetGain.gain.value = 0.42;
        rev.connect(wetGain);
        wetGain.connect(bus);
      }

      this.musicGain.connect(this.compressor);
      this.sfxGain.connect(this.compressor);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && !this.hidden) {
      try { this.ctx.resume(); } catch { /* ignore */ }
    }
  }

  _createStereoReverb(duration = 2.4, decay = 2.6) {
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  // --- VOLUME & MUTE CONTROLS ---
  setMuted(isMuted) {
    this.muted = Boolean(isMuted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1.0, this.ctx.currentTime, 0.05);
    }
    saveSettings(this);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMusicVolume(val0to1) {
    this.musicVolume = Math.max(0, Math.min(1, Number(val0to1) || 0));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.9, this.ctx.currentTime, 0.05);
    }
    saveSettings(this);
  }

  setSfxVolume(val0to1) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(val0to1) || 0));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume * 0.9, this.ctx.currentTime, 0.05);
    }
    saveSettings(this);
  }

  // --- CORE WARM SYNTH HELPERS (1C STYLE) ---
  _playMusicNote(freq, wave = 'sine', duration = 0.5, vol = 0.28, cutoff = 850, sendReverb = true) {
    if (this.muted || !this.ready || this.hidden) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(280, cutoff * 0.55), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    if (sendReverb) gain.connect(this.musicReverb);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  _playSfxNote(freq, wave = 'sine', duration = 0.14, vol = 0.25, slideTo = null, delay = 0, cutoff = 1200, sendReverb = true) {
    if (this.muted || !this.unlocked || this.hidden) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }

    filter.type = 'lowpass';
    filter.frequency.value = cutoff;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    if (sendReverb) gain.connect(this.sfxReverb);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  _playSoftNoise(duration = 0.15, vol = 0.15, filterType = 'bandpass', freq = 900, q = 1.5, delay = 0) {
    if (this.muted || !this.unlocked || this.hidden) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.08 * white) / 1.08;
      data[i] = last * 2.2;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    src.start(now);
    src.stop(now + duration + 0.02);
  }

  // =========================================================================
  // 1. SOUNDTRACKS (6 DYNAMIC LOOPS)
  // =========================================================================
  /** Stops the music and forgets any track requested before unlock. */
  stopMusic() {
    this.wantedMusic = 'off';
    this._stopTrack();
  }

  _stopTrack() {
    this._trackGen++;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.ambientNodes.forEach(n => {
      try { n.stop(); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    });
    this.ambientNodes = [];
    this.currentMusic = 'off';
  }

  /** Requests a track. Before unlock() it is remembered and started on unlock. */
  playMusic(trackName) {
    this.wantedMusic = trackName;
    if (!this.ready) return;
    if (this.currentMusic === trackName) return;
    this._startTrack(trackName);
  }

  /** Picks the track from game state (see resolveMusicTrack) and plays it. Returns the track. */
  updateMusic(state) {
    const track = resolveMusicTrack(state);
    this.playMusic(track);
    return track;
  }

  _startTrack(trackName) {
    this._stopTrack();
    this.init();
    if (!this.ctx) return;
    this.currentMusic = trackName;

    if (trackName === 'base_day') this._startBaseDayMusic();
    else if (trackName === 'base_night') this._startBaseNightMusic();
    else if (trackName === 'storm_alert') this._startStormMusic();
    else if (trackName === 'expedition') this._startExpeditionMusic();
    else if (trackName === 'canyon_mystery') this._startCanyonMysteryMusic();
    else if (trackName === 'victory') this._startVictoryMusic();
  }

  // Track 1: Main Base Day (Terraria Soft Marimba + Bouncy Bass)
  _startBaseDayMusic() {
    const bassSeq = [
      130.81, null, 196.00, 130.81,
      174.61, null, 220.00, 174.61,
      146.83, null, 220.00, 146.83,
      196.00, null, 246.94, 196.00
    ];
    const leadSeq = [
      523.25, null, 659.25, 587.33,
      523.25, 440.00, 392.00, null,
      440.00, null, 587.33, 523.25,
      493.88, 392.00, 523.25, null
    ];

    let step = 0;
    const run = () => {
      if (this.currentMusic !== 'base_day') return;
      const i = step % 16;
      if (bassSeq[i]) this._playMusicNote(bassSeq[i], 'triangle', 0.32, 0.35, 620, false);
      if (leadSeq[i]) this._playMusicNote(leadSeq[i], 'sine', 0.52, 0.30, 850, true);
      step++;
    };
    run();
    this.musicTimer = setInterval(run, 340);
  }

  // Track 2: Base Night / Sleep Cycle (Half-time dreamy marimba lullaby)
  _startBaseNightMusic() {
    const bassSeq = [130.81, null, null, null, 174.61, null, null, null, 146.83, null, null, null, 196.00, null, null, null];
    const leadSeq = [
      659.25, null, 493.88, null,
      523.25, null, 392.00, null,
      587.33, null, 440.00, null,
      493.88, null, 392.00, null
    ];

    let step = 0;
    const run = () => {
      if (this.currentMusic !== 'base_night') return;
      const i = step % 16;
      if (bassSeq[i]) this._playMusicNote(bassSeq[i], 'sine', 0.9, 0.25, 450, false);
      if (leadSeq[i]) this._playMusicNote(leadSeq[i], 'sine', 0.85, 0.22, 740, true);
      step++;
    };
    run();
    this.musicTimer = setInterval(run, 520);
  }

  // Helper for lush SpaceAmbient / Ken Lusk - Chronicles style evolving pads
  _playSpaceAmbientSwell(freqs, stepSec = 5.5, fadeSec = 2.2, cutoff = 620) {
    if (this.muted || !this.ready || this.hidden || this.currentMusic !== 'storm_alert') return;
    const now = this.ctx.currentTime;
    const total = stepSec + fadeSec;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff * 0.7, now);
    filter.frequency.linearRampToValueAtTime(cutoff * 1.15, now + stepSec * 0.6);
    filter.frequency.linearRampToValueAtTime(cutoff * 0.75, now + total);
    filter.connect(this.musicReverb);
    filter.connect(this.musicGain);

    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f + (idx % 2 === 0 ? -0.9 : 0.9), now);

      const peak = idx === 0 ? 0.14 : 0.095;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + fadeSec);
      gain.gain.setValueAtTime(peak, now + stepSec);
      gain.gain.linearRampToValueAtTime(0.0001, now + total);

      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);
      osc.stop(now + total + 0.1);
    });
  }

  // Track 3: Dust Storm / Solar Flare / Emergency Event (SpaceAmbient / Ken Lusk - Chronicles style)
  _startStormMusic() {
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.025 * w) / 1.025;
        data[i] = last * 2.4;
      }
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 320;

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);

    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.16;

    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.musicReverb);
    windGain.connect(this.musicGain);
    noise.start();
    lfo.start();
    this.ambientNodes.push(noise, windFilter, lfo, lfoGain, windGain);

    const chroniclesChords = [
      [146.83, 220.00, 261.63, 329.63, 349.23], // Dm9
      [116.54, 174.61, 220.00, 261.63, 293.66], // Bbmaj9
      [98.00,  196.00, 233.08, 293.66, 349.23], // Gm9
      [110.00, 164.81, 220.00, 293.66, 329.63]  // Asus4 -> resolve
    ];
    const echoNotes = [659.25, 587.33, 523.25, 440.00];

    let step = 0;
    const gen = this._trackGen;
    const run = () => {
      if (this.currentMusic !== 'storm_alert') return;
      const chordIdx = step % chroniclesChords.length;
      this._playSpaceAmbientSwell(chroniclesChords[chordIdx], 5.2, 2.2, 640);

      setTimeout(() => {
        if (this.currentMusic === 'storm_alert' && this._trackGen === gen) {
          this._playMusicNote(echoNotes[chordIdx], 'sine', 2.4, 0.14, 780, true);
        }
      }, 2400);

      step++;
    };
    run();
    this.musicTimer = setInterval(run, 5200);
  }

  // Track 4: Rover Expedition Active (Upbeat G-Lydian Crater Exploration Groove)
  _startExpeditionMusic() {
    const bassSeq = [196.00, null, 293.66, 196.00, 220.00, null, 329.63, 220.00];
    const leadSeq = [587.33, 659.25, 739.99, 880.00, 739.99, 659.25, 587.33, 493.88];

    let step = 0;
    const run = () => {
      if (this.currentMusic !== 'expedition') return;
      const i = step % 8;
      if (bassSeq[i]) this._playMusicNote(bassSeq[i], 'triangle', 0.30, 0.32, 600, false);
      if (leadSeq[i]) this._playMusicNote(leadSeq[i], 'sine', 0.44, 0.26, 900, true);
      step++;
    };
    run();
    this.musicTimer = setInterval(run, 310);
  }

  // Track 5: Canyon Anomaly / The Jezero Signal (Curious glowing crystal marimba)
  _startCanyonMysteryMusic() {
    const notes = [392.00, 493.88, 587.33, 739.99, 880.00, 739.99, 587.33, 493.88];
    let step = 0;
    const run = () => {
      if (this.currentMusic !== 'canyon_mystery') return;
      const i = step % 8;
      if (i % 4 === 0) this._playMusicNote(196.00, 'sine', 1.1, 0.26, 480, false);
      this._playMusicNote(notes[i], 'sine', 0.65, 0.25, 860, true);
      step++;
    };
    run();
    this.musicTimer = setInterval(run, 420);
  }

  // Track 6: Finale Victory / Sol 20 Celebration (Bright major marimba fanfare loop)
  _startVictoryMusic() {
    const bassSeq = [261.63, null, 392.00, 261.63, 349.23, null, 440.00, 349.23];
    const leadSeq = [523.25, 659.25, 783.99, 1046.50, 880.00, 783.99, 659.25, 783.99];
    let step = 0;
    const run = () => {
      if (this.currentMusic !== 'victory') return;
      const i = step % 8;
      if (bassSeq[i]) this._playMusicNote(bassSeq[i], 'triangle', 0.32, 0.34, 650, false);
      this._playMusicNote(leadSeq[i], 'sine', 0.50, 0.28, 960, true);
      step++;
    };
    run();
    this.musicTimer = setInterval(run, 320);
  }

  // =========================================================================
  // 2. EVENT & GAMEPLAY SFX (ALL MATCHING WARM 1C MARIMBA/FELT PALETTE)
  // =========================================================================

  // --- Intro & UI ---
  /** One blip per typed character; whitespace is silent and the rate is capped. */
  typewriterBlip(char = 'x') {
    if (typeof char === 'string' && char.trim() === '') return;
    const t = now_ms();
    if (t - this._lastBlip < BLIP_MIN_GAP_MS) return;
    this._lastBlip = t;
    const pitch = 540 + Math.random() * 90;
    this._playSfxNote(pitch, 'sine', 0.04, 0.09, null, 0, 1100, false);
  }

  astraSlideIn() {
    this._playSfxNote(440.00, 'sine', 0.14, 0.18, null, 0.00, 1000, true);
    this._playSfxNote(554.37, 'sine', 0.14, 0.18, null, 0.07, 1000, true);
    this._playSfxNote(659.25, 'sine', 0.24, 0.20, null, 0.14, 1100, true);
  }

  uiClick() {
    this._playSfxNote(480, 'sine', 0.055, 0.18, 320, 0, 950, false);
  }

  uiTabSwitch() {
    this._playSfxNote(392, 'sine', 0.05, 0.14, 523.25, 0, 950, false);
  }

  dilemmaChoice() {
    this._playSfxNote(523.25, 'triangle', 0.10, 0.20, null, 0.00, 900, true);
    this._playSfxNote(659.25, 'triangle', 0.18, 0.20, null, 0.08, 950, true);
  }

  // --- Landing Cutscene ---
  landerDescent() {
    this._playSoftNoise(1.4, 0.16, 'bandpass', 480, 1.4, 0);
  }

  landerTouchdown() {
    this._playSfxNote(140, 'triangle', 0.35, 0.35, 55, 0, 400, true);
    this._playSoftNoise(0.45, 0.18, 'lowpass', 650, 1.0, 0.1);
  }

  // --- Alerts & Safety Modes ---
  alertWarning() {
    this._playSfxNote(587.33, 'sine', 0.16, 0.22, null, 0.00, 950, true);
    this._playSfxNote(493.88, 'sine', 0.22, 0.22, null, 0.18, 950, true);
  }

  alertEmergency() {
    this._playSfxNote(659.25, 'triangle', 0.14, 0.26, 523.25, 0.00, 900, true);
    this._playSfxNote(659.25, 'triangle', 0.14, 0.26, 523.25, 0.20, 900, true);
  }

  medRestActivate() {
    this._playSfxNote(523.25, 'sine', 0.22, 0.20, 392.00, 0.00, 800, true);
    this._playSfxNote(392.00, 'sine', 0.32, 0.20, 329.63, 0.18, 800, true);
  }

  // --- Drones & Base Modules ---
  droneWake() {
    this._playSfxNote(392.00, 'sine', 0.09, 0.22, null, 0.00, 1100, true);
    this._playSfxNote(523.25, 'sine', 0.09, 0.22, null, 0.09, 1100, true);
    this._playSfxNote(659.25, 'sine', 0.11, 0.22, null, 0.18, 1100, true);
    this._playSfxNote(783.99, 'sine', 0.22, 0.24, null, 0.27, 1200, true);
  }

  droneBuildTick() {
    const t = now_ms();
    if (t - this._lastTick < TICK_MIN_GAP_MS) return;
    this._lastTick = t;
    const pitch = 420 + Math.random() * 120;
    this._playSfxNote(pitch, 'triangle', 0.05, 0.12, pitch * 0.8, 0, 850, false);
  }

  moduleComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((n, i) => {
      this._playSfxNote(n, 'sine', 0.24, 0.22, null, i * 0.09, 1100, true);
    });
  }

  solDawnChime() {
    this._playSfxNote(523.25, 'sine', 0.28, 0.18, null, 0.00, 950, true);
    this._playSfxNote(659.25, 'sine', 0.28, 0.18, null, 0.14, 950, true);
    this._playSfxNote(783.99, 'sine', 0.42, 0.20, null, 0.28, 1000, true);
  }

  // --- 9 Mini-Games SFX ---
  staticZap() {
    this._playSfxNote(920, 'triangle', 0.08, 0.22, 260, 0, 1200, true);
    this._playSoftNoise(0.07, 0.14, 'bandpass', 1400, 2.0, 0);
  }

  brushWipe() {
    this._playSoftNoise(0.14, 0.14, 'bandpass', 950, 1.4, 0);
  }

  pipeRotate() {
    this._playSfxNote(260, 'triangle', 0.08, 0.22, 180, 0, 750, false);
  }

  waterValveTurn() {
    this._playSfxNote(340, 'sine', 0.12, 0.20, 480, 0, 850, true);
    this._playSoftNoise(0.16, 0.10, 'bandpass', 1100, 2.5, 0.05);
  }

  nutrientDrop() {
    this._playSfxNote(440, 'sine', 0.11, 0.22, 660, 0, 1000, true);
  }

  pebblePop() {
    this._playSfxNote(340, 'sine', 0.08, 0.24, 780, 0, 1100, true);
  }

  vacuumHum() {
    this._playSoftNoise(0.18, 0.12, 'lowpass', 420, 1.0, 0);
  }

  suitClampSnap() {
    this._playSfxNote(680, 'triangle', 0.06, 0.22, 320, 0, 1000, false);
  }

  antennaLock() {
    this._playSfxNote(659.25, 'sine', 0.12, 0.20, null, 0.00, 1050, true);
    this._playSfxNote(880.00, 'sine', 0.22, 0.22, null, 0.10, 1150, true);
  }

  minigameWin() {
    this._playSfxNote(587.33, 'sine', 0.12, 0.24, null, 0.00, 1100, true);
    this._playSfxNote(739.99, 'sine', 0.12, 0.24, null, 0.09, 1100, true);
    this._playSfxNote(880.00, 'sine', 0.28, 0.26, null, 0.18, 1200, true);
  }

  // --- Expeditions & Jezero Signal Lore ---
  airlockCycle() {
    this._playSoftNoise(0.55, 0.16, 'bandpass', 520, 1.5, 0);
    this._playSfxNote(220, 'triangle', 0.25, 0.20, 150, 0.35, 600, true);
  }

  roverDepart() {
    this._playSfxNote(180, 'triangle', 0.45, 0.22, 280, 0, 650, true);
  }

  radioPing() {
    this._playSoftNoise(0.06, 0.09, 'bandpass', 1200, 2.0, 0);
    this._playSfxNote(880, 'sine', 0.09, 0.18, null, 0.04, 1100, true);
  }

  canyonSeismicThump() {
    this._playSfxNote(110, 'sine', 0.65, 0.40, 42, 0, 320, true);
  }

  brineGeyserFrost() {
    this._playSoftNoise(0.45, 0.15, 'bandpass', 1150, 2.2, 0);
    this._playSfxNote(783.99, 'sine', 0.25, 0.18, 1046.50, 0.12, 1200, true);
    this._playSfxNote(987.77, 'sine', 0.30, 0.18, 1174.66, 0.24, 1200, true);
  }
}

export const sfx = new SoundManager();
