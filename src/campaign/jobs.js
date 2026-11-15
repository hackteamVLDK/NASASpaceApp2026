/**
 * Optional Commander jobs, separate from the base's repair/prep tasks.
 * Integration: merge jobFields() into new/migrated states, route jobCommand first,
 * call stepJobs each minute, and apply jobBuildMult to drone builds/upgrades only.
 * All new tuning stays here because this delegation owns only this module and its tests.
 */
import { CAP, ITEMS, MODULES, SOL } from './data.js';
import { clockAt, isNight, online } from './util.js';
import { nextRandom } from '../sim/rng.js';

const HOURS_PER_SOL = 24; // gameplay: the campaign's clock convention, not the length of a real Mars day
const HOUR = SOL / HOURS_PER_SOL;
const PERCENT = 100; // unit conversion for reward labels
const REWARD_DECIMALS = 2; // gameplay: keep reward text short when a nearly-full meter clips a reward
/** Provenance: gameplay. Rewards, limits and timers are pacing choices, never NASA measurements. */
const RULES = Object.freeze({
  winsPerSol: 4, openHours: 2,
  assistProgress: 0.25, assistsPerBuild: 2, assistHours: 3, assistFailHours: 1,
  scrapMin: 4, scrapMax: 8, sampleChance: 0.25, scrapHp: 2, scrapHours: 8,
  food: 8, morale: 2, greenhouseHours: 12,
  research: 6, scanHours: 12,
  buildMult: 1.2, tuneHours: 12, tuneCooldownHours: HOURS_PER_SOL,
});

export const STRINGS = Object.freeze({
  'astra.jobs.intro': 'While the drones build, you can help! Open Jobs and pick one.',
});

/** Fresh independent containers; additional jobStats bookkeeping is filled lazily and is JSON-safe. */
export function jobFields() {
  return { job: null, jobCooldowns: {}, jobStats: { done: 0, assists: 0 } };
}

// Facts are qualitative; reward numbers above are gameplay values.
// NASA: https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/marking-13-years-on-mars-nasas-curiosity-picks-up-new-skills/
const ASSIST_SCIENCE = 'Curiosity uses a robotic arm to study rocks on Mars.';
const JOBS = Object.freeze([
  {
    id: 'scrap_hunt', title: 'Find useful scrap',
    text: `Look near old landers and crates. Going outside costs ${RULES.scrapHp} HP.`,
    // NASA: https://www.nasa.gov/science-research/heliophysics/real-martians-how-to-protect-astronauts-from-space-radiation-on-mars/
    science: "Mars's thin air gives less protection from space radiation than Earth's air.",
    game: 'scrap_hunt', reward: `Spare Parts +${RULES.scrapMin} to ${RULES.scrapMax}`, hours: RULES.scrapHours, module: null,
  },
  {
    id: 'tend_greenhouse', title: 'Tend the Greenhouse', text: 'Match nutrients and check the growing lights.',
    // NASA: https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/
    science: 'Space station astronauts have grown lettuce under LED lights.',
    game: 'nutrient_match', reward: `Food +${RULES.food}, Morale +${RULES.morale}`, hours: RULES.greenhouseHours, module: 'greenhouse',
  },
  {
    id: 'sample_scan', title: 'Study a soil sample', text: 'Look closely at a soil sample through the microscope.',
    // NASA: https://science.nasa.gov/mission/msl-curiosity/science-highlights/
    science: 'Mars rovers study rocks to learn about ancient water.',
    game: 'sample_scan', reward: `Research +${RULES.research}`, hours: RULES.scanHours, module: 'lab',
  },
  {
    id: 'drone_tune', title: 'Tune up a drone', text: 'Clean dust from the wheels and joints.',
    // NASA/JPL: https://www-robotics.jpl.nasa.gov/what-we-do/flight-projects/mars-science-laboratory/surface-system-software-and-rover-navigation/
    science: "Sharp Mars rocks have damaged Curiosity's metal wheels.",
    game: 'wheel_vacuum', reward: `Build speed +${Math.round((RULES.buildMult - 1) * PERCENT)}% for ${RULES.tuneHours} h`,
    hours: RULES.tuneCooldownHours, module: 'workshop',
  },
]);

