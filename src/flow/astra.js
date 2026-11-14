/**
 * ASTRA 6.7 — the station AI who guides the player (SCENARIO.md sections 1, 2, 5, 6).
 *
 * Logic only: what ASTRA says, when, and in which mood. The on-screen panel is the
 * `AstraGuidePanel` component with props { isOpen, message, mood, onClose }; `guideProps()`
 * produces exactly those props from the guide state.
 *
 * Per the scenario, ASTRA appears whenever a new module is built, a survival event
 * triggers, or a scientific fact is unlocked, and slides back out when dismissed.
 * `astraLineFor(event)` turns simulation events into her lines.
 */
import { ROOMS } from '../data/base-layout.js';
import { PROVENANCE } from '../data/nasa/reference.js';

export const ASTRA = Object.freeze({
  name: 'ASTRA 6.7',
  role: 'onboard station AI',
  badge: 'ASTRA 6.7 // STATION AI',
  component: 'AstraGuidePanel',
  props: Object.freeze(['isOpen', 'message', 'mood', 'onClose']),
  panel: Object.freeze({ side: 'left', leftPx: 24, bottomPx: 24, widthPx: 360, text: 'typewriter' }),
  buttons: Object.freeze({ next: 'Next', done: 'Got it' }),
  avatar: 'animated holographic portrait: cyan/amber waveforms or a friendly geometric AI core, animating while she speaks',
  /** PROPOSAL: the scenario has a `mood` prop but does not list its values. */
  moods: Object.freeze(['cheerful', 'calm', 'curious', 'alert']),
});

// ---------------------------------------------------------------- guide state (a small queue)

/** A fresh guide: closed, nothing queued. */
export function createGuide() {
  return { current: null, queue: [], said: [] };
}

/**
 * Ask ASTRA to say something. If she is already talking, it waits its turn.
 * @param line {{ id: string, message: string, mood?: string, once?: boolean, button?: string }}
 *   `once` lines are never repeated in the same game.
 */
export function say(guide, line) {
  if (!line || typeof line.message !== 'string' || !line.message) return guide;
  if (line.once && guide.said.includes(line.id)) return guide;
  const mood = ASTRA.moods.includes(line.mood) ? line.mood : 'calm';
  const entry = { id: line.id, message: line.message, mood, button: line.button || ASTRA.buttons.done };
  if (line.fact) entry.fact = line.fact;
  if (!guide.said.includes(line.id)) guide.said.push(line.id);
  if (guide.current) guide.queue.push(entry);
  else guide.current = entry;
  return guide;
}

/** The player dismissed the panel: show the next queued line, or slide out. */
export function dismiss(guide) {
  guide.current = guide.queue.shift() ?? null;
  return guide;
}

/** Props for <AstraGuidePanel>, exactly as named in the scenario. */
export function guideProps(guide, onClose = () => {}) {
  return {
    isOpen: guide.current !== null,
    message: guide.current ? guide.current.message : '',
    mood: guide.current ? guide.current.mood : 'calm',
    onClose,
  };
}

// ---------------------------------------------------------------- what ASTRA says

const fact = (provenance, text) => ({ provenance, text });

/** One line per module, spoken when it comes online. Each carries a tagged science fact. */
const MODULE_LINES = Object.freeze({
  power: {
    message: 'Battery & Heating is online, Commander! Now we can save sunshine for the night — and Mars nights are far colder than any winter on Earth.',
    fact: fact(PROVENANCE.APPROX, 'Solar panels only work by day, so a base needs batteries to get through the night.'),
  },
  workshop: {
    message: 'The Workshop is ready! From here we can make upgrades for the whole base. On Mars you cannot order spare parts — you build and repair everything yourself.',
    fact: fact(PROVENANCE.APPROX, 'A cargo ship from Earth takes many months to reach Mars.'),
  },
  lab: {
    message: 'Research & Comms Lab online! I can hear Earth clearly again, so space-weather warnings will reach us much sooner. Even at the speed of light, a message needs several minutes to cross between the planets.',
    fact: fact(PROVENANCE.APPROX, 'Depending on where the planets are, a radio signal takes from about 5 to 20 minutes to travel between Mars and Earth.'),
  },
  garage: {
    message: "The Rover Garage is finished! Time to explore, Commander. Did you know? NASA's Perseverance rover landed right here in Jezero Crater in 2021.",
    fact: fact(PROVENANCE.NASA, 'Perseverance landed in Jezero Crater on 18 February 2021.'),
  },
  hydroponics: {
    message: 'The Hydroponics bay is growing! Fresh food, and the plants give us a little oxygen too.',
    fact: fact(PROVENANCE.APPROX, 'Plants take in carbon dioxide and give out oxygen.'),
  },
});

