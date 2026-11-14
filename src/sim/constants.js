/**
 * Every tunable number of the simulation, in one place, each with a provenance tag.
 *
 *   nasa-measurement  a value measured or published by NASA (see src/data/nasa/reference.js)
 *   approximation     a scientifically motivated simplification of a real relationship
 *   gameplay          chosen for pacing and fun; not a claim about Mars
 *
 * TUNING holds plain numbers so the simulation code stays readable.
 * TUNING_PROVENANCE must have one entry per TUNING key (enforced by tests/constants.test.mjs).
 */
import { NASA, PROVENANCE } from '../data/nasa/reference.js';

const { NASA: N, APPROX: A, GAME: G } = PROVENANCE;

// ---------------------------------------------------------------- time

/** Mars-clock minutes in one sol. The game clock divides a sol into 24 Mars-hours of 60 Mars-minutes. */
export const SOL_MINUTES = 1440;
export const SOL_SECONDS = NASA.solSeconds.value;
/** One simulation minute is slightly longer than an Earth minute, because a sol is longer than a day. */
export const EARTH_HOURS_PER_SIM_MINUTE = SOL_SECONDS / SOL_MINUTES / 3600;
export const EARTH_DAYS_PER_SIM_MINUTE = SOL_SECONDS / SOL_MINUTES / 86400;

// ---------------------------------------------------------------- tuning

export const TUNING = {
  // Crew metabolism
  o2KgPerCrewDay: NASA.crewOxygenPerDay.value,
  waterLPerCrewDay: NASA.crewWaterPerDay.value,
  foodKgPerCrewDay: NASA.crewFoodPerDay.value,
  waterRecoveryMax: NASA.waterRecovery.value,
  electrolysisWaterPerO2: 1.125,

  // Storage capacities
  o2TankKg: 30,
  waterTankL: 400,
  foodStoreKg: 150,
  batteryKwh: 260,

  // Life-support hardware
  o2GenKgPerSol: 4.6,
  o2GenKw: 2.5,
  recyclerKw: 1.0,
  wearPerSol: 0.12,
  maintenancePerHour: 0.02,
  minEfficiency: 0.2,

  // Power
  solarPeakKw: 48,
  solarExpansionFactor: 1.25,
  dustLossPerSol: 0.03,
  dustCleanPerHour: 0.04,
  minSolarClean: 0.2,
  dustDevilCleaning: 0.25,
  baseLoadKw: 2.5,
  heatingDayKw: 1.5,
  heatingNightKw: 2.5,
  greenhouseKw: 3.0,
  labKw: 1.5,
  reserveO2gen: 0.25,
  reserveRecycler: 0.28,
  reserveGreenhouse: 0.32,
  reserveLab: 0.4,
  o2CriticalKg: 3,
  waterCriticalL: 20,
  emergencyGraceMinutes: 120,
  foodEmergencyKg: 0.5,
  sunriseHour: 6,
  sunsetHour: 18,

  // Greenhouse
  cropBaseKgPerSol: 0.5,
  cropKgPerWorkHour: 0.15,
  cropO2PerKgFood: 0.3,
  cropWaterLPerSol: 2.0,

  // Work output
  iceLPerWorkHour: 5,
  scienceEvaPerHour: 1.2,
  scienceLabPerHour: 0.8,
  skillBonus: 1.5,
  commanderBonus: 1.2,
  workFloor: 0.4,

  // Crew needs (per simulation minute, on 0..100 scales)
  energyDrainPerMin: 0.09,
  evaEnergyFactor: 1.3,
  evaEndHour: 15,
  sleepGainPerMin: 0.21,
  shelterSleepFactor: 0.6,
  forcedSleepBelow: 8,
  forcedSleepUntil: 40,
  nutritionDrainPerMin: 0.05,
  mealMinutes: 30,
  mealGainPerMin: 0.85,
  fitnessDrainPerMin: 0.007,
  exerciseGainPerMin: 0.35,
  moraleRatePerMin: 0.002,
  healthRecoverPerMin: 0.01,
  healthNoO2PerMin: 1.0,
  healthNoWaterPerMin: 0.1,
  healthStarvingPerMin: 0.03,
  healthExhaustedPerMin: 0.02,
  healthUnfitPerMin: 0.01,
  healthColdPerMin: 0.02,

  // Radiation environment and shielding
  gcrSurfaceMsvPerDay: NASA.gcrSurfaceDoseEquivalent.value,
  gcrAttenuationGcm2: 180,
  gcrBuildupStrength: 0.15,
  gcrBuildupDepthGcm2: 40,
  gcrResidualFraction: 0.02,
  speAttenuationGcm2: 40,
  rockBackgroundMsvPerDay: 0.002,
  doseWarningFraction: 0.7,
  stormShelteredMsv: 0.2,
  stormRiseFraction: 0.2,
};

