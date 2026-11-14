/**
 * Public API of the simulation. The UI, tests and tools import from here only.
 *
 *   const game = createGame('L1-first-sols');
 *   const events = step(game, 60);                       // one Mars-hour
 *   applyCommand(game, { type: 'shelter', on: true });
 *   const text = serialize(game);
 */
export { createGame, step, applyCommand, clockAt, roomReport, summary, warningLeadMinutes, STATE_VERSION } from './sim.js';
export { constructionSite, constructionRemaining } from './construction.js';
export { serialize, deserialize, validateState, SaveError, newProfile, recordResult, serializeProfile, deserializeProfile } from './save.js';
export { evaluateObjectives, scoreBreakdown, starRating, ACHIEVEMENTS } from './objectives.js';
export { reserves, sunFactor, batteryCapacity } from './resources.js';
export { shieldingReport, roomShielding, doseRateMsvPerHour, gcrTransmission, speTransmission, arealDensity, effectiveDensity } from './radiation.js';
export { stormsFromDonki, stormRateMsvPerHour, classifyDetections, minuteAt } from './space-weather.js';
export { workMultiplier, desiredActivity, jobAvailable } from './crew.js';
export { shortestPath, travelMinutes } from './pathfinding.js';
export { describeEvent } from './messages.js';
export { TUNING, TUNING_PROVENANCE, STORM_CLASSES, MATERIALS, JOBS, ROLES, PROJECTS, DEFAULT_SCHEDULE, SOL_MINUTES, EARTH_HOURS_PER_SIM_MINUTE } from './constants.js';
export { LEVELS, LEVEL_BY_ID, FIRST_LEVEL_ID } from '../data/levels.js';
export { WORLD, ROOMS, MODULE_IDS, EDGES, DRONES, SURFACE_PROPS, ZONE_LABEL, depthMetres } from '../data/base-layout.js';
export { CREW } from '../data/crew.js';
export { NASA, FACTS, PROVENANCE, PROVENANCE_LABEL } from '../data/nasa/reference.js';
