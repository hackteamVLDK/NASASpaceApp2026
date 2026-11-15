/**
 * Science Logbook, badges and Mission Report (SCENARIO Section 8). Pure data and functions.
 * A card unlocks the first time its trigger plays. Trigger keys:
 *   <lineId>        an ASTRA line (astra.*)       D:<id>  a dilemma alert       E:<id>  an event alert
 *   C:<id><choice>  a choice follow-up            R:<id>  a radio log line      (e.g. C:d1a, R:radio.exp5.02)
 * Texts live in strings.en.json as card.<id>.title / card.<id>.text.
 * Not modelled yet: Fitness (3.11), so the Strong Bones badge and the Fitness part of Crew Care are left out.
 */

/** [id, tier, triggers, real mission or organisation, source URL] */
export const CARDS = [
  ['gravity', 'core', ['astra.intro.landing'], 'NASA Mars Fact Sheet', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html'],
  ['no_shield', 'core', ['astra.intro.why_underground'], 'MAVEN', 'https://science.nasa.gov/missions/maven/nasas-maven-illuminates-new-understanding-of-auroras-at-mars/'],
  ['soil_blanket', 'core', ['astra.intro.why_underground'], 'Curiosity RAD (model checked against it)', 'https://doi.org/10.1029/2019JE006246'],
  ['sunlight', 'core', ['astra.tut.solar_done'], 'NASA Mars Fact Sheet', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html'],
  ['sol', 'core', ['astra.tut.done'], 'NASA GISS Mars24', 'https://www.giss.nasa.gov/tools/mars24/help/notes.html'],
  ['blue_sunset', 'bonus', ['astra.act1.first_sunset'], 'NASA rover images', 'https://science.nasa.gov/image-article/apod-2025-june-15-two-worlds-one-sun/'],
  ['cold_nights', 'core', ['astra.act1.first_dusk'], 'Perseverance (MEDA)', 'https://www.jpl.nasa.gov/news/nasas-first-weather-report-from-jezero-crater-on-mars/'],
  ['waste_heat', 'core', ['astra.act1.battery_built'], 'Perseverance', 'https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/power/'],
  ['global_storms', 'core', ['astra.act1.storm_begin'], 'Mars Reconnaissance Orbiter, Opportunity', 'https://science.nasa.gov/solar-system/planets/mars/10-things-massive-dust-storm-on-mars/'],
  ['storm_temps', 'bonus', ['D:d1'], 'Curiosity', 'https://www.nasa.gov/missions/how-a-tiny-curiosity-motor-identified-a-massive-martian-dust-storm/'],
  ['printed_wrench', 'core', ['astra.act1.workshop_built'], 'International Space Station', 'https://www.nasa.gov/mission_pages/station/research/news/3Dratchet_wrench'],
  ['sticky_dust', 'core', ['astra.act1.storm_end'], 'NASA dust research', 'https://ntrs.nasa.gov/api/citations/20120003263/downloads/20120003263.pdf'],
  ['sleep_missions', 'bonus', ['astra.act1.first_sleep'], 'International Space Station', 'https://www.nasa.gov/missions/station/seven-ways-astronauts-improve-sleep-may-help-you-snooze-better-on-earth/'],
  ['green_air', 'bonus', ['astra.act2.greenhouse_start'], 'NASA plant research', 'https://ntrs.nasa.gov/citations/20170011105'],
  ['perchlorates', 'core', ['astra.act2.greenhouse_built'], 'Phoenix; US EPA', 'https://www.jpl.nasa.gov/news/missing-piece-inspires-new-look-at-mars-puzzle/'],
  ['purple_garden', 'core', ['astra.act2.greenhouse_built'], 'Veggie (space station)', 'https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/'],
  ['sharp_rocks', 'core', ['astra.act2.garage_built'], 'Curiosity', 'https://jpl.nasa.gov/news/news.php?release=2014-028'],
  ['space_salad', 'core', ['astra.act2.first_harvest'], 'Veggie (space station)', 'https://www.nasa.gov/blogs/spacestation/2015/08/10/cosmonauts-complete-russian-spacewalk/'],
  ['surface_dose', 'core', ['astra.act3.radiation_lesson'], 'Curiosity RAD; US NRC', 'https://www.nasa.gov/news-release/nasa-rover-results-include-first-age-measurement-on-mars-and-help-for-human-exploration/'],
  ['slow_messages', 'core', ['astra.act3.lab_built'], 'NASA Mars Fact Sheet', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html'],
  ['chapea', 'bonus', ['astra.act3.rec_built'], 'CHAPEA', 'https://www.nasa.gov/missions/analog-field-testing/chapea/first-mars-crew-completes-yearlong-simulated-red-planet-nasa-mission/'],
  ['marsquakes', 'core', ['astra.act3.blackbox_react1'], 'InSight', 'https://www.jpl.nasa.gov/news/nasa-retires-insight-mars-lander-mission-after-years-of-science/'],
  ['methane', 'bonus', ['astra.act3.blackbox_react2'], 'Curiosity', 'https://www.nasa.gov/solar-system/curiositys-mars-methane-mystery-continues/'],
  ['wet_soil', 'bonus', ['astra.act3.roof_built'], 'Curiosity RAD (model checked against it)', 'https://doi.org/10.1029/2019JE006246'],
  ['moxie', 'core', ['astra.act3.ls_t2'], 'Perseverance (MOXIE)', 'https://www.jpl.nasa.gov/news/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/'],
  ['brine', 'bonus', ['astra.act3.deep_scan'], 'Curiosity', 'https://www.jpl.nasa.gov/news/nasa-mars-rovers-weather-data-bolster-case-for-brine/'],
  ['rock_pages', 'bonus', ['R:radio.exp5.02'], 'Curiosity', 'https://www.jpl.nasa.gov/news/curiosity-peels-back-layers-on-ancient-martian-lake/'],
  ['leopard_spots', 'core', ['astra.finale.leopard'], 'Perseverance', 'https://www.nasa.gov/news-release/nasa-says-mars-rover-discovered-potential-biosignature-last-year/'],
  ['sealed_samples', 'bonus', ['R:radio.exp5.06'], 'Perseverance', 'https://www.jpl.nasa.gov/news/nasas-perseverance-rover-collects-first-mars-rock-sample/'],
  ['long_stay', 'bonus', ['astra.sandbox.milestone_50'], 'NASA Mars Design Reference Architecture 5.0', 'https://www.nasa.gov/wp-content/uploads/2015/09/373665main_nasa-sp-2009-566.pdf'],
  ['hydrogen_shield', 'bonus', ['astra.rad.suit_liner'], 'NASA space radiation research', 'https://three.jsc.nasa.gov/articles/CucinottaKimChappell0512.pdf'],
  ['dose_adds_up', 'bonus', ['astra.tut.hp_intro'], 'NASA crew health standards', 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf'],
  ['water_98', 'bonus', ['astra.res.water_low'], 'International Space Station', 'https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/'],
  ['dust_devils', 'bonus', ['astra.t2.solar'], 'Spirit', 'https://science.nasa.gov/mission/mer-spirit/'],
  ['stacked_farm', 'bonus', ['astra.t2.greenhouse'], 'NASA plant research spinoff', 'https://spinoff.nasa.gov/indoor-farming'],
  ['rover_marathon', 'bonus', ['astra.t2.garage'], 'Opportunity', 'https://www.jpl.nasa.gov/news/nasas-opportunity-mars-rover-passes-marathon-distance/'],
  ['insight_dust', 'bonus', ['astra.mg.solar_wipe'], 'InSight', 'https://www.jpl.nasa.gov/news/nasa-retires-insight-mars-lander-mission-after-years-of-science/'],
  ['dust_hitchhikers', 'bonus', ['astra.mg.air_filter_scrub'], 'Perseverance dust studies', 'https://www.nasa.gov/missions/mars-2020-perseverance/nasas-perseverance-offers-clues-to-protect-crews-from-mars-dust/'],
  ['too_much_co2', 'bonus', ['astra.mg.valve_balance'], 'International Space Station', 'https://www.nasa.gov/missions/station/iss-research/science-in-space-august-4-2023-spacecraft-air-quality/'],
  ['thin_air', 'bonus', ['astra.mg.suit_seal_check'], 'Curiosity', 'https://www.jpl.nasa.gov/news/nasa-rover-finds-clues-to-changes-in-mars-atmosphere/'],
  ['radiation_badge', 'bonus', ['astra.mg.suit_seal_check'], 'NASA crew health standards', 'https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-tb-050-spacesuits.pdf'],
  ['last_storm', 'bonus', ['C:d1a'], 'Opportunity', 'https://www.nasa.gov/news-release/nasas-record-setting-opportunity-rover-mission-on-mars-comes-to-end/'],
  ['no_showers', 'bonus', ['C:d2c'], 'International Space Station', 'https://www.nasa.gov/image-article/astronaut-koichi-wakata-demonstrates-washing-his-hair-space/'],
  ['plants_soak', 'bonus', ['C:d3a'], 'Plant science (Environ. Sci. Technol. 2007)', 'https://doi.org/10.1021/es062337s'],
  ['soil_wash', 'bonus', ['C:d3b'], 'Soil science (Soil Systems 2021)', 'https://doi.org/10.3390/soilsystems5030037'],
  ['fast_particles', 'bonus', ['D:d5', 'E:e1'], 'MAVEN, Curiosity', 'https://www.nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/'],
  ['cliff_shelter', 'bonus', ['C:d5b'], 'Curiosity RAD', 'https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/'],
  ['flare_forecast', 'bonus', ['astra.e1.watch'], 'NOAA Space Weather Prediction Center', 'https://swpc-drupal.woc.noaa.gov/phenomena/solar-flares-radio-blackouts'],
  ['thirty_xrays', 'bonus', ['C:e1a'], 'Curiosity RAD', 'https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/'],
  ['tea_leaves', 'bonus', ['C:e3a'], 'International Space Station (Roscosmos report)', 'https://www.universetoday.com/148443/the-crew-of-the-iss-has-found-the-source-of-the-stations-air-leak'],
  ['space_flowers', 'bonus', ['C:e4a'], 'Veggie (space station)', 'https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/'],
  ['weather_station', 'bonus', ['astra.exp1.return'], 'Perseverance (MEDA)', 'https://www.jpl.nasa.gov/news/mars-is-getting-a-new-robotic-meteorologist/'],
  ['wind_ripples', 'bonus', ['R:radio.exp1.30'], 'NASA orbiters and rovers', 'https://science.nasa.gov/photojournal/ripples-or-dunes/'],
  ['hidden_ice', 'bonus', ['astra.exp3.return'], 'Mars Odyssey, MRO (SWIM project)', 'https://www.jpl.nasa.gov/news/nasa-is-locating-ice-on-mars-with-this-new-map/'],
  ['ingenuity', 'core', ['astra.exp4.at20'], 'Ingenuity', 'https://www.nasa.gov/news-release/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends/'],
  ['ancient_lake', 'bonus', ['astra.exp4.at35'], 'Perseverance', 'https://www.nasa.gov/solar-system/nasas-perseverance-rover-arrives-at-delta-for-new-science-campaign/'],
  ['strong_in_space', 'bonus', ['astra.fit.intro'], 'International Space Station', 'https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/'],
  ['mars_gravity_body', 'bonus', ['astra.fit.mars'], 'Physiology research (Frontiers in Physiology 2019)', 'https://doi.org/10.3389/fphys.2019.00899'],
].map(([id, tier, triggers, org, url]) => ({ id, tier, triggers, org, url }));

const BY_TRIGGER = new Map();
for (const c of CARDS) for (const t of c.triggers) { if (!BY_TRIGGER.has(t)) BY_TRIGGER.set(t, []); BY_TRIGGER.get(t).push(c.id); }

/** Unlock the cards for a trigger key. Returns the ids newly unlocked (the state keeps `s.logbook`). */
export function unlockFor(s, key) {
  const fresh = [];
  for (const id of BY_TRIGGER.get(key) ?? []) if (!s.logbook.includes(id)) { s.logbook.push(id); fresh.push(id); }
  return fresh;
}

/** Badges (8.3). Strong Bones needs Fitness, which is not modelled yet. */
export const BADGES = [
  ['perchlorate_wash', (s) => s.choices.includes('d3b'), 'soil_wash'],
  ['flare_safe', (s) => s.stats.flares > 0 && s.stats.flareMaxLoss <= 1 && Boolean(s.flags.finaleDone), 'fast_particles'],
  ['forecaster', (s) => s.choices.includes('e1c'), 'flare_forecast'],
  ['storm_ready', (s) => s.choices.includes('d1a') || s.choices.includes('d1b'), 'global_storms'],
  ['closed_loop', (s) => s.stats.recycleStreak >= 10, 'water_98'],
  ['air_from_mars', (s) => s.modules.lifesupport.tier === 2, 'moxie'],
  ['under_the_blanket', (s) => s.modules.roof.status === 'online', 'soil_blanket'],
  ['panel_sweeper', (s) => s.stats.wipes >= 5, 'sticky_dust'],
  ['ice_miner', (s) => s.stats.melted >= 5, 'hidden_ice'],
  // 8.3: "Sleep 8 hours or more every Sol from Sol 1 to Sol 6" (a full night in the Bedroom is 22:00-06:00 = 480 minutes)
  ['strong_bones', (s) => (s.stats.fitBest ?? 0) >= 10, 'strong_in_space'], // 8.3: Fitness 70+ for 10 Sols in a row
  ['well_rested', (s) => Array.isArray(s.stats.sleepNights) && s.stats.sleepNights.length === 6 && s.stats.sleepNights.every((m) => m >= 8 * 60), 'sleep_missions'],
  ['first_contact', (s) => Boolean(s.flags.earthContact), 'slow_messages'],
  ['space_gardener', (s) => s.stats.harvest >= 50, 'green_air'],
  ['look_dont_touch', (s) => Boolean(s.flags.passedIngenuity), 'ingenuity'],
  ['biosignature_hunter', (s) => Boolean(s.flags.done?.[5]), 'leopard_spots'],
].map(([id, test, card]) => ({ id, test, card }));

/** Check all badges; returns the ids newly earned. */
export function checkBadges(s) {
  const fresh = [];
  for (const b of BADGES) if (!s.badges.includes(b.id) && b.test(s)) { s.badges.push(b.id); fresh.push(b.id); }
  return fresh;
}

/** The Mission Report of 8.2: panels and the Mission Rating (1 to 3 stars per category, never zero). */
/** Story items and the trip that brings each one home (SCENARIO 5.5). */
const STORY_FINDS = [['probe_power_core', 1], ['weather_sensor', 1], ['black_box', 2], ['dish_antenna', 2], ['water_filter_membrane', 3], ['lab_sensor_kit', 4]];

export function buildReport(s) {
  const samples = Math.max(1, s.stats.samples);
  // 8.2: the average of HP, Fitness and Morale. Saves from before Fitness have no Fitness samples: then HP and Morale only.
  const fitSamples = s.stats.fitSamples ?? 0;
  const crewCare = fitSamples > 0
    ? (s.stats.hpSum / samples + s.stats.moraleSum / samples + s.stats.fitSum / fitSamples) / 3
    : (s.stats.hpSum / samples + s.stats.moraleSum / samples) / 2;
  const modulesBuilt = ['battery', 'workshop', 'greenhouse', 'garage', 'lab', 'recreation'].filter((id) => s.modules[id].status === 'online').length;
  const tier2 = Object.values(s.modules).filter((m) => m.tier === 2).length;
  const roof = s.modules.roof.status === 'online' ? 1 : 0;
  const builder = modulesBuilt + tier2 + roof;
  const science = s.logbook.length + 2 * s.badges.length;
  const stars = (v, two, three) => (v >= three ? 3 : v >= two ? 2 : 1);
  const rating = { crew: stars(crewCare, 60, 80), base: stars(builder, 8, 13), science: stars(science, 40, 60) };
  return {
    crewCare, builder, science, rating, total: rating.crew + rating.base + rating.science,
    hp: s.hp, lowestHp: s.stats.lowestHp, medRests: s.stats.medRests, outsideHours: Math.round(s.stats.outsideMin / 60),
    meters: { ...s.res }, emergencies: s.stats.emergencies, flares: s.stats.flares, flareMaxLoss: s.stats.flareMaxLoss ?? 0,
    // B16: the story finds the player brought home (they are used up later, so the flags of the trips count too)
    storyFinds: STORY_FINDS.filter(([item, trip]) => (s.items?.[item] ?? 0) > 0 || Boolean(s.flags?.done?.[trip])).map(([item]) => item),
    modulesBuilt, tier2, roof, dronesAwake: s.drones.filter((d) => d.status === 'awake').length,
    expeditions: s.stats.expeditions, melted: s.stats.melted, choices: [...s.choices],
    cards: s.logbook.length, totalCards: CARDS.length, badges: [...s.badges],
  };
}
