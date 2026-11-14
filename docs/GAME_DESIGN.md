# Game design

Browser-based 2D pixel-art Mars base builder. Side-view cutaway of a base buried under the
Martian soil for radiation shielding. Builder drones began the base and fell asleep in a
dust storm; the player's crew arrives, wakes the drones, finishes the base and survives. The
player manages the crew's jobs and learns real engineering trade-offs along the way.
Audience: children aged 7–12 and adults.

**[SCENARIO.md](../SCENARIO.md) is binding.** Where it and this document disagree, the
scenario wins. This document describes what the **simulation backend implements today**
(`src/sim/`, `src/flow/`). Names, crew and art are not final; open questions to the team are
listed in [LEVELS.md](LEVELS.md), section "Open points in the scenario".

## Design pillars

1. **Every number can be questioned.** Each value is tagged *NASA data*, *scientific
   approximation* or *game value*, and the game shows the tag.
2. **Trade-offs, not right answers.** Water is drinking water, oxygen feedstock and
   shielding. Soil is a free shield that costs hours outside. Science is quickest in the field
   and safest in the deep lab.
3. **Kind to beginners.** Nobody dies on screen. A mission can be *aborted* (medical
   evacuation). Level 1 cannot be lost by doing nothing.
4. **Small enough to finish.** A handful of people, eight modules, a handful of jobs.

## The loop

Each sol the crew follow a schedule: sleep, three meals, work, exercise, free time. The
player decides **who does which job**, picks **which unfinished module to build next**,
gives the **shelter order** when a solar storm is coming, and **starts upgrades**. Resources drift, hardware wears, dust settles, storms
arrive. A level ends after a fixed number of sols with a score and one to three stars.

## The base

World canvas 1920 × 3200 units, ground line at Y 1050 (SCENARIO section 4). 100 units = 1 m;
5 units = 1 art pixel. *(The scale and the room positions are proposals.)*

```
surface   [solar panels] [AIRLOCK DOME] [antenna] [lander] [mound + 2 buried drones]   Y 1050
  5.1 m   [ BEDROOM        ] [shaft] [ Workshop             ]   floor 1
  7.8 m   [ DINING ROOM    ] [shaft] [ Research & Comms Lab ]   floor 2
 10.5 m   [ WATER & AIR LS ] [shaft] [ Battery & Heating    ]   floor 3
 13.2 m   [ (hydroponics)  ] [shaft] [ Rover Garage + Drone #01 ]  floor 4
            left wing: online      right wing: unfinished at the start
```

The left wing works at the start; the right wing is dark steel frames in the sand. *Hydroponics
bay* is a proposed module (the scenario has no food source), absent from level 1. Depths are
the soil above each ceiling and feed the radiation model directly. Modules and walking times
are data: [src/data/base-layout.js](../src/data/base-layout.js). The exploration site is
off-screen, an hour's drive from the airlock.

### Finishing the base

Unfinished modules are built by the **crew** (job *Build*), with a work-hours cost each (14 h
Battery & Heating, 18 h Workshop, 22 h Research & Comms Lab, 26 h Rover Garage; game values).
**Awake drones help:** each adds one work-hour per daylight hour, as they are solar powered.
Drones wake through the `DroneRepairMiniGame` (wipe dust, reconnect two wires); the rules are
in `src/flow/drone-repair.js`. Finishing a module switches on what it is for:

| Module | Switches on |
|---|---|
| Battery & Heating | the full battery; until then only a small emergency cell (90 kWh) |
| Workshop | upgrades (berm, water-bag lining, extra array, antenna) |
| Research & Comms Lab | the *Research* job; earlier storm warnings through the radio link |
| Rover Garage | the *Explore* job |

## Crew

Four placeholder astronauts (names are not final; SCENARIO.md does not say who or how many):
commander, engineer, botanist, scientist. A specialist does their own job 50% faster; the
commander gets 20% on everything.

| Stat | Falls when | Rises when | If it bottoms out |
|---|---|---|---|
| Energy | awake (faster in a suit) | asleep in quarters | falls asleep on the spot |
| Nutrition | always | eating a full meal (30 min, three a sol) | health drops |
| Fitness | always (low gravity) | exercise hour | health drops |
| Morale | storms, shelter, blackout, shortages | free time, good needs | works slower |
| Health | any emergency | slowly, when all is well | mission aborted at zero |

Tired, hungry or unhappy astronauts work slower (down to 40% of normal).

**Schedule** (one activity per Mars-hour, same for everyone for now):
sleep 22–06 · meal 06 · work 07–12 · meal 12 · work 13–17 · exercise 17 · meal 18 · free 19–22.

**Jobs**

| Job | Where | Effect | Cost |
|---|---|---|---|
| Build | the current construction site | finishes an unfinished module or an upgrade | upgrades outdoors cost dose |
| Maintain life support | Water & Air Life Support | oxygen generator and water recycler efficiency | none |
| Clean solar panels | outside | panel cleanliness | suit time, full exposure |
| Explore and mine ice | exploration site | science, water | needs the Rover Garage; far from shelter, full exposure |
| Research in the lab | Research & Comms Lab | science | needs the lab and its power |
| Tend the hydroponics bay | Hydroponics bay (proposed) | food, a little oxygen | needs that module |
| Off duty | Dining Room | morale | no output |