const assistId = (id) => id.startsWith('assist:') ? id.slice('assist:'.length) : null;
function assistTarget(s, id) {
  const m = s.modules[id];
  if (m?.status === 'building') return { key: `${id}:build`, progress: m };
  if (m?.status === 'online' && m.upgrading) return { key: `${id}:upgrade`, progress: m.upgrading };
  return null;
}
const todayWins = (s) => s.jobStats?.winsSol === clockAt(s.minute).sol ? (s.jobStats.winsToday ?? 0) : 0;

function commonBlock(s, resolving) {
  if (s.status !== 'running') return 'The mission is paused or over.';
  if (s.pending) return 'Choose a decision first.';
  if (s.away) return 'The Commander is away.';
  if (s.medRest) return 'Rest in the Bedroom first.';
  if (s.job && !resolving) return 'Finish the open job first.';
  if (todayWins(s) >= RULES.winsPerSol) return `${RULES.winsPerSol} jobs won this Sol. More next Sol!`;
  return null;
}

function jobBlock(s, offer, resolving = false) {
  const common = commonBlock(s, resolving);
  if (common) return common;
  const left = (s.jobCooldowns?.[offer.id] ?? 0) - s.minute;
  if (left > 0) return `Ready in ${Math.ceil(left / HOUR)} h`;
  const module = assistId(offer.id);
  if (module !== null) {
    const target = assistTarget(s, module);
    if (!target) return 'The drones have finished this job.';
    if (target.progress.progress >= 1) return 'The drones are finishing.';
    if ((s.jobStats?.assistCounts?.[target.key] ?? 0) >= RULES.assistsPerBuild) return 'Already helped twice. Let the drones finish!';
  }
  if (offer.id === 'scrap_hunt') {
    if (s.storm) return 'Wait for the dust storm to pass.';
    if (s.flags?.flare) return 'Wait for the solar flare to pass.';
    if (isNight(clockAt(s.minute).hourFloat)) return 'Too dark outside';
  }
  if (offer.id === 'drone_tune' && !s.drones.some((d) => d.status === 'awake')) return 'Wake a drone first.';
  return null;
}

/** Read-only board. `hours` is the cooldown in game hours; `module` is the relevant room or null. */
export function jobBoard(s) {
  const assists = Object.keys(MODULES).filter((id) => assistTarget(s, id)).map((module) => ({
    id: `assist:${module}`, title: 'Help the drones', text: 'Tighten bolts to help finish this room.',
    science: ASSIST_SCIENCE, game: 'bolt_sprint', reward: `Build +${RULES.assistProgress * PERCENT}%`,
    hours: RULES.assistHours, module,
  }));
  const visible = JOBS.filter((job) => !job.module || online(s, job.module));
  return [...assists, ...visible].map((job) => ({ ...job, block: jobBlock(s, job) }));
}

function clearJob(s) {
  s.job = null;
  if (s.jobStats) delete s.jobStats.assistTarget;
}

