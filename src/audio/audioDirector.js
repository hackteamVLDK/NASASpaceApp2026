/**
 * Audio director: the only place that decides *when* a sound plays.
 *
 * The campaign simulation (src/campaign, src/sim) never imports audio. The game loop and the UI
 * report what happened (campaign events, intro cues, ASTRA lines, typed characters, mini-game
 * actions, clicks) and the director turns that into calls on the sound engine (`sfx`). Music is
 * chosen from game state with `sfx.updateMusic(flags)`; the director only calls it when a flag
 * changes. Hook points and the old cue names are listed in content/handoff/AUDIO_HOOKS.md.
 *
 * Safe in Node: with no browser the sound engine is silent, and the director's logic is plain
 * functions of state and time (see audioDirector.test.mjs).
 */
import { sfx as defaultSfx } from './soundManager.js';
import { clockAt, isNight } from '../campaign/util.js';

/** Lore cues keyed by line ID (SCENARIO Section 1 and 5.3). */
export const LORE_CUES = Object.freeze({
  'log.pathfinder.02': 'canyonSeismicThump',
  'radio.exp5.03': 'canyonSeismicThump',
  'radio.exp5.04': 'brineGeyserFrost',
  'radio.exp5.05': 'brineGeyserFrost',
});

/**
 * Cue names the game already uses (src/ui/audio.js and src/flow/intro.js SFX_CUES), mapped to the
 * sound engine. Any sound-engine method name (e.g. 'pipeRotate') is also accepted by `cue()`.
 */
export const LEGACY_CUES = Object.freeze({
  click: 'uiClick',
  win: 'minigameWin',
  zap: 'staticZap',
  chirp: 'radioPing',
  alert: 'alertWarning',
  'astra-chime': 'astraSlideIn',
  'type-blip': 'typewriterBlip',
  'bass-boom': 'canyonSeismicThump',
  'wind-hum': 'landerDescent',
  'parachute-deploy': 'brushWipe',
  'retro-rocket-roar': 'landerDescent',
  'landing-thud': 'landerTouchdown',
  'airlock-hiss': 'airlockCycle',
});

/** Sound-engine methods that `cue()` may call by name. */
export const SFX_NAMES = Object.freeze([
  'typewriterBlip', 'astraSlideIn', 'uiClick', 'uiTabSwitch', 'dilemmaChoice', 'actionDenied',
  'landerDescent', 'landerTouchdown', 'alertWarning', 'alertEmergency', 'medRestActivate',
  'droneWake', 'droneBuildTick', 'moduleComplete', 'solDawnChime',
  'staticZap', 'brushWipe', 'pipeRotate', 'waterValveTurn', 'nutrientDrop', 'pebblePop',
  'vacuumHum', 'suitClampSnap', 'antennaLock', 'minigameWin',
  'airlockCycle', 'roverDepart', 'radioPing', 'canyonSeismicThump', 'brineGeyserFrost',
]);

/**
 * Mini-game actions -> sound. Games report `down` / `move` (generic pointer input) or a named
 * action; `win` is shared. Keys follow the game ids used by src/ui/minigames*.js.
 */
export const MINIGAME_CUES = Object.freeze({
  solar_wipe: { zap: 'staticZap', wipe: 'brushWipe', move: 'brushWipe' },
  battery: { insert: 'suitClampSnap', cable: 'suitClampSnap' },
  air_filter: { pull: 'uiClick', move: 'brushWipe', lock: 'suitClampSnap' },
  valve_balance: { down: 'waterValveTurn', move: 'waterValveTurn' },
  water_sort: { place: 'suitClampSnap', tap: 'waterValveTurn' },
  heat_pump: { rotate: 'pipeRotate' },
  nutrient_match: { drop: 'nutrientDrop', led: 'uiClick' },
  wheel_vacuum: { move: 'vacuumHum', pebble: 'pebblePop', patch: 'suitClampSnap' },
  suit_seal: { clamp: 'suitClampSnap', badge: 'uiClick', liner: 'suitClampSnap' },
  antenna: { move: 'uiTabSwitch', lock: 'antennaLock' },
});

/**
 * One-shot sounds that can be reported twice for the same moment (e.g. the intro's chime cue and
 * the panel's first slide-in at touchdown; several rooms finishing in one tick): repeats inside
 * this window are dropped.
 */
export const DEDUPE_MS = Object.freeze({ astraSlideIn: 600, moduleComplete: 400, alertWarning: 400, alertEmergency: 400, droneWake: 400, airlockCycle: 400 });

