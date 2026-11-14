/**
 * Missions (docs/GAMEPLAY_PLAN.md 3.5): the story spine as a checklist the player sees from the
 * start. Every mission is a pure function of the campaign state, so loading a save restores it.
 * The texts are written in ASTRA's voice (short, calm, never scary) and are NOT yet in
 * content/data/strings.en.json; they are marked for extraction by the content owner.
 * `focus` is what the "Show me" button points at: a module, a drone, a tab or the map.
 */
import { clockAt } from './util.js';

const done = (s, k) => Boolean(s.flags.done?.[k]);
const on = (s, id) => s.modules[id].status === 'online';
const awake = (s, i) => s.drones[i].status === 'awake';
const chose = (s, d) => s.choices.some((c) => c.startsWith(d));

/** [id, act, title, why, doneTest, progress([have, need]) or null, reward, focus] */
const MAIN = [
  ['wake-pip', 1, 'Wake Drone #01', 'Builders make the base. Pip is the first one.', (s) => awake(s, 0), null, 'Your first builder drone', 'drone:drone-01'],
  ['battery', 1, 'Build Battery & Heating', 'It keeps the base warm through the cold nights.', (s) => on(s, 'battery'), (s) => [Math.floor(s.modules.battery.progress * 100), 100], 'Heat +25 and a bigger battery', 'module:battery'],
  ['storm-ready', 1, 'Get ready for the dust storm', 'A storm is coming on Sol 3. Pick a plan.', (s) => chose(s, 'd1'), null, 'Storm Ready badge for planning ahead', null],
  ['workshop', 1, 'Build the Workshop', 'On Mars we make our own spare parts.', (s) => on(s, 'workshop'), (s) => [Math.floor(s.modules.workshop.progress * 100), 100], 'Crafting', 'module:workshop'],
  ['storm', 1, 'Get through the storm', 'Sols 4 to 6. Save power and keep warm.', (s) => Boolean(s.flags._stormBegin) && !s.storm, null, 'A calm sky and a cleaning job', null],
  ['pumble', 1, 'Craft a Repair Kit and wake Drone #02', 'Two builders can build two rooms at once.', (s) => awake(s, 1), null, 'A second builder', 'drone:drone-02'],
  ['greenhouse', 2, 'Build the Greenhouse', 'Fresh food and a little oxygen.', (s) => on(s, 'greenhouse'), (s) => [Math.floor(s.modules.greenhouse.progress * 100), 100], 'Food, oxygen and extra HP', 'module:greenhouse'],
  ['garage', 2, 'Build the Garage & Airlock', 'Home of the Rover. Time to explore.', (s) => on(s, 'garage'), (s) => [Math.floor(s.modules.garage.progress * 100), 100], 'The Rover and the crater map', 'module:garage'],
  ['exp1', 2, 'Visit the weather probe Breeze-7', 'Its power core can wake Drone #03.', (s) => done(s, 1), null, 'Probe Power Core, parts', 'map'],
  ['zip', 2, 'Craft a Reboot Kit and wake Drone #03', 'All three builders awake.', (s) => awake(s, 2), null, 'A third builder', 'drone:drone-03'],
  ['exp2', 2, 'Find Pathfinder-X', 'Its black box and big dish are out there.', (s) => done(s, 2), null, 'Black Box and Dish Antenna', 'map'],
  ['lab', 3, 'Build the Research & Comms Lab', 'It needs the dish from Pathfinder-X.', (s) => on(s, 'lab'), (s) => [Math.floor(s.modules.lab.progress * 100), 100], 'Contact with Earth', 'module:lab'],
  ['rec', 3, 'Build Recreation & Storage', 'Rest, play and spare supplies.', (s) => on(s, 'recreation'), (s) => [Math.floor(s.modules.recreation.progress * 100), 100], 'Morale', 'module:recreation'],
  ['exp3', 3, 'Find ice on the crater rim', 'Ice Cores melt into fresh water.', (s) => done(s, 3), null, 'Ice Cores', 'map'],
  ['shield', 3, 'Cover the right wing and craft a suit liner', 'Soil and special materials block radiation.', (s) => on(s, 'roof') && Boolean(s.upgrades.suit_liner), (s) => [Number(on(s, 'roof')) + Number(Boolean(s.upgrades.suit_liner)), 2], 'Much less radiation', 'module:roof'],
  ['earth', 3, 'Read the black box and call Earth', 'Point the dish at Earth.', (s) => Boolean(s.flags.earthContact), null, 'Message in Minutes badge', 'tasks'],
  ['exp4', 3, 'Drive to the Ancient Delta Cliffs', 'Rare battery cells wait there.', (s) => done(s, 4), null, 'Rare Battery Cells', 'map'],
  ['tier2', 3, 'Upgrade the Lab and the Rover', 'The Deep Scan finds the signal.', (s) => s.modules.lab.tier === 2 && s.modules.garage.tier === 2, (s) => [Number(s.modules.lab.tier === 2) + Number(s.modules.garage.tier === 2), 2], 'The route to the Canyon', 'base'],
  ['finale', 3, 'Find the Jezero Signal', 'Take the Rover to the Canyon Anomaly.', (s) => Boolean(s.flags.finaleDone), null, 'THE JEZERO SIGNAL', 'map'],
];