const p = (tag, note) => ({ tag, note });

export const TUNING_PROVENANCE = {
  o2KgPerCrewDay: p(N, NASA.crewOxygenPerDay.source),
  waterLPerCrewDay: p(N, NASA.crewWaterPerDay.source),
  foodKgPerCrewDay: p(N, NASA.crewFoodPerDay.source),
  waterRecoveryMax: p(N, NASA.waterRecovery.source),
  electrolysisWaterPerO2: p(A, 'Chemistry of water electrolysis: 36 g of water gives 32 g of oxygen. Ignores hydrogen reuse (Sabatier), which the ISS uses to win some water back.'),

  o2TankKg: p(G, 'Reserve of roughly a week for four people.'),
  waterTankL: p(G, 'Tank size chosen so that ice mining matters.'),
  foodStoreKg: p(G, 'Pantry size.'),
  batteryKwh: p(G, 'Enough to carry the base through one night with a small margin.'),

  o2GenKgPerSol: p(G, 'Sized to cover four people with about 30% margin when fully maintained.'),
  o2GenKw: p(G, 'Electrolysis power draw, right order of magnitude for an ISS-class oxygen generator.'),
  recyclerKw: p(G, 'Water processor power draw.'),
  wearPerSol: p(G, 'Life-support hardware loses efficiency without maintenance. Real hardware wears far more slowly; accelerated so maintenance is a daily decision.'),
  maintenancePerHour: p(G, 'Efficiency restored per hour of maintenance work.'),
  minEfficiency: p(G, 'Neglected hardware limps along rather than stopping completely.'),

  solarPeakKw: p(G, 'Tens of kilowatts, the scale NASA surface-power studies assume for a small crewed outpost.'),
  solarExpansionFactor: p(G, 'Extra array adds a quarter more power.'),
  dustLossPerSol: p(G, `About ten times faster than the real ${NASA.pathfinderDustLossPerSol.value}% per sol measured by Mars Pathfinder, so that dust matters within one level.`),
  dustCleanPerHour: p(G, 'Panel cleanliness restored per hour of cleaning on EVA.'),
  minSolarClean: p(G, 'Even filthy panels make some power.'),
  dustDevilCleaning: p(A, 'Wind "cleaning events" really did restore power on the Spirit and Opportunity rovers; the amount here is illustrative.'),
  baseLoadKw: p(G, 'Air circulation, pumps, computers, lights, radio.'),
  heatingDayKw: p(G, 'Heating by day.'),
  heatingNightKw: p(G, 'Heating by night: Mars nights are far below freezing, so heating costs more.'),
  greenhouseKw: p(G, 'Grow lights and climate control.'),
  labKw: p(G, 'Lab instruments, only while someone is using them.'),
  reserveO2gen: p(G, 'Below 25% battery the oxygen generator waits, so the last quarter of the battery is kept for air circulation and heating through the night. The oxygen tank covers the gap.'),
  reserveRecycler: p(G, 'Battery level below which the water recycler waits.'),
  reserveGreenhouse: p(G, 'Battery level below which the greenhouse lights go off.'),
  reserveLab: p(G, 'Battery level below which the lab is switched off: science is the first thing to wait.'),
  foodEmergencyKg: p(G, 'Less than half a kilogram in the pantry counts as out of food: the greenhouse trickle alone cannot feed four people.'),
  o2CriticalKg: p(G, 'With less than about a sol of air left, the oxygen generator ignores its battery reserve: breathing comes before saving power.'),
  waterCriticalL: p(G, 'With this little water left, the recycler ignores its battery reserve.'),
  emergencyGraceMinutes: p(G, 'A shortage that comes back within two hours counts as the same emergency, not a new one.'),
  sunriseHour: p(A, 'Equinox at the equator: 12 hours of daylight. Real day length changes with latitude and season.'),
  sunsetHour: p(A, 'See sunriseHour.'),

  cropBaseKgPerSol: p(G, 'What the greenhouse grows on its own, when lit and watered.'),
  cropKgPerWorkHour: p(G, 'Extra harvest from tending the plants. A greenhouse this small supplements packaged food; it cannot replace it.'),
  cropO2PerKgFood: p(A, 'Photosynthesis releases about 1 kg of oxygen per kg of DRY plant matter. Fresh food is mostly water, so per kg of fresh food (counting the inedible parts too) it is roughly 0.3 kg.'),
  cropWaterLPerSol: p(G, 'Net irrigation loss; most transpired water is condensed and reused.'),

  iceLPerWorkHour: p(G, 'Water recovered from icy soil per hour of field work. Real basis: Phoenix found shallow ice in 2008.'),
  scienceEvaPerHour: p(G, 'Science points per hour of field exploration.'),
  scienceLabPerHour: p(G, 'Science points per hour of lab work.'),
  skillBonus: p(G, 'A specialist doing their own job works 50% faster.'),
  commanderBonus: p(G, 'The commander is a generalist: a smaller bonus on every job.'),
  workFloor: p(G, 'Tired, hungry or unhappy crew still get some work done.'),

  energyDrainPerMin: p(G, 'Awake for 16 hours uses most of a full energy bar.'),
  evaEnergyFactor: p(A, 'Working in a pressurised suit is much more tiring than working indoors.'),
  evaEndHour: p(G, 'Outdoor work stops at 15:00 so everyone is home well before dark. Real basis: a spacesuit carries roughly eight hours of life support.'),
  sleepGainPerMin: p(G, 'Eight hours of sleep refills the energy bar.'),
  shelterSleepFactor: p(G, 'Sleep in the cramped shelter is less restful.'),
  forcedSleepBelow: p(G, 'An exhausted astronaut falls asleep whatever the schedule says.'),
  forcedSleepUntil: p(G, 'They wake once partly rested.'),
  nutritionDrainPerMin: p(G, 'Hunger builds much faster than in reality so that food matters within a level.'),
  mealMinutes: p(G, 'Minutes of eating that make one full meal.'),
  mealGainPerMin: p(G, 'Three full meals slightly outpace a sol of hunger.'),
  fitnessDrainPerMin: p(A, `Muscles and bones weaken in low gravity (Mars: ${NASA.surfaceGravity.value} m/s^2). The speed here is exaggerated.`),
  exerciseGainPerMin: p(G, `About half an hour of exercise a sol holds fitness steady. ISS crews do about ${NASA.issExerciseHours.value} hours.`),
  moraleRatePerMin: p(G, 'How quickly mood follows circumstances.'),
  healthRecoverPerMin: p(G, 'Slow recovery when nothing is wrong.'),
  healthNoO2PerMin: p(G, 'No oxygen is an emergency within minutes. Softened to give the player a chance to react.'),
  healthNoWaterPerMin: p(G, 'No water harms health within a sol.'),
  healthStarvingPerMin: p(G, 'Hunger harms health.'),
  healthExhaustedPerMin: p(G, 'Exhaustion harms health.'),
  healthUnfitPerMin: p(G, 'Very low fitness harms health.'),
  healthColdPerMin: p(G, 'A blackout means no heating.'),

  gcrSurfaceMsvPerDay: p(N, NASA.gcrSurfaceDoseEquivalent.source),
  gcrAttenuationGcm2: p(A, 'Cosmic rays are hard to stop: dose falls to about 37% for every 180 g/cm^2 of shielding (about 1.2 m of regolith). Chosen to match published subsurface dose models, where roughly 1 to 1.6 m of regolith is needed to cut the surface dose to about 40%.'),
  gcrBuildupStrength: p(A, 'Thin shielding makes showers of secondary particles, so the first centimetres help little and can make the dose slightly higher.'),
  gcrBuildupDepthGcm2: p(A, 'Depth at which the secondary-particle build-up is strongest.'),
  gcrResidualFraction: p(A, 'Secondary neutrons keep a small cosmic-ray dose even under many metres of rock: never exactly zero.'),
  speAttenuationGcm2: p(A, `Solar storm particles are far easier to stop than cosmic rays. The ones reaching the surface already passed about ${NASA.atmosphereColumnGale.value} g/cm^2 of atmosphere, so they are the energetic ones; dose falls to 37% per 40 g/cm^2.`),
  rockBackgroundMsvPerDay: p(A, 'Natural radioactivity of rock, about what soil gives on Earth. Present everywhere, including deep underground.'),
  doseWarningFraction: p(G, 'Warn the player at 70% of the mission radiation budget.'),
  stormShelteredMsv: p(G, 'A crew member who received less than this from a storm counts as sheltered.'),
  stormRiseFraction: p(A, 'Solar particle events rise quickly and fade slowly; modelled as a triangle peaking 20% of the way through.'),
};

