# Science fact-check of SCENARIO.md

Checked: 2026-11-14, against `SCENARIO.md` on `main` after PR #1 (bible v2 merge).
Scope: every real-world science claim in ASTRA lines, mini-game explanations, dilemma and
event follow-ups, and radio logs. Skipped: lines tagged *(fiction)* and pure gameplay
numbers (meter rates, HP, costs, shielding factors that are labelled as gameplay).

Method: for each claim a NASA page, a peer-reviewed paper, or a major science organisation
page was **opened** (not just a search snippet). Where a PDF was the source, its text was
extracted and the quoted sentence was found in it. Line numbers refer to `SCENARIO.md`.

**Result: 100 claims checked. 84 correct, 16 needed a fix (all fixed), 0 unverifiable.**
Rows F10–F16 and the six rows marked "added after Codex review" came from the independent Codex review.
The 23 rows marked "added with the open-items specs" cover new claims in SCENARIO.md Sections 3.10, 3.11 and 8;
the other Science Logbook cards restate claims already checked above. The team's decisions on the
9 fixes are in [Decisions](#decisions-2026-11-14); an independent Codex review is in
[content/ai-collaboration/records/20261114-science-fact-check-review.md](../ai-collaboration/records/20261114-science-fact-check-review.md).
This file does not change `SCENARIO.md`; fixes need a team decision first.

Verdicts: **correct** (matches the source, at kid-friendly precision) · **needs fix**
(wrong, overstated, or presented as real when it is not) · **unverifiable** (no adequate
source found).
Data label: the label the claim should carry in `src/data/*.js` and in docs:
`nasa_measurement`, `approximation` or `gameplay`.

## Needs fix (summary)

| # | Line ID (line) | Problem | Suggested fix |
|---|---|---|---|
| F1 | Dilemma 3, choice B follow-up (886) | "Perchlorates dissolve in water, so we rinsed them away" overstates it. A 2021 peer-reviewed study found that washing could **not completely remove** perchlorate from Mars regolith simulant, despite its high solubility, and the washed soil may still be toxic to plants. | "Perchlorates dissolve in water, so rinsing washes a lot of them out. But rinsing can leave some behind, so real scientists are still testing ways to make Mars soil safe for farms." |
| F2 | astra.d5.alert / Dilemma 5 alert (901, JSON 1153) | "It will reach Mars in about 2 hours." In the May 2024 storm, NASA says the particles reached Mars "in just tens of minutes". | "...a solar storm! The fastest particles can reach Mars in under an hour." (Keep the game's warning time as a gameplay value.) |
| F3 | Event 1 alert (922) | Same "about 2 hours" claim. | "...will hit Mars very soon, maybe in less than an hour." |
| F4 | Expedition 3, ASTRA on return (779) and 5.2 row 3 (736) | A buried ice patch at Jezero's rim is shown as real. Jezero is at ~18°N; NASA's ice map puts shallow ice in the mid-latitudes, and the best ice landing zones are the *southern edge* of that belt, far north of Jezero. | Tag the Crater Rim Ice site *(fiction)*. Optionally add: "Real ice this close to the equator would be a lucky find!" |
| F5 | astra.act3.blackbox_react2 (218) | "On Earth, most methane comes from living things" is stronger than the NASA source, which calls microbial life "an important source". | "On Earth, a lot of methane comes from living things, like microbes." |
| F6 | Event 3, choice A follow-up (946) | "astronauts on the space station found a tiny leak": it was Russian **cosmonaut** Anatoly Ivanishin, in October 2020. | "In 2020, the space station crew found a tiny leak by watching floating tea leaves drift toward the hole!" |
| F7 | Event 4, choice A follow-up (958) | "rescued sick zinnia flowers... by changing how he watered them": NASA says the zinnias were overwatered with poor airflow, mold grew, and Kelly **cleaned off the fungus and nursed** the survivors. | "In 2016, astronaut Scott Kelly rescued moldy zinnia flowers on the space station by cleaning them and nursing them back to health, and they bloomed!" |
| F8 | Event 1, choice C follow-up (928) | "Robots don't mind radiation as much as people" is too broad: in the same May 2024 storm, radiation knocked Mars Odyssey's star camera offline for an hour. | "Our drones are built to handle radiation better than people, so they kept building while we stayed safe." |
| F9 | log.pathfinder.02–04 (214–216) | Only log.01 carries *(fiction)*. Log.03's "40 parts per billion" methane spike is about twice the largest value Curiosity has really measured (~21 ppb). | Tag log.02–04 *(fiction)* so the number is never presented as a real reading. |

## Full table

| Line ID (line) | Claim | Verdict | Source URL | Data label | Suggested fix |
|---|---|---|---|---|---|
| astra.intro.landing | Mars gravity is 38% of Earth's | correct (fact sheet: 3.73 vs 9.82 m/s², ratio 0.380) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | nasa_measurement | — |
| astra.intro.why_underground | Mars has very thin air and no magnetic shield around the whole planet | correct (no global field today; only local crustal fields) | https://science.nasa.gov/missions/maven/nasas-maven-illuminates-new-understanding-of-auroras-at-mars/ | approximation | — |
| astra.intro.why_underground | Space radiation reaches the ground; soil above blocks most of it | correct (0.8–2.5 m of regolith keeps annual dose under 100 mSv) | https://doi.org/10.1029/2019JE006246 (Röstel et al. 2020, JGR Planets) | approximation | — |
| astra.tut.solar_done | Mars gets less than half the sunlight Earth does | correct (586 vs 1361 W/m², 43%) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | nasa_measurement | — |
| astra.tut.done | A sol is 39 minutes longer than an Earth day | correct (24 h 39 min 35 s) | https://www.giss.nasa.gov/tools/mars24/help/notes.html | nasa_measurement | — |
| astra.act1.first_sunset | Fine dust makes Martian sunsets glow blue, the opposite of Earth | correct (Mars sunsets bluer near the Sun, Earth's orange; dust forward-scattering, "not fully understood") | https://science.nasa.gov/image-article/apod-2025-june-15-two-worlds-one-sun/ · https://science.nasa.gov/solar-system/planets/mars/what-does-a-sunrise-sunset-look-like-on-mars/ | approximation | — |
| astra.act1.first_dusk, astra.act1.battery_built, 4.5 ASTRA | Nights drop to about −80 °C | correct (Perseverance MEDA low at Jezero: −83 °C) | https://www.jpl.nasa.gov/news/nasas-first-weather-report-from-jezero-crater-on-mars/ | approximation | — |
| astra.act1.battery_built, 4.5 ASTRA | Perseverance stays warm with spare heat from its power generator, piped around the rover | correct (MMRTG excess heat in a fluid loop) | https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/power/ | approximation | — |
| astra.act1.storm_begin | Dust storms can grow to cover the whole planet | correct (2018 storm was "planet-encircling") | https://science.nasa.gov/solar-system/planets/mars/10-things-massive-dust-storm-on-mars/ | approximation | — |
| astra.act1.workshop_built | In 2014, ISS astronauts 3D-printed a wrench from a design sent up from Earth | correct (file sent to space, printed in 4 hours, Dec 2014) | https://www.nasa.gov/mission_pages/station/research/news/3Dratchet_wrench | nasa_measurement | — |
| astra.act1.storm_end | Mars dust is very fine and clings to everything (static) | correct (tribocharging causes strong adhesion to panels) | https://ntrs.nasa.gov/api/citations/20120003263/downloads/20120003263.pdf | approximation | — |
| astra.act2.greenhouse_built | Martian soil has perchlorates, found by Phoenix in 2008 | correct | https://www.jpl.nasa.gov/news/missing-piece-inspires-new-look-at-mars-puzzle/ | nasa_measurement | — |
| astra.act2.greenhouse_built | Perchlorates are bad for people | correct (block iodide uptake by the thyroid) | https://www.epa.gov/sdwa/perchlorate-drinking-water-frequent-questions | approximation | — |
| astra.act2.greenhouse_built, 4.6 ASTRA | Plants use red and blue light most; the grow room glows purple | correct (plants "use more red and blue wavelengths"; Veggie "glows magenta pink") | https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/ | approximation | — |
| astra.act2.garage_built, 4.7 ASTRA | Sharp rocks put holes and cracks in Curiosity's metal wheels | correct (punctures in aluminum wheels, 2013) | https://jpl.nasa.gov/news/news.php?release=2014-028 | nasa_measurement | — |
| astra.act2.first_harvest | In 2015, ISS astronauts ate lettuce grown in space | correct (Aug 10, 2015, Veggie) | https://www.nasa.gov/blogs/spacestation/2015/08/10/cosmonauts-complete-russian-spacewalk/ | nasa_measurement | — |
| astra.act3.radiation_lesson | One day on the Martian surface ≈ three months of Earth's natural background radiation | correct (Mars surface 0.67 mSv/day; US natural background ~3.1 mSv/yr ≈ 0.78 mSv per 3 months) | https://www.nasa.gov/news-release/nasa-rover-results-include-first-age-measurement-on-mars-and-help-for-human-exploration/ · https://www.nrc.gov/about-nrc/radiation/around-us/doses-daily-lives.html | approximation | — |
| astra.act3.lab_built, 4.9 ASTRA, data labels | Radio takes about 3 to 22 minutes between Mars and Earth | correct (54.6–401.4 million km at light speed = 3.0–22.3 min) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | approximation | — |
| astra.act3.earth_reply, astra.finale.earth, ui.mg.dish_antenna_alignment.counter ({delay}) | The Earth-Mars one-way light time on the current Sol (about 13–15 min during the campaign), computed in `src/data/nasa/lightTime.js` | correct (Keplerian elements, Table 1, 1800–2050; tested against the 2003, 2018 and 2020 closest approaches: <0.5% distance error) | https://ssd.jpl.nasa.gov/planets/approx_pos.html | approximation | — |
| astra.act3.rec_built | CHAPEA: four volunteers, 378 days, 3D-printed mock Mars home in Texas | correct (Johnson Space Center, Houston; 2023–2024) | https://www.nasa.gov/missions/analog-field-testing/chapea/first-mars-crew-completes-yearlong-simulated-red-planet-nasa-mission/ | nasa_measurement | — |
| astra.act3.blackbox_react1 | InSight felt more than 1,300 marsquakes | correct (1,319) | https://www.jpl.nasa.gov/news/nasa-retires-insight-mars-lander-mission-after-years-of-science/ | nasa_measurement | — |
| astra.act3.blackbox_react2 | On Earth, most methane comes from living things | **needs fix** (NASA: "an important source") | https://www.nasa.gov/solar-system/curiositys-mars-methane-mystery-continues/ | approximation | F5 |
| astra.act3.blackbox_react2, astra.finale.methane | Methane can also come from water reacting with rocks; Curiosity detected methane; source unknown | correct | https://www.nasa.gov/solar-system/curiositys-mars-methane-mystery-continues/ | approximation | — |
| astra.act3.roof_built | Scientists think a few meters of soil could protect Mars bases | correct (0.8–2.5 m, depending on soil) | https://doi.org/10.1029/2019JE006246 | approximation | — |
| astra.act3.ls_t2, 4.3 ASTRA | Mars air is mostly carbon dioxide | correct (95.1% CO₂) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | nasa_measurement | — |
| astra.act3.ls_t2, 4.3 ASTRA | MOXIE made 122 g of oxygen, about what a small dog breathes in 10 hours | correct (NASA's own comparison) | https://www.jpl.nasa.gov/news/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/ | nasa_measurement | — |
| astra.act3.deep_scan | Salt keeps water from freezing in the Martian cold | correct (perchlorate lowers the freezing temperature of water) | https://www.jpl.nasa.gov/news/nasa-mars-rovers-weather-data-bolster-case-for-brine/ | approximation | — |
| log.pathfinder.02–04 | 37-minute pulse; 40 ppb methane spike | **needs fix** (fiction, but not tagged; real maximum measured ~21 ppb) | https://www.nasa.gov/solar-system/curiositys-mars-methane-mystery-continues/ | gameplay | F9 |
| radio.exp5.02 | Canyon rock layers are pages of Mars history | correct (layers grow younger upward and record past lakes and rivers) | https://www.jpl.nasa.gov/news/curiosity-peels-back-layers-on-ancient-martian-lake/ | approximation | — |
| radio.exp5.05 | Leopard spots: tiny dark rings with light centers | correct (light patches each ringed with dark material) | https://science.nasa.gov/resource/perseverance-finds-a-rock-with-leopard-spots/ | approximation | — |
| astra.finale.leopard | 2024: Perseverance found Cheyava Falls in Jezero; 2025: one of the best clues of ancient life, a clue not proof | correct ("potential biosignature", Nature, Sept 2025; "closest we have ever come") | https://www.nasa.gov/news-release/nasa-says-mars-rover-discovered-potential-biosignature-last-year/ | nasa_measurement | — |
| radio.exp5.06 | Samples sealed in tubes, like Perseverance | correct (hermetically sealed titanium tubes) | https://www.jpl.nasa.gov/news/nasas-perseverance-rover-collects-first-mars-rock-sample/ | approximation | — |
| astra.sandbox.milestone_50 | Real Mars missions plan stays of more than a year | correct (DRA 5.0: ~500 days on Mars) | https://www.nasa.gov/wp-content/uploads/2015/09/373665main_nasa-sp-2009-566.pdf | approximation | — |
| astra.rad.suit_liner | Hydrogen-rich materials (water, some plastics) block space radiation well | correct (hydrogen-rich hydrocarbons beat aluminum) | https://three.jsc.nasa.gov/articles/CucinottaKimChappell0512.pdf | approximation | — |
| astra.rad.rover_shield | Mars soil makes a good shield | correct | https://doi.org/10.1029/2019JE006246 | approximation | — |
| astra.res.water_low, core rules, 3.5, 4.4 ASTRA, Dilemma 2 | The ISS recycles 98% of its water, including sweat, breath and urine | correct (98% reached with the Brine Processor) | https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/ | nasa_measurement | — |
| astra.t2.solar | Wind gusts sometimes cleaned Spirit's and Opportunity's panels | correct | https://www.jpl.nasa.gov/news/spirit-gets-energy-boost-from-cleaner-solar-panels/ | approximation | — |
| astra.t2.garage | Opportunity drove about 45 km, more than a marathon | correct (45 km total; passed 42.195 km in March 2015) | https://www.nasa.gov/news-release/nasas-record-setting-opportunity-rover-mission-on-mars-comes-to-end/ · https://www.jpl.nasa.gov/news/nasas-opportunity-mars-rover-passes-marathon-distance/ | nasa_measurement | — |
| 4.1 ASTRA | Dust on its solar panels ended InSight's mission in 2022 | correct (Dec 2022, "dead bus") | https://www.jpl.nasa.gov/news/nasa-retires-insight-mars-lander-mission-after-years-of-science/ | nasa_measurement | — |
| 4.1 ASTRA | Mars dust is full of static, so it clings to panels | correct | https://ntrs.nasa.gov/api/citations/20120003263/downloads/20120003263.pdf | approximation | — |
| 4.3 ASTRA | Too much CO₂ makes people sleepy and sick | correct (fatigue, headache, breathing difficulties) | https://www.nasa.gov/missions/station/iss-research/science-in-space-august-4-2023-spacecraft-air-quality/ | approximation | — |
| 4.6 ASTRA | Without soil, the water must carry every nutrient | correct (by definition of hydroponics; Veggie delivers water and nutrients to roots) | https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/ | approximation | — |
| 4.8 ASTRA | Mars air is about 100 times thinner than Earth's | correct | https://www.jpl.nasa.gov/news/nasa-rover-finds-clues-to-changes-in-mars-atmosphere/ | approximation | — |
| 4.8 ASTRA | Real astronauts wear radiation badges | correct (personal passive dosimeter required) | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-tb-050-spacesuits.pdf | approximation | — |
| Dilemma 1, A follow-up | In 2018 a dust storm covered all of Mars and Opportunity ran out of power | correct (Mars-wide storm; solar rover could not recharge) | https://www.nasa.gov/news-release/nasas-record-setting-opportunity-rover-mission-on-mars-comes-to-end/ · https://science.nasa.gov/solar-system/planets/mars/10-things-massive-dust-storm-on-mars/ | nasa_measurement | — |
| Dilemma 2, C follow-up | ISS astronauts take sponge baths | correct (no showers; rinseless shampoo, wet towel) | https://www.nasa.gov/image-article/astronaut-koichi-wakata-demonstrates-washing-his-hair-space/ | approximation | — |
| Dilemma 3, A follow-up | Plants soak up perchlorates | correct (lettuce accumulates perchlorate in its leaves) | https://doi.org/10.1021/es062337s (Seyfferth & Parker 2007) | approximation | — |
| Dilemma 3, B follow-up | Perchlorates dissolve in water, so rinsing removes them | **needs fix** (washing cannot remove all of it) | https://doi.org/10.3390/soilsystems5030037 (Oze et al. 2021, Soil Systems) | approximation | F1 |
| Dilemma 4, B follow-up | Most vegetables stop growing close to freezing | correct (growth slows sharply near the minimum; cool-season crops survive light frost) | https://ag.purdue.edu/department/hla/extension/extension-publications-library/ext-pubs/ho-203-w.html | approximation | optional: "grow very slowly" |
| Dilemma 5 alert, astra.d5.alert | Solar storm particles reach Mars in about 2 hours | **needs fix** (unsupported event-specific prediction: arrival time varies, and in May 2024 NASA says particles reached Mars in "tens of minutes") | https://www.nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/ | approximation | F2 |
| Dilemma 5, B follow-up | Thick rock blocks radiation like soil | correct (cliffsides or lava tubes give extra shielding) | https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/ | approximation | — |
| Event 1 alert | Particles hit Mars in about 2 hours | **needs fix** (unsupported event-specific prediction, same as F2) | https://www.nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/ | approximation | F3 |
| Event 1 early warning (Lab T2 / Storm Watch) | A flare warning 1 Sol ahead, framed as a forecast: "The Sun has a stormy spot facing Mars. A flare could come soon." | correct as a forecast (flares come from active regions; forecasters give probabilities, not exact times) | https://swpc-drupal.woc.noaa.gov/phenomena/solar-flares-radio-blackouts | approximation | — (added with the F3 decision) |
| Event 1, A follow-up | May 2024: astronaut next to Curiosity would get a dose like 30 chest X-rays | correct (8,100 micrograys) | https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/ | nasa_measurement | — |
| Event 1, C follow-up | Robots don't mind radiation as much as people | **needs fix** (Odyssey's camera was knocked offline by the same storm) | https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/ | approximation | F8 |
| Event 2, A follow-up | Dust devils sometimes cleaned Spirit's and Opportunity's panels | correct (Spirit: 60% → 93% power, March 2005) | https://science.nasa.gov/mission/mer-spirit/ | nasa_measurement | — |
| Event 3, A follow-up | In 2020, ISS astronauts found a leak with a floating tea leaf | **needs fix** (it was cosmonaut Ivanishin) | https://www.universetoday.com/148443/the-crew-of-the-iss-has-found-the-source-of-the-stations-air-leak (space news, reporting Roscosmos) · https://www.nasa.gov/blogs/spacestation/2020/10/19/crews-change-command-on-tuesday-leak-temporarily-sealed/ (NASA: Russian crew sealed the leak; no tea-leaf detail) | approximation | F6 |
| Event 4, A follow-up | In 2016 Scott Kelly rescued sick zinnias by changing the watering | **needs fix** (he cleaned off mold and nursed them) | https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/ · https://www.nasa.gov/humans-in-space/zinnias-from-space-nasa-studies-the-multiple-benefits-of-gardening/ | nasa_measurement | F7 |
| Expedition 1 radio, 30% | Mars wind shapes sand ripples, like dunes on Earth | correct | https://science.nasa.gov/photojournal/ripples-or-dunes/ | approximation | — |
| Expedition 3, ASTRA on return | Mars has lots of frozen water, mostly underground and near the poles | correct | https://science.nasa.gov/mars/facts/ · https://www.jpl.nasa.gov/news/nasa-is-locating-ice-on-mars-with-this-new-map/ | approximation | — |
| Expedition 3, ASTRA on return; 5.2 row 3 | A small buried ice patch sits in the shadow of Jezero's rim | **needs fix** (not expected at 18°N; must be tagged fiction) | https://www.jpl.nasa.gov/news/nasa-is-locating-ice-on-mars-with-this-new-map/ | gameplay | F4 |
| Expedition 4, ASTRA at 20% | Ingenuity was the first helicopter on another planet, in 2021, and made 72 flights | correct | https://www.nasa.gov/news-release/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends/ | nasa_measurement | — |
| Expedition 4, ASTRA at 35% | Billions of years ago a river flowed into a lake in Jezero; the delta's mud is a good place to look for ancient life | correct ("billions of years ago"; delta base rocks were "once mud on the bottom of Lake Jezero") | https://www.nasa.gov/solar-system/nasas-perseverance-rover-arrives-at-delta-for-new-science-campaign/ | approximation | — |
| astra.tut.hp_intro, astra.act2.surface_warning, astra.hp.25, Event 1 B follow-up | Rest and fresh food "bring back" HP lost to radiation | **needs fix** (radiation dose is cumulative over a career, which is why NASA caps it; rest restores energy, not radiation damage) | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf | approximation | F10 |
| astra.act3.roof_built, astra.rad.rover_shield | Soil keeps "almost all" radiation outside; soil makes "a great shield" | **needs fix** (regolith gives large, depth- and composition-dependent reductions, not near-total blocking) | https://doi.org/10.1029/2019JE006246 | approximation | F11 |
| astra.act3.deep_scan | Salt keeps water from freezing in the Martian cold | **needs fix** (salt lowers the freezing temperature; very cold brine still freezes) | https://www.jpl.nasa.gov/news/nasa-mars-rovers-weather-data-bolster-case-for-brine/ | approximation | F12 |
| Dilemma 4, A follow-up | The 3-Sol wait for Earth contact is because Mars and Earth keep moving | **needs fix** (the 3-Sol window is a game schedule, not planetary motion) | — | gameplay | F13 |
| Event 2, B and C follow-ups | Stowed panels "don't get buried"; hands-on cleaning "works every time" | **needs fix** (guarantees, not engineering facts) | — | gameplay | F14 |
| Dilemma 1 alert; 3.3 extra power rules | In a dust storm the heaters must work extra hard | **needs fix** (dust storms make Mars days cooler but nights warmer) | https://www.nasa.gov/missions/how-a-tiny-curiosity-motor-identified-a-massive-martian-dust-storm/ | approximation | F15 |
| 4.6 trigger and ASTRA; Event 4 C follow-up | Without soil, the water must carry "every nutrient" | **needs fix** (plants also take carbon from CO₂ in the air; the water carries the minerals) | https://ntrs.nasa.gov/citations/20170011105 | approximation | F16 |
| astra.act1.first_sleep | Rest is a real part of every space mission | correct (strict sleep schedules; sleep loss causes fatigue-induced errors) | https://www.nasa.gov/missions/station/seven-ways-astronauts-improve-sleep-may-help-you-snooze-better-on-earth/ | approximation | — (added after Codex review) |
| astra.act2.greenhouse_start | Plants make oxygen | correct (photosynthesis generates oxygen and removes CO₂) | https://ntrs.nasa.gov/citations/20170011105 | approximation | — (added after Codex review) |
| astra.act3.lab_built | Radio travels at the speed of light, the fastest thing there is | correct (communications are bound by the speed of light) | https://www.nasa.gov/missions/tech-demonstration/space-communications-7-things-you-need-to-know/ | approximation | — (added after Codex review) |
| astra.t2.greenhouse | Stacking trays grows more food in the same small room | correct (vertical farms grow more crops in a much smaller area) | https://spinoff.nasa.gov/indoor-farming | approximation | — (added after Codex review) |
| 4.2 ASTRA | Dust rides in on spacesuits; clean filters keep it out of lungs | correct (suits collect fine dust; fine particles can reach deep into the lungs) | https://www.nasa.gov/missions/mars-2020-perseverance/nasas-perseverance-offers-clues-to-protect-crews-from-mars-dust/ | approximation | — (added after Codex review) |
| Expedition 1, ASTRA on return | Weather probes measure wind, dust and temperature | correct (MEDA measures temperature, wind, pressure, humidity and dust) | https://www.jpl.nasa.gov/news/mars-is-getting-a-new-robotic-meteorologist/ | approximation | — (added after Codex review) |
| 3.11; astra.fit.intro; card.strong_in_space | In space, weight-bearing bones lose about 1% of their density per month without countermeasures; station crews exercise about 2 h a day | correct ("roughly 1% less dense" per month; "an average of two hours a day") | https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/ | nasa_measurement | — (added with the open-items specs) |
| astra.fit.rec_open; 3.11 | The space station has an exercise bike, a treadmill and a weight machine | correct (stationary bike, TVIS treadmill, ARED resistive device) | https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/ | approximation | — (added with the open-items specs) |
| astra.fit.mars; card.mars_gravity_body; 3.11 | Bone and muscle loss in Mars gravity is not well known; rats carrying 40% of their weight lost grip strength in two weeks | correct (partial-gravity physiology "far less well understood"; grip force −6.18% after 14 days at 40% weight bearing) | https://doi.org/10.3389/fphys.2019.00899 | approximation | — (added with the open-items specs) |
| card.gravity | At 38% gravity you could jump about two and a half times higher | correct (jump height scales with 1/g: 9.82/3.73 = 2.6; ignores a spacesuit) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | approximation | — (added with the open-items specs) |
| card.cold_nights | Perseverance measured −83 °C one night at Jezero | correct | https://www.jpl.nasa.gov/news/nasas-first-weather-report-from-jezero-crater-on-mars/ | nasa_measurement | — (added with the open-items specs) |
| card.wet_soil | Soil with water in it shields radiation better, because of its hydrogen | correct (hydrogen in water-rich regolith reduces equivalent dose) | https://doi.org/10.1029/2019JE006246 | approximation | — (added with the open-items specs) |
| card.hydrogen_shield | Liquid hydrogen is the best shield but hard to use | correct ("Liquid hydrogen remains the optimal shielding material") | https://three.jsc.nasa.gov/articles/CucinottaKimChappell0512.pdf | approximation | — (added with the open-items specs) |
| card.dose_adds_up | NASA's career limit is 600 mSv of spaceflight radiation | correct (NASA-STD-3001: career effective dose less than 600 mSv) | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf | nasa_measurement | — (added with the open-items specs) |
| card.radiation_badge | A personal dosimeter is required for every crew member | correct (required by CFR and OSHA for monitoring astronaut exposure) | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-tb-050-spacesuits.pdf | approximation | — (added with the open-items specs) |
| card.dust_devils | In March 2005 dust devils raised Spirit's power from about 60% to 93% | correct | https://science.nasa.gov/mission/mer-spirit/ | nasa_measurement | — (added with the open-items specs) |
| card.stacked_farm | A two-acre indoor farm grows about as much as a 720-acre outdoor farm | correct as reported by NASA Spinoff (a company figure) | https://spinoff.nasa.gov/indoor-farming | approximation | — (added with the open-items specs) |
| card.green_air | Plants for space life support have been tested since the 1950s and 60s | correct | https://ntrs.nasa.gov/citations/20170011105 | approximation | — (added with the open-items specs) |
| card.marsquakes | Some marsquakes were caused by space rocks hitting Mars | correct ("including quakes caused by meteoroid impacts") | https://www.jpl.nasa.gov/news/nasa-retires-insight-mars-lander-mission-after-years-of-science/ | nasa_measurement | — (added with the open-items specs) |
| card.last_storm | Opportunity fell silent in the June 2018 storm and was never heard from again | correct (last communication June 10, 2018; recovery ended) | https://www.nasa.gov/news-release/nasas-record-setting-opportunity-rover-mission-on-mars-comes-to-end/ | nasa_measurement | — (added with the open-items specs) |
| card.sealed_samples | Samples are sealed in airtight titanium tubes for possible future collection | correct | https://www.jpl.nasa.gov/news/nasas-perseverance-rover-collects-first-mars-rock-sample/ | approximation | — (added with the open-items specs) |
| card.sleep_missions | Crews keep strict sleep schedules, even before launch; sleep loss causes fatigue errors | correct | https://www.nasa.gov/missions/station/seven-ways-astronauts-improve-sleep-may-help-you-snooze-better-on-earth/ | approximation | — (added with the open-items specs) |
| card.no_showers | No showers on the station because water is limited and microgravity | correct | https://www.nasa.gov/image-article/astronaut-koichi-wakata-demonstrates-washing-his-hair-space/ | approximation | — (added with the open-items specs) |
| card.rock_pages | Rock layers get younger upward; Curiosity reads them for ancient lakes and rivers | correct | https://www.jpl.nasa.gov/news/curiosity-peels-back-layers-on-ancient-martian-lake/ | approximation | — (added with the open-items specs) |
| card.brine | Tiny amounts of brine may form in Martian soil on some nights | correct | https://www.jpl.nasa.gov/news/nasa-mars-rovers-weather-data-bolster-case-for-brine/ | approximation | — (added with the open-items specs) |
| card.weather_station | MEDA measures temperature, wind, pressure, humidity, and dust amount, size and shape | correct | https://www.jpl.nasa.gov/news/mars-is-getting-a-new-robotic-meteorologist/ | approximation | — (added with the open-items specs) |
| card.hidden_ice | NASA maps buried ice to choose landing sites for astronauts | correct | https://www.jpl.nasa.gov/news/nasa-is-locating-ice-on-mars-with-this-new-map/ | approximation | — (added with the open-items specs) |
| card.ingenuity | Ingenuity first flew on April 19, 2021; mission ended 2024 | correct | https://www.nasa.gov/news-release/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends/ | nasa_measurement | — (added with the open-items specs) |
| badge.first_contact.text | A message to Earth crosses millions of kilometers | correct (54.6 to 401.4 million km) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | nasa_measurement | — (added with the open-items specs) |
| astra.intro.why_underground (readability pass) | Space radiation is invisible energy that zooms in from the Sun and deep space | correct (galactic cosmic rays from outside the solar system, solar particle events from the Sun) | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf | approximation | — (added with the readability pass) |
| card.perchlorates (readability pass) | The thyroid is a small gland in the neck that helps the body grow | correct (thyroid hormones matter for metabolism, growth and development) | https://www.epa.gov/sdwa/perchlorate-drinking-water-frequent-questions | approximation | — (added with the readability pass) |

## Other observations (outside the science scope)

- `astra.act1.first_sleep` says sleep "gave you back 10 HP", but Section 3.6 gives sleep as +12 HP
  per night. This is a gameplay inconsistency, not a science error.
- Section 4.6 and the Greenhouse use hydroponics. NASA's Veggie uses clay "pillows" with
  fertilizer, not pure water. That is fine for our design, but ASTRA should not say Veggie is
  hydroponic.

## Decisions (2026-11-14)

All nine fixes were accepted and applied to `SCENARIO.md` on branch `content/science-fact-check`
(final wording below, where the team changed it).

| # | Decision | Final wording in SCENARIO.md |
|---|---|---|
| F1 | accepted, team wording, softened after Codex finding C2; Soil Beds bonus kept (partial cleaning still helps) | "Perchlorates dissolve in water, so rinsing washes a lot of them out. But rinsing can leave some behind, so real scientists are still testing ways to make Mars soil safe for farms." |
| F2 | accepted, team wording; also in the Section 7 JSON | "...a solar storm! The fastest particles can reach Mars in less than an hour, so we must decide fast!" |
| F3 | accepted, team wording; early warning reframed as a forecast (row added above) | "Solar flare! Its fastest particles can reach Mars in less than an hour." · watch line: "The Sun has a stormy spot facing Mars. A flare could come soon." |
| F4 | accepted | Site tagged (fiction) in the 5.2 table and the Expedition 3 line; added "Real ice this close to the equator would be a lucky find!" |
| F5 | accepted | "On Earth, a lot of methane comes from living things, like microbes." |
| F6 | accepted | "In 2020, the space station crew found a tiny leak..." |
| F7 | accepted | "...rescued moldy zinnia flowers on the space station by cleaning them and nursing them back to health, and they bloomed!" |
| F8 | accepted, team wording | "Our drones are built to handle radiation better than people, but even robots can glitch in a big storm. In 2024, one hit knocked a Mars orbiter's star camera offline for an hour!" |
| F9 | accepted | log.pathfinder.02–04 tagged (fiction) |

Also from the "other observations": `astra.act1.first_sleep` now says 12 HP (Section 3.6 is the source
of truth). `SCENARIO.md` never names NASA's Veggie, so no change was needed; rule for future text:
describe Veggie as "plant pillows with clay and fertilizer", never as hydroponic.

### Codex review findings (decided 2026-11-14)

| # | Fix | Decision | Final wording in SCENARIO.md |
|---|---|---|---|
| F10 | C1 | accepted: HP is health and energy; rest restores energy; real radiation adds up, so astronauts limit time outside | hp_intro: "...Sleep and fresh food restore your energy. Real radiation adds up over time, so astronauts limit their time outside." · surface_warning: "Rest brings your energy back, but real radiation adds up over time, so keep trips short." · hp.25: "Rest and fresh food will restore your energy." · Event 1 B: "Rest brings your energy back, but real radiation adds up over time, so it's better to avoid it." |
| F11 | C6 | accepted | "...so it blocks most of the radiation." · "Mars soil cuts the radiation a lot, and there's plenty of it!" |
| F12 | C7 | accepted | "Salt helps water stay liquid even when it's very cold." |
| F13 | C8 | accepted, team wording | "Earth will still be there. Our next radio slot is in 3 Sols." |
| F14 | C9 | accepted | "...but they're safer from the dust." · "Hands-on cleaning did the trick!" |
| F15 | C10 | accepted: same ×4 storm power draw, now blamed on the dust-filter fans; fact added | Dilemma 1: "...our dust-filter fans will have to work extra hard. Fun fact: dust storms make Mars days cooler and nights warmer." · 3.3: Battery & Heating ×4 "because it also runs the base's dust-filter fans, which work overtime in a storm (gameplay value)." |
| F16 | C11 | accepted | "all the minerals their roots need" (4.6 twice, Event 4 C) |
| — | C12 | accepted | six rows added above |
| — | C2 | accepted: F1 now says "rinsing can leave some behind" | see F1 |
| — | C3 | accepted as verdict wording only (F2/F3 rows); no text change | — |
| — | C4 | not applied: team keeps "a lot of methane" (F5) | — |
| — | C5, C13 | not applied (see the Codex record for reasons) | — |

### Readability pass (2026-11-14, branch content/readability)

35 player-facing lines were reworded for ages 7–8 (shorter sentences, hard words explained or
replaced). Every reworded science line was re-checked against its row above; meaning and numbers
are unchanged. Two precision fixes came with it: "The base is safe under the soil" and "Our
underground rooms are safe" now say "well shielded" (radiation underground is reduced, never zero).
Two new explanatory claims were added as rows above.

