/**
 * The Sol Plan and Fitness of the Commander (SCENARIO 3.10, 3.11). Pure functions over the state.
 *
 * A plan is 24 one-hour blocks. Three presets exist (the Advanced 24-slot editor is not built):
 *   Balanced  sleep 8, work 9, exercise 1, free 3   (the default)
 *   Crunch    sleep 8, work 11, exercise 1, free 1  (work +22%, Morale -4 a Sol against Balanced)
 *   Recover   sleep 9, work 6, exercise 2, free 4   (work -33%, sleep +13.5 HP)
 * Meals stay at 06:00, 12:00 and 18:00 in every preset. A new plan starts at the next midnight.
 * All numbers are gameplay values, except the direction of the Fitness loss (approximation, 3.11).
 */
import { FITNESS } from './data.js';

const S = 'sleep', M = 'meal', W = 'work', E = 'exercise', F = 'free';

/** hour 0..23 -> block */
export const PLANS = Object.freeze({
  //          0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
  balanced: [S, S, S, S, S, S, M, W, W, W, W, W, M, W, W, W, W, E, M, F, F, F, S, S],
  crunch:   [S, S, S, S, S, S, M, W, W, W, W, W, M, W, W, W, W, E, M, W, W, F, S, S],
  recover:  [S, S, S, S, S, S, M, W, W, W, E, E, M, W, W, W, F, F, M, F, F, S, S, S],
});
export const PLAN_IDS = Object.freeze(Object.keys(PLANS));

const count = (plan, block) => PLANS[plan].filter((b) => b === block).length;

/** The block the Commander's plan has for this hour. */
export const blockAt = (s, hour) => PLANS[PLAN_IDS.includes(s.plan) ? s.plan : 'balanced'][hour];

/** Hours of each block in a plan. */
export const planHours = (plan) => ({ sleep: count(plan, S), meal: count(plan, M), work: count(plan, W), exercise: count(plan, E), free: count(plan, F) });

/** Morale per Sol from the plan (3.10): free time 3 h+ gives +2, 0 h gives -3; each Work hour above 9 costs 1. */
export function planMoralePerSol(plan) {
  const h = planHours(plan);
  const free = h.free >= 3 ? 2 : h.free === 0 ? -3 : 0;
  return free - Math.max(0, h.work - 9);
}

/**
 * Personal work speed: +11% per Work hour above 9, -11% per hour below (3.10), and x0.8 at Fitness
 * below 40 (3.11). It speeds up or slows down what the base builds and crafts.
 */
export function workSpeed(s) {
  const plan = PLAN_IDS.includes(s.plan) ? s.plan : 'balanced';
  return (1 + 0.11 * (planHours(plan).work - 9)) * (s.fitness < FITNESS.lowAt ? FITNESS.lowWorkSpeed : 1);
}

/** Where the Commander exercises: Recreation & Storage once it stands, else stretch bands in the Bedroom. */
export const exercisePlace = (s) => (s.modules.recreation?.status === 'online' ? 'recreation' : 'bedroom');

/** Fitness gained per hour of exercise (3.11): Bedroom +10, Recreation +20, Recreation T2 +25. */
export function fitnessPerHour(s) {
  if (s.modules.recreation?.status !== 'online') return FITNESS.bedroomPerHour;
  return s.modules.recreation.tier === 2 ? FITNESS.recT2PerHour : FITNESS.recPerHour;
}

/** M_fit, the expedition HP multiplier of 3.6, measured at launch: x1.10 below 40, x1.25 at 15 or less (the cap). */
export const fitMult = (fitness) => (fitness <= FITNESS.criticalAt ? FITNESS.criticalTripMult : fitness < FITNESS.lowAt ? FITNESS.lowTripMult : 1);
