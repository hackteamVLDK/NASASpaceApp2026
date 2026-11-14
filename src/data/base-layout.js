/**
 * The base, as data: the world canvas, the modules, how they connect, what shields them.
 *
 * Follows SCENARIO.md section 4. What the scenario states is marked SCENARIO; what it leaves
 * open and had to be chosen is marked PROPOSAL (listed in docs/LEVELS.md, "Open points").
 *
 *   world: 1920 x 3200 logical units, side-view cutaway
 *
 *      Y    0 ─────────────────────────────── sky, Jezero Crater mountains
 *      Y 1050 ═══ ground line ═══  solar panels · AIRLOCK DOME · antenna · mound + 2 buried drones
 *      Y 1100 ─ soil ─────────────────────────────────────────────
 *                        │shaft│
 *      Y 1560   BEDROOM  │  1  │  WORKSHOP                 left wing: operational
 *      Y 1830   DINING   │  2  │  RESEARCH & COMMS LAB     right wing: unfinished at the start
 *      Y 2100   LIFE SUP.│  3  │  BATTERY & HEATING
 *      Y 2370  (hydrop.) │  4  │  ROVER GARAGE + Drone #01
 *      Y 2640 ─ soil ─────────────────────────────────────────────
 *      Y 3200
 */

export const WORLD = Object.freeze({
  // SCENARIO section 4
  width: 1920,
  height: 3200,
  groundY: 1050,
  subsurfaceTopY: 1100,
  camera: Object.freeze({ skyY: 400, surfaceY: 850, baseOverviewY: 2100 }),
  place: 'Jezero Crater',
  base: 'Ares-1',
  mission: 'ARES-KIDS',
  year: 2042,
  // PROPOSALS
  viewWidth: 1920,
  viewHeight: 1080, // a 16:9 window on the world; camera Y is the centre of the view
  unitsPerMetre: 100, // an astronaut is about 175 units tall
  unitsPerArtPixel: 5, // every coordinate in SCENARIO.md is a multiple of 5
  floorHeight: 270,
  firstFloorY: 1560, // four floors of 270 fill the view exactly when the camera sits at Y 2100
  leftWingX: 300,
  shaftX: 900,
  rightWingX: 1020,
  wingWidth: 600,
  shaftWidth: 120,
});

const floorY = (floor) => WORLD.firstFloorY + (floor - 1) * WORLD.floorHeight;
const left = (floor) => Object.freeze({ x: WORLD.leftWingX, y: floorY(floor), w: WORLD.wingWidth, h: WORLD.floorHeight });
const right = (floor) => Object.freeze({ x: WORLD.rightWingX, y: floorY(floor), w: WORLD.wingWidth, h: WORLD.floorHeight });
const shaft = (floor) => Object.freeze({ x: WORLD.shaftX, y: floorY(floor), w: WORLD.shaftWidth, h: WORLD.floorHeight });

/**
 * Every place an astronaut can be.
 *   zone         outdoor | surface | underground — decides the radiation shielding
 *   module       true for a room that can be online or unfinished
 *   startsOnline SCENARIO: the left wing is operational, the right wing unfinished
 *   buildHours   work-hours to finish an unfinished module (game value)
 *   inScenario   false marks a module that SCENARIO.md does not contain (a proposal)
 *   rect         position on the world canvas (x, widths and the floor a room sits on are PROPOSALS)
 */
