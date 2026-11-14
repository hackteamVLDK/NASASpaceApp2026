/**
 * The base, as data: rooms, how they connect, and what shields them.
 *
 * Side-view cutaway. Columns run left to right, floors run downward:
 *
 *   floor  0 (surface)   [away] . [outside] [airlock] [hub0] [greenhouse] [command]
 *   floor -1 (upper)               [   quarters   ]   [hub1] [galley]     [lifesupport]
 *   floor -2 (deep)                [   shelter    ]   [hub2] [lab]        [power]
 *
 * `col` / `span` / `floor` are layout hints for the renderer. The simulation uses only
 * `zone` (for shielding) and the EDGES graph (for walking).
 */

export const ROOMS = Object.freeze({
  away: { name: 'Exploration site', zone: 'outdoor', floor: 0, col: -1, span: 1, offMap: true, about: 'Out with the rover: science samples and icy soil. A long way from shelter.' },
  outside: { name: 'Solar field', zone: 'outdoor', floor: 0, col: 0, span: 1, about: 'Solar panels and the rover pad, under the open sky.' },
  airlock: { name: 'Airlock', zone: 'surface', floor: 0, col: 1, span: 1, about: 'The only door to the outside. Suits are put on here.' },
  hub0: { name: 'Surface hub', zone: 'surface', floor: 0, col: 2, span: 1, about: 'Top of the ladder shaft.' },
  greenhouse: { name: 'Greenhouse', zone: 'surface', floor: 0, col: 3, span: 1, about: 'Fresh food and a little oxygen. Needs power for its lights.' },
  command: { name: 'Command module', zone: 'surface', floor: 0, col: 4, span: 1, about: 'Radio link to Earth and the space-weather alerts.' },
  quarters: { name: 'Crew quarters', zone: 'upper', floor: -1, col: 0, span: 2, about: 'Bunks. Sleeping under the soil keeps the nightly radiation dose low.' },
  hub1: { name: 'Upper landing', zone: 'upper', floor: -1, col: 2, span: 1, about: 'Ladder shaft, first level down.' },
  galley: { name: 'Galley and gym', zone: 'upper', floor: -1, col: 3, span: 1, about: 'Meals, exercise and free time.' },
  lifesupport: { name: 'Life support', zone: 'upper', floor: -1, col: 4, span: 1, about: 'Oxygen generator and water recycler.' },
  shelter: { name: 'Storm shelter', zone: 'deep', floor: -2, col: 0, span: 2, about: 'The best-shielded room in the base. Everyone fits, but it is cramped.' },
  hub2: { name: 'Lower landing', zone: 'deep', floor: -2, col: 2, span: 1, about: 'Bottom of the ladder shaft.' },
  lab: { name: 'Science lab', zone: 'deep', floor: -2, col: 3, span: 1, about: 'Sample analysis. Deep underground, so research can go on during a storm.' },
  power: { name: 'Battery room', zone: 'deep', floor: -2, col: 4, span: 1, about: 'Stores solar power for the night.' },
});

/** Walking connections: [roomA, roomB, minutes]. Travel times are gameplay values. */
export const EDGES = Object.freeze([
  ['away', 'outside', 60],
  ['outside', 'airlock', 10],
  ['airlock', 'hub0', 6],
  ['hub0', 'greenhouse', 6],
  ['greenhouse', 'command', 8],
  ['hub0', 'hub1', 8],
  ['hub1', 'hub2', 8],
  ['hub1', 'quarters', 8],
  ['hub1', 'galley', 6],
  ['galley', 'lifesupport', 8],
  ['hub2', 'shelter', 8],
  ['hub2', 'lab', 6],
  ['lab', 'power', 8],
]);

/**
 * Built-in shielding of each zone, outermost layer first. Thickness in metres.
 * Scientific approximation: only what is overhead counts, as a flat slab.
 * The Martian atmosphere is not listed because the surface radiation measurements
 * (src/data/nasa/reference.js) were already taken underneath it.
 */
export const ZONE_SHIELDING = Object.freeze({
  outdoor: [],
  surface: [{ material: 'aluminum', thicknessM: 0.04 }],
  upper: [
    { material: 'regolith', thicknessM: 1.5 },
    { material: 'aluminum', thicknessM: 0.02 },
  ],
  deep: [
    { material: 'regolith', thicknessM: 4.0 },
    { material: 'aluminum', thicknessM: 0.02 },
  ],
});

export const ZONE_LABEL = Object.freeze({
  outdoor: 'Outside, in a suit',
  surface: 'Surface module',
  upper: 'Underground, upper level',
  deep: 'Underground, deep level',
});
