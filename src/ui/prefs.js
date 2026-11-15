/**
 * C15: player settings that are not sound (sound lives in src/audio/soundManager.js).
 * Saved per browser; storage may be blocked, then the defaults stay for this visit.
 *   reduceMotion: no camera shake, no pulsing glows, no CSS animations. On by default when the
 *                 system asks for less motion (prefers-reduced-motion).
 *   largeText:    bigger text in the panels, cards and ASTRA's box.
 *   voice:        ASTRA reads her lines aloud (recorded with a local text-to-speech model, src/ui/astra-voice.js).
 */
const KEY = 'ares-kids.prefs.v1';

const systemReduce = () => { try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; } };

export const prefs = { reduceMotion: systemReduce(), largeText: false, voice: true };
try {
  const v = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null');
  if (v && typeof v.reduceMotion === 'boolean') prefs.reduceMotion = v.reduceMotion;
  if (v && typeof v.largeText === 'boolean') prefs.largeText = v.largeText;
  if (v && typeof v.voice === 'boolean') prefs.voice = v.voice;
} catch { /* defaults */ }

/** Change one setting, save it, and update the page classes. */
export function setPref(key, value) {
  prefs[key] = Boolean(value);
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  applyPrefs();
}

export function applyPrefs() {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  root.classList.toggle('reduce-motion', prefs.reduceMotion);
  root.classList.toggle('large-text', prefs.largeText);
}

/** 0..1 glow for pulsing things; a steady 0.75 with Reduce motion. */
export const wave = (now, ms = 320) => (prefs.reduceMotion ? 0.75 : 0.5 + 0.5 * Math.sin(now / ms));
