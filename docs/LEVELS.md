# Game start and levels — working notes

Notes for the team on how the game opens and how the levels are built. The backend for all
of this exists and is tested; the story layer is empty on purpose and waits for the lore.

- Level data: [src/data/levels.js](../src/data/levels.js)
- Mechanics behind the numbers: [GAME_DESIGN.md](GAME_DESIGN.md)
- Try a level without a browser: `node tools/balance/run-level.mjs L2-storm-season --policy smart`

## Waiting for lore

When the lore and the planned course of events arrive, these are the places it plugs in.
Nothing else needs to change.

| Slot | Where | Today |
|---|---|---|
| Opening story (why are we here, who sent us) | `lore.intro` of level 1 | placeholder, marked `loreTbd` |
| Text between levels | `lore.intro` / `lore.outro` of each level | placeholders |
| Crew names, personalities, suit colours | [src/data/crew.js](../src/data/crew.js) | Amara, Kenji, Sofia, Leo — stand-ins |
| Level titles and taglines | `title`, `tagline` | working titles |
| Who speaks the tips (mission control? an AI? the commander?) | `hints[].text` | neutral narrator |
| Order and number of levels | `LEVELS` array, `unlocks` | 3 levels, linear |
| Name of the base and the mission | UI text | none yet |

Questions the lore should answer, because they change the levels:

1. Is the base **already built** when the crew arrives (pre-deployed cargo, as in NASA's
   reference mission designs), or do they build it? Today: already built.
2. Is there **one crew** for the whole game, or do people arrive and leave?
3. Is there a **resupply ship**, and can it be late? (A natural level 4.)
4. How long is the whole story: weeks, or a full 500-sol surface stay?
5. Does anything **go wrong on purpose** in the story (equipment failure, a crew member hurt)?
6. Tone for the youngest players: is anyone ever in real danger on screen?

## Game start

What happens from opening the page to having control. Steps 1–3 need art and lore; steps
4–7 already run on the backend.

| # | Step | Needs | Backend |
|---|---|---|---|
| 1 | Title screen: New game / Continue / Levels | art: title illustration, logo | campaign profile says what "Continue" and "Levels" show |
| 2 | Opening story, 2–4 cards | lore; art: 2–4 event illustrations | `lore.intro` |
| 3 | Meet the crew: four cards | lore; art: portraits | `CREW` |
| 4 | Level 1 loads, 06:00 on sol 1, crew asleep in quarters, **nobody has a job** | — | `createGame('L1-first-sols')` |
| 5 | Tip: "Nobody has a job yet. Give each astronaut one…" The game waits. | — | hint `welcome` at sol 1 06:00 |
| 6 | Player assigns four jobs; crew wake, eat, walk to work | — | `applyCommand({ type: 'assign' })` |
| 7 | Tips appear when their moment comes, never twice | — | hint triggers |

**The first five minutes, as designed** (at normal speed one sol is about two minutes):

- *Minute 0.* Four sleepers, four gauges, one tip. The only thing to do is hand out jobs.
  This is the game's main control, so it is the first thing taught.
- *Minute 1.* Noon. Everyone walks to the galley. Tip about the daily rhythm. The player
  sees that people are not machines: they stop to eat.