/** Optional goals: they give cards, badges and bragging rights. */
const SIDE = [
  ['side-wipes', 'Clean the solar panels 5 times', (s) => s.stats.wipes >= 5, (s) => [Math.min(5, s.stats.wipes), 5], 'Panel Sweeper badge'],
  ['side-ice', 'Melt 5 Ice Cores', (s) => s.stats.melted >= 5, (s) => [Math.min(5, s.stats.melted), 5], 'Ice Miner badge'],
  ['side-food', 'Grow 50 Food in the Greenhouse', (s) => s.stats.harvest >= 50, (s) => [Math.min(50, Math.floor(s.stats.harvest)), 50], 'Space Gardener badge'],
  ['side-water', 'Keep the water recycler at 98% for 10 Sols', (s) => s.stats.recycleStreak >= 10, (s) => [Math.min(10, s.stats.recycleStreak), 10], 'Closed Loop badge'],
  ['side-cards', 'Unlock 20 Logbook cards', (s) => s.logbook.length >= 20, (s) => [Math.min(20, s.logbook.length), 20], 'A real Mars scientist'],
  ['side-ingenuity', 'Pass Ingenuity on the way to the Delta', (s) => Boolean(s.flags.passedIngenuity), null, 'Look, Don\'t Touch badge'],
  ['side-soil', 'Wash the Martian soil (Dilemma 3, choice B)', (s) => s.choices.includes('d3b'), null, 'Washed the Perchlorates badge'],
  ['side-sleep', 'Sleep a full night, every night, for a week', (s) => clockAt(s.minute).sol >= 7 && s.stats.medRests === 0, null, 'Well Rested badge'],
];

/** The whole list with live status. */
export function missions(s) {
  const main = MAIN.map(([id, act, title, why, test, progress, reward, focus]) => {
    const isDone = test(s);
    return { id, kind: 'main', act, title, why, reward, focus, done: isDone, progress: progress && !isDone ? progress(s) : null };
  });
  const firstOpen = main.findIndex((m) => !m.done);
  main.forEach((m, i) => { m.state = m.done ? 'done' : i === firstOpen ? 'current' : m.act === (main[firstOpen]?.act ?? 3) && i < firstOpen + 3 ? 'next' : 'later'; });
  const side = SIDE.map(([id, title, test, progress, reward]) => ({ id, kind: 'side', title, reward, done: test(s), progress: progress ? progress(s) : null, state: test(s) ? 'done' : 'open' }));
  return { main, side, currentAct: main[firstOpen]?.act ?? 4, finished: firstOpen === -1 };
}

/** The few missions to show in the small tracker: the current one and the next two. */
export function tracker(s) {
  const all = missions(s);
  return all.main.filter((m) => m.state === 'current' || m.state === 'next').slice(0, 3);
}