// ---------------------------------------------------------------- solar storm classes

/**
 * Game storm classes. `surfaceDoseMsv` is the total an unshielded person on the surface
 * would receive over the whole event.
 */
export const STORM_CLASSES = {
  minor: { label: 'Minor solar storm', hours: 6, surfaceDoseMsv: 1.5, tag: G, note: 'Small event: a reason to practise, not a danger.' },
  moderate: { label: 'Moderate solar storm', hours: 10, surfaceDoseMsv: 5, tag: G, note: 'Between the 2017 and 2024 events measured by Curiosity.' },
  strong: {
    label: 'Strong solar storm',
    hours: 14,
    surfaceDoseMsv: 12,
    tag: A,
    note: `Calibrated on the storm of 20 May 2024, when Curiosity measured ${NASA.speMay2024AbsorbedDose.value} micrograys (8.1 mGy) on the surface. Converting absorbed dose to dose equivalent with a quality factor near 1.5 gives about 12 mSv.`,
  },
  extreme: { label: 'Extreme solar storm', hours: 18, surfaceDoseMsv: 30, tag: G, note: 'A "what if" larger than anything measured on Mars so far.' },
};

// ---------------------------------------------------------------- shielding materials

/**
 * density in g/cm^3.
 * effectiveness: how well a material stops particles, per g/cm^2, relative to regolith.
 * secondaries:   how many secondary particles it makes when hit, per g/cm^2, relative to regolith.
 *                Heavy nuclei (metal) make more; hydrogen-rich materials make fewer.
 */
