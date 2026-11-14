# Game start and levels — working notes

Notes for the team on how the game opens and how the levels are built. The backend for all
of this exists and is tested. **[SCENARIO.md](../SCENARIO.md) is binding**: where this file
and the scenario disagree, the scenario wins.

- Scenario: [SCENARIO.md](../SCENARIO.md)
- Opening logic (intro, cutscene, ASTRA, drone mini-game rules): [src/flow/](../src/flow/)
- Level data: [src/data/levels.js](../src/data/levels.js); world and modules: [src/data/base-layout.js](../src/data/base-layout.js)
- Mechanics behind the numbers: [GAME_DESIGN.md](GAME_DESIGN.md)
- Try a level without a browser: `node tools/balance/run-level.mjs L1-wake-the-station --policy smart`

## The story so far (from the scenario and the team)

2042, mission ARES-KIDS, base Ares-1 in Jezero Crater. Builder **drones** were sent ahead
and built half of an underground base. A dust storm put them to sleep. **People then arrive
by lander** and carry on, with the station AI **ASTRA 6.7** as their guide. In the backend:
the crew do the building (job "Build"); every drone that is woken makes building faster by
daylight.

## Game start, as the scenario specifies it

Timings are in `src/flow/intro.js`; `tests/flow.test.mjs` keeps them equal to SCENARIO.md.

| Time | State | What happens |
|---|---|---|
| 0.0–10.0 s | `INTRO_TEXT` | Among Us-style text on black: five lines, typewriter blips, bass boom on the last. `Skip >>` top right. |
| 10.0–14.0 s | `DESCENT` | Camera on the sky (Y 400). Lander on a red-and-white parachute, Y −150 → 650. Parachute detaches at 13.2 s. |
| 14.0–17.5 s | `TOUCHDOWN` | 4 thrusters at 14.0 s; touchdown at 16.0 s on Y 1050 with camera shake (±4 px, 0.3 s) and a dust burst. |
| 17.5–24.0 s | `UNDERGROUND_PAN` | Camera pans Y 850 → 2100 (ease-in-out). 20.0 s astronaut exits the airlock into the left wing, removes helmet. 22.0 s Drone #01 blinks red at 1 Hz. |
| 24.0 s + | `TUTORIAL_HANDOFF` | ASTRA slides in from the left with a chime. Everything is dimmed except Drone #01, which has a pulsing yellow wrench. The player clicks the drone → `DroneRepairMiniGame` (wipe dust, reconnect 2 wires). |

After the mini-game the screen sends `{ type: 'wakeDrone', drone: 'drone-01' }`, ASTRA
suggests Battery & Heating first, and the player takes control of level 1.

## What the backend gives the story and the UI

| Need | Where |
|---|---|
| Exact lines, pauses, colours of the text intro | `INTRO_TEXT` |
| "What does second 15.3 look like?" | `openingFrameAt(t)` and the functions it uses |
| Sound cues with times (`type-blip`, `bass-boom`, `retro-rocket-roar` …) | `cuesBetween(t0, t1)` |
| ASTRA's tutorial speech, mood values, panel props | `TUTORIAL_STEP_1`, `src/flow/astra.js` |
| ASTRA's line for any game event (module built, storm, emergency …) | `astraLineFor(event)` |
| Rules of the drone repair | `src/flow/drone-repair.js` |
| Crew names | [src/data/crew.js](../src/data/crew.js) — placeholders |

## Open points in the scenario

SCENARIO.md does not say these. The code uses the marked default (comments say `PROPOSAL`)
until the team decides. **Answers wanted from the team.**

