/** Lives and one JSON checkpoint. Pure, deterministic; the state object keeps its identity on rewind. */
import { LIVES, RULES } from './data.js';
import { clockAt } from './util.js';

export const STRINGS = Object.freeze({
  'astra.lives.rewind': "Good try! The Commander is worn out, so the rescue team took over. Let's revisit our last decision. Watch Oxygen, Heat and HP as we try another way.",
  'astra.lives.danger_oxygen': "Empty Oxygen costs our Commander energy. Let's fix the air scrubber.",
  'astra.lives.danger_heat': "Empty Heat costs our Commander energy. Let's fix the heat pump.",
  'astra.lives.danger_water': "Empty Water costs our Commander energy. Let's check our water supply.",
  'astra.lives.danger_food': "Empty Food costs our Commander energy. Let's check the Greenhouse.",
});

const LABELS = Object.freeze({
  d1: 'The Dust Storm decision',
  d2: 'The Cracked Filter decision',
  d3: 'The Martian Soil Test decision',
  d4: 'Cold Plants or Call Home?',
  d5: 'The Space Weather Warning decision',
  e1: 'The Solar Flare decision',
  e2: 'The Dust Devil decision',
  e3: 'The Airlock Leak decision',
  e4: 'The Nutrient Mix decision',
});

export function takeCheckpoint(s, label, kind = null, id = null) {
  if (!(s.rules?.hpZeroEndsRun ?? RULES.hpZeroEndsRun)) return;
  const { checkpoint, ...state } = s; // exclude the previous snapshot: never nest checkpoints
  s.checkpoint = {
    sol: clockAt(s.minute).sol,
    minute: s.minute,
    label: label ?? (kind === 'radio' ? 'A radio call from the Rover' : LABELS[id] ?? 'The last decision'),
    kind, id,
    snap: JSON.stringify(state),
  };
}

/** Returns true when HP loss was handled, so the caller can stop the current tick/batch immediately. */
export function loseLife(s, emit, reason) {
  if (s.status !== 'running' || !(s.rules?.hpZeroEndsRun ?? RULES.hpZeroEndsRun)) return false;
  const checkpoint = s.checkpoint;
  const lives = Math.max(0, (s.lives ?? LIVES.start) - 1);
  const livesMax = s.livesMax ?? LIVES.start;
  const livesLost = (s.stats.livesLost ?? 0) + 1;
  s.lives = lives;
  s.livesMax = livesMax;
  s.stats.livesLost = livesLost;
  const event = { type: 'life-lost', livesLeft: lives, reason, checkpoint: checkpoint ? { sol: checkpoint.sol, label: checkpoint.label } : null };
  if (lives > 0 && checkpoint) {
    const restored = JSON.parse(checkpoint.snap);
    for (const key of Object.keys(s)) delete s[key];
    Object.assign(s, restored, { lives, livesMax, checkpoint });
    s.stats.livesLost = livesLost;
    s.hp = Math.max(s.hp, LIVES.restoreHpMin);
    emit(event);
    emit({ type: 'rewind', sol: checkpoint.sol, label: checkpoint.label });
    emit({ type: 'astra', lineId: 'astra.lives.rewind', mood: 'calm' });
  } else {
    emit(event);
    // Preserve the existing Game Over contract and cleanup after expeditionMinute's rescue path.
    s.status = 'over';
    if (s.medRest) { s.medRest = null; s.stats.medRests = Math.max(0, s.stats.medRests - 1); }
    s.pending = null;
    s.over = { reason, sol: clockAt(s.minute).sol, minute: s.minute };
    emit({ type: 'gameover', reason, sol: s.over.sol });
  }
  return true;
}