/** Returns null for commands belonging to another subsystem. Emits events through the supplied callback. */
export function jobCommand(s, cmd, emit) {
  if (cmd?.type !== 'startJob' && cmd?.type !== 'jobResult') return null;
  const fail = (error) => ({ ok: false, error });
  if (typeof cmd.job !== 'string') return fail('Choose a job from the board.');
  if (cmd.type === 'jobResult') {
    if (!s.job || s.job.id !== cmd.job) return fail('That job is not open.');
    if (typeof cmd.win !== 'boolean') return fail('The job result must say whether you won.');
    if (s.minute - s.job.minute > RULES.openHours * HOUR) {
      clearJob(s);
      return fail('That job timed out. Pick another job.');
    }
  }
  const offer = jobBoard(s).find((job) => job.id === cmd.job);
  if (!offer) {
    if (cmd.type === 'jobResult') clearJob(s);
    return fail('That job is not available.');
  }
  const resolving = cmd.type === 'jobResult';
  const block = jobBlock(s, offer, resolving);
  const module = assistId(cmd.job);
  const target = module !== null ? assistTarget(s, module) : null;
  if (block || (resolving && target && target.key !== s.jobStats?.assistTarget)) {
    if (resolving) clearJob(s);
    return fail(block ?? 'That build has already finished.');
  }
  s.jobStats ??= { done: 0, assists: 0 };
  s.jobCooldowns ??= {};
  if (!resolving) {
    s.job = { id: offer.id, game: offer.game, minute: s.minute };
    if (target) s.jobStats.assistTarget = target.key;
    // The outing costs HP even on a failed or abandoned hunt; no free surface trips.
    if (offer.id === 'scrap_hunt') s.hp = Math.max(0, s.hp - RULES.scrapHp);
    emit({ type: 'job-start', job: offer.id, game: offer.game });
    return { ok: true };
  }

  let reward = 'Good try! No reward this time.';
  if (cmd.win) {
    reward = applyReward(s, offer, target);
    s.jobStats.done += 1;
    const sol = clockAt(s.minute).sol;
    s.jobStats.winsToday = (s.jobStats.winsSol === sol ? s.jobStats.winsToday : 0) + 1;
    s.jobStats.winsSol = sol;
  }
  const hours = target && !cmd.win ? RULES.assistFailHours : offer.hours;
  s.jobCooldowns[offer.id] = s.minute + hours * HOUR;
  clearJob(s);
  emit({ type: 'job-done', job: offer.id, win: cmd.win, reward });
  return { ok: true };
}

function addResource(s, key, amount) {
  const before = s.res[key];
  s.res[key] = Math.min(CAP[key], before + amount);
  return Number((s.res[key] - before).toFixed(REWARD_DECIMALS));
}

function applyReward(s, offer, target) {
  if (target) {
    const before = target.progress.progress;
    target.progress.progress = Math.min(1, before + RULES.assistProgress);
    s.jobStats.assistCounts ??= {};
    s.jobStats.assistCounts[target.key] = (s.jobStats.assistCounts[target.key] ?? 0) + 1;
    s.jobStats.assists += 1;
    // The engine owns completion, drone release, story triggers and starting queued work.
    return `Build +${Math.round((target.progress.progress - before) * PERCENT)}%`;
  }
  switch (offer.id) {
    case 'scrap_hunt': {
      const parts = RULES.scrapMin + Math.floor(nextRandom(s) * (RULES.scrapMax - RULES.scrapMin + 1));
      const gained = addResource(s, 'sp', parts);
      const sample = ITEMS.includes('mineral_sample') && nextRandom(s) < RULES.sampleChance;
      if (sample) s.items.mineral_sample = (s.items.mineral_sample ?? 0) + 1;
      return `Spare Parts +${gained}${sample ? ', Mineral Sample +1' : ''}`;
    }
    case 'tend_greenhouse': {
      const food = addResource(s, 'food', RULES.food);
      const morale = addResource(s, 'morale', RULES.morale);
      return `Food +${food}, Morale +${morale}`;
    }
    case 'sample_scan': s.research += RULES.research; return offer.reward;
    case 'drone_tune': s.jobStats.tuneUntilMinute = s.minute + RULES.tuneHours * HOUR; return offer.reward;
  }
}

/** `now` may be the engine's clockAt(s.minute) value; absolute timers always use simulation minutes. */
export function stepJobs(s, emit, now) {
  if (s.job && s.minute - s.job.minute > RULES.openHours * HOUR) clearJob(s);
  if (s.status !== 'running' || s.flags?.jobsIntro) return;
  if (!Object.keys(MODULES).some((id) => s.modules[id]?.status === 'building')) return;
  s.flags ??= {};
  s.flags.jobsIntro = true;
  emit({ type: 'astra', lineId: 'astra.jobs.intro', mood: 'cheerful' });
}

/** Temporary drone build/upgrade multiplier. Repeated reads do not mutate state. */
export function jobBuildMult(s) {
  return s.minute < (s.jobStats?.tuneUntilMinute ?? 0) ? RULES.buildMult : 1;
}
