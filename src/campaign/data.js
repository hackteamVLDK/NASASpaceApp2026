/**
 * Campaign data: the numbers of SCENARIO.md v2 (Sections 3 and 5) as tables.
 * Every number here is a `gameplay` value unless noted ("starting values for playtesting"),
 * except where the scenario ties it to a real measurement. Change numbers HERE and update
 * SCENARIO.md in the same commit (scenario rule).
 */

export const SOL = 1440; // minutes per Sol
export const SECONDS_PER_SOL = 240; // 1 Sol = 4 real minutes at 1x (SCENARIO 3.1)
export const START_MINUTE = 7 * 60; // Sol 1, 07:00

export const RES = Object.freeze(['power', 'heat', 'water', 'oxygen', 'food', 'morale', 'sp']);
export const START_RES = Object.freeze({ power: 60, heat: 70, water: 80, oxygen: 80, food: 70, morale: 70, sp: 60 });
export const CAP = Object.freeze({ power: 100, heat: 100, water: 100, oxygen: 100, food: 100, morale: 100, sp: 999 });

/** Per-astronaut needs per Sol (3.2). Water: 50 used, 98% recycled. */
export const NEEDS = Object.freeze({ oxygen: -10, food: -6, morale: -2, power: -2, waterUsed: 50 });
export const BASE_HEAT_LOSS = -20;
export const RECYCLER = Object.freeze({ ok: 0.98, cracked: 0.7 });

export const HP = Object.freeze({
  commanderMax: 100,
  sleepPerHour: 1.5,
  radiationPerSol: 20, // x shielding factor
  freshCropsT1: 4, freshCropsT2: 6, highMorale: 2, moraleThreshold: 70,
  medRestHp: 50,
});

/** Shielding factors of rooms (3.6). */
export const SHIELD = Object.freeze({ surface: 1.0, rightBeforeRoof: 0.3, left: 0.05, bedroom: 0.02 });

export const SLEEP_FROM = 22;
export const SLEEP_TO = 6;
export const MEALS = Object.freeze([6, 12, 18]);

/**
 * The six buildable modules plus the roof layer, and the four pre-built ones (3.3).
 * `t1` / `t2`: per-Sol effects while online. `powerCap`: battery capacity.
 * `needs`: unlock rule, see `unlockReason` in engine.js.
 */
export const MODULES = Object.freeze({
  solar: { id: 'solar', nameId: 'ui.module.solar_array.name', wing: 'surface', prebuilt: true, t1: { power: 50 }, t2: { power: 80 } },
  bedroom: { id: 'bedroom', nameId: 'ui.module.bedroom.name', wing: 'left', prebuilt: true, t1: { power: -2, morale: 3 } },
  kitchen: { id: 'kitchen', nameId: 'ui.module.kitchen.name', wing: 'left', prebuilt: true, t1: { power: -4, morale: 2 } },
  lifesupport: { id: 'lifesupport', nameId: 'ui.module.water_and_air_life_support.name', wing: 'left', prebuilt: true, t1: { power: -12, oxygen: 14 }, t2: { power: -14, oxygen: 20 } },
  battery: { id: 'battery', nameId: 'ui.module.battery_and_heating.name', wing: 'right', cost: { sp: 10 }, t1: { power: -6, heat: 25 }, t2: { power: -6, heat: 35 }, powerCap: [250, 400] },
  workshop: { id: 'workshop', nameId: 'ui.module.workshop.name', wing: 'right', cost: { sp: 15 }, t1: { power: -8, sp: 6 }, t2: { power: -10, sp: 10 } },
  greenhouse: { id: 'greenhouse', nameId: 'ui.module.greenhouse.name', wing: 'right', cost: { sp: 15, water: 10 }, t1: { power: -10, food: 10, oxygen: 3, water: -3, morale: 2 }, t2: { power: -12, food: 16, oxygen: 5, water: -4, morale: 2 } },
  garage: { id: 'garage', nameId: 'ui.module.garage_and_airlock.name', wing: 'right', cost: { sp: 15 }, t1: { power: -6 }, t2: { power: -6 } },
  lab: { id: 'lab', nameId: 'ui.module.research_and_comms_lab.name', wing: 'right', cost: { sp: 20, items: { dish_antenna: 1 } }, t1: { power: -10, research: 5 }, t2: { power: -12, research: 8 } },
  recreation: { id: 'recreation', nameId: 'ui.module.recreation_and_storage.name', wing: 'right', cost: { sp: 10 }, t1: { power: -4, morale: 4 }, t2: { power: -4, morale: 6 } },
  roof: { id: 'roof', nameId: 'ui.module.regolith_roof_layer.name', wing: 'right', cost: { sp: 10, items: { titanium_plate: 1 } }, t1: {} },
});

export const BUILD_SOLS = 2; // with one drone (3.1)
export const UPGRADE_SOLS = 0.5;
export const DRONE_BUILD_POWER = -5; // per Sol while a drone builds
export const STORM = Object.freeze({ solarT1: 0.3, solarT2: 0.5, batteryPowerMult: 4 });