Outdoor work happens only in daylight and stops at 15:00. A field team eats its packed lunch
at the site.

## Resources

| Resource | In | Out | Real basis |
|---|---|---|---|
| Oxygen (kg) | generator splitting water; hydroponics | crew: 0.84 kg/person/day | NASA rate; chemistry |
| Water (L) | ice from exploring | crew 3.8 L/person/day, 98% recycled when the recycler works; electrolysis 1.125 L per kg O₂; hydroponics | NASA rate; ISS 98% recovery |
| Food (kg) | stored food; hydroponics where built (base growth + tending) | crew 1.27 kg/person/day at meals | NASA ration |
| Power (kWh) | solar panels: sun × cleanliness × dust storm | everything; battery bridges the night | game scale |

Hardware wears 12% per sol without maintenance; dust takes 3% per sol off the panels (about
ten times the real rate, so it matters within a level).

### Power and load shedding

Basic life support (air, heating, radio) is always served first. Every other system has a
battery reserve level and switches off when running it would take the battery below it:

| System | Stops below battery | Consequence |
|---|---|---|
| Science lab | 40% | no research |
| Hydroponics lights | 32% | no growth |
| Water recycler | 28% | all used water is lost |
| Oxygen generator | 25% | the tank drains |
| Basic life support | 0% | **blackout**: cold, health and morale fall |

So in a long dust storm science stops first and the base keeps breathing. A drained battery
recharges before optional systems come back.

Two safety overrides: when the oxygen tank is nearly empty (under 3 kg) the oxygen generator
ignores its reserve, and when water is nearly gone (under 20 L) so does the recycler.
Breathing comes before saving power.

Shortages hurt in proportion to what is missing. An empty tank with the generator covering
90% of demand is thin air — a slow problem — not the same as no air at all.

## Radiation

The heart of the game. Dose rate at a place:

```
dose = cosmic rays at the surface  × how much of them the shielding lets through
     + solar storm at the surface  × how much of it the shielding lets through
     + natural radioactivity of rock (always there)
```

- **Environment:** quiet-day cosmic rays are the Curiosity RAD measurement, 0.64 mSv/day
  (NASA data). Solar storms add to it for hours.
- **Position:** each room belongs to a zone with built-in shielding overhead.
- **Thickness and material:** shielding is a stack of layers; each has a thickness and a
  material (regolith, water, polyethylene, aluminium) with its own density and effectiveness.
- **Time:** dose accumulates minute by minute where the astronaut actually is, including
  while walking.
- **Events:** storms from the level's space-weather schedule.

What the model gives (computed from the code, not hand-written):

| Place | Shield mass | Cosmic rays let through | Storm let through | Quiet day | Strong storm, whole event |
|---|---|---|---|---|---|
| Outside in a suit | 0 g/cm² | 100% | 100% | 0.66 mSv/sol | 12.0 mSv |
| Airlock dome (surface) | 11 g/cm² | 106% | 81% | 0.70 mSv/sol | 9.7 mSv |
| Dome + water lining (0.25 m) | 36 g/cm² | 89% | 36% | 0.59 mSv/sol | 4.3 mSv |
| Dome + regolith berm (0.5 m) | 86 g/cm² | 70% | 12% | 0.46 mSv/sol | 1.5 mSv |
| Dome + both | 111 g/cm² | 56% | 5.5% | 0.37 mSv/sol | 0.7 mSv |
| Bedroom (5.1 m of soil) | 770 g/cm² | 2% | ~0% | 0.015 mSv/sol | ~0 mSv |
| Dining Room (7.8 m) | 1,175 g/cm² | 2% | ~0% | 0.015 mSv/sol | ~0 mSv |
| Rover Garage (13.2 m) | 1,985 g/cm² | 2% | ~0% | 0.015 mSv/sol | ~0 mSv |

*(Computed by `roomShielding` and `shieldingReport`; the numbers are the model's, not NASA
measurements.)* Below about five metres the model reaches its floor: deeper rooms are no
longer measurably safer, but they are never exactly zero.

Things worth noticing — each is a lesson the game can show:

- A thin metal hull does **not** reduce cosmic radiation (106%): fast particles make
  secondary particles in the metal. *(approximation)*
- For the same mass, hydrogen-rich materials (polyethylene, water) always beat soil, and
  soil beats metal — against both kinds of radiation, thin or thick. *(approximation; a test
  checks it across thicknesses)*
- About a metre of soil stops a solar storm almost completely; cosmic rays need several
  metres. The whole base is under more than five, which is why ASTRA says living underground
  keeps the crew safe. *(approximation)*
- Underground is never zero. *(approximation)*
- The curves are simplified and are **calibrated for plausibility, not against measured
  particle-transport data**. They ignore the shape of the base, the direction particles come
  from, and changes in the Sun's 11-year cycle.

