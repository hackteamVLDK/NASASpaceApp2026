# Science fact-check of SCENARIO.md

Checked: 2026-11-14, against `SCENARIO.md` on `main` after PR #1 (bible v2 merge).
Scope: every real-world science claim in ASTRA lines, mini-game explanations, dilemma and
event follow-ups, and radio logs. Skipped: lines tagged *(fiction)* and pure gameplay
numbers (meter rates, HP, costs, shielding factors that are labelled as gameplay).

Method: for each claim a NASA page, a peer-reviewed paper, or a major science organisation
page was **opened** (not just a search snippet). Where a PDF was the source, its text was
extracted and the quoted sentence was found in it. Line numbers refer to `SCENARIO.md`.

**Result: 61 claims checked. 52 correct, 9 need a fix, 0 unverifiable.**
This file does not change `SCENARIO.md`; fixes need a team decision first.

Verdicts: **correct** (matches the source, at kid-friendly precision) · **needs fix**
(wrong, overstated, or presented as real when it is not) · **unverifiable** (no adequate
source found).
Data label: the label the claim should carry in `src/data/*.js` and in docs:
`nasa_measurement`, `approximation` or `gameplay`.

## Needs fix (summary)

| # | Line ID (line) | Problem | Suggested fix |
|---|---|---|---|
| F1 | Dilemma 3, choice B follow-up (886) | "Perchlorates dissolve in water, so we rinsed them away" overstates it. A 2021 peer-reviewed study found that washing could **not completely remove** perchlorate from Mars regolith simulant, despite its high solubility, and the washed soil may still be toxic to plants. | "Perchlorates dissolve in water, so rinsing washes a lot of them out. Real scientists found some always stays behind, so they're still testing ways to make Mars soil safe for farms." |
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
| Dilemma 5 alert, astra.d5.alert | Solar storm particles reach Mars in about 2 hours | **needs fix** (NASA: "tens of minutes" in May 2024) | https://www.nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/ | approximation | F2 |
| Dilemma 5, B follow-up | Thick rock blocks radiation like soil | correct (cliffsides or lava tubes give extra shielding) | https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/ | approximation | — |
| Event 1 alert | Particles hit Mars in about 2 hours | **needs fix** (same as F2) | https://www.nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/ | approximation | F3 |
| Event 1, A follow-up | May 2024: astronaut next to Curiosity would get a dose like 30 chest X-rays | correct (8,100 micrograys) | https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/ | nasa_measurement | — |
| Event 1, C follow-up | Robots don't mind radiation as much as people | **needs fix** (Odyssey's camera was knocked offline by the same storm) | https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/ | approximation | F8 |
| Event 2, A follow-up | Dust devils sometimes cleaned Spirit's and Opportunity's panels | correct (Spirit: 60% → 93% power, March 2005) | https://science.nasa.gov/mission/mer-spirit/ | nasa_measurement | — |
| Event 3, A follow-up | In 2020, ISS astronauts found a leak with a floating tea leaf | **needs fix** (it was cosmonaut Ivanishin) | https://www.universetoday.com/148443/the-crew-of-the-iss-has-found-the-source-of-the-stations-air-leak | approximation | F6 |
| Event 4, A follow-up | In 2016 Scott Kelly rescued sick zinnias by changing the watering | **needs fix** (he cleaned off mold and nursed them) | https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/ · https://www.nasa.gov/humans-in-space/zinnias-from-space-nasa-studies-the-multiple-benefits-of-gardening/ | nasa_measurement | F7 |
| Expedition 1 radio, 30% | Mars wind shapes sand ripples, like dunes on Earth | correct | https://science.nasa.gov/photojournal/ripples-or-dunes/ | approximation | — |
| Expedition 3, ASTRA on return | Mars has lots of frozen water, mostly underground and near the poles | correct | https://science.nasa.gov/mars/facts/ · https://www.jpl.nasa.gov/news/nasa-is-locating-ice-on-mars-with-this-new-map/ | approximation | — |
| Expedition 3, ASTRA on return; 5.2 row 3 | A small buried ice patch sits in the shadow of Jezero's rim | **needs fix** (not expected at 18°N; must be tagged fiction) | https://www.jpl.nasa.gov/news/nasa-is-locating-ice-on-mars-with-this-new-map/ | gameplay | F4 |
| Expedition 4, ASTRA at 20% | Ingenuity was the first helicopter on another planet, in 2021, and made 72 flights | correct | https://www.nasa.gov/news-release/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends/ | nasa_measurement | — |
| Expedition 4, ASTRA at 35% | Billions of years ago a river flowed into a lake in Jezero; the delta's mud is a good place to look for ancient life | correct ("billions of years ago"; delta base rocks were "once mud on the bottom of Lake Jezero") | https://www.nasa.gov/solar-system/nasas-perseverance-rover-arrives-at-delta-for-new-science-campaign/ | approximation | — |

## Other observations (outside the science scope)

- `astra.act1.first_sleep` says sleep "gave you back 10 HP", but Section 3.6 gives sleep as +12 HP
  per night. This is a gameplay inconsistency, not a science error.
- Section 4.6 and the Greenhouse use hydroponics. NASA's Veggie uses clay "pillows" with
  fertilizer, not pure water. That is fine for our design, but ASTRA should not say Veggie is
  hydroponic.
