/**
 * ASTRA 6.7's voice. Every spoken line (src/ui/spoken-text.js) was recorded once with a local text-to-speech model
 * (tools/voice/astra-voice.mjs: Kokoro-82M, Apache-2.0) into assets/audio/astra/<lineId>.mp3; index.json lists them.
 * The panel calls `speak(lineId)` when a line appears and `stop()` when it goes. Settings: prefs.voice (on by default).
 * A line without a recording (one with a {placeholder}, or a new line not recorded yet) is simply shown as text.
 */
import { prefs } from './prefs.js';

const DIR = 'assets/audio/astra/';
let index = null; // { lineId: { file, sec, text } }
let audio = null;
let volume = 1; // follows the master volume of the sound engine (set by main.js)

/** Load the list of recordings once (browser only). A missing list just means: no voice. */
export async function loadVoice() {
  try {
    const res = await fetch(`${DIR}index.json`);
    index = res.ok ? await res.json() : {};
  } catch { index = {}; }
}

export const hasVoice = (lineId) => Boolean(lineId && index?.[lineId]);
export function setVoiceVolume(v) { volume = Math.max(0, Math.min(1, Number(v) || 0)); if (audio) audio.volume = volume; }

/** Say a line, cutting off the one before. Returns true when a recording is playing. */
export function speak(lineId) {
  stop();
  if (!prefs.voice || !hasVoice(lineId) || volume === 0) return false;
  audio = new Audio(DIR + index[lineId].file);
  audio.volume = volume;
  audio.play().catch(() => { audio = null; }); // before the first tap the browser may refuse: then it stays text
  return true;
}

export function stop() {
  if (!audio) return;
  audio.pause();
  audio = null;
}

/** ASTRA is still talking (the panel animates her face and a cutscene waits for her). */
export const speaking = () => Boolean(audio && !audio.paused && !audio.ended);