**Radiation budget.** Each level gives every astronaut a mission dose budget (4–12 mSv).
At 70% the game warns; at 100% the astronaut is **grounded** by the flight doctor: no more
work, lower morale, objective failed. There is deliberately **no radiation sickness**: at
these doses the real effect is long-term risk, and the game does not pretend otherwise. For
scale, NASA's career limit is 600 mSv. *(The budget itself is a game value.)*

### Solar storms

| Class | Lasts | Unshielded dose | Peak | Basis |
|---|---|---|---|---|
| Minor | 6 h | 1.5 mSv | 0.5 mSv/h | game value |
| Moderate | 10 h | 5 mSv | 1.0 mSv/h | game value |
| Strong | 14 h | 12 mSv | 1.7 mSv/h | approximation: Curiosity measured 8.1 mGy on 20 May 2024 |
| Extreme | 18 h | 30 mSv | 3.3 mSv/h | game value, "what if" |

A storm rises fast and fades slowly. The warning comes 2–2.5 hours ahead (doubled by the
storm-watch antenna).

**When** storms happen can be real: levels 2 and 3 replay the dates and times of solar
energetic particle events from NASA's DONKI catalogue for 2024. Those detections were made
near Earth, so **how strong** each one is on Mars is a game value, and the game says so. One
storm in level 2 is real at Mars too: 20 May 2024, measured on the surface by Curiosity.

Because the dates come from spacecraft near Earth, the game never says such a storm "reached
Mars": each storm carries an `about` text for its event card that says what is real (the
detection) and what is imagined (its arrival and strength at Mars).

**Shelter order.** One command: *nobody stays above ground*. Anyone whose current task is on
the surface or outside goes underground (everyone gathers in the Dining Room); anyone whose
task is already underground carries on. The whole base is underground, so every module is a
shelter. An explorer turns the rover around at once — from the site it takes 100 minutes
to reach the shelter. The order lifts itself when the last storm ends (can be switched off).

## Upgrades (projects)

One at a time, like unfinished modules. Crew with the *Build* job work on it at its site; awake drones help. All need the Workshop.

| Project | Work | Cost | Effect | The trade-off |
|---|---|---|---|---|
| Regolith berm | 14 h outside | hours in the open | +0.5 m regolith over the airlock dome | free shield, paid in dose |
| Water-bag lining | 4 h indoors | 100 L water | +0.25 m water in the airlock dome | quick and safe, paid in water |
| Extra solar array | 10 h outside | — | +25% solar power | more to keep clean |
| Storm-watch antenna | 6 h indoors | — | warning time ×2 | time is the real shield |

## Objectives, score, stars

Each level has primary and bonus objectives (data in `src/data/levels.js`).

- 1 star: the crew reached the end.
- 2 stars: every primary objective met.
- 3 stars: every bonus objective too.
- 0 stars: mission aborted.

Score = science ×10 + average health ×3 + average morale ×2 + up to 300 for low radiation
+ 50 per storm ridden out safely + 60 per upgrade − 100 per emergency. *(All game values.)*

Achievements: First Results, Green Thumb, Ice Miner, Safe Below, Home Improvement, Spotless. ASTRA 6.7 announces module completions, storms, emergencies and science facts (`src/flow/astra.js`).

## Saving

The whole game state is plain data. A save is that state as JSON; loading it continues
exactly where it stopped (covered by a test). A separate campaign profile keeps unlocked
levels and best results.

## Not built yet

From the full feature list, in rough priority order:

1. Art and the real renderer (waiting for assets — see [ASSET_PIPELINE.md](ASSET_PIPELINE.md)).
2. The screens for the opening (intro, cutscene, ASTRA panel, mini-game): their logic is in `src/flow/`. Further scenario parts and the crew's identities wait for the team.
3. Per-astronaut schedule editor (the schedule is already data).
4. Building new rooms, not only upgrades to existing ones.
5. Exploration as a map with destinations, instead of one site.
6. Research that unlocks things (today science is only points).
7. Player-set load-shedding priorities.
8. CO₂ removal, food variety, medical events.
9. Sound.

## Decisions on record

| Decision | Why |
|---|---|
| No radiation sickness | Honest at these doses; grounding is the visible consequence |
| Shelter order sends people below ground, not all to one room | Teaches that *any* buried room is safe from a storm |
| Storm dates from real data, strength as a game value | The catalogue is near-Earth; claiming more would be false |
| Outdoor work ends at 15:00 | A playtest run showed explorers too tired to eat; also realistic for suit endurance |
| Oxygen generator overrides its battery reserve when the tank is nearly empty | Independent review found the crew could suffocate with 55 kWh left in the battery |
| Harm from missing air or water is proportional | An empty tank with a working generator is not vacuum |
| Load shedding is automatic | Keeps the first levels simple; player control is on the list |
| Level 1 starts with nobody assigned | The first action teaches the main control |
| Crew build, awake drones help | The team's clarification: drones began the base, people finish it |
| Emergency battery until Battery & Heating is built | The scenario gives no power source for the working wing; 90 kWh is a placeholder |
| The whole base underground is the shelter | The scenario buries every module under about five metres of soil |
