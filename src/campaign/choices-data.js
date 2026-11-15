/** Decision extensions agreed for the gameplay batch. All numbers below are gameplay,
 * not measured Mars engineering values. Scenario immediate effects remain in story.js. */
export const CHOICE_RULES = Object.freeze({
  source: 'gameplay', durationSols: 6, callbackSols: 3, choreEverySols: 2,
  minTripTime: 0.6, maxTripTime: 1.6, minTripHp: 0.5, maxTripHp: 1.8,
  minSalvage: 0.5, maxSalvage: 1.8,
});

// rates: [module, resource, fraction of that module's current output/load].
// recycler rates use the water currently lost, not a fictional change to ISS efficiency.
// tripTime/tripHp/salvage are fractional changes; salvage applies to repeatable Scrap Runs.
const definitions = {
  d1a: { preview: ['Save 6 Power; lose 3 Morale/Sol', 'Room power use -20% for 6 Sols', 'Workshop parts -20% for 6 Sols'], rates: [['loads', 'power', -0.2], ['workshop', 'sp', -0.2]], callback: { morale: 4 }, text: 'Remember our Power Saver choice? Efficient routines still save power, but careful work makes fewer parts. Good planning!' },
  d1b: { preview: ['Power +40 now; HP -10', 'Extra solar power until the motor check', 'Wipe panels every 2 Sols'], rates: [['solar', 'power', 0.2]], maintenance: 'solar_wipe', maintenancePower: -6, callback: { sp: 4 }, text: 'Remember tilting the panels before the storm? The extra power helped us save parts. Regular wipes keep our setup working.' },
  d1c: { preview: ['No change now; storm drains Power', 'Lab Research +30% for 6 Sols', 'Workshop parts -30% for 6 Sols'], rates: [['workshop', 'sp', -0.3]], research: 0.3, callback: { research: 5 }, text: 'Remember keeping everything running? Studying the drained batteries taught us something. Testing uses workshop time, so we make fewer parts.' },
  d2a: { preview: ['Spare Parts -12; fix Water Sort', 'Water loss -30% for 6 Sols', 'Workshop parts -20% for 6 Sols'], rates: [['recycler', 'water', -0.3], ['workshop', 'sp', -0.2]], callback: { water: 8 }, text: 'Remember fixing the filter first? Our careful checks saved this water. Keeping spare filters ready uses some workshop time.' },
  d2b: { preview: ['Spare Parts -12; water drains faster', 'Scrap Run parts +40%: 6 Sols', 'Extra Water use: 3/Sol'], salvage: 0.4, meters: { water: -3 }, callback: { sp: 8 }, text: 'Remember building the Cargo Trailer? It keeps bringing useful scrap. Cleaning the extra cargo uses water, so plan an ice trip.' },
  d2c: { preview: ['Ration 2 Sols; HP -2/Sol', 'Water loss -30% for 6 Sols', 'Greenhouse Food -20% for 6 Sols'], rates: [['recycler', 'water', -0.3], ['greenhouse', 'food', -0.2]], callback: { water: 10 }, text: 'Remember rationing water? Our smaller growing plan saved more water. It grows less food, so keep an eye on supplies.' },
  d3a: { preview: ['Water -10; test harvest composted later', 'Lab Research +30% for 6 Sols', 'Greenhouse Food -20% for 6 Sols'], research: 0.3, rates: [['greenhouse', 'food', -0.2]], callback: { research: 8 }, text: 'Remember testing potatoes in Mars soil? Those test beds taught us more. They take growing space; washing soil stays available.' },
  d3b: { preview: ['Water -20; drone busy 1 Sol', 'Soil Beds: Food +3/Sol for good', 'Research +20%; Water -2/Sol: 6 Sols'], research: 0.2, meters: { water: -2 }, callback: { food: 8 }, text: 'Remember washing the soil first? Our tested beds produced extra food. Keeping this trial going uses extra water.' },
  d3c: { preview: ['No cost now; washing stays available', 'Greenhouse Food +20% for 6 Sols', 'Greenhouse power use +30%: 6 Sols'], rates: [['greenhouse', 'food', 0.2], ['greenhouse', 'power', 0.3]], callback: { food: 8 }, text: 'Remember staying with hydroponics? Our extra trays grew this food. Their lamps need more power, so watch the battery.' },
  d4a: { preview: ['Morale -5; Earth window in 3 Sols', 'Greenhouse Food +30% for 6 Sols', 'Lab Research -30% for 6 Sols'], rates: [['greenhouse', 'food', 0.3]], research: -0.3, callback: { food: 10 }, text: 'Remember keeping the plants warm? The growing trial brought extra food. Sharing power with it leaves less time for lab work.' },
  d4b: { preview: ['Call Earth: Morale +10, Research +10', 'Lab Research +40% for 6 Sols', 'Lab power use +30%: 6 Sols'], research: 0.4, rates: [['lab', 'power', 0.3]], callback: { research: 10 }, text: 'Remember choosing to call Earth? Their advice helped our research. Working with those messages keeps the Lab using extra power.' },
  d4c: { preview: ['Morale +5; Food -20% for 1 Sol', 'Greenhouse power use -20%: 6 Sols', 'Move trays: drone busy every 2 Sols'], rates: [['greenhouse', 'power', -0.2]], drone: { id: 'warm_trays', module: 'kitchen', sols: 0.25 }, callback: { power: 15 }, text: 'Remember moving trays into the Kitchen? Shared warmth saved power. A drone must keep moving the trays while we use this plan.' },
  d5a: { preview: ['HP -6; partial loot; return trip unlocked', 'Future trips 20% shorter: 6 Sols', 'Scrap Run parts -20%: 6 Sols'], tripTime: -0.2, salvage: -0.2, callback: { sp: 6 }, text: 'Remember racing home from the cliffs? Our lighter travel plan saved parts. Shorter trips mean bringing home less loose scrap.' },
  d5b: { preview: ['HP -2; Morale -3; return 1 Sol later', 'Travel HP loss rate -30%: 6 Sols', 'Future trips 20% longer: 6 Sols'], tripHp: -0.3, tripTime: 0.2, callback: { research: 8 }, text: 'Remember sheltering under the cliff? Mapping covered stops helped our research. Those stops reduce exposure, but future trips take longer.' },
  d5c: { preview: ['HP -14; full loot; shielding needs repair', 'Scrap Run parts +40%: 6 Sols', 'Travel HP loss rate +20%: 6 Sols'], salvage: 0.4, tripHp: 0.2, callback: { sp: 10 }, text: 'Remember working behind the Rover shielding? Our longer collecting rounds brought extra parts. They also mean more exposure, so plan rest.' },
  e1a: { preview: ['HP -1; Parts -3; Food -5', 'Travel HP loss rate -20%: 6 Sols', 'Workshop parts -20% for 6 Sols'], tripHp: -0.2, rates: [['workshop', 'sp', -0.2]], callback: { food: 6 }, text: 'Remember going to the shelter? Practising that plan helped us save supplies. More shelter preparation leaves less workshop time.' },
  e1b: { preview: ['HP loss depends on your room', 'Workshop parts +40% for 6 Sols', 'Seal checks every 2 Sols; skipping hurts'], rates: [['workshop', 'sp', 0.4]], maintenance: 'suit_seal', maintenanceHp: -4, callback: { sp: 6 }, text: 'Remember working through the flare? We made extra parts. Our busy schedule needs regular seal checks; good care keeps the Commander comfortable.' },
  e1c: { preview: ['HP -1; drones keep working', 'Lab Research +30% for 6 Sols', 'Drone checks every 2 Sols'], research: 0.3, drone: { id: 'forecast_check', module: 'lab', sols: 0.25 }, callback: { research: 8 }, text: 'Remember planning shelter with the forecast? Our records helped the Lab. A drone keeps checking the equipment for our next warning.' },
  e2a: { preview: ['Solar output +20% or -30%', 'Scrap Run parts +30%: 6 Sols', 'Travel HP loss rate +20%: 6 Sols'], salvage: 0.3, tripHp: 0.2, callback: { sp: 6 }, text: 'Remember letting the dust devil pass? We mapped new collecting spots. Exploring them brings more scrap, but takes more effort outside.' },
  e2b: { preview: ['Solar output -50% until next Sol', 'Solar output -20% for 6 Sols', 'Travel HP loss rate -30%: 6 Sols'], rates: [['solar', 'power', -0.2]], tripHp: -0.3, callback: { power: 15 }, text: 'Remember stowing the panels? Our sheltered setup saved repair power. It collects less sunlight while we use the more sheltered travel plan.' },
  e2c: { preview: ['HP -5; solar +10% for 3 Sols', 'Solar output +20% for 6 Sols', 'Wipe panels every 2 Sols'], rates: [['solar', 'power', 0.2]], maintenance: 'solar_wipe', maintenancePower: -8, callback: { power: 15 }, text: 'Remember watching outside and wiping the panels? Our careful tilts brought extra power. Regular wipes keep this setup useful.' },
  e3a: { preview: ['Find leak with the valve mini-game', 'Life Support Oxygen +20%: 6 Sols', 'Workshop parts -20% for 6 Sols'], rates: [['lifesupport', 'oxygen', 0.2], ['workshop', 'sp', -0.2]], callback: { oxygen: 10 }, text: 'Remember hunting the leak? Our tested seals helped us keep extra air. Making spare seals uses workshop time.' },
  e3b: { preview: ['Spare Parts -1; leak returns later', 'Scrap Run parts +30%: 6 Sols', 'Valve checks every 2 Sols'], salvage: 0.3, maintenance: 'valve_balance', maintenanceWater: -2, callback: { sp: 6 }, text: 'Remember choosing the quick tape patch? We used the saved time to collect parts. Regular valve checks still matter while it lasts.' },
  e3c: { preview: ['Airlock closed; drone busy 1 Sol', 'Water loss -30% for 6 Sols', 'Future trips 20% longer: 6 Sols'], rates: [['recycler', 'water', -0.3]], tripTime: 0.2, callback: { water: 10 }, text: 'Remember sealing the airlock for repairs? Our careful checks saved water. We keep those checks before trips, so travel takes longer.' },
  'exp2.60a': { preview: ['Current trip 0.25 Sol longer', 'Travel HP loss rate -20%: 6 Sols', 'Future trips 20% longer: 6 Sols'], tripHp: -0.2, tripTime: 0.2, callback: { research: 6 }, text: 'Remember taking the careful route at Pathfinder? Our map helped the Lab. Following it reduces exposure, but makes future trips longer.' },
  'exp2.60b': { preview: ['Current trip HP cost +5', 'Scrap Run parts +30%: 6 Sols', 'Travel HP loss rate +20%: 6 Sols'], salvage: 0.3, tripHp: 0.2, callback: { sp: 8 }, text: 'Remember taking the direct route at Pathfinder? We found more collecting spots. Using them brings extra parts and more exposure.' },
  'exp3.85a': { preview: ['Extra Ice Core; HP -4; trip longer', 'Ice Runs bring 1 extra core: 6 Sols', 'Extra Power use: 4/Sol'], extraIce: 1, meters: { power: -4 }, callback: { water: 10 }, text: 'Remember collecting extra ice at the crater? Our ice survey saved more water. Processing the extra cores keeps using power.' },
  'exp3.85b': { preview: ['Return on time with standard ice', 'Future trips 20% shorter: 6 Sols', 'Scrap Run parts -20%: 6 Sols'], tripTime: -0.2, salvage: -0.2, callback: { power: 15 }, text: 'Remember leaving the extra crater ice? Our lighter travel plan saved power. We travel sooner, but bring less loose scrap.' },
};