export const ROOMS = Object.freeze({
  away: { name: 'Exploration site', zone: 'outdoor', offMap: true, about: 'Out with the rover: science samples and icy soil. A long way from the airlock.' },
  outside: { name: 'Surface', zone: 'outdoor', rect: Object.freeze({ x: 380, y: 930, w: 420, h: 120 }), about: 'Solar panels under the open sky. No shielding at all.' },
  airlock: { name: 'Airlock dome', zone: 'surface', module: true, wing: 'surface', startsOnline: true, inScenario: true, rect: Object.freeze({ x: 870, y: 930, w: 180, h: 120 }), about: 'The only door to the outside. Suits are put on here.' },
  shaft1: { name: 'Shaft, level 1', zone: 'underground', floor: 1, rect: shaft(1), about: 'The ladder shaft down from the airlock.' },
  shaft2: { name: 'Shaft, level 2', zone: 'underground', floor: 2, rect: shaft(2), about: 'Ladder shaft.' },
  shaft3: { name: 'Shaft, level 3', zone: 'underground', floor: 3, rect: shaft(3), about: 'Ladder shaft.' },
  shaft4: { name: 'Shaft, level 4', zone: 'underground', floor: 4, rect: shaft(4), about: 'Bottom of the ladder shaft.' },
  // Left wing — operational, warm light (SCENARIO)
  bedroom: { name: 'Bedroom', zone: 'underground', module: true, wing: 'left', floor: 1, startsOnline: true, inScenario: true, rect: left(1), about: 'Bunks. Sleeping under the soil keeps the nightly radiation dose low.' },
  dining: { name: 'Kitchen', zone: 'underground', module: true, wing: 'left', floor: 2, startsOnline: true, inScenario: true, rect: left(2), about: 'Meals, exercise and free time. Also where everyone gathers during a solar storm.' },
  lifesupport: { name: 'Water & Air Life Support', zone: 'underground', module: true, wing: 'left', floor: 3, startsOnline: true, inScenario: true, rect: left(3), about: 'Oxygen generator and water recycler.' },
  // PROPOSAL — not in SCENARIO.md. The scenario has no place to grow food; this slot is empty soil at the start.
  hydroponics: { name: 'Hydroponics bay', zone: 'underground', module: true, wing: 'left', floor: 4, startsOnline: false, inScenario: false, buildHours: 20, rect: left(4), about: 'Proposed module: fresh food and a little oxygen. Needs power for its lights.' },
  // Right wing — unfinished, dark steel frames in sand (SCENARIO)
  workshop: { name: 'Workshop', zone: 'underground', module: true, wing: 'right', floor: 1, startsOnline: false, inScenario: true, buildHours: 18, rect: right(1), about: 'Where upgrades for the base are made.' },
  lab: { name: 'Research & Comms Lab', zone: 'underground', module: true, wing: 'right', floor: 2, startsOnline: false, inScenario: true, buildHours: 22, rect: right(2), about: 'Science, and the radio link to Earth that brings space-weather warnings.' },
  power: { name: 'Battery & Heating', zone: 'underground', module: true, wing: 'right', floor: 3, startsOnline: false, inScenario: true, buildHours: 14, rect: right(3), about: 'Stores solar power for the night and keeps the base warm.' },
  garage: { name: 'Rover Garage', zone: 'underground', module: true, wing: 'right', floor: 4, startsOnline: false, inScenario: true, buildHours: 26, rect: right(4), about: 'Home of the rover. Needed before anyone can go exploring.' },
});

/** Ids of the rooms that are modules (can be online or unfinished). */
export const MODULE_IDS = Object.freeze(Object.keys(ROOMS).filter((id) => ROOMS[id].module));

/** Walking connections: [roomA, roomB, minutes]. Travel times are game values. */
export const EDGES = Object.freeze([
  ['away', 'outside', 60],
  ['outside', 'airlock', 10],
  ['airlock', 'shaft1', 10], // the long climb through five metres of soil
  ['shaft1', 'shaft2', 5],
  ['shaft2', 'shaft3', 5],
  ['shaft3', 'shaft4', 5],
  ['shaft1', 'bedroom', 6],
  ['shaft1', 'workshop', 6],
  ['shaft2', 'dining', 6],
  ['shaft2', 'lab', 6],
  ['shaft3', 'lifesupport', 6],
  ['shaft3', 'power', 6],
  ['shaft4', 'hydroponics', 6],
  ['shaft4', 'garage', 6],
]);

/** Builder drones (SCENARIO: Drone #01 in the unfinished right wing, two more buried on the surface). */
export const DRONES = Object.freeze({
  'drone-01': { name: 'Drone #01', at: 'garage', buried: false, led: 'red, blinking at 1 Hz while dormant', x: 1500, y: 2590 },
  'drone-02': { name: 'Drone #02', at: 'outside', buried: true, x: 1560, y: 1040 },
  'drone-03': { name: 'Drone #03', at: 'outside', buried: true, x: 1680, y: 1045 },
});

/**
 * Things standing on the surface (SCENARIO section 4 lists them; the x positions are PROPOSALS).
 * Scenery for the renderer and the asset list; the simulation does not read this.
 */
export const SURFACE_PROPS = Object.freeze([
  { id: 'solar-panels', what: 'dust-covered solar panels', x: 380, y: WORLD.groundY },
  { id: 'airlock-dome', what: 'Airlock dome', x: 960, y: WORLD.groundY },
  { id: 'antenna', what: 'bent antenna', x: 1110, y: WORLD.groundY },
  { id: 'lander', what: 'Mars lander touchdown spot, next to the Airlock dome', x: 1280, y: WORLD.groundY },
  { id: 'regolith-mound', what: 'regolith mound', x: 1620, y: WORLD.groundY },
  { id: 'drone-02', what: 'buried dormant drone', x: 1560, y: WORLD.groundY },
  { id: 'drone-03', what: 'buried dormant drone', x: 1680, y: WORLD.groundY },
]);

/** Metres of soil above a room's ceiling (0 for anything on the surface). */
export function depthMetres(roomId) {
  const room = ROOMS[roomId];
  if (!room || room.zone !== 'underground') return 0;
  return (room.rect.y - WORLD.groundY) / WORLD.unitsPerMetre;
}

/** Hull of a pressurised module, as a shielding layer. Scientific approximation. */
export const HULL = Object.freeze({ surface: { material: 'aluminum', thicknessM: 0.04 }, underground: { material: 'aluminum', thicknessM: 0.02 } });

export const ZONE_LABEL = Object.freeze({
  outdoor: 'Outside, in a suit',
  surface: 'On the surface, inside the dome',
  underground: 'Underground',
});
