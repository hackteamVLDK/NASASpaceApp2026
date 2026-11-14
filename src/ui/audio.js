/**
 * UI-side adapter for the audio director (src/audio/audioDirector.js). Keeps the old
 * `play(id)` / `unlock()` API so existing calls work; new code can use `director` directly.
 * Cue names: any sound-engine method ('pipeRotate', 'antennaLock', ...) or the older names
 * ('click', 'win', 'zap', 'chirp', 'alert', intro cue ids). See content/handoff/AUDIO_HOOKS.md.
 */
import { audioDirector } from '../audio/audioDirector.js';

export const director = audioDirector;

/** Call from the first user gesture (Start Mission / Continue): browsers block audio before it. */
export function unlock() { audioDirector.gesture(); }

export function play(id, arg) { audioDirector.cue(id, arg); }

/** The intro wind is a one-shot sound in the new engine; nothing to stop. */
export function stopWind() {}
