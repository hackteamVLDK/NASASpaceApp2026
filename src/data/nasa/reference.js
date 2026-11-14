/**
 * NASA reference values used by the simulation and shown to the player.
 *
 * Every entry is an actual NASA measurement or published NASA figure, with its source.
 * Approximations and gameplay numbers do NOT belong here — they live in src/sim/constants.js.
 */

export const PROVENANCE = Object.freeze({
  NASA: 'nasa-measurement',
  APPROX: 'approximation',
  GAME: 'gameplay',
});

export const PROVENANCE_LABEL = Object.freeze({
  'nasa-measurement': 'NASA data',
  approximation: 'Scientific approximation',
  gameplay: 'Game value',
});

const nasa = (value, unit, source, extra = {}) => Object.freeze({ value, unit, source, provenance: PROVENANCE.NASA, ...extra });

export const NASA = Object.freeze({
  // --- Mars as a planet
  solSeconds: nasa(88775.244, 's', 'NASA Mars Fact Sheet / NASA GISS Mars24: one sol is 24 h 39 min 35.244 s'),
  surfaceGravity: nasa(3.73, 'm/s^2', 'NASA Mars Fact Sheet, "Surface gravity (mean)": 3.73 m/s^2, against 9.82 on Earth (38%)'),
  solarIrradiance: nasa(586.2, 'W/m^2', 'NASA Mars Fact Sheet: mean sunlight at Mars orbit (Earth gets 1361)'),
  atmosphereCo2Percent: nasa(95.1, '%', 'NASA Mars Fact Sheet: atmosphere by volume'),
  surfacePressurePa: nasa(636, 'Pa', 'NASA Mars Fact Sheet: 6.36 mb at mean radius, varying about 4.0 to 8.7 mb (Earth: 101,325 Pa)'),
  atmosphereColumnGale: nasa(21, 'g/cm^2', 'MSL RAD team, Gale crater: average atmospheric column shielding above Curiosity (Hassler et al., Science 2014)'),

  // --- Radiation measured by Curiosity's Radiation Assessment Detector (RAD)
  gcrSurfaceDoseEquivalent: nasa(0.64, 'mSv/day', 'MSL RAD on the surface at Gale crater, Aug 2012 - Jun 2013 (Hassler et al., Science 343, 2014)', { uncertainty: 0.12 }),
  gcrSurfaceAbsorbedDose: nasa(0.21, 'mGy/day', 'MSL RAD on the surface at Gale crater (Hassler et al., Science 343, 2014)', { uncertainty: 0.04 }),
  cruiseDoseEquivalent: nasa(1.84, 'mSv/day', 'MSL RAD inside the spacecraft on the way to Mars (Zeitlin et al., Science 340, 2013)', { uncertainty: 0.33 }),
  speMay2024AbsorbedDose: nasa(8100, 'microGy', 'MSL RAD, solar storm of 20 May 2024: largest surge in 12 years on Mars, "equivalent to 30 chest X-rays" (NASA/JPL news, 10 June 2024)'),
  speSept2017: nasa(2, 'x normal', 'MSL RAD, September 2017 solar storm: surface radiation more than doubled (NASA/JPL news, 29 Sept 2017)'),
  careerDoseLimit: nasa(600, 'mSv', 'NASA-STD-3001 Vol. 1 Rev. B (2022): career radiation limit for astronauts'),

  // --- Keeping a crew alive (International Space Station experience)
  crewOxygenPerDay: nasa(0.84, 'kg/person/day', 'NASA Marshall Space Flight Center life-support planning value for one crew member; real use varies with activity, roughly 0.6 to 1.0 kg'),
  crewWaterPerDay: nasa(3.8, 'L/person/day', 'NASA (2023): about one gallon per crew member per day for drinking, food preparation and hygiene'),
  waterRecovery: nasa(0.98, 'fraction', 'NASA (June 2023): the ISS life-support system demonstrated 98% water recovery'),
  crewFoodPerDay: nasa(1.27, 'kg/person/day', 'NASA Facts "Food for Space Flight" (1996, Space Shuttle era): 3.8 lb per person per day including 1 lb of packaging. The 2.8 lb (1.27 kg) of food is our subtraction, not a separately published figure', { derived: true }),
  issExerciseHours: nasa(2, 'h/day', 'NASA: ISS astronauts exercise about two hours a day to limit muscle and bone loss'),

  // --- Living off the land
  moxiePeakOxygen: nasa(12, 'g/hour', 'NASA MOXIE on the Perseverance rover: peak oxygen production from Martian CO2 (NASA, Sept 2023)'),
  moxieTotalOxygen: nasa(122, 'g', 'NASA MOXIE: total oxygen made in 16 runs, 2021 - 2023 (NASA, Sept 2023)'),
  phoenixWaterIce: nasa(2008, 'year', 'NASA Phoenix lander dug up and confirmed water ice just under the surface near the north pole'),
  pathfinderDustLossPerSol: nasa(0.28, '%/sol', 'Mars Pathfinder MAE experiment: solar power lost to settling dust (Landis & Jenkins, JGR 2000)'),
});