/** Minimum real time between repeats of continuous sounds (pointer moves, drone work). */
export const REPEAT_MS = Object.freeze({ move: 160, droneWork: 2500 });
/** Canyon music after the black box starts decoding: until react2 shows + 8 s, at most 120 s. */
export const CANYON_MS = Object.freeze({ afterLast: 8000, max: 120000 });
/** Victory music keeps playing this long into Free-Play, then base music returns. */
export const VICTORY_SANDBOX_MS = 30000;

const URGENT = new Set(['e1', 'd5']); // solar flare and the space-weather radio dilemma
const MEDREST_LINES = new Set(['astra.hp.zero_base', 'astra.hp.zero_expedition']);

/**
 * Music flags from campaign state plus the director's own timed flags. Pure: no audio here.
 * @param {object|null} s campaign state (src/campaign/engine.js), or null before the campaign
 * @param {{ canyon?: boolean, victory?: boolean }} timed
 */
export function musicFlags(s, timed = {}) {
  if (!s) return { victory: false, storm: false, emergency: false, canyon: false, expedition: false, night: false };
  const pendingId = s.pending?.id;
  return {
    victory: Boolean(timed.victory),
    storm: Boolean(s.storm) || URGENT.has(pendingId),
    emergency: Object.values(s.emergency ?? {}).some(Boolean),
    canyon: Boolean(timed.canyon) || s.away?.id === 5,
    expedition: Boolean(s.away),
    night: isNight(clockAt(s.minute ?? 0).hourFloat),
  };
}

const sameFlags = (a, b) => a && b && Object.keys(a).every((k) => a[k] === b[k]);

/**
 * @param {{ sfx?: object, now?: () => number }} [opts]
 */