// Freeze nested values too: callers cannot accidentally retune effects through a preview.
const freeze = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const CHOICE_EFFECTS = freeze(definitions);
// Proposed Section 6 text. Each card explicitly recalls the choice that opened it.
export const FOLLOWUP_TEXT = freeze({
  f1: ['Tilt Motor Check', 'Tilting the panels helped us charge up. Dust reached the motor mount. We can buy parts, pause travel, or return to normal.',
    ['Replace the mount', 'Inspect it for one Sol', 'Return to normal panels'],
    [['Parts -8; end the extra solar plan'], ['Power -20; travel and solar upgrades pause 1 Sol', 'End extra solar plan'], ['Morale -3; end the extra solar plan']]],
  f2: ['Trailer Balance', 'Our Cargo Trailer carries more scrap. Its loose load needs balancing before another Scrap Run. Choose parts, time, or lighter collecting.',
    ['Fit braces and check wheels', 'Balance cargo for two Sols', 'Park the extra scrap racks'],
    [['Parts -8; Wheel Vacuum opens Scrap Runs'], ['Scrap Runs closed for 2 Sols'], ['End extra scrap and water-use plan; Morale -3']]],
  f3: ['The Test Tray', 'Planting in untreated soil gave us a useful test. Keep that tray separate before expanding. We can clean, wash, or compost it.',
    ['Clean the test tray', 'Wash and test the soil', 'Compost the test and record it'],
    [['Water -5; Nutrient Match opens farm upgrades'], ['Water -20; Soil Beds in 2 Sols'], ['Morale -5; Research +8; farm upgrades reopen']]],
  f4: ['Extra Growing Lamps', 'Our hydroponics choice added growing trays. Their extra lamps share a heat pipe. We can rewire, reroute heat, or remove them.',
    ['Fit separate lamp wiring', 'Reroute the heat pipe', 'Remove the extra trays'],
    [['Parts -10; Research +5; keep extra growing'], ['Heat Pump repair opens farm upgrades'], ['Research +5; end extra growing plan']]],
  f5: ['Our Next Radio Slot', 'Keeping the plants warm postponed our call. We still need a canyon route plan. Choose a quick draft, careful study, or supplies.',
    ['Draft a route tomorrow', 'Study the route for three Sols', 'Pack extra food and go'],
    [['Canyon route ready in 1 Sol'], ['Canyon route ready in 3 Sols; Research +15'], ['Food -15; canyon route ready now']]],
  f6: ['A Map From Earth', 'Calling Earth brought a canyon map. It needs checking against our scans. We can align the dish, wait, or survey outside.',
    ['Buy calibration parts', 'Compare scans for four Sols', 'Survey the route outside'],
    [['Parts -12; Antenna Alignment opens the canyon'], ['Canyon closed 4 Sols; Research +20'], ['HP -8; canyon route ready in 2 Sols']]],
  f7: ['Forecast Sensor Check', 'Our planned shelter worked well. Keeping our own forecast sensor ready needs parts or testing time. We can also study its records.',
    ['Fit a spare sensor', 'Test the sensor for two Sols', 'Study the old records instead'],
    [['Parts -6; future flares get early warnings'], ['Lab upgrades pause 2 Sols; early warnings follow'], ['Research +8; end extra forecast plan']]],
  f8: ['The Tape Patch Returns', 'Our quick tape patch needs attention again. Good try! Choose a lasting seal, close the airlock, or keep checking until Workshop repairs.',
    ['Buy a lasting seal', 'Close the airlock for repairs', 'Keep checking the tape'],
    [['Parts -8; Valve Balance finishes the seal'], ['Travel closed 2 Sols; leak stops now'], ['Valve checks every 2 Sols until Workshop T2']]],
});