export const MATERIALS = {
  regolith: { label: 'Martian regolith', density: 1.5, effectiveness: 1.0, secondaries: 1.0, tag: A, note: 'Loose Martian soil. Bulk density varies from about 1.0 to 1.8 g/cm^3.' },
  water: { label: 'Water', density: 1.0, effectiveness: 1.3, secondaries: 0.6, tag: A, note: 'Hydrogen-rich materials stop particles better per kilogram and make fewer secondaries.' },
  polyethylene: { label: 'Polyethylene', density: 0.95, effectiveness: 1.5, secondaries: 0.5, tag: A, note: 'Plastic rich in hydrogen; used for radiation shielding on the ISS.' },
  aluminum: { label: 'Aluminium hull', density: 2.7, effectiveness: 0.8, secondaries: 1.3, tag: A, note: 'Structural metal. Heavier nuclei make more secondary particles, so it shields less per kilogram.' },
};

// ---------------------------------------------------------------- schedule, jobs, roles

/** Default daily schedule: one activity per Mars-hour. Data, so an editor can change it later. */
export const DEFAULT_SCHEDULE = Object.freeze([
  'sleep', 'sleep', 'sleep', 'sleep', 'sleep', 'sleep', // 00-06
  'meal', // 06
  'work', 'work', 'work', 'work', 'work', // 07-12
  'meal', // 12
  'work', 'work', 'work', 'work', // 13-17
  'exercise', // 17
  'meal', // 18
  'free', 'free', 'free', // 19-22
  'sleep', 'sleep', // 22-24
]);

/** Work assignments. `node` is where the work happens; `skill` is the role that gets the bonus. */
export const JOBS = Object.freeze({
  farm: { label: 'Tend the greenhouse', node: 'greenhouse', skill: 'botanist', eva: false },
  lifesupport: { label: 'Maintain life support', node: 'lifesupport', skill: 'engineer', eva: false },
  solar: { label: 'Clean solar panels (outside)', node: 'outside', skill: 'engineer', eva: true },
  explore: { label: 'Explore and mine ice (outside)', node: 'away', skill: 'scientist', eva: true },
  research: { label: 'Research in the lab', node: 'lab', skill: 'scientist', eva: false },
  build: { label: 'Build the current project', node: null, skill: 'engineer', eva: false },
  rest: { label: 'Off duty', node: 'galley', skill: null, eva: false },
});

export const ROLES = Object.freeze({
  commander: { label: 'Commander' },
  engineer: { label: 'Engineer' },
  botanist: { label: 'Botanist' },
  scientist: { label: 'Scientist' },
});

/**
 * Build projects (base upgrades). `hours` are crew work-hours at `site`.
 * `shielding` layers are added to every room in the listed zones when the project is done.
 */
export const PROJECTS = Object.freeze({
  berm: {
    title: 'Regolith berm over the surface modules',
    site: 'outside',
    hours: 14,
    costs: {},
    shielding: { zones: ['surface'], layer: { material: 'regolith', thicknessM: 0.5 } },
    teaches: 'Soil is a free shield, but piling it up means hours outside in the radiation you are trying to avoid.',
    tag: G,
  },
  waterRoof: {
    title: 'Water-bag roof on the surface modules',
    site: 'greenhouse',
    hours: 4,
    costs: { waterL: 100 },
    shielding: { zones: ['surface'], layer: { material: 'water', thicknessM: 0.25 } },
    teaches: 'Water shields well and is quick to install indoors, but it is the same water you drink and turn into oxygen.',
    tag: G,
  },
  solarExpansion: {
    title: 'Extra solar array',
    site: 'outside',
    hours: 10,
    costs: {},
    teaches: 'More panels mean more power, and more panels to keep clean.',
    tag: G,
  },
  stormWatch: {
    title: 'Storm-watch antenna',
    site: 'command',
    hours: 6,
    costs: {},
    teaches: 'Earlier warning gives the crew time to get underground. NASA watches the Sun around the clock for this reason.',
    tag: G,
  },
});
