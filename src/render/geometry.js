/**
 * Where everything stands in the cutaway: rooms, floors, the surface, the places people and drones go to.
 * Pure data and functions (no DOM), shared by the renderer, the movers, the cutscene and the tests, so the
 * picture, the clicks and the walking all agree. World units: 100 = 1 m. Room positions come from LAYOUT
 * (src/campaign/data.js).
 *
 * The base is three floors deep. The left wing is one room wide (Bedroom, Kitchen, Life Support). The right
 * wing is two rooms wide. The Garage & Airlock is a SURFACE building to the right of the dome (SCENARIO 1:
 * "Surface structures: Solar Array, Garage airlock and dish antenna"), so the Rover rolls out over the ground.
 */
import { LAYOUT } from '../campaign/data.js';

/** Surface props. Proposals (docs/LEVELS.md); everything stands on the ground line. */
export const SURFACE = Object.freeze({
  solar: { x: 310, w: 330 },
  airlock: { x: 960, w: 860 },
  antenna: { x: 1470, h: 360 },
  lander: { x: 1650, w: 240 },
  mound: [{ x: 1830, w: 170, flip: false }, { x: 1790, w: 130, flip: true }], // the cutscene only: SCENARIO has Drones #02 and #03 in the Garage after it
});

/** How tall a body is drawn (about 1.85 m is 92 units: half of the first version, which towered over doors and beds). */
export const PERSON_H = 92;
export const DRONE_H = 66;

export const SHAFT_X = LAYOUT.shaftX + LAYOUT.shaftWidth / 2; // the middle of the shaft
export const GROUND_Y = LAYOUT.groundY + 8; // feet on the surface
const FOOT = 16; // feet stand this far above the bottom of a room

/** Feet height on floor `floor` (1 = the top floor). */
export const floorFeetY = (floor) => LAYOUT.firstFloorY + (floor - 1) * LAYOUT.floorHeight + LAYOUT.floorHeight - FOOT;

/** Rectangle of a room in world units. A surface room (the Garage) stands on the ground line. */
export function roomRect(id) {
  const r = LAYOUT.rooms[id];
  if (r.wing === 'surface') return { x: r.x, y: LAYOUT.groundY - LAYOUT.floorHeight, w: LAYOUT.roomWidth, h: LAYOUT.floorHeight };
  const x = r.wing === 'left' ? LAYOUT.leftX : LAYOUT.rightX + (r.col ?? 0) * LAYOUT.roomWidth;
  return { x, y: LAYOUT.firstFloorY + (r.floor - 1) * LAYOUT.floorHeight, w: LAYOUT.roomWidth, h: LAYOUT.floorHeight };
}

/** Feet height of the floor of room `id`. */
export const feetY = (id) => (LAYOUT.rooms[id].wing === 'surface' ? GROUND_Y : floorFeetY(LAYOUT.rooms[id].floor));

/** The underground part: the lowest y and the whole width of the right wing. */
export const baseBottom = LAYOUT.firstFloorY + LAYOUT.floors * LAYOUT.floorHeight;
export const rightWingWidth = 2 * LAYOUT.roomWidth;

/**
 * The bunk the Commander sleeps in: the lower bunk on the left of module.bedroom.png (measured on the
 * picture, as fractions of the room), and the spot where he stands before he lies down.
 */
export function bedroomSpots() {
  const r = roomRect('bedroom');
  return {
    lie: { x: r.x + 0.2096 * r.w, y: r.y + 0.7374 * r.h }, // on the mattress
    stand: { x: r.x + 0.3 * r.w, y: feetY('bedroom') }, // beside the ladder
  };
}

/** The Garage on the surface: where drones rest, where the Rover parks and where the Commander boards it. */
export function garageSpots() {
  const r = roomRect('garage');
  return {
    rest: (i) => ({ x: r.x + 40 + i * 82, y: GROUND_Y }), // the left of the Garage; a drone is about 78 units wide, so three fit side by side
    park: { x: r.x + 340, y: GROUND_Y }, // the Rover, on the pad of the picture (see patchBakedRover in atlas.js)
    board: { x: r.x + 275, y: GROUND_Y }, // the Commander at the Rover's door
  };
}

/** Where the Commander or a drone stands (feet) for a place. `slot` spreads two bodies in one room. */
export function anchor(place, slot = 0) {
  if (place === 'outside') return { x: 330 + slot * 90, y: GROUND_Y };
  if (place === 'away') return null;
  if (place === 'solar') return { x: SURFACE.solar.x + 110 + (slot - 1) * 60, y: GROUND_Y }; // a drone upgrading the panels
  if (place === 'roof') return { x: LAYOUT.rightX + rightWingWidth / 2 + (slot - 1) * 150, y: LAYOUT.firstFloorY - 6 }; // piling soil over the right wing
  if (place === 'shaft') return { x: SHAFT_X, y: LAYOUT.firstFloorY + 100 };
  const r = LAYOUT.rooms[place];
  if (!r) return { x: SHAFT_X, y: LAYOUT.firstFloorY + 200 };
  if (place === 'bedroom' && slot === 1) return bedroomSpots().stand;
  if (place === 'garage' && slot === 1) return garageSpots().board;
  const rect = roomRect(place);
  return { x: rect.x + rect.w / 2 + (slot - 1) * 150, y: feetY(place) };
}

/**
 * The path of the astronaut in the entry scene (feet, world units): out of the lander, along the ground to the hatch of the
 * dome, down the shaft, and into the Bedroom, where the Commander stands when the tutorial starts (src/flow/intro.js).
 */
export function entryGeometry() {
  return {
    landerHatch: { x: SURFACE.lander.x - 30, y: GROUND_Y }, landerExit: { x: SURFACE.lander.x - 90, y: GROUND_Y },
    domeHatch: { x: SHAFT_X, y: GROUND_Y }, shaftTop: { x: SHAFT_X, y: GROUND_Y }, shaftBottom: { x: SHAFT_X, y: feetY('bedroom') },
    bedroomStand: bedroomSpots().stand,
  };
}
