/**
 * One line on what to do next, for the current mission that builds a room (docs/ERRORS.md A30).
 * Pure: no DOM, so it runs under node --test.
 *
 * The wording follows SCENARIO's `astra.tut.build_prompt` ("Tap the Battery & Heating frame, then tap Build."),
 * so ASTRA and the Missions tracker say the same thing. When the room cannot be built yet, the engine's own
 * reason is shown instead ("Build the Workshop first."). Provenance: `gameplay` (UI hint text, not a claim about Mars).
 */
import { MODULES } from '../campaign/data.js';
import { moduleInfo } from '../campaign/engine.js';
import { t, hasString } from '../flow/strings.js';

/**
 * @param s the campaign state
 * @param m a mission from `missions(s)` or `tracker(s)`
 * @returns the hint, or '' when the mission is not the current one, does not build a room, or the room is already
 *          being built or finished
 */
export function howTo(s, m) {
  const id = m.state === 'current' && m.focus?.startsWith('module:') ? m.focus.slice(7) : null;
  if (!id || !s.modules[id]) return '';
  const info = moduleInfo(s, id);
  if (info.status !== 'unbuilt') return '';
  const nameId = MODULES[id].nameId;
  return info.reason ?? `Tap the ${hasString(nameId) ? t(nameId) : id} frame, then tap Build.`;
}