| # | Question | Default in code |
|---|---|---|
| 1 | Is the Dining Room usable at the start? Section 4 puts it in the operational wing; ASTRA says only Water, Air and Sleeping Quarters are online. | Yes, usable. |
| 2 | Where does power come from before Battery & Heating is built? | A small emergency battery (90 kWh). |
| 3 | Food: there is no greenhouse in the scenario. | Packaged food only. A Hydroponics bay exists as a proposal for levels 2–3, not in level 1. |
| 4 | Room positions inside the wings; pixel scale. | 4 floors of 270 units; 5 world units per art pixel (every number in the scenario divides by 5). |
| 5 | How are the 2 buried drones woken: same mini-game, or dig them out first? | Same mini-game. |
| 6 | Do woken drones help build? | Yes, faster by daylight. |
| 7 | How many people arrive, and who are they? The cutscene shows one astronaut leaving the lander. | Four placeholders: Amara, Kenji, Sofia, Leo. |
| 8 | ASTRA says "deadly space radiation", but in the game radiation builds up a dose and never kills. Suggest "harmful". | Text kept exactly as in the scenario; only the team can change it. |
| 9 | Values of the ASTRA `mood` prop. | `cheerful`, `calm`, `curious`, `alert`. |
| 10 | Wire colours and how much dust to wipe in the mini-game. | Orange and cyan; 95% clean. A wrong plug just doesn't stick, nothing can be failed. |
| 11 | Do later levels exist, and what are they? | Levels 2 and 3 are proposals (`beyondScenario: true`). |

## Level 1 — Wake the Station *(playable)*

**Purpose:** learn that underground is shielded, wake and use drones, hand out jobs, see
power follow the sun. Begins exactly where the cutscene ends.
**Length:** 6 sols. **Budget:** 4 mSv. **Start:** left wing online (Airlock dome, Bedroom,
Dining Room, Water & Air Life Support); right wing unfinished (Battery & Heating, Workshop,
Research & Comms Lab, Rover Garage). Drone #01 inside, Drones #02 and #03 buried at the surface.

Objectives — primary: crew healthy for 6 sols; wake Drone #01; finish Battery & Heating.
Bonus: finish the whole right wing; solar panels 80% clean; everyone below ground for the storm.

One scripted minor storm on sol 5 at 10:00 (game value, not a real event) shows what the
soil roof is for.

Balance, from headless runs (`run-level.mjs`, seed 1):

| How it is played | Result |
|---|---|
| Touch nothing (`idle`) | completes, 1 star, 194 points: the crew lives on stores but builds nothing |
| Wake drones, build in order, shelter on warning (`smart`) | 3 stars, 1,547 points; whole right wing finished; no emergencies |

Open question: 3 stars may be easy for adults. Candidate fix: make the right wing cost more
work-hours rather than making the base more fragile.

## Level 2 — Storm Season *(playable, beyond the scenario)*

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
| `smart` (wakes drones, builds modules and upgrades, shelters, moves the scientist) | 3 stars, 2,850 points, highest dose 2.55 mSv |

The level's point shows in those rows: hiding is not enough, you have to **reorganise the
work** around the weather.

## Level 3 — Dust and Darkness *(draft, beyond the scenario)*

**Purpose:** energy budget, battery as a buffer, what to switch off first.
**Length:** 16 sols. **Calendar:** 1–17 September 2024 (three minor and two moderate real
storm dates). **New:** extra solar array.

Scripted: a regional dust storm from sol 6, 09:00, for four sols — sunlight at 35%, dust
settling four times faster. *(Game values. Real basis: the 2018 global dust storm that ended
the Opportunity rover's mission.)* A tip on sol 4 gives two sols of warning.

During the storm the base sheds load by itself: lab, then greenhouse, then recycler, then
oxygen generator. With the recycler off, water is lost at about 16 L per sol, and the level
starts with only 110 L. So the real problem of this level is **water**, caused by **power**.

Balance (`run-level.mjs`, seed 1):

| How it is played | Result |
|---|---|
| Touch nothing | completes, 1 star, 1,496 points: one water emergency, lowest health 73, 106 science of 110 |
| `smart` (builds the extra solar array before the dust, shelters, farms) | 3 stars, 2,966 points, no emergencies, 176 science, 27 kg food |

Whether a human reaches 3 stars is untested. Consider a tip on sol 4 that says plainly
"build the extra array and stock up on water before the dust arrives".

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
