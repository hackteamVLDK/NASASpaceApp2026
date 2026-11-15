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
import { t } from './strings.js';

export const ASTRA = Object.freeze({
  name: 'ASTRA 6.7',
  role: 'onboard station AI',
  badge: 'ASTRA 6.7 // STATION AI',
  component: 'AstraGuidePanel',
  props: Object.freeze(['isOpen', 'lineId', 'mood', 'onClose']),
  panel: Object.freeze({ side: 'left', leftPx: 24, bottomPx: 24, widthPx: 360, text: 'typewriter' }),
  buttons: Object.freeze({ next: 'Next', done: 'Got it' }),
  avatar: 'animated holographic portrait: cyan/amber waveforms or a friendly geometric AI core, animating while she speaks',
  /** PROPOSAL: the scenario has a `mood` prop but does not list its values. */
  moods: Object.freeze(['cheerful', 'calm', 'curious', 'alert']),
});

// ---------------------------------------------------------------- guide state (a small queue)

// gameplay: presentation pacing, not simulation time or a Mars measurement.
export const PLAY_HOLD_MS = 12_000;
export const ASTRA_POPUP_INTERVAL_MS = 20_000;
export const TOAST_INTERVAL_MS = 6_000;
export const isUrgentLine = (line) => line.mood === 'alert'
  || /^(astra\.(lives\.|res\.|flare|hp\.|tut\.)|astra\.intro\.status$)/.test(line.lineId ?? line.id ?? '');
export const isLowValueLine = (line) => !isUrgentLine(line) && (
  /^astra\..*\.fact[^.]*|^astra\.(char\.|logbook\.|badge\.)|^astra\.act\d+\.title$/.test(line.lineId ?? line.id ?? '')
  || /(?:fact.*(?:science )?logbook|(?:science )?logbook.*fact)/i.test(line.message ?? ''));

/** Raw compatibility messages keep their first sentence, including decimal numbers. */
export const firstSentence = (message) => message.match(/^.*?[.!?](?=\s|$)/s)?.[0] ?? message;
export const canShowToast = (nowMs, lastMs) => nowMs - lastMs >= TOAST_INTERVAL_MS;

/** Promote only into an empty panel. Undismissed play lines stay as long as needed. */
export function advanceGuide(guide, nowMs = guide.nowMs) {
  guide.nowMs = nowMs;
  if (guide.current || !guide.queue.length) return guide;
  const next = guide.queue[0];
  if (!guide.auto && !isUrgentLine(next)
      && nowMs - guide.lastShownAt < Math.max(PLAY_HOLD_MS, ASTRA_POPUP_INTERVAL_MS)) return guide;
  guide.current = guide.queue.shift();
  guide.lastShownAt = nowMs;
  return guide;
}

/** A fresh guide: closed, nothing queued. */
export function createGuide() {
  return { current: null, queue: [], said: [], history: [], nowMs: 0, lastShownAt: -Infinity, auto: false };
}

/** Archive card/radio text without scheduling another popup. */
export function rememberLine(guide, lineId) {
  if (!guide.history.some((entry) => entry.id === lineId)) {
    guide.history.push({ id: lineId, lineId, message: t(lineId), mood: 'calm' });
  }
}

/**
 * Ask ASTRA to say something. If she is already talking, it waits its turn.
 * A line is either a `lineId` (text comes from strings.js, SCENARIO rule: IDs, not raw text)
 * or, for the event lines below that are not in the scenario yet, a `message` with its own `id`.
 * @param line {{ id?: string, lineId?: string, message?: string, mood?: string, once?: boolean, button?: string }}
 *   `once` lines are never repeated in the same game.
 */
export function say(guide, line) {
  if (!line) return guide;
  const id = line.lineId ?? line.id;
  const message = line.lineId ? t(line.lineId) : line.message;
  if (!id || typeof message !== 'string' || !message) return guide;
  if (line.once && guide.said.includes(id)) return guide;
  if (guide.current?.id === id || guide.queue.some((entry) => entry.id === id)) return guide;
  const mood = ASTRA.moods.includes(line.mood) ? line.mood : 'calm';
  const entry = { id, lineId: line.lineId ?? null, message, mood, button: line.button || ASTRA.buttons.done };
  if (line.fact) entry.fact = line.fact;
  if (!guide.said.includes(id)) guide.said.push(id);
  if (!guide.history.some((item) => item.id === id)) guide.history.push(entry);
  if ((guide.current || guide.queue.length || guide.nowMs - guide.lastShownAt < ASTRA_POPUP_INTERVAL_MS) && isLowValueLine(entry)) return guide;
  if (isUrgentLine(entry)) {
    const before = guide.queue.findIndex((item) => !isUrgentLine(item));
    guide.queue.splice(before < 0 ? guide.queue.length : before, 0, entry);
  } else guide.queue.push(entry);
  return advanceGuide(guide);
}

/** The player dismissed the panel: show the next queued line, or slide out. */
export function dismiss(guide) {
  guide.current = null;
  return advanceGuide(guide);
}

/** Props for <AstraGuidePanel>, exactly as named in the scenario: { isOpen, lineId, mood, onClose }. */
export function guideProps(guide, onClose = () => {}) {
  return {
    isOpen: guide.current !== null,
    lineId: guide.current ? guide.current.id : '',
    mood: guide.current ? guide.current.mood : 'calm',
    onClose,
  };
}

/** The text the panel types out for the current line (resolved from the line ID). */
export const currentMessage = (guide) => (guide.current ? guide.current.message : '');

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