/**
 * Short facts for event cards and the in-game encyclopedia.
 * `provenance` tells the player what kind of statement each one is.
 */
export const FACTS = Object.freeze([
  { id: 'sol-length', provenance: PROVENANCE.NASA, text: 'A day on Mars is called a sol. It lasts 24 hours 39 minutes — a little longer than a day on Earth.' },
  { id: 'gcr-surface', provenance: PROVENANCE.NASA, text: "NASA's Curiosity rover measured about 0.64 millisieverts of cosmic radiation per day on the surface of Mars. On Earth we get roughly that much in three months." },
  { id: 'storm-2024', provenance: PROVENANCE.NASA, text: 'On 20 May 2024 a solar storm hit Mars. Curiosity measured 8,100 micrograys — like 30 chest X-rays at once. It was the biggest surge in 12 years.' },
  { id: 'regolith-shield', provenance: PROVENANCE.APPROX, text: 'Martian soil (regolith) is a free radiation shield. About a metre of it stops most solar storm particles. Cosmic rays are much harder to stop: it takes several metres.' },
  { id: 'thin-shield', provenance: PROVENANCE.APPROX, text: 'A thin metal wall can make cosmic radiation slightly worse: fast particles smash into the metal and make showers of new particles.' },
  { id: 'not-zero', provenance: PROVENANCE.APPROX, text: 'Even deep underground the radiation is never exactly zero. Rocks themselves are very slightly radioactive — on Earth too.' },
  { id: 'water-recycling', provenance: PROVENANCE.NASA, text: 'On the International Space Station, 98% of the water is recycled — even sweat and breath.' },
  { id: 'oxygen-from-water', provenance: PROVENANCE.APPROX, text: 'Electricity can split water into hydrogen and oxygen. Making 1 kg of oxygen uses about 1.1 kg of water.' },
  { id: 'moxie', provenance: PROVENANCE.NASA, text: "NASA's MOXIE experiment made oxygen out of Mars air: 122 grams in total, up to 12 grams an hour." },
  { id: 'dust', provenance: PROVENANCE.NASA, text: 'Dust slowly covers solar panels on Mars. Mars Pathfinder lost about 0.28% of its power every sol. Sometimes a dust devil blows the panels clean.' },
  { id: 'exercise', provenance: PROVENANCE.NASA, text: 'Mars gravity is only 38% of Earth gravity. Astronauts must exercise so their muscles and bones stay strong — about two hours a day on the space station.' },
  { id: 'ice', provenance: PROVENANCE.NASA, text: "In 2008 NASA's Phoenix lander scraped away soil and found water ice just below the surface." },
  { id: 'sunlight', provenance: PROVENANCE.NASA, text: 'Mars is farther from the Sun than Earth, so sunlight there is less than half as strong.' },
]);