export const BRANCH_PREVIEWS = freeze({
  d1a: 'Recreation opens early after the Workshop', d1b: 'Tilt Motor follow-up in 1 Sol',
  d2a: 'Roof opens early after the Garage', d2b: 'Trailer follow-up; Scrap Runs need balancing',
  d3a: 'Farm upgrades wait for Test Tray follow-up', d3c: 'Growing Lamps follow-up in 1 Sol',
  d4a: 'Route-planning follow-up before the canyon', d4b: 'Earth Map follow-up before the canyon',
  e1b: 'Skipped seal checks drain HP until Workshop T2 repairs', e1c: 'Forecast Sensor follow-up in 1 Sol',
  e2b: 'Wipe panels before Scrap Runs or solar upgrades', e2c: 'Extra wipes continue until Workshop T2 repairs',
  e3a: 'Valve repair opens roof builds and delta trips', e3b: 'Tape Patch follow-up in 3 Sols',
});

export const BRANCH_GATES = freeze({
  mount: { launch: '*', upgrade: 'solar', reason: 'Our tilt motor is being checked. Travel and solar upgrades reopen after one Sol.' },
  trailer: { launch: 'run', reason: 'Balance the Cargo Trailer first. Its follow-up offers a wheel check, waiting, or lighter collecting.' },
  soil: { upgrade: 'greenhouse', reason: 'Separate the test tray first. The Test Tray follow-up offers cleaning, washing, or composting.' },
  lamps: { upgrade: 'greenhouse', reason: 'Reroute the Heat Pump before adding more growing lamps.' },
  canyon: { launch: 5, reason: 'Our canyon route needs checking. Finish the route follow-up, calibration, or its waiting time first.' },
  forecast: { upgrade: 'lab', reason: 'Our forecast sensor is being tested. Lab upgrades reopen after two Sols.' },
  stowed: { launch: 'run', upgrade: 'solar', reason: 'The panels are stowed. Win Solar Wipe to deploy them before Scrap Runs or solar upgrades.' },
  airlock: { launch: [4, 5], build: 'roof', reason: 'Find the airlock leak with Valve Balance before roof work or delta and canyon trips.' },
  seal: { launch: '*', reason: 'The airlock seal needs repair. Finish Valve Balance or wait for the airlock repair to complete.' },
});

