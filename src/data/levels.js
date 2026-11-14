/**
 * Levels, as data. The simulation reads everything about a level from here; adding or
 * retuning a level needs no code change. Design notes: docs/LEVELS.md.
 *
 * Relation to SCENARIO.md:
 *   - Level 1 starts exactly where the scenario's landing cutscene and tutorial hand-off end:
 *     left wing online, right wing unfinished, Drone #01 asleep.
 *   - Levels 2 and 3 lie beyond what SCENARIO.md covers so far (`beyondScenario: true`).
 *     They are proposals that exercise mechanics already built, and they use one module the
 *     scenario does not have (the Hydroponics bay). They wait for the team's decision.
 *
 * Objective types (src/sim/objectives.js):
 *   survive                         finish the level with nobody at zero health
 *   noEmergencies                   never run out of oxygen, water, food or power
 *   droneAwake         { drone }
 *   moduleBuilt        { module }
 *   modulesBuilt       { modules }  every listed module online
 *   scienceAtLeast     { value }
 *   maxDoseBelow       { value }    highest crew dose stays under value (mSv)
 *   resourceAtLeast    { resource, value }   checked at the end
 *   systemAtLeast      { system, value }     checked at the end
 *   foodGrownAtLeast   { value }    kg
 *   stormsSheltered    { value }    storms in which nobody received a meaningful dose
 *   projectDone        { project }
 *
 * Hint triggers (src/sim/sim.js): { at: { sol, hour } } | { event: '<event type>' } |
 *   { resourceBelow: { <resource>: value } } | { systemBelow: { <system>: value } }
 * Hints are spoken by ASTRA 6.7 (src/flow/astra.js), so they are written in her voice.
 */

const SCENARIO_MODULES = ['airlock', 'bedroom', 'dining', 'lifesupport', 'workshop', 'lab', 'power', 'garage'];

