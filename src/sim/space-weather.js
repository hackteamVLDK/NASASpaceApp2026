/**
 * Solar storms (solar particle events, SPE).
 *
 * WHEN storms happen can come from real NASA data: the DONKI catalogue of solar energetic
 * particle detections (src/data/nasa/donki-sep-2024.js). HOW STRONG a storm is on the
 * Martian surface is a game value chosen from STORM_CLASSES — the DONKI spacecraft are not
 * at Mars, so the catalogue cannot tell us that. Each storm object says which is which.
 */
import { STORM_CLASSES, TUNING, EARTH_HOURS_PER_SIM_MINUTE, SOL_MINUTES, SOL_SECONDS } from './constants.js';
import { PROVENANCE } from '../data/nasa/reference.js';
import { has } from './util.js';

const SIM_MINUTE_SECONDS = SOL_SECONDS / SOL_MINUTES;

/** Length of a storm of the given class, in simulation minutes. */
export function stormDurationMinutes(stormClass) {
  return Math.round(STORM_CLASSES[stormClass].hours / EARTH_HOURS_PER_SIM_MINUTE);
}

/**
 * Surface dose rate of one storm at a given mission minute, in mSv per Earth hour.
 * Triangular profile: quick rise, slow decay. Its area is exactly the class total dose.
 */
export function stormRateMsvPerHour(storm, minute) {
  const span = storm.endMinute - storm.startMinute;
  const u = (minute - storm.startMinute) / span;
  if (!(u >= 0 && u < 1) || !has(STORM_CLASSES, storm.class)) return 0;
  const cls = STORM_CLASSES[storm.class];
  const peak = (2 * cls.surfaceDoseMsv) / cls.hours;
  const rise = TUNING.stormRiseFraction;
  return peak * (u < rise ? u / rise : (1 - u) / (1 - rise));
}

/**
 * Game class for one calendar day of DONKI detections.
 * Rule (gameplay): the more energetic the particles seen that day, the stronger the game storm.
 * GOES ">100 MeV" protons are the ones that get through spacecraft walls and thin shields.
 */
export function classifyDetections(instruments) {
  if (instruments.some((name) => />\s*100 MeV/.test(name))) return 'strong';
  if (instruments.some((name) => />\s*10 MeV/.test(name))) return 'moderate';
  return 'minor';
}

/**
 * Turn the DONKI catalogue into game storms for a mission window.
 * Detections on the same UTC day are one storm, starting at the first detection.
 * @param dataset the default export of src/data/nasa/donki-sep-2024.js
 * @param {{ startDateUtc: string, sols: number }} window mission minute 0 is 00:00 on startDateUtc
 */
export function stormsFromDonki(dataset, { startDateUtc, sols }) {
  const t0 = Date.parse(startDateUtc);
  if (Number.isNaN(t0)) throw new Error(`invalid startDateUtc: ${startDateUtc}`);
  const byDay = new Map();
  for (const event of dataset.events) {
    const day = event.time.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(event);
  }
  const storms = [];
  for (const [day, events] of byDay) {
    const first = events.reduce((a, b) => (a.time < b.time ? a : b));
    const startMinute = Math.round((Date.parse(first.time) - t0) / 1000 / SIM_MINUTE_SECONDS);
    if (startMinute < 0 || startMinute >= sols * SOL_MINUTES) continue;
    const instruments = [...new Set(events.flatMap((e) => e.instruments))];
    const stormClass = classifyDetections(instruments);
    storms.push(
      makeStorm({
        id: `donki-${day}`,
        startMinute,
        class: stormClass,
        label: `Solar storm (scenario from ${niceDate(day)})`,
        about: `Game scenario. On ${niceDate(day)} spacecraft near Earth really did detect a burst of solar particles (NASA DONKI). The game imagines that burst arriving at Mars at the same moment; whether it reached Mars, and how strongly, is not in the data.`,
        timing: {
          provenance: PROVENANCE.NASA,
          source: dataset.source,
          note: 'Time of the first detection near Earth. Using it as the arrival time at Mars is a game assumption.',
          detections: events.length,
          instruments,
          firstDetectionUtc: first.time,
          link: first.link,
        },
        strength: { provenance: PROVENANCE.GAME, note: 'Strength at Mars is a game value. These detections were made near Earth, not at Mars.' },
      }),
    );
  }
  return storms.sort((a, b) => a.startMinute - b.startMinute);
}

/** Mission minute of a UTC timestamp, when mission minute 0 is 00:00 on startDateUtc. */
export function minuteFromUtc(utc, startDateUtc) {
  const t = Date.parse(utc);
  const t0 = Date.parse(startDateUtc);
  if (Number.isNaN(t) || Number.isNaN(t0)) throw new Error(`invalid UTC time: ${utc} / ${startDateUtc}`);
  return Math.round((t - t0) / 1000 / SIM_MINUTE_SECONDS);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2024-05-09" -> "9 May 2024" */
export function niceDate(isoDay) {
  const [y, m, d] = isoDay.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Build a storm object with its end time filled in. */
export function makeStorm({ id, startMinute, class: stormClass, label, about, timing, strength }) {
  if (!has(STORM_CLASSES, stormClass)) throw new Error(`unknown storm class: ${stormClass}`);
  return {
    id,
    class: stormClass,
    label: label || STORM_CLASSES[stormClass].label,
    about: about || 'Scripted for this level: a game scenario, not a real event.',
    startMinute,
    endMinute: startMinute + stormDurationMinutes(stormClass),
    status: 'pending', // pending -> warned -> active -> done
    timing: timing || { provenance: PROVENANCE.GAME, note: 'Scripted for this level.' },
    strength: strength || { provenance: STORM_CLASSES[stormClass].tag, note: STORM_CLASSES[stormClass].note },
  };
}

/** Mission minute for "sol N at HH:00" (sol 1 starts at minute 0). */
export function minuteAt(sol, hour = 0, minute = 0) {
  return (sol - 1) * SOL_MINUTES + hour * 60 + minute;
}