export const STRINGS = Object.freeze({
  ...Object.fromEntries(Object.entries(definitions).map(([key, fx]) => [`astra.choice.${key}.callback`, fx.text])),
  ...Object.fromEntries(Object.entries(FOLLOWUP_TEXT).flatMap(([id, [title, alert, labels]]) => [
    [`ui.${id}.header`, 'FOLLOW-UP'], [`ui.${id}.title`, title], [`astra.${id}.alert`, alert],
    ...labels.map((label, i) => [`ui.${id}.${['a', 'b', 'c'][i]}.label`, label]),
  ])),
  'astra.branch.repaired': 'Nice work! The Workshop repaired our special setup. Its extra checks can stop now.',
  'astra.branch.ready': 'Our equipment check is complete. Good planning! The waiting route or upgrade is open again.',
  'astra.branch.upkeep': 'Our earlier choice needs another check. Finish the repair task, or upgrade the Workshop to stop these extra checks.',
});

const EVENT4_PREVIEWS = freeze({
  a: ['Play Nutrient Match to restore growing', 'Food -40% until repaired'],
  b: ['Water -10 now', 'Food -40% until next dawn'],
  c: ['Food -40%; no fresh-crop healing', 'Food -10 after 2 Sols; repair opens'],
});
export function choicePreview(pendingId, choice) {
  const index = ['a', 'b', 'c'].indexOf(choice);
  if (FOLLOWUP_TEXT[pendingId]) return index < 0 ? [] : [...FOLLOWUP_TEXT[pendingId][3][index]];
  const key = `${pendingId}${choice}`;
  const preview = [...(CHOICE_EFFECTS[key]?.preview ?? (pendingId === 'e4' ? EVENT4_PREVIEWS[choice] : null) ?? [])];
  if (BRANCH_PREVIEWS[key]) preview[2] = BRANCH_PREVIEWS[key];
  return preview;
}

/** Plain-data records survive saves and checkpoint rewinds; old saves start with none. */
export function activeChoiceEffects(s) {
  return Object.values(s.flags.choiceEffects ?? {}).filter((r) => r && r.until > s.minute && Object.hasOwn(CHOICE_EFFECTS, r.key));
}

/** Bound stacking so several route choices never produce instant or unfinishable trips. */
export function choiceTripMult(s, field) {
  const value = activeChoiceEffects(s).reduce((m, r) => m * (1 + (CHOICE_EFFECTS[r.key][field] ?? 0)), 1);
  const [lo, hi] = field === 'tripTime' ? [CHOICE_RULES.minTripTime, CHOICE_RULES.maxTripTime]
    : field === 'tripHp' ? [CHOICE_RULES.minTripHp, CHOICE_RULES.maxTripHp] : [CHOICE_RULES.minSalvage, CHOICE_RULES.maxSalvage];
  return Math.max(lo, Math.min(hi, value));
}