- *Minutes 2–5.* Gauges drift. Whichever runs low first triggers its tip: water ("send
  someone to explore"), the oxygen generator ("maintain life support"), dust ("clean the
  panels"). The player learns by reacting, in the order their own choices produced.
- *Minute 7.* Sol 4, 07:30: the space-weather alert. The game should pause here and show a
  full card. One big button: shelter order. Storm at 10:00, over by 16:00.
- *Minute 8.* Storm over. The mission log compares doses. The lesson lands on its own: the
  engineer underground got almost nothing.
- *Minute 10.* End of sol 5: results, stars, level 2 unlocked.

Recommended UI behaviour, not in the backend because it is presentation: **pause
automatically** on `storm-warning`, on `emergency`, and on the first `hint` of a level.

## What a level is

A level is one object of data. The simulation reads all of it; there is no per-level code.

| Field | Meaning |
|---|---|
| `lengthSols`, `startHour` | how long it runs; levels start at 06:00 |
| `crew` | who is here and their starting job |
| `jobs`, `projects` | what is unlocked |
| `start.resources`, `start.systems` | tanks and hardware condition at the start |
| `doseBudgetMsv` | radiation budget per astronaut |
| `warningLeadMinutes` | how early storm warnings come |
| `spaceWeather.donki` | take storm dates from real NASA data, starting at this UTC date |
| `spaceWeather.scripted` | extra storms placed by hand (sol + hour, or a UTC time) |
| `dustStorms`, `dustDevilChance` | weather |
| `objectives` | primary and bonus goals |
| `hints` | tips and what triggers each |
| `teaches` | the learning goals, for our own reference |
| `unlocks` | next level |

## Level 1 — First Sols *(playable)*

**Purpose:** learn the controls and the four gauges without being punished.
**Length:** 5 sols. **Budget:** 4 mSv. **Unlocked:** all jobs except building.

Starts short of everything on purpose, so every gauge moves visibly within a few minutes:
oxygen for 3.5 sols, food for under 6, generator at 80%.

| When | What | Why it is there |
|---|---|---|
| Sol 1 06:00 | Tip: hand out jobs | first control |
| Sol 1 12:00 | Tip: daily rhythm | explains why work stops |
| when water < 75 L | Tip: explore for ice | usually sol 2–3 |
| when generator < 70% | Tip: maintain life support | usually sol 1–2 |
| when panels < 82% | Tip: clean the panels | usually sol 3–4 |
| Sol 4 07:30 | Storm warning (2.5 h ahead) | the one scripted threat |
| Sol 4 10:00–16:00 | Minor storm, 1.5 mSv unshielded | training scenario — **game value, not a real event** |

Objectives — primary: everyone healthy; no shortages; 30 science. Bonus: 10 kg of food left;
everyone below ground for the storm.

Balance, from headless runs:

| How it is played | Result |
|---|---|
| Touch nothing | completes, 1 star, 739 points — the base limps but nobody is hurt |
| Sensible jobs + shelter order | 3 stars, about 1,290 points |

Open question: 3 stars may be too easy for adults. If so, raise the science goal from 30 to
45 rather than making the base more fragile.

## Level 2 — Storm Season *(playable)*

**Purpose:** radiation as a budget; shielding thickness, material and depth; the cost of
being caught outside. **Length:** 14 sols. **Budget:** 12 mSv.
**New:** upgrades (berm, water roof, storm-watch antenna).

The level's calendar is **8–22 May 2024**. Storm dates and times are real.

| Sol and time | Storm | Source of the date | Strength |
|---|---|---|---|
| Sol 2, 12:58 → 18:48 | minor | NASA DONKI, 9 May 2024 | game value |
| Sol 3, 11:21 → 21:05 | moderate | NASA DONKI, 10 May 2024 | game value |
| Sol 4, 00:11 → 13:49 | strong | NASA DONKI, 11 May 2024 (>100 MeV protons seen) | game value |
| Sol 6, 09:11 → 18:55 | moderate | NASA DONKI, 13 May 2024 | game value |
| Sol 12, 22:08 → sol 13 11:46 | strong | **measured on Mars** by Curiosity, 20 May 2024; the hour of day is our choice (tagged approximation) | scaled from the 8,100 µGy measured |

The first four are the famous May 2024 solar storms as recorded near Earth. Whether they hit
Mars the same way is not in the data. The game treats them as scenarios ("what if this burst
had been aimed at Mars"), never says they "reached Mars", and each storm carries an `about`
text for its event card that separates the real detection from the imagined arrival.

What each storm is designed to teach:

- *Sol 2, lunchtime.* Everyone is in the galley, underground, by coincidence. Nothing
  happens — unless someone is exploring. First lesson: where you are matters.
- *Sol 3, mid-morning.* Everyone is at work. The explorer is 100 minutes from the shelter and
  the warning is 120 minutes. It works if the player reacts at once.
- *Sol 4, midnight.* It starts while everyone sleeps under 1.5 m of soil. At breakfast it is
  still going at about 1 mSv/h on the surface. Sending people up "because it is morning" is
  the mistake this storm is built to catch. There is a tip for it.
- *Sol 6.* A normal working morning again: has the player built anything to make it cheaper?
- *Sol 12.* The real Mars event, at night, after a quiet week in which the player has
  probably relaxed.

Objectives — primary: everyone healthy; everyone under 12 mSv; 90 science. Bonus: four
storms ridden out safely; build the berm.

Balance:

| How it is played | Result |
|---|---|
| Touch nothing | 1 star; three of four astronauts grounded (13–15 mSv); only the engineer underground is fine (2.7 mSv) |
| Shelter order every time, nothing else | 1 star; doses fine (4.4 mSv) but 80 science of 90 — the explorer lost too many days |
| Shelter + move the scientist to the deep lab when storms threaten | 2 stars, about 2,530 points |
| All that + build the berm | 3 stars (not yet confirmed by an automated run) |

The level's point shows in those rows: hiding is not enough, you have to **reorganise the
work** around the weather.

## Level 3 — Dust and Darkness *(draft)*

**Purpose:** energy budget, battery as a buffer, what to switch off first.
**Length:** 16 sols. **Calendar:** 1–17 September 2024 (three minor and two moderate real
storm dates). **New:** extra solar array.

Scripted: a regional dust storm from sol 6, 09:00, for four sols — sunlight at 35%, dust
settling four times faster. *(Game values. Real basis: the 2018 global dust storm that ended
the Opportunity rover's mission.)* A tip on sol 4 gives two sols of warning.

During the storm the base sheds load by itself: lab, then greenhouse, then recycler, then
oxygen generator. With the recycler off, water is lost at about 16 L per sol, and the level
starts with only 110 L. So the real problem of this level is **water**, caused by **power**.

Balance — **not good yet**:

| How it is played | Result |
|---|---|
| Touch nothing | completes, 1 star: water ran out (1 emergency), lowest health 74, 103 science of 110 |
| Shelter order only | completes, 1 star |
| Simple automatic player | completes, 1 star: 166 science and 23 kg grown, but two blackouts |

No automated run reaches 2 stars yet: the blackouts on sols 9–10 need the extra solar array
built before the dust arrives, which the simple automatic player does not do. To do before
calling the level playable: confirm a human can reach 2 and 3 stars; consider a tip that says
plainly "build the extra array and stock up on water before the dust arrives".

## Ideas for later levels

Sketches only. Which of these exist depends on the lore.

| Working title | Core idea | New mechanic needed |
|---|---|---|
| Resupply Is Late | The cargo ship slips by N sols; food and parts must stretch | none — tuning and a scripted message |
| Six Instead of Four | A second crew arrives; the base was sized for four | variable crew size (supported), shelter capacity (not yet) |
| Dig Deeper | Build a third underground level | building rooms |
| The Long Drive | A multi-sol expedition away from the base | exploration map, rover as a mobile shelter |
| Solar Maximum | A whole season with an extreme storm | none — `extreme` class already exists |
| Sandbox | No goals, real 2024 calendar, runs until you stop | endless mode |

## Changing or adding a level

1. Edit or add an object in `src/data/levels.js`.
2. `npm run test:sim` — a test checks that every level's jobs, projects, objectives, hints
   and storm times are valid.
3. `node tools/balance/run-level.mjs <id> --policy idle` and `--policy smart` to see how it
   plays out sol by sol.
4. Update the table for that level in this file.
