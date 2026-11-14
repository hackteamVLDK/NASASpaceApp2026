/**
 * Levels, as data. The simulation reads everything about a level from here; adding or
 * retuning a level needs no code change. Design notes: docs/LEVELS.md.
 *
 * Story text is a PLACEHOLDER until the lore document arrives. Every such field is marked
 * `loreTbd: true` so it can be found and replaced.
 *
 * Objective types (src/sim/objectives.js):
 *   survive                         finish the level with nobody at zero health
 *   noEmergencies                   never run out of oxygen, water, food or power
 *   scienceAtLeast     { value }
 *   maxDoseBelow       { value }    highest crew dose stays under value (mSv)
 *   resourceAtLeast    { resource, value }   checked at the end
 *   foodGrownAtLeast   { value }    kg
 *   stormsSheltered    { value }    storms in which nobody received a meaningful dose
 *   projectDone        { project }
 *
 * Hint triggers (src/sim/sim.js): { at: { sol, hour } } | { event: '<event type>' } |
 *   { resourceBelow: { <resource>: value } } | { systemBelow: { <system>: value } }
 */

const ALL_JOBS = ['farm', 'lifesupport', 'solar', 'explore', 'research', 'build', 'rest'];

export const LEVELS = Object.freeze([
  {
    id: 'L1-first-sols',
    order: 1,
    status: 'playable',
    title: 'First Sols',
    tagline: 'Wake the base up and keep four people alive for five sols.',
    lore: { loreTbd: true, intro: 'PLACEHOLDER — arrival at the pre-deployed base. Replace with the lore text.', outro: 'PLACEHOLDER — the base is running; a warning from Earth about the Sun.' },
    teaches: ['Reading the four life resources', 'Assigning jobs', 'Daily schedule', 'What a solar storm warning means'],
    lengthSols: 5,
    startHour: 6,
    doseBudgetMsv: 4,
    warningLeadMinutes: 150,
    // Everyone starts off duty: giving out the first jobs is the first thing the player does.
    crew: { cmdr: 'rest', eng: 'rest', bot: 'rest', sci: 'rest' },
    jobs: ALL_JOBS.filter((j) => j !== 'build'),
    projects: [],
    start: {
      resources: { o2Kg: 12, waterL: 90, foodKg: 30, batteryKwh: 150 },
      systems: { o2GenEff: 0.8, recyclerEff: 0.85, solarClean: 0.9 },
    },
    spaceWeather: {
      donki: null,
      scripted: [{ sol: 4, hour: 10, class: 'minor', label: 'Solar storm (training scenario)' }],
    },
    dustStorms: [],
    dustDevilChance: 0,
    objectives: [
      { id: 'survive', type: 'survive', text: 'Keep the whole crew healthy for 5 sols', primary: true },
      { id: 'no-emergency', type: 'noEmergencies', text: 'Never run out of oxygen, water, food or power', primary: true },
      { id: 'science', type: 'scienceAtLeast', value: 30, text: 'Collect 30 science points', primary: true },
      { id: 'pantry', type: 'resourceAtLeast', resource: 'foodKg', value: 10, text: 'Finish with at least 10 kg of food', primary: false },
      { id: 'sheltered', type: 'stormsSheltered', value: 1, text: 'Get everyone below ground before the storm hits', primary: false },
    ],
    hints: [
      { id: 'welcome', trigger: { at: { sol: 1, hour: 6 } }, text: 'Nobody has a job yet. Give each astronaut one, then watch the four gauges: oxygen, water, food and power.' },
      { id: 'meals', trigger: { at: { sol: 1, hour: 12 } }, text: 'The crew eat three times a sol, exercise, and sleep at night. Work happens in between.' },
      { id: 'water', trigger: { resourceBelow: { waterL: 75 } }, text: 'Water is dropping. Send someone out to explore: they bring back ice.' },
      { id: 'o2gen', trigger: { systemBelow: { o2GenEff: 0.7 } }, text: 'The oxygen generator is wearing out. Give someone the "Maintain life support" job.' },
      { id: 'dust', trigger: { systemBelow: { solarClean: 0.82 } }, text: 'Dust is settling on the solar panels. Cleaning them means going outside.' },
      { id: 'storm', trigger: { event: 'storm-warning' }, text: 'Solar storm coming! Give the shelter order: nobody stays on the surface. Underground rooms are safe.' },
      { id: 'storm-over', trigger: { event: 'storm-end' }, text: 'Storm over. Look at each astronaut\'s radiation dose: who was underground?' },
    ],
    unlocks: 'L2-storm-season',
  },
  {
    id: 'L2-storm-season',
    order: 2,
    status: 'playable',
    title: 'Storm Season',
    tagline: 'May 2024: the Sun is restless. The storm dates in this level are real.',
    lore: { loreTbd: true, intro: 'PLACEHOLDER — the Sun wakes up. Replace with the lore text.', outro: 'PLACEHOLDER — the crew came through the storms.' },
    teaches: ['Radiation budget', 'Shielding thickness and material', 'Depth as protection', 'Trade-off: time outside versus dose', 'Building upgrades'],
    lengthSols: 14,
    startHour: 6,
    doseBudgetMsv: 12,
    warningLeadMinutes: 120,
    crew: { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'explore' },
    jobs: ALL_JOBS,
    projects: ['berm', 'waterRoof', 'stormWatch'],
    start: {
      resources: { o2Kg: 18, waterL: 150, foodKg: 62, batteryKwh: 160 },
      systems: { o2GenEff: 0.9, recyclerEff: 0.9, solarClean: 0.95 },
    },
    spaceWeather: {
      // Real dates and times: NASA DONKI solar energetic particle detections (near Earth).
      donki: { startDateUtc: '2024-05-08T00:00Z' },
      scripted: [
        {
          // Real event AT MARS: measured on the surface by Curiosity's RAD instrument.
          utc: '2024-05-20T06:00Z',
          class: 'strong',
          label: 'Solar storm of 20 May 2024 (measured on Mars by Curiosity)',
          timing: { provenance: 'nasa-measurement', source: 'NASA/JPL news, 10 June 2024. The date is real; the hour of day used here is approximate.' },
          strength: { provenance: 'approximation', source: 'Scaled from the 8,100 micrograys measured by MSL RAD.' },
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
      { id: 'berm', type: 'projectDone', project: 'berm', text: 'Build the regolith berm', primary: false },
    ],
    hints: [
      { id: 'budget', trigger: { at: { sol: 1, hour: 6 } }, text: 'Each astronaut has a radiation budget for this mission. Time on the surface and outside uses it up; time underground barely does.' },
      { id: 'projects', trigger: { at: { sol: 1, hour: 8 } }, text: 'You can build upgrades now. Compare the regolith berm and the water roof: what does each one cost you?' },
      { id: 'storm', trigger: { event: 'storm-warning' }, text: 'Storm warning. How long does your explorer need to get home?' },
      { id: 'night-storm', trigger: { at: { sol: 4, hour: 6 } }, text: 'A storm started while the crew slept underground. It is still going: check the surface dose rate before sending anyone up.' },
    ],
    unlocks: 'L3-dust-and-darkness',
  },
  {
    id: 'L3-dust-and-darkness',
    order: 3,
    status: 'draft',
    title: 'Dust and Darkness',
    tagline: 'A regional dust storm cuts the sunlight. Decide what stays switched on.',
    lore: { loreTbd: true, intro: 'PLACEHOLDER — the sky turns brown. Replace with the lore text.', outro: 'PLACEHOLDER — the dust settles.' },
    teaches: ['Energy budget', 'Battery as a buffer', 'Load shedding priorities', 'Dust on solar panels'],
    lengthSols: 16,
    startHour: 6,
    doseBudgetMsv: 12,
    warningLeadMinutes: 120,
    crew: { cmdr: 'solar', eng: 'lifesupport', bot: 'farm', sci: 'research' },
    jobs: ALL_JOBS,
    projects: ['berm', 'waterRoof', 'stormWatch', 'solarExpansion'],
    start: {
      resources: { o2Kg: 18, waterL: 110, foodKg: 70, batteryKwh: 180 },
      systems: { o2GenEff: 0.9, recyclerEff: 0.9, solarClean: 0.95 },
    },
    spaceWeather: { donki: { startDateUtc: '2024-09-01T00:00Z' }, scripted: [] },
    // Scripted for this level (gameplay). Real basis: the 2018 global dust storm ended the Opportunity rover's mission.
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
      { id: 'forecast', trigger: { at: { sol: 4, hour: 8 } }, text: 'Orbiters see a dust storm growing. Charge the battery and think about more solar panels.' },
      { id: 'dust-start', trigger: { event: 'dust-storm-start' }, text: 'The dust storm is here. Sunlight is down to a third. The base will switch off the lab first, then the greenhouse.' },
    ],
    unlocks: null,
  },
]);

export const LEVEL_BY_ID = Object.freeze(Object.fromEntries(LEVELS.map((l) => [l.id, l])));
export const FIRST_LEVEL_ID = LEVELS[0].id;
