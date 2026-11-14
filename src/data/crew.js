/**
 * Crew roster.
 *
 * PLACEHOLDER: names, colours and one-line bios are stand-ins until the lore document
 * arrives (see docs/LEVELS.md, "Waiting for lore"). Ids and roles are what the simulation
 * depends on; everything else can change freely.
 */
export const CREW = Object.freeze({
  cmdr: { name: 'Amara', role: 'commander', suitColor: 'red', bio: 'Mission commander. Good at everything, best at nothing.' },
  eng: { name: 'Kenji', role: 'engineer', suitColor: 'yellow', bio: 'Keeps the machines alive: life support, power, construction.' },
  bot: { name: 'Sofia', role: 'botanist', suitColor: 'green', bio: 'Grows the fresh food.' },
  sci: { name: 'Leo', role: 'scientist', suitColor: 'blue', bio: 'Geologist. Happiest outside with a rock hammer.' },
});
