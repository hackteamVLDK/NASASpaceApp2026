/**
 * Base systems: electricity, oxygen, water, food, and the slow wear of the hardware.
 * All functions advance the state by one simulation minute.
 */
import { TUNING, EARTH_HOURS_PER_SIM_MINUTE, EARTH_DAYS_PER_SIM_MINUTE, SOL_MINUTES } from './constants.js';

/** Sunlight on the panels, 0 at night to 1 at local noon. */
export function sunFactor(hourFloat) {
  const { sunriseHour: rise, sunsetHour: set } = TUNING;
  if (hourFloat <= rise || hourFloat >= set) return 0;
  return Math.sin((Math.PI * (hourFloat - rise)) / (set - rise));
}

/**
 * Electricity for one minute.
 *
 * The energy on hand is what the panels make this minute plus what the battery holds.
 * Basic life support (air circulation, heating, radio) is always served first; if even
 * that cannot be powered, the base is in blackout.
 *
 * Every other system has a battery reserve level and is switched off ("load shedding")
 * whenever running it would take the battery below that level. The lab stops first, then
 * the greenhouse lights, then the water recycler, then the oxygen generator. This keeps
 * the last part of the battery for heating and air through the night, and it means a
 * drained battery recharges before the optional systems come back.
 *
 * Exception: when the oxygen tank (or the water tank) is nearly empty, the oxygen generator
 * (or the recycler) ignores its reserve and runs on whatever energy is left.
 *
 * Must be called after the crew have decided what they are doing this minute, so that the
 * lab draws power in exactly the minutes someone works in it.
 */
export function stepPower(state, clock) {
  const T = TUNING;
  const sys = state.systems;
  const res = state.resources;
  const hours = EARTH_HOURS_PER_SIM_MINUTE;
  const dust = state.env.dustStorm;

  const genKw = T.solarPeakKw * (state.projects.solarExpansion?.status === 'done' ? T.solarExpansionFactor : 1) * sunFactor(clock.hourFloat) * sys.solarClean * (dust ? dust.solarFactor : 1);

  const labInUse = state.crew.some((c) => c.activity === 'work' && c.job === 'research' && c.location === 'lab');
  const o2Wanted = res.o2Kg < T.o2TankKg && res.waterL > 0;
  // When air or water is nearly gone, that system stops respecting its battery reserve:
  // there is no point saving power for the night if nobody can breathe until then.
  const o2Critical = res.o2Kg < T.o2CriticalKg;
  const waterCritical = res.waterL < T.waterCriticalL;
  // [name, kW wanted, battery fraction that must remain after serving it]
  const loads = [
    ['base', T.baseLoadKw + (clock.isDay ? T.heatingDayKw : T.heatingNightKw), 0],
    ['o2gen', o2Wanted ? T.o2GenKw : 0, o2Critical ? 0 : T.reserveO2gen],
    ['recycler', T.recyclerKw, waterCritical ? 0 : T.reserveRecycler],
    ['greenhouse', T.greenhouseKw, T.reserveGreenhouse],
    ['lab', labInUse ? T.labKw : 0, T.reserveLab],
  ];

  let energy = genKw * hours + res.batteryKwh; // kWh on hand during this minute
  const powered = {};
  const shed = [];
  let loadKw = 0;
  let demandKw = 0;
  for (const [name, kw, reserve] of loads) {
    demandKw += kw;
    const need = kw * hours;
    if (energy - need >= reserve * T.batteryKwh) {
      energy -= need;
      loadKw += kw;
      powered[name] = kw > 0 || name === 'base';
    } else {
      powered[name] = false;
      if (kw > 0) shed.push(name);
    }
  }
  res.batteryKwh = Math.min(T.batteryKwh, Math.max(0, energy));
  state.power = { genKw, loadKw, demandKw, powered, shed };
}