const EMERGENCY_LINES = Object.freeze({
  noO2: 'Oxygen alert, Commander! The tank is empty. The oxygen generator needs power, water and a little maintenance.',
  noWater: 'Water alert! The tank is empty. Check the recycler, and send someone to dig for ice.',
  noFood: 'The pantry is empty, Commander! The crew cannot work for long on empty stomachs.',
  blackout: 'Power is out! No heating and no air circulation. Clean the solar panels and switch off what we can spare.',
});

/**
 * ASTRA's line for a simulation event, or null if she stays quiet.
 * @returns {{ id: string, message: string, mood: string, once?: boolean, fact?: object } | null}
 */
export function astraLineFor(e) {
  switch (e?.type) {
    case 'module-built': {
      const line = Object.hasOwn(MODULE_LINES, e.module) ? MODULE_LINES[e.module] : { message: `${ROOMS[e.module]?.name ?? 'A new module'} is online, Commander!` };
      return { id: `built-${e.module}`, mood: 'cheerful', once: true, ...line };
    }
    case 'drone-awake':
      return { id: `awake-${e.drone}`, mood: 'cheerful', once: true, message: `${e.name} is awake! It will help the crew build. Now choose a module to finish — I suggest Battery & Heating first, so we stay warm tonight.` };
    case 'project-done':
      return { id: `project-${e.project}`, mood: 'cheerful', once: true, message: `Upgrade finished: ${e.title}. Nice work, Commander!` };
    case 'storm-warning':
      return { id: `storm-warning-${e.storm}`, mood: 'alert', message: 'Solar storm warning, Commander! Give the shelter order: everyone underground. Our roof of Martian soil will keep the crew safe.' };
    case 'storm-end':
      return e.sheltered
        ? { id: `storm-end-${e.storm}`, mood: 'cheerful', message: 'The solar storm has passed, and everyone stayed safe under the soil. Well done!' }
        : { id: `storm-end-${e.storm}`, mood: 'calm', message: `The solar storm has passed. ${e.maxDoseName} was caught above ground and took some extra radiation. Next time, let us get everyone below sooner.` };
    case 'dust-storm-start':
      return { id: 'dust-storm', mood: 'alert', message: 'Dust storm, Commander! Sunlight on our panels is much weaker. I will switch off what we can spare: the lab first, life support last.' };
    case 'dust-devil':
      return { id: 'dust-devil', mood: 'curious', once: true, message: 'Look! A dust devil just swept our solar panels clean — free of charge.', fact: fact(PROVENANCE.NASA, 'Wind really did blow dust off the solar panels of the Spirit and Opportunity rovers.') };
    case 'emergency':
      return Object.hasOwn(EMERGENCY_LINES, e.kind) ? { id: `emergency-${e.kind}`, mood: 'alert', message: EMERGENCY_LINES[e.kind] } : null;
    case 'dose-warning':
      return { id: `dose-warning-${e.crew}`, mood: 'alert', once: true, message: `${e.name} has used most of the radiation budget for this mission. More time underground, less time outside.` };
    case 'crew-grounded':
      return { id: `grounded-${e.crew}`, mood: 'calm', once: true, message: `${e.name} has reached the radiation limit for this mission. The flight doctor says: rest indoors from now on.` };
    case 'hint':
      return { id: `hint-${e.id}`, mood: 'curious', once: true, message: e.text };
    case 'level-complete':
      return { id: 'level-complete', mood: 'cheerful', message: 'Mission complete, Commander! Let us look at how we did.' };
    case 'level-failed':
      return { id: 'level-failed', mood: 'calm', message: 'We have to call the mission off and bring the crew home safely. Every astronaut learns from a hard day — let us try again.' };
    default:
      return null;
  }
}

/** Convenience: feed a batch of simulation events to the guide. */
export function hearEvents(guide, events) {
  for (const e of events) say(guide, astraLineFor(e));
  return guide;
}