/** Floor and column of each room in the cutaway (src/render/world.js reads this). Floors count from 1 at the top. */
export const LAYOUT = Object.freeze({
  groundY: 1050, firstFloorY: 1240, floorHeight: 270, floors: 6,
  leftX: 300, shaftX: 900, rightX: 1020, wingWidth: 600, shaftWidth: 120,
  rooms: {
    bedroom: { wing: 'left', floor: 1 }, kitchen: { wing: 'left', floor: 2 }, lifesupport: { wing: 'left', floor: 3 },
    workshop: { wing: 'right', floor: 1 }, lab: { wing: 'right', floor: 2 }, battery: { wing: 'right', floor: 3 },
    garage: { wing: 'right', floor: 4 }, greenhouse: { wing: 'right', floor: 5 }, recreation: { wing: 'right', floor: 6 },
  },
});

export const ITEMS = Object.freeze([
  'circuit_board', 'titanium_scrap', 'titanium_plate', 'solar_cell', 'ice_core', 'rare_battery_cell', 'probe_power_core',
  'weather_sensor', 'dish_antenna', 'black_box', 'water_filter_membrane', 'lab_sensor_kit', 'mineral_sample',
]);

/**
 * Workshop recipes (5.4). `needs` is a module that must be online. `kind: 'kit'` crafts a
 * one-shot item; `kind: 'rover'/'suit'/'base'` sets a permanent flag.
 */
export const RECIPES = Object.freeze({
  repair_kit: { nameId: 'ui.upgrade.repair_kit.name', kind: 'kit', sp: 10 },
  reboot_kit: { nameId: 'ui.upgrade.reboot_kit.name', kind: 'kit', sp: 10, items: { probe_power_core: 1, circuit_board: 1 } },
  titanium_wheels: { nameId: 'ui.upgrade.titanium_wheels.name', kind: 'rover', sp: 10, items: { titanium_scrap: 2 } },
  deep_ice_drill: { nameId: 'ui.upgrade.deep_ice_drill.name', kind: 'rover', sp: 10, items: { titanium_plate: 1, circuit_board: 1 } },
  rover_shielding: { nameId: 'ui.upgrade.regolith_radiation_shielding.name', kind: 'rover', sp: 15, items: { titanium_plate: 1 } },
  suit_liner: { nameId: 'ui.upgrade.suit_radiation_liner.name', kind: 'suit', sp: 10, items: { circuit_board: 1 } },
});

/** Module Tier 2 upgrades (5.4). Done by a drone in half a Sol. */
export const UPGRADES = Object.freeze({
  solar: { nameId: 'ui.upgrade.clean_sweep_panels.name', sp: 10, items: { solar_cell: 3 }, line: 'astra.t2.solar' },
  workshop: { nameId: 'ui.upgrade.precision_fabricator.name', sp: 10, items: { titanium_plate: 1, circuit_board: 1 }, line: 'astra.t2.workshop' },
  greenhouse: { nameId: 'ui.upgrade.vertical_led_farm.name', sp: 10, water: 10, items: { circuit_board: 2 }, line: 'astra.t2.greenhouse' },
  lifesupport: { nameId: 'ui.upgrade.moxie_x_and_ice_melter.name', sp: 10, items: { water_filter_membrane: 1, ice_core: 2, circuit_board: 1, titanium_plate: 1 }, line: 'astra.act3.ls_t2' },
  battery: { nameId: 'ui.upgrade.deep_cell_bank.name', sp: 10, items: { rare_battery_cell: 2 }, line: 'astra.t2.battery' },
  garage: { nameId: 'ui.upgrade.long_range_battery.name', sp: 15, items: { rare_battery_cell: 1, titanium_plate: 1 }, line: 'astra.t2.garage' },
  lab: { nameId: 'ui.upgrade.deep_space_array.name', sp: 15, items: { lab_sensor_kit: 1, weather_sensor: 1 }, line: 'astra.t2.lab' },
  recreation: { nameId: 'ui.upgrade.habitat_lounge.name', sp: 10, items: { mineral_sample: 1 }, line: 'astra.t2.rec' },
});

/** Lines ASTRA says when a module build starts / finishes (Sections 1 and 3). */
export const MODULE_LINES = Object.freeze({
  battery: { built: 'astra.act1.battery_built' },
  workshop: { start: 'astra.act1.workshop_start', built: 'astra.act1.workshop_built' },
  greenhouse: { start: 'astra.act2.greenhouse_start', built: 'astra.act2.greenhouse_built' },
  garage: { start: 'astra.act2.garage_start', built: 'astra.act2.garage_built' },
  lab: { start: 'astra.act3.lab_start', built: 'astra.act3.lab_built' },
  recreation: { built: 'astra.act3.rec_built' },
  roof: { built: 'astra.act3.roof_built' },
});