export function createAudioDirector({ sfx = defaultSfx, now = () => (globalThis.performance?.now?.() ?? Date.now()) } = {}) {
  let lastFlags = null;
  let wasNight = null;
  let lastMove = new Map();
  let lastDroneWork = -Infinity;
  let canyonFrom = null;
  let canyonUntil = null;
  let victoryFrom = null;
  let sandboxFrom = null;
  let musicOn = false;
  const INTRO_FLAGS = Object.freeze({ victory: false, storm: false, emergency: false, canyon: false, expedition: false, night: true });
  const lastOneShot = new Map();

  const call = (name, ...args) => {
    if (!SFX_NAMES.includes(name)) return false;
    const f = sfx[name];
    if (typeof f !== 'function') return false;
    if (DEDUPE_MS[name]) {
      const t = now();
      if (t - (lastOneShot.get(name) ?? -Infinity) < DEDUPE_MS[name]) return false;
      lastOneShot.set(name, t);
    }
    f.call(sfx, ...args);
    return true;
  };

  function timedFlags(t) {
    const canyon = canyonFrom !== null && t < Math.min(canyonFrom + CANYON_MS.max, canyonUntil ?? Infinity);
    let victory = victoryFrom !== null;
    if (victory && sandboxFrom !== null && t >= Math.max(victoryFrom, sandboxFrom) + VICTORY_SANDBOX_MS) victory = false;
    return { canyon, victory };
  }

  const director = {
    /** First user gesture (Start Mission, Continue, role select): unlock audio. */
    gesture() { return sfx.unlock?.() ?? false; },

    /** Play a cue by sound-engine name or legacy name. `arg` goes to typewriterBlip(char). */
    cue(id, arg) {
      const name = LEGACY_CUES[id] ?? id;
      return name === 'typewriterBlip' ? call(name, arg) : call(name);
    },

    /** A cue from src/flow/intro.js cuesBetween(): { type: 'sfx', id, char? }. */
    flowCue(c) {
      if (!c || c.type !== 'sfx') return false;
      return director.cue(c.id, c.char);
    },

    /** One typed character in the crawl or the ASTRA panel. */
    typed(char) { return call('typewriterBlip', char); },

    /**
     * An ASTRA (or log) line starts showing in the panel. `slideIn` is true when the panel
     * opens for it. Plays lore cues and tracks the black-box decoding window.
     */
    astraLine(lineId, { slideIn = false } = {}) {
      const t = now();
      if (slideIn) call('astraSlideIn');
      if (LORE_CUES[lineId]) call(LORE_CUES[lineId]);
      if (lineId === 'astra.act3.blackbox_decode_start') { canyonFrom = t; canyonUntil = null; }
      if (lineId === 'astra.act3.blackbox_react2' && canyonFrom !== null) canyonUntil = t + CANYON_MS.afterLast;
    },

    /** A radio log line appears (expedition progress). */
    radio(lineId) {
      call('radioPing');
      if (LORE_CUES[lineId]) call(LORE_CUES[lineId]);
    },

    /** A mini-game action: game id + action ('down', 'move', 'zap', 'pebble', 'lock', 'win'...). */
    minigame(game, action) {
      if (action === 'win') return call('minigameWin');
      const name = MINIGAME_CUES[game]?.[action];
      if (!name) return false;
      if (action === 'move') {
        const t = now();
        const key = `${game}:${action}`;
        if (t - (lastMove.get(key) ?? -Infinity) < REPEAT_MS.move) return false;
        lastMove.set(key, t);
      }
      return call(name);
    },

    /** UI sounds: 'click' | 'tab' | 'choice'. */
    ui(kind) {
      return call({ click: 'uiClick', tab: 'uiTabSwitch', choice: 'dilemmaChoice' }[kind] ?? 'uiClick');
    },

    /**
     * A dilemma, event or radio-decision card opens (the moment the player sees it, also for a
     * decision pending in a loaded save). Urgent ones (solar flare e1, space weather d5) are
     * emergencies.
     */
    decisionShown(id) { return call(URGENT.has(id) ? 'alertEmergency' : 'alertWarning'); },

    /** Events returned by the campaign engine (step / command). */
    campaignEvents(events = []) {
      const t = now();
      for (const e of events) {
        switch (e.type) {
          case 'built': case 'upgraded': case 'crafted': call('moduleComplete'); break;
          case 'drone-awake': call('droneWake'); break;
          case 'emergency': call('alertEmergency'); break;
          case 'storm': if (e.on) call('alertWarning'); break;
          case 'launched': call('airlockCycle'); call('roverDepart'); break;
          case 'returned': call('airlockCycle'); break;
          case 'radio': director.radio(e.id); break;
          case 'astra':
            if (MEDREST_LINES.has(e.lineId)) call('medRestActivate');
            if (e.lineId === 'astra.act3.blackbox_decode_start') { canyonFrom = t; canyonUntil = null; }
            break;
          case 'finale': if (victoryFrom === null) victoryFrom = t; break;
          case 'sandbox': if (sandboxFrom === null) sandboxFrom = t; break;
          default:
        }
      }
    },

    /**
     * Call every frame. `mode`: 'loading' | 'intro' | 'tutorial' | 'play'. Updates the music
     * when a flag changes, plays the dawn chime, and paces drone work sounds.
     */
    tick({ s = null, mode = 'play' } = {}) {
      const t = now();
      if (mode === 'intro') {
        // the text crawl and the landing get the soft night tune, so the game is not silent for its first half minute
        if (!musicOn || lastFlags !== INTRO_FLAGS) { sfx.updateMusic?.(INTRO_FLAGS); musicOn = true; lastFlags = INTRO_FLAGS; }
        wasNight = null;
        return null;
      }
      if (mode !== 'tutorial' && mode !== 'play') {
        if (musicOn) { sfx.stopMusic?.(); musicOn = false; lastFlags = null; }
        wasNight = null;
        return null;
      }
      const flags = musicFlags(s, timedFlags(t));
      if (!musicOn || !sameFlags(flags, lastFlags)) {
        sfx.updateMusic?.(flags);
        musicOn = true;
        lastFlags = flags;
      }
      if (mode === 'play' && wasNight === true && !flags.night) call('solDawnChime');
      wasNight = flags.night;
      if (mode === 'play' && !flags.night && s?.drones?.some((d) => d.status === 'awake' && d.task)) {
        if (t - lastDroneWork >= REPEAT_MS.droneWork) { lastDroneWork = t; call('droneBuildTick'); }
      }
      return flags;
    },

    // ---- settings (HUD mute button, Music/SFX sliders)
    toggleMute() { return sfx.toggleMute?.(); },
    setMuted(v) { sfx.setMuted?.(v); },
    setMusicVolume(v) { sfx.setMusicVolume?.(v); },
    setSfxVolume(v) { sfx.setSfxVolume?.(v); },
    get settings() { return { muted: Boolean(sfx.muted), musicVolume: sfx.musicVolume, sfxVolume: sfx.sfxVolume }; },

    /**
     * Forget timed state (new campaign or a loaded save). With the loaded state `s`, victory music
     * is restored when the finale is done but Free-Play has not started; past that the 30 s
     * fallback is already over. (The black-box canyon window lasts under 2 minutes and is not
     * restored.)
     */
    reset(s = null) {
      lastOneShot.clear();
      lastFlags = null; wasNight = null; lastMove = new Map(); lastDroneWork = -Infinity;
      canyonFrom = null; canyonUntil = null; victoryFrom = null; sandboxFrom = null;
      if (s?.flags?.finaleDone && clockAt(s.minute ?? 0).sol < 21) victoryFrom = now();
    },
  };
  return director;
}

/** The director the game uses. */
export const audioDirector = createAudioDirector();
