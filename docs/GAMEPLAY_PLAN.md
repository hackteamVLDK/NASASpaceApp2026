# Gameplay plan: a crew you command, missions, jobs, resources, disasters

Status: **proposal for the team**. Nothing here is implemented yet. [SCENARIO.md](../SCENARIO.md) stays
binding and is not edited by this file. Where this plan differs from it, the difference is marked
**DEVIATION** and needs a team decision (section 2) before code is written.

Written after a full check of the game against SCENARIO.md v2 (section 1) and after these requests from the player:

1. Four people in the base, not one; they should be smaller; click one and send it to work.
2. A list of main missions from the start.
3. Control over every creature (people and drones): what they do and where; how resources are obtained;
   how disasters are shown. Think it through first, in a file.

---

## 1. Audit: what the game has and what is missing

Legend: **done** works and is tested; **partial** exists but not as the scenario says; **missing** not built.

### 1.1 Done

| Area | Scenario part | State |
|---|---|---|
| Opening | 19 s crawl, landing cutscene, tutorial (HP, Drone #01, Solar Wipe, battery + cable, first build) | done |
| Economy | Meters and per-Sol rates 3.1-3.5, Sol 1/9/15/20 snapshots, power cap, storm multipliers | done, tested against the printed numbers |
| Modules | Six right-wing modules + Roof Layer, unlock chain, 2-Sol builds by drones, Tier 2 upgrades | done |
| Workshop | Six recipes, kits wake Drones #02/#03, rover and suit upgrades | done |
| Story | Acts I-III lines, dust storm Sols 4-6, Dilemmas D1-D5, four random events, black-box log, finale | done |
| Expeditions | Five trips + run, HP formula, risk roll, loot, rescue rule, radio log, two radio decisions | partial (see 1.2) |
| Mini-games | All nine of Section 4 | done (simplified controls) |
| Meta | Logbook (58 cards), 14 badges, Mission Report with 9-star rating, autosave | done except Fitness parts |

### 1.2 Partial: exists but differs from the scenario

| # | Scenario | What is missing |
|---|---|---|
| P1 | 2.1 Drone Link: queue 2 jobs per drone | A drone takes one job; no queue |
| P2 | 2.1 Breakdowns: about 1 per 2 Sols, max 2 open | No breakdown system at all |
| P3 | 5.1 Risk: Bumpy = extra wheel repair, Rough = back 0.5 Sol late, +5 HP | Only "half loot, +5 HP"; no delay, no extra repair |
| P4 | 5.3 Scrap Run and Ice Run modes | One run, scrap only; Ice mode unreachable (`runMode` never set) |
| P5 | 3.3 Lab research and "Deep Scan unlocks the Canyon Anomaly" | `research` is counted but gates nothing |
| P6 | 3.3 Recreation: emergency refill every 5 (3) Sols | Not built |
| P7 | 4.9 Antenna: Earth window every 3 Sols after the Lab; bent dish step after storms | Only the two story windows; no recurring window; no dish step |
| P8 | Section 1 system lines: `astra.hp.*`, `astra.rad.partial_room`, `astra.res.storage_save` | Not wired (HP warnings are silent) |
| P9 | 6: an ignored event (dismissed without a choice) keeps costing | The card cannot be dismissed, so this is moot; fine |
| P10 | Dilemma D2/D3 follow-ups, Cargo Trailer, Soil Beds menu in the Lab | Effects exist; the Lab menu ("Choice B stays available") does not |
| P11 | Repair Kit: "drag it onto Drone #02" | A button instead of a drag |
| P12 | 5.1 Required prep before every trip | Done, but a failed vacuum only raises risk if the final try fails |
| P13 | Drones: three beeps/LEDs personalities (2.5) | Names only; no per-drone sounds |

### 1.3 Missing

| # | Scenario or request | Notes |
|---|---|---|
| M1 | **Several astronauts** (2.2-2.4, 3.7) | The engine has one Commander. Roles, N-scaling and co-op loops are not built |
| M2 | **Sol Plan** (3.10): per-astronaut 24-slot day, three presets, Advanced editor | Schedule is hard-coded |
| M3 | **Fitness** (3.11) and the badge Strong Bones, cards `strong_in_space`, `mars_gravity_body` | No stat, no exercise |
| M4 | **Direct control**: click a person or drone, give an order | Orders exist only as buttons in tabs |
| M5 | **Mission list** (objectives) | Story beats exist but the player never sees "what should I do now" |
| M6 | **Where resources come from**, a net-per-Sol breakdown | Only current values are shown |
| M7 | **Disaster display**: forecast, countdown, per-room hazard, alarm | Only a toast, a sky tint and a "DUST STORM" word |
| M8 | Radiation per room visible (3.6 shielding factors) | Not shown |
| M9 | Logbook images (26 prompts by Vlad), crew portraits and head overlays (`CHARACTER_PROMPTS.md`) | Art not generated |
| M10 | Audio files; per-drone beep patterns | Synthesised only |
| M11 | Co-op (2-4 players, lobby, majority vote on dilemmas) | Not planned for the hackathon |
| M12 | Free-Play extras: sandbox random tips every 5 Sols exist; nothing else | Fine |
| M13 | Mobile layout, keyboard control, accessibility | Not done |

---

## 2. The big decision: one player, four people (DEVIATION)

SCENARIO v2 says solo = **one Commander + three drones**, and co-op = 2-4 **players**, each with one
Specialist (Engineer Kenji, Botanist Sofía, Pilot Leo, Comms Noor). Section 3.7 already gives every
number for a crew of N = 2-4 (needs x N, tanks x N, SP income, breakdown rate, build speed, expedition
crew, dilemma deltas).

The player wants to see **four people in the base and command all of them**. Nothing in the scenario
forbids a single player commanding the four Specialists; it just does not describe that mode.

**Proposal: "Crew mode"** next to the scenario's Solo mode.

| | Solo Commander (scenario default) | Crew of four (proposed) |
|---|---|---|
| People | Amara (Commander) | Kenji, Sofía, Leo, Noor: the four Specialists |
| Controlled by | one player | one player, who commands each person |
| Rules | Sections 2.1 and 3 as printed | Sections 2.2-2.4 and 3.7 as printed (N = 4) |
| Drones | Pip, Bumble, Zip | the same |
| Balance | printed solo snapshots | printed co-op scaling; about 2-3 Sols faster with helpers (3.8) |

Why this is the safest reading: every number already exists in SCENARIO.md, so no new balance is invented.
The only new thing is **who gives the orders** (one person instead of four).

Rules that need a decision from the team (Vlad owns SCENARIO.md; do not edit it without his OK):

1. Is "Crew of four, one player" an allowed mode? (Recommended: yes, as the default for the demo, with
   Solo selectable on the title screen.)
2. Does the Commander (Amara) join the crew as a fifth person? (Recommended: no; the four Specialists only,
   so 3.7 holds without change.)
3. Co-op voting on dilemmas (majority tap, 20 s): not needed for one player; the player simply chooses.
4. Fairness rules written for one player (Base Autopilot while away, 2.1) must also hold for a crew:
   Autopilot applies only when **everyone** is away; one person away does not stop breakdowns.

Until answered, the game keeps the scenario's Solo mode as is. The plan below is written so that
Solo is simply "crew of one", so nothing is thrown away.

---

## 3. Player-facing design

### 3.1 People on screen

- Each person has a fixed colour (stripe) and a portrait: Kenji yellow, Sofía green, Leo blue, Noor violet (2.5).
  Amara red in Solo.
- **Size.** Today a person is 185 world units tall (a 1.85 m person in a 2.7 m room) and fills the room.
  Proposal: **140 units** and drones **95**. The habitat and the lander keep their proportions to each other;
  only the people shrink a little, which is also what keeps four of them readable in one room.
  (Cosmetic scale decision, not a scenario matter.)
- Several people in one room stand side by side, never on top of each other (slots across the room width).
- A small icon above each head shows what they do: bed, fork, hammer, wrench, dumbbell, radio, rover.
- Selection: click a person, a ring appears, the portrait strip at the bottom highlights them.

### 3.2 Portrait strip (always visible)

One card per person: portrait, name, role, HP bar, current activity icon, a small warning dot
(low HP, hungry, tired, radiation). Clicking a card selects the person and centres the camera on them.
Drones get a second row of three small cards: name, battery/idle state, current job.

### 3.3 Giving orders (the core loop)

**Select, then click a target.** The target is a room, a drone, a module, the surface or the map.

| Select | Click | Result |
|---|---|---|
| Person | a room | The person walks there and starts the room's job (menu offers alternatives) |
| Person | the same room again / a job in the menu | Start that job |
| Person | a drone | Menu: "Help build", "Install kit", "Repair" |
| Person | the surface / airlock | Menu: "Clean panels (Static Wipe)", "Go outside" (suit check first) |
| Person | the Garage / map | Opens the crater map to plan an expedition with this person as crew |
| Drone | a module frame | "Build" or "Upgrade" (queue, see below) |
| Drone | a person | "Fetch / carry" (optional) |
| Drone | the surface | "Salvage" (idle default), "Dig out" |
| Anyone | Sleep / Eat / Exercise button | Go to Bedroom / Kitchen / Recreation and do it now (player beats plan, 3.10) |

A job menu appears next to the cursor with 2-5 buttons, each with a one-line cost and effect
("Research, 6 h, +Research"). No exact numbers a child cannot use; icons plus up/down arrows.

**Job queue.** Each person and each drone has a queue of up to 2 jobs (Drone Link, 2.1, for everyone in
Crew mode). Shift-click or "Add to queue" appends; the first finishes and the next starts by itself.

**Auto mode.** A per-person toggle "Auto" lets the Sol Plan and a simple priority list pick jobs
(so a child is never forced to micro-manage four people). Default: Auto on for people with nothing queued.

### 3.4 Job catalogue (what a person or drone can be sent to do)

| Job | Who | Where | Needs | Produces / effect | Duration |
|---|---|---|---|---|---|
| Sleep | person | Bedroom | night or tired | +1.5 HP per hour | up to 8-10 h |
| Eat | person | Kitchen | Food | uses the meal need; meals together: +1 Morale | 1 h |
| Exercise | person | Recreation (or Bedroom bands) | Fitness system | Fitness +20 (+10) per hour | 1 h |
| Free time | person | Kitchen / Recreation | none | Morale | hours |
| Run mini-game | person | the module that needs it | a task on offer | +2 SP, fixes a system | 10-20 s of play |
| Operate Workshop | Engineer best | Workshop | Workshop online | crafting speed; Fast Fabricator | per craft |
| Tend plants | Botanist best | Greenhouse | Greenhouse online | Food +25%, crop HP, Field Nurse | hours |
| Research | Comms best | Lab | Lab online | Research +5/8 per Sol (+25% Comms) | hours |
| Drive the Rover | Pilot best | Garage, then away | upgrades, prep | expedition loot | 1-2 Sols |
| Ride along | any (Comms rides, never drives) | Rover | crew slot | +25% loot, pays own HP | trip |
| Clean panels | any, Engineer best | Surface (drone camera) | Static Wipe | Power back to 100% | 20 s |
| Shelter | any | Bedroom | flare or storm | HP loss x0.4 | while on |
| Repair | any, Engineer best | the broken module | a breakdown | system back to normal | mini-game |
| Build / Upgrade | **drone** | a module frame | SP and items paid | module online or Tier 2 | 2 Sols / 0.5 Sol |
| Salvage | **drone** | surface | idle | +2 SP per Sol | continuous |
| Dig out | **drone** | surface mound | story | wakes a buried drone (cutscene only) | once |
| Wash soil | **drone** | Lab menu | D3 choice B | Soil Beds | 1 Sol |

### 3.5 Missions (objectives) panel, visible from the start

A **Missions** button opens (and a small tracker shows the current three). Missions come in three kinds:

- **Main missions**, the story spine, always listed, one act at a time, later acts shown greyed ("locked").
- **Side missions**, optional goals that give cards, badges, SP or Morale.
- **Standing orders**, short "what to do now" lines from ASTRA, never more than three.

Each mission has: a name, a one-line "why" in kid words, a progress bar, a reward, and a "show me" button
that moves the camera and highlights the thing to click. Completion is computed from the simulation state
(no separate script), so loading a save restores it.

#### Main missions (proposed list)

| Act | # | Mission | Done when | Reward |
|---|---|---|---|---|
| I | 1 | Wake Drone #01 | tutorial battery step done | first drone |
| I | 2 | Build Battery & Heating | `battery` online | Heat +25, power cap 250 |
| I | 3 | Get ready for the dust storm | Dilemma 1 answered | Storm Ready badge (A or B) |
| I | 4 | Build the Workshop | `workshop` online | crafting |
| I | 5 | Survive the storm (Sols 4-6) | storm ended, no Emergency left open | card Sticky Dust |
| I | 6 | Craft a Repair Kit and wake Drone #02 | Drone #02 awake | second builder |
| II | 7 | Build the Greenhouse | `greenhouse` online | Food source |
| II | 8 | Build the Garage & Airlock | `garage` online | Rover |
| II | 9 | Expedition 1: Breeze-7 | trip 1 done | Probe Power Core |
| II | 10 | Wake Drone #03 | Reboot Kit used | third builder |
| II | 11 | Expedition 2: Pathfinder-X | trip 2 done | Black Box, Dish Antenna |
| III | 12 | Build the Research & Comms Lab | `lab` online | Earth contact |
| III | 13 | Build Recreation & Storage | `recreation` online | exercise, Morale |
| III | 14 | Find ice: Expedition 3 | trip 3 done | Ice Cores |
| III | 15 | Roof Layer and suit liner | `roof` online | full shielding |
| III | 16 | Decode the black box and call Earth | `earthContact` | Message in Minutes |
| III | 17 | Expedition 4: Delta Cliffs | trip 4 done | Rare Battery Cells |
| III | 18 | Upgrade the base (Tier 2) | Lab Deep Scan online | Canyon route |
| III | 19 | **Expedition 5: Canyon Anomaly** | finale | THE JEZERO SIGNAL |
| Free-Play | 20 | Keep the base thriving | none | sandbox goals |

#### Side missions (proposed list)

Keep everyone above 60 HP for 5 Sols; no Emergency for 5 Sols; Water recycler at 98% for 10 Sols (badge Closed Loop);
win Static Wipe 5 times (Panel Sweeper); melt 5 Ice Cores (Ice Miner); harvest 50 Food (Space Gardener);
visit Ingenuity (Look, Don't Touch); bring Canyon Samples home (Biosignature Hunter); unlock 20 Logbook cards;
finish a day with every Sol Plan block done; crew dinner together 5 times (Crew mode).

### 3.6 Resources: where they come from and where they go

A **Resources** screen (button next to each meter, or click the meter) shows, for the selected meter:

```
Oxygen   +14 Life Support  +3 Greenhouse   -10 each astronaut x4 = -40   NET -23 per Sol
         [tank 80/100]  runs out in about 3.5 Sols   <- the useful number for a child
```

and a short list of **actions that change it**: "Build Greenhouse (+3 O2)", "Upgrade Life Support (+6 O2)",
"Run Valve Balance when below 30".

| Meter | Sources | Sinks | Emergency at 0 | Player actions |
|---|---|---|---|---|
| Power | Solar +50/+80, battery cap | every module, each person -2, drones building -5, storm x0.3, Battery & Heating x4 in storm | non-life-support off, Static Wipe | clean panels, Solar T2, Roof, save power (D1A), more batteries |
| Heat | Battery & Heating +25/+35 | base loss -20 | Heat Pump mini-game | build Battery & Heating, Heat Pump, T2 |
| Water | Ice Cores +25 each, recycler 98% | each person ~1 net, Greenhouse -3/-4, airlock -2, leaks | Greenhouse pauses, Morale | Ice Run, fix filter (Water Sort), Life Support T2 auto-melt |
| Oxygen | Life Support +14/+20, Greenhouse +3/+5 | each person -10 | Valve Balance, shelter in Bedroom | Life Support T2, Greenhouse, fix leaks |
| Food | Greenhouse +10/+16 (+25% Botanist), Soil Beds +3 | each person -6 (Pilot -7.5) | rations, Morale | Greenhouse, Nutrient Match, Vertical LED Farm |
| Morale | Bedroom +3, Kitchen +2, Recreation +4/+6, Greenhouse +2, Earth contact, free time | each person -2, Crunch, shortages | builds 25% slower | Recreation, plans, calls home |
| Spare Parts | Workshop +6/+10, idle drone salvage +2, mini-game wins +2, expedition loot, Scrap Run | module builds, crafting, upgrades | none (Scrap Run always open) | keep a drone salvaging, expeditions |
| HP (per person) | sleep +1.5/h, fresh crops, high Morale, Field Nurse, Med-Rest | radiation (surface 20/Sol, rooms 0.02-0.3), expeditions, flares x3 | Med-Rest | sleep, shelter, shielding, liner |
| Fitness | exercise (+10/+20/+25 per hour) | -10 per Sol | -2 HP/Sol at 15 | exercise hour |

Items (parts for upgrades) come **only from expeditions and the Workshop**; the Items list shows where each is
found (the 5.5 ledger): "Circuit Board: Exp 1 x3, Exp 2 x2, ...", so a child can see why a trip is worth it.

### 3.7 Disasters and hazards: how they are shown

One **Threats** strip at the top of the base view (hidden when empty), plus world feedback.

| Hazard | Warning | Shown in the world | Shown in the strip | Counter |
|---|---|---|---|---|
| Dust storm (D1, Sols 4-6) | Dilemma 1 at end of Sol 3 | sky turns dark orange, dust particles, panels dim | "Dust storm: solar x0.3, 2 Sols left" with a countdown | Power Saver, Top Up, Static Wipe after |
| Solar flare (E1, D5) | forecast 1 Sol early with Lab T2 or Comms; otherwise a siren | green flash, radiation icons over rooms without roof, people outside flash red | "Solar flare: shelter!" with the dose per place | Bedroom shelter, planned shelter, shielded Rover, cliff overhang |
| Dust devil (E2) | none | a swirl crosses the panels | "Dust devil" | let it pass, stow, clean by hand |
| Airlock micro-leak (E3) | tiny hiss sound | puff icon at the airlock | "Air leak: O2 -4, Water -1 per Sol" | find it (Valve), tape, seal |
| Nutrient drift (E4) | plants droop | greenhouse plants yellow | "Plants drifting: Food -40%" | Nutrient Match, flush, wait (worse) |
| Cracked filter (D2) | Dilemma 2 | water icon red | "Recycler 70%: -15 Water per astronaut per Sol" | Water Sort, trailer, ration |
| Breakdown (P2) | alarm light in the room | spark and a red wrench over the module | "Broken: Heat Pump" | the matching mini-game (Engineer best) |
| Emergency Mode (power/heat/oxygen 0) | meter low at 25 | rooms go dark / frosted / hazy | "EMERGENCY: Oxygen" | the matching mini-game |
| Low meters (<25) | ASTRA line | meter pulses | amber chip | the action list of 3.6 |
| Expedition danger | radio line | Rover icon on the map, HP of the crew | trip bar | radio decisions, return early |

Every hazard also gets a **card in the Logbook** after it ends (cause, real example), so a disaster teaches something.
A **Radiation view** toggle tints each room by its shielding factor (0.02 Bedroom ... 1.0 surface) so the
"why underground" lesson is visible all the time.

A **20-Sol timeline** at the bottom of the Missions panel shows the story beats as dots
(Sol 3 dilemma, Sols 4-6 storm, Sol 8 filter, ...). Random events are hidden dots ("something may happen")
so surprises stay surprising.

---

## 4. Engine design (what changes in code)

The engine today has one Commander. The change keeps its structure and generalises three things.

1. **People.** `state.crew = [{ id, role, hp, fitness, morale-share, where, plan, queue[], activity }]`.
   `rates()` multiplies needs by `crew.length` (3.7). Role numbers (HP, RR, buffs, debuffs) go in `data.js`
   from 2.2. Solo = a crew of one (Amara, Commander numbers).
2. **Jobs.** A catalogue (3.4) of `{ id, who, place, needs(state), start(state), tick(state, dt), done(state) }`.
   A person's `queue[0]` runs; walking time between places is simulated; `where` drives radiation per person.
3. **Drones** get the same queue (Drone Link). Build, upgrade, salvage, wash become jobs.
4. **Sol Plan and Fitness** become the default behaviour when the queue is empty (Auto), per 3.10/3.11.
5. **Breakdowns** as a small generator with the scenario rates, producing tasks and hazards.
6. **Hazards** become one list `state.hazards = [{ id, kind, place, until, severity }]` that the Threats strip,
   the world renderer and the ASTRA lines all read, so every disaster is shown the same way.
7. **Missions** are pure functions of state in `src/campaign/missions.js` with tests.
8. **Rate breakdown**: `rates()` also returns `{ source, amount }` lines per meter for the Resources screen.

Tests: the numbers of 3.7 (N = 2, 3, 4), the Sol Plan presets of 3.10, Fitness 3.11, the autopilot bot extended to
command four people and still finish, and a determinism test.

### UI work

- `src/ui/crew-strip.js` (portrait strip), `src/ui/orders.js` (select, click, job menu, queue),
  `src/ui/missions.js`, `src/ui/threats.js`, `src/ui/resources.js`.
- `src/render/campaign-world.js`: several people, selection rings, activity icons, hazard overlays, radiation view.

---

## 5. Order of work (smallest useful steps first)

| Step | What | Why first | Size |
|---|---|---|---|
| 1 | Missions panel + tracker (main and side lists above) | the player always knows what to do; no engine change | small |
| 2 | Resources screen with net-per-Sol breakdown and "runs out in about X Sols" | answers "where do resources come from"; one engine function | small |
| 3 | Threats strip + hazard overlays + radiation view | shows disasters; reads existing state | medium |
| 4 | Fill the partial items P1-P8 (queue, breakdowns, risk outcomes, Ice Run, research gate, refill, HP lines) | closes gaps to the scenario | medium |
| 5 | Select-and-order UI for the Commander and the drones (menu, queue) | the control model, tested on one person first | medium |
| 6 | **Crew of four** (people array, roles, N-scaling, portrait strip, Sol Plan, Fitness) | the big change; needs the team's yes (section 2) | large |
| 7 | Portraits, heads, Logbook images, per-drone sounds | art and audio (generation limit permitting) | art |

Steps 1-5 improve Solo and do not depend on the decision. Step 6 follows once Vlad confirms section 2.

## 6. Open questions

1. May a single player command the four Specialists ("Crew mode")? Which mode is the default of the demo?
2. People size: is 140 units (about 25% smaller than now) what the player wants, or smaller still?
3. Should Auto mode be on by default, so beginners never have to micro-manage four people?
4. The Missions panel text: write new lines, or reuse ASTRA's act lines only (the scenario's voice guide applies
   to every new ASTRA line: short, calm, never scary)?
5. Co-op with several real players: out of scope for the hackathon? (Recommended: yes.)