export const LEVELS = Object.freeze([
  {
    id: 'L1-wake-the-station',
    order: 1,
    status: 'playable',
    beyondScenario: false,
    title: 'Wake the Station', // PROPOSAL: SCENARIO.md does not name levels
    tagline: 'The drones fell asleep before the base was finished. Wake one up and finish the job.',
    lore: { source: 'SCENARIO.md sections 3-5', intro: 'Text intro, landing cutscene and ASTRA hand-off: see src/flow/intro.js', outro: 'TO BE WRITTEN by the team: what happens once the station is finished.', loreTbd: true },
    teaches: ['Underground = shielded from radiation', 'Waking and using builder drones', 'Assigning jobs', 'Power: sunlight, dust and the night', 'What a solar storm warning means'],
    lengthSols: 6,
    startHour: 6,
    doseBudgetMsv: 4,
    warningLeadMinutes: 150,
    // Several people arrived (team clarification). Names are placeholders: src/data/crew.js.
    // Everyone starts off duty: handing out jobs is among the first things the player does.
    crew: { cmdr: 'rest', eng: 'rest', bot: 'rest', sci: 'rest' },
    jobs: ['build', 'lifesupport', 'solar', 'research', 'explore', 'rest'],
    // SCENARIO section 4: left wing operational, right wing unfinished.
    modules: { online: ['airlock', 'bedroom', 'dining', 'lifesupport'], unfinished: ['power', 'workshop', 'lab', 'garage'] },
    drones: { awake: [], dormant: ['drone-01', 'drone-02', 'drone-03'] },
    projects: [],
    start: {
      resources: { o2Kg: 12, waterL: 90, foodKg: 40, batteryKwh: 60 },
      systems: { o2GenEff: 0.8, recyclerEff: 0.85, solarClean: 0.5 }, // SCENARIO: "dust-covered solar panels"
    },
    // PROPOSAL: one small scripted storm so the level can show what the soil roof is for.
    spaceWeather: { donki: null, scripted: [{ sol: 5, hour: 10, class: 'minor', label: 'Solar storm (training scenario)' }] },
    dustStorms: [],
    dustDevilChance: 0,
    objectives: [
      { id: 'survive', type: 'survive', text: 'Keep the whole crew healthy for 6 sols', primary: true },
      { id: 'drone', type: 'droneAwake', drone: 'drone-01', text: 'Wake up Drone #01', primary: true },
      { id: 'power', type: 'moduleBuilt', module: 'power', text: 'Finish Battery & Heating', primary: true },
      { id: 'right-wing', type: 'modulesBuilt', modules: ['power', 'workshop', 'lab', 'garage'], text: 'Finish the whole right wing', primary: false },
      { id: 'panels', type: 'systemAtLeast', system: 'solarClean', value: 0.8, text: 'Get the solar panels at least 80% clean', primary: false },
      { id: 'sheltered', type: 'stormsSheltered', value: 1, text: 'Get everyone below ground before the storm hits', primary: false },
    ],
    hints: [
      { id: 'build-with-people', trigger: { event: 'construction-started' }, text: 'Construction has begun! The crew build too, Commander: give someone the "Build" job and it goes much faster. Our engineer is the quickest builder.' },
      { id: 'panels', trigger: { at: { sol: 1, hour: 9 } }, text: 'Our solar panels are still covered in dust from the storm. Send someone outside to clean them: more sunlight on the panels means more power.' },
      { id: 'meals', trigger: { at: { sol: 1, hour: 12 } }, text: 'Lunch time! The crew eat three times a sol, exercise, and sleep at night. Work happens in between.' },
      { id: 'first-night', trigger: { at: { sol: 1, hour: 18 } }, text: 'The Sun is setting. Until Battery & Heating is finished we only have a small emergency cell, so tonight I will switch off everything we can spare.' },
      { id: 'o2gen', trigger: { systemBelow: { o2GenEff: 0.7 } }, text: 'The oxygen generator is wearing out. Give someone the "Maintain life support" job.' },
      { id: 'water', trigger: { resourceBelow: { waterL: 60 } }, text: 'Water is getting low. Once the Rover Garage is finished, an explorer can drive out and bring back ice.' },
    ],
    unlocks: 'L2-storm-season',
  },
  {
    id: 'L2-storm-season',
    order: 2,
    status: 'playable',
    beyondScenario: true,
    usesProposedModules: ['hydroponics'],
    title: 'Storm Season',
    tagline: 'The Sun is restless. The storm pattern in this level is replayed from real NASA records of May 2024.',
    lore: { loreTbd: true, intro: 'PLACEHOLDER — the Sun wakes up. Waiting for the next part of SCENARIO.md.', outro: 'PLACEHOLDER — the crew came through the storms.' },
    teaches: ['Radiation budget', 'Time above ground costs dose', 'Trade-off: field science versus the deep lab', 'Upgrades'],
    lengthSols: 14,
    startHour: 6,
    doseBudgetMsv: 12,
    warningLeadMinutes: 120,
    crew: { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'explore' },
    jobs: ['build', 'lifesupport', 'solar', 'research', 'explore', 'farm', 'rest'],
    modules: { online: [...SCENARIO_MODULES, 'hydroponics'], unfinished: [] },
    drones: { awake: ['drone-01'], dormant: ['drone-02', 'drone-03'] },
    projects: ['antenna', 'berm', 'waterRoof'],
    start: {
      resources: { o2Kg: 18, waterL: 150, foodKg: 62, batteryKwh: 160 },
      systems: { o2GenEff: 0.9, recyclerEff: 0.9, solarClean: 0.95 },
    },
    spaceWeather: {
      // Real dates and times of detections near Earth (NASA DONKI, 2024). The game replays the
      // pattern in its own year (2042) and imagines the storms arriving at Mars.
      donki: { startDateUtc: '2024-05-08T00:00Z' },
      scripted: [
        {
          // Real event AT MARS: measured on the surface by Curiosity's RAD instrument.
          utc: '2024-05-20T06:00Z',
          class: 'strong',
          label: 'Solar storm (scenario from 20 May 2024, measured on Mars by Curiosity)',
          about: 'Based on a real storm at Mars. On 20 May 2024 the Curiosity rover measured the biggest radiation surge of its 12 years on the surface. The game replays it in its own year; the hour of day is our choice.',
          timing: { provenance: 'approximation', note: 'The date is a NASA measurement (NASA/JPL news, 10 June 2024). The hour of day is not published and was chosen for the game.' },
          strength: { provenance: 'approximation', note: 'Scaled from the 8,100 micrograys measured by MSL RAD.' },
        },
      ],
    },
    dustStorms: [],
    dustDevilChance: 0.06,
    objectives: [
      { id: 'survive', type: 'survive', text: 'Keep the whole crew healthy for 14 sols', primary: true },
      { id: 'dose', type: 'maxDoseBelow', value: 12, text: 'Keep every astronaut under the 12 mSv radiation budget', primary: true },
      { id: 'science', type: 'scienceAtLeast', value: 90, text: 'Collect 90 science points', primary: true },
      { id: 'sheltered', type: 'stormsSheltered', value: 4, text: 'Ride out 4 storms with everyone protected', primary: false },
      { id: 'antenna', type: 'projectDone', project: 'antenna', text: 'Repair the bent antenna', primary: false },
    ],
    hints: [
      { id: 'budget', trigger: { at: { sol: 1, hour: 6 } }, text: 'Each astronaut has a radiation budget for this mission, Commander. Time on the surface uses it up; time underground barely does.' },
      { id: 'upgrades', trigger: { at: { sol: 1, hour: 8 } }, text: 'The Workshop can make upgrades now. Repairing the bent antenna would give us storm warnings twice as early.' },
      { id: 'night-storm', trigger: { at: { sol: 4, hour: 6 } }, text: 'A solar storm began while the crew slept under the soil. It is still going: check the surface radiation before you send anyone up.' },
    ],
    unlocks: 'L3-dust-and-darkness',
  },
  {
    id: 'L3-dust-and-darkness',
    order: 3,
    status: 'draft',
    beyondScenario: true,
    usesProposedModules: ['hydroponics'],
    title: 'Dust and Darkness',
    tagline: 'A dust storm like the one that stopped the drones. This time people are here.',
    lore: { loreTbd: true, intro: 'PLACEHOLDER — the sky turns brown again. Waiting for the next part of SCENARIO.md.', outro: 'PLACEHOLDER — the dust settles.' },
    teaches: ['Energy budget', 'Battery as a buffer', 'Load shedding priorities', 'Dust on solar panels'],
    lengthSols: 16,
    startHour: 6,
    doseBudgetMsv: 12,
    warningLeadMinutes: 120,
    crew: { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'research' },
    jobs: ['build', 'lifesupport', 'solar', 'research', 'explore', 'farm', 'rest'],
    modules: { online: [...SCENARIO_MODULES, 'hydroponics'], unfinished: [] },
    drones: { awake: ['drone-01'], dormant: ['drone-02', 'drone-03'] },
    projects: ['antenna', 'solarExpansion', 'berm', 'waterRoof'],
    start: {
      resources: { o2Kg: 18, waterL: 110, foodKg: 70, batteryKwh: 180 },
      systems: { o2GenEff: 0.9, recyclerEff: 0.9, solarClean: 0.95 },
    },
    spaceWeather: { donki: { startDateUtc: '2024-09-01T00:00Z' }, scripted: [] },
    // Scripted for this level (game values). Real basis: the 2018 global dust storm ended the Opportunity rover's mission.
    dustStorms: [{ startSol: 6, startHour: 9, durationSols: 4, solarFactor: 0.35, dustFactor: 4 }],
    dustDevilChance: 0.08,
    objectives: [
      { id: 'survive', type: 'survive', text: 'Keep the whole crew healthy for 16 sols', primary: true },
      { id: 'no-emergency', type: 'noEmergencies', text: 'Never run out of oxygen, water, food or power', primary: true },
      { id: 'science', type: 'scienceAtLeast', value: 110, text: 'Collect 110 science points', primary: true },
      { id: 'harvest', type: 'foodGrownAtLeast', value: 20, text: 'Grow 20 kg of food', primary: false },
      { id: 'array', type: 'projectDone', project: 'solarExpansion', text: 'Build the extra solar array', primary: false },
    ],
    hints: [
      { id: 'forecast', trigger: { at: { sol: 4, hour: 8 } }, text: 'Orbiters see a dust storm growing, Commander. Charge the battery, stock up on water, and think about more solar panels.' },
    ],
    unlocks: null,
  },
]);

export const LEVEL_BY_ID = Object.freeze(Object.fromEntries(LEVELS.map((l) => [l.id, l])));
export const FIRST_LEVEL_ID = LEVELS[0].id;