/** Oxygen, water, the greenhouse's own growth, and hardware wear, for one minute. */
export function stepLifeSupport(state) {
  const T = TUNING;
  const sys = state.systems;
  const res = state.resources;
  const powered = state.power.powered;
  const crew = state.crew.length;
  const perSol = 1 / SOL_MINUTES;

  // Oxygen: the generator splits water to make it; then the crew breathe.
  // If the tank cannot cover a minute of breathing, `shortfall.o2` is the missing fraction:
  // an empty tank with the generator covering 95% of demand is thin air, not vacuum.
  const breathed = crew * T.o2KgPerCrewDay * EARTH_DAYS_PER_SIM_MINUTE;
  if (powered.o2gen) {
    const make = Math.max(0, Math.min(T.o2GenKgPerSol * perSol * sys.o2GenEff, T.o2TankKg + breathed - res.o2Kg, res.waterL / T.electrolysisWaterPerO2));
    res.o2Kg += make;
    res.waterL -= make * T.electrolysisWaterPerO2;
  }
  const o2Got = Math.min(res.o2Kg, breathed);
  res.o2Kg -= o2Got;

  // Water: used by the crew, mostly won back by the recycler when it has power.
  // What the crew can drink this minute is what is in the tank plus what was just recovered.
  const used = crew * T.waterLPerCrewDay * EARTH_DAYS_PER_SIM_MINUTE;
  const recovered = powered.recycler ? T.waterRecoveryMax * sys.recyclerEff : 0;
  const waterGot = Math.min(used, Math.max(0, res.waterL) + used * recovered);
  res.waterL -= used * (1 - recovered);
  state.shortfall = { o2: 1 - o2Got / breathed, water: 1 - waterGot / used };

  // Greenhouse: grows a little by itself when lit and watered.
  if (powered.greenhouse && res.waterL > 0) {
    const grown = T.cropBaseKgPerSol * perSol;
    res.foodKg += grown;
    res.o2Kg += grown * T.cropO2PerKgFood;
    res.waterL -= T.cropWaterLPerSol * perSol;
    state.stats.foodGrownKg += grown;
  }

  // Wear and dust.
  sys.o2GenEff = Math.max(T.minEfficiency, sys.o2GenEff - T.wearPerSol * perSol);
  sys.recyclerEff = Math.max(T.minEfficiency, sys.recyclerEff - T.wearPerSol * perSol);
  const dustRate = T.dustLossPerSol * (state.env.dustStorm ? state.env.dustStorm.dustFactor : 1);
  sys.solarClean = Math.max(T.minSolarClean, sys.solarClean - dustRate * perSol);

  res.o2Kg = Math.min(T.o2TankKg, Math.max(0, res.o2Kg));
  res.waterL = Math.min(T.waterTankL, Math.max(0, res.waterL));
  res.foodKg = Math.min(T.foodStoreKg, Math.max(0, res.foodKg));
}

/**
 * Update the shortage flags and the emergency count.
 *
 * `state.alerts` is the situation this very minute (it drives crew health and morale).
 * `state.emergencies` tracks episodes: a shortage opens an emergency, and the emergency
 * only closes once the shortage has stayed away for emergencyGraceMinutes. Power that
 * flickers on and off at dawn is therefore one emergency, not thirty.
 */
export function updateAlerts(state, events) {
  const res = state.resources;
  const now = {
    noO2: res.o2Kg <= 0,
    noWater: res.waterL <= 0,
    noFood: res.foodKg < TUNING.foodEmergencyKg,
    blackout: state.power.powered.base === false,
  };
  for (const key of Object.keys(now)) {
    const episode = state.emergencies[key];
    if (now[key]) {
      if (!episode.open) {
        episode.open = true;
        state.stats.emergencies += 1;
        events.push({ type: 'emergency', kind: key });
      }
      episode.clearMinutes = 0;
    } else if (episode.open) {
      episode.clearMinutes += 1;
      if (episode.clearMinutes >= TUNING.emergencyGraceMinutes) {
        episode.open = false;
        events.push({ type: 'emergency-over', kind: key });
      }
    }
  }
  state.alerts = now;
}

/** How long the reserves last at the current rate of use, for the gauges. */
export function reserves(state) {
  const T = TUNING;
  const crew = state.crew.length;
  const solFactor = EARTH_DAYS_PER_SIM_MINUTE * SOL_MINUTES;
  const res = state.resources;
  return {
    o2Sols: res.o2Kg / (crew * T.o2KgPerCrewDay * solFactor),
    foodSols: res.foodKg / (crew * T.foodKgPerCrewDay * solFactor),
    waterSolsWithoutRecycling: res.waterL / (crew * T.waterLPerCrewDay * solFactor),
    batteryHoursAtCurrentLoad: state.power.demandKw > 0 ? res.batteryKwh / state.power.demandKw : Infinity,
  };
}
