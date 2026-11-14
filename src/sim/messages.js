/**
 * Player-facing text for simulation events (mission log, alerts).
 * Kept apart from the logic so wording, tone and translations can change without touching
 * the simulation. Written for readers aged 7 and up: short sentences, concrete words.
 */
import { STORM_CLASSES } from './constants.js';

const KIND = { noO2: 'oxygen', noWater: 'water', noFood: 'food', blackout: 'power' };

const hoursAndMinutes = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

/**
 * @returns {{ level: 'info' | 'good' | 'warn' | 'danger', text: string } | null}
 *   null for events that do not belong in the mission log.
 */
export function describeEvent(e) {
  switch (e.type) {
    case 'sol-start':
      return { level: 'info', text: `Sol ${e.sol} begins.` };
    case 'storm-warning':
      return { level: 'warn', text: `Space weather alert: ${STORM_CLASSES[e.class].label.toLowerCase()} expected in ${hoursAndMinutes(e.minutesUntil)}.` };
    case 'storm-start':
      return { level: 'danger', text: `${e.label} has reached Mars. Radiation on the surface is rising.` };
    case 'storm-end':
      return e.sheltered
        ? { level: 'good', text: 'The solar storm has passed. Everyone stayed protected.' }
        : { level: 'warn', text: `The solar storm has passed. Highest dose from it: ${e.maxDoseMsv.toFixed(2)} mSv (${e.maxDoseName}).` };
    case 'all-clear':
      return { level: 'good', text: 'All clear. The shelter order is lifted.' };
    case 'shelter-order':
      return e.on ? { level: 'warn', text: 'Shelter order: nobody stays on the surface.' } : { level: 'info', text: 'Shelter order lifted.' };
    case 'dust-storm-start':
      return { level: 'warn', text: 'A dust storm has rolled in. Sunlight on the panels is much weaker.' };
    case 'dust-storm-end':
      return { level: 'good', text: 'The dust storm has cleared.' };
    case 'dust-devil':
      return { level: 'good', text: 'A dust devil swept across the solar panels and blew some dust off.' };
    case 'emergency':
      return { level: 'danger', text: `Emergency: the base has run out of ${KIND[e.kind]}!` };
    case 'emergency-over':
      return { level: 'good', text: `${KIND[e.kind][0].toUpperCase()}${KIND[e.kind].slice(1)} is back.` };
    case 'dose-warning':
      return { level: 'warn', text: `${e.name} has used most of the radiation budget (${e.doseMsv.toFixed(1)} of ${e.budgetMsv} mSv).` };
    case 'crew-grounded':
      return { level: 'danger', text: `${e.name} is over the radiation budget and is taken off duty by the flight doctor.` };
    case 'project-started':
      return { level: 'info', text: `Project started: ${e.title}.` };
    case 'project-done':
      return { level: 'good', text: `Project finished: ${e.title}.` };
    case 'assigned':
      return { level: 'info', text: `${e.name}: ${e.jobLabel}.` };
    case 'achievement':
      return { level: 'good', text: `Achievement: ${e.title} — ${e.text}` };
    case 'hint':
      return { level: 'info', text: `Tip: ${e.text}` };
    case 'level-complete':
      return { level: 'good', text: 'Mission complete.' };
    case 'level-failed':
      return { level: 'danger', text: `Mission aborted: ${e.result.reason}` };
    default:
      return null;
  }
}
