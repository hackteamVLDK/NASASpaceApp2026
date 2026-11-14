# SCENARIO — ARES-KIDS: The Jezero Signal

Status: Binding game scenario and design specification (v2, 2026-11-14). Source of truth: exported from the Claude Docs "ARES-KIDS: Master Game Design & Story Bible". Edit there or here, but keep both in sync. Audience: Claude Code, Codex and every human contributor. Check your work against this file (see master instructions, section 8).

## How to use this file

- Precedence. For story, gameplay rules, balance numbers and player-facing text, this file wins. For process (Git, agents, assets, sync), the master project instructions win.
- Localization keys. Every player-facing line has an ID (astra.*, radio.*, crawl.*, ui.*, card.*, report.*, badge.*). Code must reference IDs, never hard-code English strings. All player-facing text is extracted to `content/data/strings.en.json` by `content/tools/extract-strings.mjs`. Lines written without an explicit ID get a derived ID: dilemma N `ui.dN.title`, `ui.dN.header`, `astra.dN.alert`, `ui.dN.<a|b|c>.label`, `astra.dN.<a|b|c>`; event N the same with `eN` (plus `astra.e1.watch`, `astra.e2.a.clean`/`.dusty`); mini-game `ui.mg.<id>.title`, `astra.mg.<id>` (ids as in Section 7); expedition N `ui.expN.name`, `radio.expN.<percent>` (0% is `00`), `ui.expN.<percent>.<a|b>.label` for radio decisions, `astra.expN.return`, `astra.expN.at<percent>`; Scrap & Ice Run `radio.run.<percent>.<1-3>`; names `ui.module.*`, `ui.upgrade.*`, `ui.item.*`, `ui.res.*`, `ui.role.*`, `ui.buff.*`; Logbook `card.<card>.title`/`.text`. "(fiction)" tags are stripped.
- Numbers. All rates and costs are starting values for playtesting. Change them in data modules (src/data/*.js), then update this file in the same commit. The JSON in Section 7 is the shape spec: the JS modules export objects with the same shape.
- Data labels. Tag every number in data files with source: nasa_measurement, approximation or gameplay.

### Reconciliation with the master instructions

| Master instruction | How this scenario satisfies it |
|---|---|
| Side-view cutaway with surface structures and multiple underground floors | The "left wing" and "right wing" are logical groups, not a fixed layout. Rooms may sit on several floors as long as the camera stays on one cutaway screen. Deeper floors get a lower radiation shielding factor (Section 3.6). Surface structures: Solar Array, Garage airlock and dish antenna. |
| Radiation depends on conditions, room position, shielding thickness and material, time and events | Section 3.6: per-room shielding factor (depth + material), surface formula with route factor, Rover and suit shielding, flare multiplier ×3, time pro-rated per tick. |
| Underground radiation is never exactly zero | Fully shielded rooms still lose −1 HP per Sol (−0.4 in the storm shelter). |
| Crew can shelter during solar particle events | Random Event 1 (Solar Flare) and Dilemma 5; the Bedroom is the storm shelter. |
| Distinguish NASA measurements, approximations and gameplay values | Data labels above; (fiction) tags in the script mark invented story elements. |
| Children 7–12 and adults | Player-facing text targets ages 7–12; the systems (formulas, trade-offs, co-op roles) give adults depth. |

Open items not yet specified here (decide before building them; do not invent silently):

- Save/load format and autosave cadence.
- Which real NASA datasets feed the game (suggested first candidates: Curiosity RAD surface radiation, InSight/Perseverance weather data).

Specified since v2: daily schedules (Section 3.10), exercise and fitness (Section 3.11), Science Logbook, Mission Report and badges (Section 8). The Mission Report has a kid-friendly Mission Rating (Section 8.2), as the master instructions require scoring.

Vertical-slice mapping (master instructions, section 6): build Act I first (Sols 1–6). It covers the station, floors, crew assignment, time, Oxygen/Water/Food/Power, shielding, a dust storm and the Heat/Power emergencies. Add Random Event 1 (Solar Flare) early to cover the solar-particle-event, evacuation and consequence items.

## Core rules at a glance

ARES-KIDS is a single-screen, 20-Sol base builder: players rebuild an underground Jezero Crater station, keep their astronauts healthy, and follow a 4-year-old signal to a canyon where ancient life may once have lived. Nothing in the game can kill an astronaut or end the run.

| Rule | What it means in code |
|---|---|
| Single screen | The camera never leaves the 2D cutaway base. Expeditions happen off-screen: a holographic map UI, a progress bar and a radio log. |
| Solo mode | 1 Commander (no bots) + 3 builder drones. The base keeps running while the Commander is away. |
| Co-op mode | 2–4 players, each with a unique Specialist Role (2 buffs, 2 debuffs). Missing roles never block progress; their tasks just take longer. |
| Astronaut HP | 0–100 per astronaut. Radiation and fatigue drain it; Bedroom rest, fresh crops and shielding restore it. |
| No death, no Game Over | HP 0 → Med-Rest Mode (1 Sol in the Bedroom). On an expedition, a rescue drone brings them home with partial loot. Oxygen/Heat/Power at 0 → Emergency Mode, fixed by a mini-game. |
| Water realism | The recycler returns 98% of used water, like the ISS. The missing 2%, plus plant uptake and airlock losses, must be replaced with ice from expeditions. |
| Language | All player-facing text in plain English for ages 7–12. Sentences under 20 words in UI; ASTRA 6.7 may use 2–4 short sentences. |
| ASTRA 6.7 | Station AI panel that slides in from the left: ASTRA 6.7 // STATION AI. Narrates, warns and explains real NASA science. Takes a line ID, never raw text (Section 1, landing & tutorial). |

Real science vs. game fiction. Every science line in this bible is based on a real NASA mission or measurement. Story elements are invented: Pathfinder-X, Breeze-7, the 2042 base, the canyon spring and its 37-minute pulse. Section 1 marks each fictional element with (fiction) so writers never present it as real.

Data labels for code and docs. Every number is one of three kinds: NASA measurement (e.g. MOXIE's 122 g of oxygen, the ISS's 98% water recovery), scientific approximation (e.g. 3–22 min light delay, about −80 °C nights), or gameplay value (all meter rates, HP costs and shielding factors). Data files should carry a source field with one of nasa_measurement, approximation or gameplay.

## Story structure

| Act | Sols | Goal | Ends with |
|---|---|---|---|
| Intro & Act I: Wake Up | 1–6 | Survive the cold and the dust storm | Drone #02 wakes |
| Act II: Reach Out | 7–13 | Greenhouse, Garage, first expeditions | Pathfinder-X black box recovered, Drone #03 wakes |
| Act III: The Signal | 14–20 | Comms Lab, shielding, Rover upgrades | Canyon Anomaly discovery |
| Free-Play Sandbox | 21+ | Keep the base thriving | Never ends |

## Section 1: The Jezero Signal — narrative arc & full script

In 2038 a robot scout recorded a thump every 37 minutes and a methane spike in a Jezero canyon, then went silent in a dust storm; in 2042 the Ares-Kids crew rebuilds the base, recovers its black box, and finds a salty spring beside rocks that may hold signs of ancient life. Every line below is final player-facing text. The Line ID is the localization key.

### Script conventions

- ASTRA lines appear in the left slide-in panel. In solo, ASTRA says "Commander". In co-op, she says "crew" or the role name.
- CRAWL lines type out letter by letter, bold sci-fi sans-serif on `#05070A`, like the intro of Among Us. The last line is Martian Orange `#FF6B35`.
- ASTRA lines play from a queue. If the next line is due while one is still typing, the current line finishes instantly and stays at least 1.5 s before the next one starts. Tap or click skips to the full line, then to the next. Cutscene camera moves never wait for text.
- RADIO lines appear in the expedition radio log, prefixed with the Sol and time.
- (fiction) marks invented story facts. All other science claims are real. The tag is a note for writers: the game never shows it.

### ASTRA 6.7 guide panel

- **Position & layout:** slide-in panel anchored to the **left side of the screen** (`left: 24px`, `bottom: 24px` or vertically centered left dock, `width: ~360px`).
- **Visual design:**
  - Animated holographic/digital avatar portrait of **ASTRA 6.7** (cyan/amber waveforms or a friendly geometric AI core that animates while "speaking").
  - Header badge: `ASTRA 6.7 // STATION AI`.
  - Typewriter text box with a `Next` / `Got it` button (or auto-advance during cutscenes).
- **Behavior:** appears smoothly from the left edge whenever a new module is built, a survival event triggers, or a scientific fact is unlocked, then slides back out when dismissed so it never blocks the base view. The first appearance (at touchdown) plays an energetic chime.
- **Tone:** adventurous, educational sci-fi realism: accessible science without overwhelming complexity. Genre references: *Fallout Shelter*, *Oxygen Not Included*, *Among Us*.

### ASTRA 6.7 voice guide

Every ASTRA line, existing or new, follows this guide. Writers and agents check new lines
against it, and against `content/science/FACT_CHECK.md` for any science claim.

**Who ASTRA is.** The station's AI and the crew's friend: warm, curious, a little playful, never
bossy. She is proud of the crew's effort, calm when things go wrong, and excited about real
science. She speaks like a kind older sibling who happens to know a lot about Mars.

**Do**
- Keep it short: 2–4 sentences, each under 20 words (UI text under 15). One idea per line.
- Say what happened, why, and what to do next, in that order.
- Praise effort and smart choices ("Smart thinking!", "Good try!"), not luck.
- Explain consequences calmly: what it cost and how to recover.
- Tie science to a real mission or measurement, and use exact facts from `FACT_CHECK.md`.
- Explain a hard word the first time, in kid words ("perchlorates, salty chemicals...").
- Use "we" and "our": ASTRA is part of the team.
- Mark invented story facts as (fiction) in this file, never present them as real.

**Don't**
- Never be scary: no death, dying, doom, "you will not survive", or graphic harm.
- Never be wrong about science, and never round a claim into something false ("blocks all").
- Never shame or blame the player ("You failed", "That was dumb").
- Never give orders the player can't follow, or more than one task at a time.
- No sarcasm, no jokes at someone's expense, no slang that dates quickly.
- No exact numbers a child can't use, unless the number is the fun fact (122 grams, 1,319).
- No walls of text: if it needs more than 4 sentences, split it into two lines.

**Good vs. bad examples**

| # | Situation | Bad | Good | Why |
|---|---|---|---|---|
| 1 | Oxygen runs out | "WARNING: Oxygen depleted. Crew will suffocate in minutes!" | "Oxygen emergency! Everyone into the Bedroom, it has backup air tanks. Once we're safe, I'll show you how to fix the scrubber." | Calm, gives a safe action, no death talk. |
| 2 | Player skipped the storm prep | "You ignored my warning and drained the batteries. Bad call." | "Oops, the storm drained our batteries. On Mars, the weather decides how much power we get. Next storm, let's prepare!" | No blame; explains cause and the lesson. |
| 3 | Underground radiation | "Underground, we're 100% safe from radiation." | "The soil above us blocks most of the radiation. A little still gets through, so we keep trips outside short." | Never round to "all" or "safe"; radiation is reduced, not zero. |
| 4 | Mini-game failed | "Failed. Try again." | "Close! The valves need a gentle touch. Try once more, I'll keep the air flowing." | Praises effort, offers help. |
| 5 | Teaching a hard word | "Perchlorates detected in regolith samples." | "Our scan found perchlorates, salty chemicals that are bad for people. Let's test the soil before we plant." | Explains the word once, in kid words. |
| 6 | Real mission fact | "Rovers have had wheel problems before." | "Sharp Mars rocks poked holes in NASA's Curiosity rover's wheels. Careful driving keeps ours safe!" | Specific, real, checked. |
| 7 | Solar flare warning | "A deadly solar storm is coming! Hide or you'll be hurt!" | "Solar flare! Its fastest particles can reach Mars in less than an hour. Everyone underground, please." | Urgent but not frightening; one clear action. |
| 8 | Low HP | "Your HP is critical. You're about to collapse." | "HP is low! Let's get you somewhere safe. Rest and fresh food will restore your energy." | Reassuring; points to recovery. |
| 9 | Too much at once | "Fix the filter, clean the panels, craft a Repair Kit and send the Rover before dusk." | "First, let's fix the air filter. I'll tell you the next job when it's done." | One task at a time. |
| 10 | Good choice made | "Correct." | "Smart thinking! Saving power kept everyone warm through the storm." | Praises the choice and links it to the result. |

New lines that break a rule above are rewritten before they go into this file.

### Intro: text crawl (fiction)

State `INTRO_TEXT`, `0.0s – 19.0s`.

- **Visual style (reference: *Among Us* role reveal / intro screen):** pitch-black background (`#05070A`) with subtle drifting starfield particles and a faint horizontal scanline/vignette effect. Centered, bold sci-fi sans-serif typography with a crisp **typewriter reveal effect** (about 37 characters per second). Lines appear one after another.
- **Audio:** classic *Among Us*-style high-pitched electronic blip/chirp synchronized with each revealed character, followed by a low bass boom on the final line.
- **Last line:** `crawl.08` is highlighted in Martian Orange `#FF6B35`.
- **Skip:** `Skip >>` in the top-right corner. After the first playthrough, a tap anywhere also skips.
- **Transition (`19.0s`):** the screen fades/wipes into the top sky of the 2D Mars world canvas (state `DESCENT`).

| Line ID | Line | Starts at | Pause after |
|---|---|---|---|
| crawl.01 | YEAR 2038. | 0.0s | 0.8s |
| crawl.02 | A robot scout named PATHFINDER-X is exploring Jezero Crater on Mars. | 1.1s | 0.8s |
| crawl.03 | Deep inside a canyon, it feels something strange. A thump in the ground... every 37 minutes. | 3.7s | 1.0s |
| crawl.04 | Then its nose sniffs a sudden puff of methane gas. | 6.8s | 0.8s |
| crawl.05 | A giant dust storm rolls in. Pathfinder-X goes silent. | 9.0s | 1.2s |
| crawl.06 | YEAR 2042. MISSION ARES-KIDS. | 11.4s | 0.8s |
| crawl.07 | Builder drones were sent ahead to dig an underground base. But a new storm buried them too. | 13.0s | 1.0s |
| crawl.08 | Now it's your turn. Land. Wake the drones. Find the signal. | 16.3s | 1.2s (bass boom) |

### Landing cutscene & tutorial (Sol 1)

**Scene layout.** Single vertical 2D world canvas (`1920 x 3200 px` logical units), side-view cutaway cross-section:

- **Top zone (`Y: 0` to `Y: 1100`):** dusty butterscotch-orange Martian sky, distant Jezero Crater mountains, surface ground line at `Y: 1050`. On the surface: the airlock dome, the dust-covered Solar Array (pre-built), a regolith mound, the dish antenna **snapped in half by the storm** (useless, which is why the Lab later needs Pathfinder-X's dish), and 2 buried dormant drones (Drones #02 and #03; shown in the intro cutscene only).
- **Subterranean zone (`Y: 1100` to `Y: 3200`):** cutaway of the Martian crust housing Ares-1:
  - *Left wing (operational, warm light):* Bedroom, Kitchen, Water & Air Life Support, and a small crew airlock shaft under the surface dome. The crew airlock is separate from the Garage & Airlock module: expeditions and the −2 Water airlock cost use the Garage & Airlock only.
  - *Right wing (unfinished, dark steel frames in sand):* all six buildable modules as frames: Battery & Heating, Workshop, Greenhouse, Garage & Airlock, Research & Comms Lab, Recreation & Storage. **Drone #01** sits here with a blinking red LED.

#### Cutscene timeline

- **Phase 1: Atmospheric descent (`19.0s – 23.0s`, state `DESCENT`, silent: no ASTRA)**
  - Camera locked on the upper Martian sky (`Y: 400`).
  - The Mars Lander descends on a red-and-white parachute (`Y: -150 -> Y: 650`). At `22.2s`, the parachute detaches and drifts left.
  - **SFX:** Martian wind hum + parachute deploy.
- **Phase 2: Retro-rocket touchdown (`23.0s – 26.5s`, state `TOUCHDOWN`)**
  - Camera tracks the Lander down to the surface (`Y: 850`).
  - `23.0s`: 4 bottom thrusters ignite (animated flame sprites), slowing the descent.
  - `25.0s`: touchdown at `Y: 1050` next to the airlock dome. Subtle camera shake (`±4px`, `0.3s`) + red dust particle burst.
  - `25.0s`: the ASTRA panel slides in for the first time (chime) and plays `astra.intro.landing`.
  - **SFX:** retro-rocket roar -> metallic landing thud -> airlock hiss.
- **Phase 3: Underground X-ray pan (`26.5s – 33.0s`, state `UNDERGROUND_PAN`)**
  - Camera pans smoothly downward (ease-in-out) from `Y: 850`, slicing through the red Martian soil layers into the underground base cutaway. ASTRA plays `astra.intro.why_underground`.
  - `29.0s`: the astronaut exits the crew airlock shaft into the left wing and removes the helmet.
  - `31.0s`: the camera settles on the gameplay framing: a thin strip of surface (about the top 15% of the screen, with the ground line and surface structures) stays visible above the underground base. Framing rule: fit the whole base width and keep a visible surface strip at the top; the zoom is decided in the layout work. **Drone #01** blinks red (`1Hz`) in the unfinished right wing.
  - Off-screen, Drone #01 has already dragged Drones #02 and #03 in from the surface: from here on they sit dormant in the Garage & Airlock frame. (fiction)

#### Tutorial flow (`33.0s+`)

| State | What happens | Player action | Advances when |
|---|---|---|---|
| `TUT_HP` | ASTRA plays `astra.intro.status`, then the HP bar highlights and ASTRA plays `astra.tut.hp_intro`. | `Next` / `Got it` | Both lines dismissed |
| `TUT_DRONE_CLICK` | Dim all modules except **Drone #01**; a pulsing yellow wrench icon appears above it. | Click / tap Drone #01 | Drone clicked; ASTRA plays `astra.tut.drone01_click` |
| `TUT_SOLAR_WIPE` | ASTRA plays `astra.tut.solar_prompt`; Solar Panel Static Wipe opens as a drone-camera overlay (Section 4.1). | Play the mini-game | Win; ASTRA plays `astra.tut.solar_done` |
| `TUT_BATTERY` | ASTRA plays `astra.tut.drone01_prompt`; the charged battery and Drone #01's back hatch highlight. | Drag the battery into the hatch, then snap 1 cable in (one drag, part of this step, not a mini-game, no timer) | Cable snapped; Drone #01 wakes and ASTRA plays `astra.tut.drone01_wake` |
| `TUT_BUILD` | ASTRA plays `astra.tut.build_prompt`; the Battery & Heating frame highlights. | Tap the frame, then Build | First build started; ASTRA plays `astra.tut.done` |
| `PLAY` | Normal play, Sol 1 continues (Act I). | — | — |

#### Landing & tutorial lines

| Line ID | Trigger | Line |
|---|---|---|
| astra.intro.landing | Lander touches down | Touchdown confirmed! Welcome to Ares-1, our station in Jezero Crater. I'm ASTRA 6.7, your station AI. Gravity here is only 38% of Earth's, so try not to bounce into the ceiling! |
| astra.intro.why_underground | Camera pans into base | Our base is built underground, under a thick blanket of Martian soil. Space radiation is invisible energy that zooms in from the Sun and deep space. Mars has very thin air and no magnetic shield around the whole planet, so space radiation reaches the ground. The soil above us blocks most of it. |
| astra.intro.status | Tutorial hand-off, camera shows both wings | Good news: the Bedroom, Kitchen and Life Support work. Bad news: everything on the right is just steel frames, and our solar panels are buried in dust. |
| astra.tut.hp_intro | HP bar highlights | This green bar is your HP, your health and energy. Hard work and radiation lower it. Sleep and fresh food restore your energy. Real radiation adds up over time, so astronauts limit their time outside. |
| astra.tut.drone01_click | Drone #01 clicked | That's Drone #01, fast asleep. Its battery is empty, and our solar panels are buried in dust. Let's clean them first! |
| astra.tut.solar_prompt | Solar Wipe opens | First job: clean the solar panels. Mars dust is sticky with static, so wipe it off! |
| astra.tut.solar_done | Solar Wipe won | Sunlight is flowing! Mars gets less than half the sunlight Earth does, so every clean panel matters. |
| astra.tut.drone01_prompt | Battery step starts | Panels are working! Now drag the charged battery into Drone #01's back hatch and snap the cable in. |
| astra.tut.drone01_wake | Drone #01 wakes | Beep-boop! Drone #01 is awake. Drones can't talk, but they never get tired. Let's give it a job: the base is getting cold. |
| astra.tut.build_prompt | Battery & Heating frame highlighted | Tap the Battery & Heating frame, then tap Build. Drone #01 will do the rest. |
| astra.tut.done | First build started | Perfect! Builds take a few Sols. A Sol is one Mars day, and it's 39 minutes longer than a day on Earth. |

#### Intro & tutorial implementation rules

1. **Modular UI:** build `AstraGuidePanel` as a standalone, reusable plain-JS (ES module) Canvas/DOM component, no React: `{ isOpen, lineId, mood, onClose }`. It takes a **line ID**, never raw English text. Every English string lives in one strings module keyed by line ID. Any game system (module completion, dust storms, rover expeditions) can trigger ASTRA 6.7 on the left side of the screen.
2. **State machine:** `INTRO_TEXT -> DESCENT -> TOUCHDOWN -> UNDERGROUND_PAN -> TUT_HP -> TUT_DRONE_CLICK -> TUT_SOLAR_WIPE -> TUT_BATTERY -> TUT_BUILD -> PLAY`.
3. **Fallback graphics:** if custom sprites are not yet loaded, render clean geometric placeholders with clear labels (`LANDER`, `AIRLOCK`, `DRONE_01`, `LIFE_SUPPORT`) at the exact coordinates, so the gameplay flow can be tested immediately.

### Act I: Wake Up (Sols 1–6)

| Line ID | Trigger | Line |
|---|---|---|
| astra.act1.title | Act card | ACT I: WAKE UP |
| astra.act1.first_sunset | Sol 1, dusk, before first_dusk (optional). The sunset sky turns bluish | Look, a blue sunset! On Mars, fine dust scatters the light so sunsets glow blue, the opposite of Earth. |
| astra.act1.first_dusk | Sol 1, dusk | The Sun is setting. Tonight it can drop to about minus 80 degrees Celsius outside. Keep an eye on the Heat bar! |
| astra.act1.heat_warning | Heat below 40 at dusk | Brrr! The base is losing heat. Let's reroute the warm pipes before it gets colder. |
| astra.act1.first_sleep | Sol 1 night ends | Good morning! Sleeping in the Bedroom gave you back 12 HP. Rest is a real part of every space mission. |
| astra.act1.battery_built | Battery & Heating built (Sol 3) | Heating core online! Out on the surface tonight it will drop to about minus 80 degrees Celsius. Our trick: we catch the leftover heat every machine makes and send it to your rooms. NASA's Perseverance rover stays warm the same way, using spare heat from its power generator. |
| astra.act1.workshop_start | Workshop build starts | Next up: the Workshop. If something breaks on Mars, we can't call a repair shop. We make the parts ourselves. |
| astra.act1.storm_alert | Sol 3, end of day | See Dilemma 1 (Section 6). |
| astra.act1.storm_begin | Sol 4, storm starts | Here it comes! The sky is turning dark orange. Dust storms on Mars can grow big enough to cover the whole planet. |
| astra.act1.storm_mid | Sol 5 | Our panels are only getting a trickle of sunlight. Every bit of saved power helps. |
| astra.act1.workshop_built | Workshop built (Sol 5) | Workshop ready! Mars is too far away to order spare parts, so we'll make our own. In 2014, astronauts on the International Space Station 3D-printed a wrench from a design emailed up from Earth. First job: a Repair Kit for Drone #02! |
| astra.act1.repair_kit_ready | Repair Kit crafted | Repair Kit done! Drag it onto Drone #02 to fix its dusty joints. |
| astra.act1.storm_end | Sol 6, storm ends | The storm is over! Time to clean up. Mars dust is super fine and sticks to everything, like a balloon to your hair. |
| astra.act1.drone02_wake | Drone #02 wakes (Sol 6) | Drone #02 is back online! Two builders means we can build two rooms at the same time. Teamwork! |
| astra.act1.end | Act I complete | We survived our first week on Mars! Next, let's grow food and get the Rover rolling. Pathfinder-X's last message is still out there somewhere. |

### Act II: Reach Out (Sols 7–13)

| Line ID | Trigger | Line |
|---|---|---|
| astra.act2.title | Act card | ACT II: REACH OUT |
| astra.act2.greenhouse_start | Greenhouse build starts (Sol 7) | Drone #01 is building the Greenhouse. Fresh food will keep your energy up, and plants make oxygen too! |
| astra.act2.garage_start | Garage build starts (Sol 7) | Drone #02 is on the Garage & Airlock. Soon we can send the Rover out to explore! |
| astra.act2.greenhouse_built | Greenhouse built (Sol 9) | Greenhouse growing! Martian soil has perchlorates, salty chemicals that are bad for people, so we skip the dirt. NASA's Phoenix lander found them in 2008. Our plants grow in water mixed with plant food, under red and blue LEDs, the colors plants use most. |
| astra.act2.garage_built | Garage & Rover built (Sol 9) | The Rover is ready to roll! Drive carefully: Mars rocks are sharp. NASA's Curiosity rover got holes and cracks in its metal wheels from them. Clean wheels, careful driving! |
| astra.act2.first_harvest | First Greenhouse harvest (Sol 10) | First harvest: fresh lettuce! In 2015, astronauts on the space station ate lettuce they grew in space. Fresh food now gives you extra HP every Sol. |
| astra.act2.map_intro | Holographic map first opened | This is the holographic crater map. Tap a glowing spot to send the Rover. It drives off-screen, and I'll keep you posted by radio. |
| astra.act2.surface_warning | First expedition launch | Heads up! Outside, there's no soil above you, so radiation reaches you. Your HP will drop while you're out there. Rest brings your energy back, but real radiation adds up over time, so keep trips short. |
| astra.act2.exp1_arrive | Expedition 1 arrives | See Section 5, Expedition 1. |
| astra.act2.reboot_kit | Reboot Kit crafted (Sol 12) | Reboot Kit ready! We built it with the power core from that old weather probe. On Mars, nothing goes to waste. |
| astra.act2.pathfinder_found | Expedition 2 arrives (Sol 12) | Commander, look, that's Pathfinder-X! It's been waiting here since 2038. Grab its black box, it recorded everything before the storm. And its big antenna could fix our Comms Lab! (fiction) |
| astra.act2.blackbox_home | Expedition 2 returns | The black box is safe in the Garage, but it's locked with an old code. We need a working Comms Lab to read it. |
| astra.act2.drone03_wake | Drone #03 wakes (Sol 13) | Drone #03 reporting for duty! All three builders are awake. Now we can really get moving. |
| astra.act2.end | Act II complete | Three drones, a garden, a Rover and a mystery box. Not bad! Next, let's get the Lab online and find out what Pathfinder-X heard. |

### Act III: The Signal (Sols 14–20)

| Line ID | Trigger | Line |
|---|---|---|
| astra.act3.title | Act card | ACT III: THE SIGNAL |
| astra.act3.lab_start | Lab build starts (Sol 13) | Pathfinder-X's antenna fits perfectly! Drone #01 is building the Research & Comms Lab. |
| astra.act3.radiation_lesson | Sol 14, Roof Layer recipe unlocks | To explore farther, we need better shielding, stuff that blocks radiation. On Mars's surface, one day brings about as much radiation as three months of natural radiation on Earth. Packing soil around our rooms and the Rover blocks most of it. |
| astra.act3.lab_built | Lab built (Sol 15) | Comms Lab online! Radio messages travel at the speed of light, the fastest thing there is. But Mars is so far away that a message takes between about 3 and 22 minutes to reach Earth. So no live video calls: we send video letters and wait. |
| astra.act3.rec_built | Recreation & Storage built (Sol 15) | Recreation room open! In NASA's CHAPEA test, four volunteers lived for 378 days inside a 3D-printed pretend Mars home in Texas. Games, music and spare supplies helped them stay strong. Now we have them too! |
| astra.act3.blackbox_decode_start | Sol 16 morning | Decoding the black box... Old code, new tricks. Got it! Playing Pathfinder-X's last log. |
| log.pathfinder.01 | Black box playback | PATHFINDER-X LOG. SOL 1,247. (fiction) |
| log.pathfinder.02 | Black box playback | Seismic pulse detected. Interval: 37 minutes. Repeating. (fiction) |
| log.pathfinder.03 | Black box playback | Methane spike: 40 parts per billion. Source: canyon floor, 18 kilometers west. (fiction) |
| log.pathfinder.04 | Black box playback | Warning: dust storm approaching. Switching to sleep mo— (fiction) |
| astra.act3.blackbox_react1 | After playback | A thump every 37 minutes, like a clock. NASA's InSight lander felt more than 1,300 marsquakes, but quakes don't usually keep a schedule. Something down there is repeating. |
| astra.act3.blackbox_react2 | After playback | And methane! On Earth, a lot of methane comes from living things, like microbes, tiny life too small to see. But it can also come from water reacting with certain rocks. NASA's Curiosity rover has sniffed methane on Mars too, and scientists are still working out where it comes from. |
| astra.act3.earth_reply | First Earth contact succeeds | Message from Earth, sent {delay} ago: "Ares-Kids, this is Mission Control. We heard Pathfinder-X's log. Go find that signal, and stay safe!" (fiction) |
| astra.act3.roof_built | Regolith Roof Layer built (Sol 16) | Regolith Roof Layer finished! Every room is now under thick soil, so it blocks most of the radiation. Scientists think a few meters of soil could protect real Mars bases. |
| astra.act3.ls_t2 | Life Support Tier 2 (Sol 16) | Life Support upgraded! Mars air is mostly carbon dioxide, the gas we breathe out, and our new unit pulls oxygen from it. NASA's MOXIE made 122 grams of oxygen on Mars, about what a small dog breathes in 10 hours! And we melt ice to top up our water loop. |
| astra.act3.deep_scan | Lab Tier 2 Deep Scan (Sol 19) | Deep Scan complete! The pulse comes from a pocket under the canyon floor. My readings say: salty liquid water. Salt helps water stay liquid even when it's very cold. (the canyon pocket is fiction) |
| astra.act3.final_prep | Expedition 5 unlocked | This is it, Commander. The Rover is charged, your suit is sealed, and Earth is listening. Let's go find the Jezero Signal. |

### Finale: the Canyon Anomaly (Sol 20)

The Rover leaves off-screen. The radio log fills line by line; the screen shakes gently on the pulse.

| Line ID | Trigger | Line |
|---|---|---|
| radio.exp5.01 | Launch +0% | RADIO: Rover leaving the airlock. Destination: the Canyon Anomaly. |
| radio.exp5.02 | 25% | RADIO: Entering the canyon. The walls are made of layers, like a giant stack of pancakes. Each layer is a page of Mars history. |
| radio.exp5.03 | 50% | RADIO: The ground is rumbling. Next pulse in 3... 2... 1... |
| radio.exp5.04 | 55% | RADIO: Whoa! A puff of salty water vapor just burst out of a crack and froze into sparkly frost! (fiction) |
| radio.exp5.05 | 70% | RADIO: Look at the rock beside the crack. Tiny dark rings with light centers, like leopard spots! |
| astra.finale.leopard | 75% | In 2024, NASA's Perseverance rover found a rock with spots just like these, here in Jezero Crater. It's called Cheyava Falls. In 2025, scientists said its spots are one of the best clues yet of ancient life on Mars. A clue, not proof, but a really good one! |
| astra.finale.methane | 85% | So where does the methane come from? Salty water reacting with rocks can make methane with no life at all. Or, long ago, tiny microbes might have made it. Only more clues can tell us which. |
| radio.exp5.06 | 95% | RADIO: Samples sealed in tubes, just like Perseverance does. Heading home! |
| astra.finale.home | Rover returns | Mission accomplished, Commander! You rebuilt a whole base and woke three drones. You found a salty spring next to what may be the oldest clues of life on Mars. |
| astra.finale.earth | +1 minute | Message from Earth, sent {delay} ago: "Ares-Kids, the whole world is cheering for you. Bring those samples home!" |
| astra.finale.closing | Credits start | Real scientists are asking these same questions right now. Maybe one day, you'll be the one who answers them. |
| ui.finale.card | Ending card | THE JEZERO SIGNAL — MISSION COMPLETE |

### Free-Play Sandbox (Sol 21+)

| Line ID | Trigger | Line |
|---|---|---|
| astra.sandbox.start | Sol 21 | Free-Play Mode unlocked! The base is yours. Build, grow, explore and keep everyone healthy. I'll be right here. |
| astra.sandbox.milestone_50 | Sol 50 | Fifty Sols on Mars! Real Mars missions plan for stays of more than a year. You're getting there! |
| astra.sandbox.random_tip | Every 5 Sols | Tip: the Ice Run and the Scrap Run never run out. Use them whenever water or spare parts get low. |

Sandbox rules: random events (Section 6) keep firing, the repeatable runs stay open, and Tier 2 numbers stay as they are.

### System lines: HP & radiation

| Line ID | Trigger | Line |
|---|---|---|
| astra.hp.surface_70 | HP below 70 on an expedition | Your HP is dropping out here. Radiation adds up, so don't stay longer than you need. |
| astra.hp.50 | HP below 50 | HP is at half. Time to head home soon, or take a rest in the Bedroom. |
| astra.hp.25 | HP below 25 | HP is low! Let's get you somewhere safe. Rest and fresh food will restore your energy. |
| astra.hp.zero_base | HP hits 0 in the base | You're worn out. Into Med-Rest Mode for 1 Sol. The drones and I will keep things running. See you tomorrow! |
| astra.hp.zero_expedition | HP hits 0 on an expedition | Your HP hit zero, so I'm sending a rescue drone. It will bring you and some of the loot home safely. |
| astra.hp.medrest_end | Med-Rest ends | Good morning! You're rested and back at 50 HP. Eat something fresh to get stronger. |
| astra.hp.full | HP reaches 100 (max once per Sol) | HP back to 100! You're ready for anything. |
| astra.rad.partial_room | Astronaut enters a room without the Roof Layer | This room's roof isn't finished yet, so a little radiation gets in. Don't hang around here too long! |
| astra.rad.suit_liner | Suit Radiation Liner crafted | New suit liner! Materials full of hydrogen, like water and some plastics, are great at blocking space radiation. |
| astra.rad.rover_shield | Rover Radiation Shielding crafted | We packed Martian soil bricks around the Rover cabin. Mars soil cuts the radiation a lot, and there's plenty of it! |

### System lines: resources & emergencies

| Line ID | Trigger | Line |
|---|---|---|
| astra.res.oxygen_low | Oxygen below 25 | Oxygen is getting low. Let's check the air scrubbers, the machines that clean our air! |
| astra.res.oxygen_zero | Oxygen hits 0 | Oxygen emergency! Everyone into the Bedroom, it has backup air tanks. Once we're safe, I'll show you how to fix the scrubber. |
| astra.res.heat_zero | Heat hits 0 | Heat emergency! The pipes are freezing. Reroute the heat pump now, and grab a blanket! |
| astra.res.power_zero | Power hits 0 | Power emergency! I've switched off everything except life support. Let's get the panels clean. |
| astra.res.water_low | Water below 25 | Water is running low. Our water recycler cleans and reuses 98%, but we still lose a little every day. Time for an Ice Run! |
| astra.res.food_low | Food below 25 | Food stores are low. Check the Greenhouse, and keep those plants happy! |
| astra.res.morale_low | Morale below 30 | The crew is feeling down. A visit to the Recreation room or a message from Earth would help. |
| astra.res.storage_save | Storage auto-refill fires | Good thing we packed spares! I opened the emergency stores. |
| astra.coop.role_missing | Co-op task with no matching role | Nobody on our crew is trained for this. You can still do it, it'll just take a bit longer. |

### Module Tier 2 upgrade lines

| Line ID | Upgrade | Line |
|---|---|---|
| astra.t2.solar | Clean-Sweep Panels | New panels with brushes and a tilt motor! Gusts of wind sometimes cleaned the solar panels of NASA's Spirit and Opportunity rovers. But we'd rather not wait for luck. |
| astra.t2.workshop | Precision Fabricator | Precision Fabricator online! It's like the 3D printer on the space station, but bigger. Now we can make two things each Sol. |
| astra.t2.greenhouse | Vertical LED Farm | Vertical LED Farm growing! Stacking trays grows more food in the same small room. Every bit of space counts on Mars! |
| astra.t2.battery | Deep Cell Bank | Deep Cell Bank charged! More stored power means more warmth through long, freezing nights. |
| astra.t2.garage | Long-Range Rover | With this battery, the Rover can go farther than ever. NASA's Opportunity rover drove about 45 kilometers on Mars, more than a marathon! |
| astra.t2.lab | Deep Space Array | Deep Space Array online! Now we can spot storms early and scan deep underground. |
| astra.t2.rec | Habitat Lounge | We put a real Mars rock on display! Looking at something beautiful helps the crew feel at home. |

## Section 2: Solo Commander & co-op Specialist Roles

Solo players get one balanced Commander with no real weaknesses; co-op players each pick one of four Specialists whose debuffs are another role's buffs, so the crew does better together. No role is ever required: a missing role adds at most one short extra step, never a block.

### 2.1 Single-player: the Commander

| Stat | Value |
|---|---|
| Base HP | 100 |
| Radiation Resistance (RR) | 15% (all radiation HP loss × 0.85) |
| Buff 1: All-Rounder | Plays every mini-game at standard difficulty, +3 s on every timer |
| Buff 2: Drone Link | Can queue 2 jobs per drone; the next job starts automatically |
| Mild limit: One Pair of Hands | Can't be in the base and on an expedition at once (handled by Autopilot, below) |

#### How solo stays fair without bots

- Base Autopilot. While the Commander is on an expedition, no new breakdowns trigger. Systems already broken keep running at reduced output, and drones keep building. Dilemmas and random events wait until the Commander is home, except radio decisions on the expedition itself.
- One mouth to feed. Every per-astronaut number in Section 3 is for 1 astronaut. Module outputs are tuned so a solo base runs a small surplus once the Greenhouse is built.
- Breakdown rate. About 1 breakdown every 2 Sols (max 2 open at once), so one player is never swamped.
- HP recovery. Sleep +12 HP per night, fresh crops +4, and Med-Rest at 0 HP. A solo Commander can do one expedition per Sol and still recover overnight (Section 3 shows the math).
- Drone timers. Same as co-op: every module takes 2 Sols with 1 drone. Drone Link means the player never loses time to an idle drone.

### 2.2 Co-op: the four Specialists

Each player picks a unique role in the lobby. All four have the same controls; only their numbers and mini-game modifiers differ.

| Role | Base HP | Radiation Resistance | Buff 1 | Buff 2 | Debuff 1 | Debuff 2 |
|---|---|---|---|---|---|---|
| Chief Engineer | 100 | 10% | Master Mechanic: repair mini-games (Air Filter, Valve Balance, Heat Pump, Wheel Vacuum) have 1 fewer step and +5 s | Fast Fabricator: crafting costs 25% less SP; Tier 2 installs are instant when the Engineer helps | Not a Gardener: in Nutrient Match the tray tags are hidden; tap "Ask Botanist" or get 2 tries | Heavy Toolkit: on expeditions, radiation HP loss +20% and 1 fewer loot item |
| Astro-Botanist | 110 | 0% | Green Thumb: Greenhouse Food +25%; Nutrient Match tags glow; Water Sort shows the first slot | Field Nurse: once per Sol, gives another astronaut +15 HP (a fresh salad); crew fresh-crop HP +2 while the Botanist is in the base | Surface Rookie: radiation HP loss on the surface +25% | Wobbly with Wrenches: Heat Pump and Valve Balance get 1 extra step and −3 s |
| Rover Pilot & Geologist | 120 | 25% | Ace Driver: Wheel Vacuum pebbles glow; expedition risk −1 step | Rock Hound: Ice Cores and Mineral Samples ×1.5 (round up) | Can't Plot Routes: a map target needs a Comms scan tag first; without one, a 10-s route-plot step is added | Hungry Explorer: eats 25% more Food |
| Comms & Science Officer | 90 | 0% | Signal Whisperer: Antenna Alignment green zone 2× wider and Earth drifts slower; Earth windows give +5 extra Morale | Storm Watch: storm and solar flare warnings 1 Sol earlier; Research +25% | Desk Scientist: radiation HP loss on the surface +30%; can ride on expeditions but never drive | All Thumbs: can't craft Rover upgrades or install Tier 2 upgrades |

### 2.3 Co-op dependency loops

#### Chief Engineer

- Engineer → Pilot → Engineer. The Engineer crafts Titanium Wheels and Radiation Shielding, so the Pilot can reach new sites. The Pilot brings back Titanium Plates and Circuit Boards for the Engineer's next build.
- Engineer ↔ Botanist. The Engineer keeps the Heat Pump routed so the Greenhouse stays warm. The Botanist's crops and Field Nurse heal the Engineer after a long repair day, and the Botanist reads Nutrient Match tags the Engineer can't see.
- Comms → Engineer → Comms. Storm Watch gives the Engineer an extra Sol to charge batteries and seal the airlock. After the storm, the Engineer straightens the bent dish so the Comms Officer can align it.

#### Astro-Botanist

- Botanist → Pilot. After an expedition, the Botanist's Field Nurse (+15 HP) lets the Pilot go out again a Sol sooner.
- Botanist ↔ Engineer. The Engineer fixes the valves and heat pipes the Botanist struggles with; the Botanist handles the water and nutrient tasks faster than anyone.
- Pilot → Botanist → crew. The Pilot's Ice Cores fill the water loop, the Botanist turns that water into the Greenhouse Tier 2 farm, and its fresh crops heal the whole crew.

#### Rover Pilot & Geologist

- Comms → Pilot. The Comms Officer scans and tags each map target, so the Pilot can launch with no extra steps. During the trip, Comms relays route warnings over the radio.
- Engineer → Pilot → Engineer. Upgrades unlock sites; sites give parts for the next upgrades (same loop as the Engineer's #1).
- Botanist → Pilot. Hungry Explorer eats 25% more, so the Botanist's extra Food keeps the Pilot going, and Field Nurse restores Pilot HP between trips.

#### Comms & Science Officer

- Comms → Pilot. No scan tag, no smooth launch. The Comms Officer is the Pilot's navigator.
- Comms → whole crew. Storm Watch gives early flare and storm warnings, so everyone shelters before HP is lost. In return, the Engineer must fix the storm-bent dish before Comms can use it.
- Pilot → Comms → finale. The Pilot's Mineral Samples feed the Comms Officer's research. That research powers the Lab Tier 2 Deep Scan, which unlocks the Canyon Anomaly.

### 2.4 Missing-role fallback (2–3 player games)

| If this role is missing | What happens instead |
|---|---|
| Chief Engineer | Rover upgrades and Tier 2 installs use normal SP cost and 0.5-Sol install time |
| Astro-Botanist | No Field Nurse; Nutrient Match tags are visible to everyone (no "Ask Botanist" needed) |
| Rover Pilot & Geologist | Anyone can drive at standard risk; loot is not multiplied |
| Comms & Science Officer | The Pilot's route-plot step is waived; warnings arrive at the normal time |

Recommended 2-player pairs: Engineer + Pilot (fastest progress) or Botanist + Comms (safest, best HP).

### 2.5 Characters

The crew is international and invented: no character is based on a real person. Everyone is
kind, competent and a little funny; nobody is a villain. Names are used on character cards and
in the lobby; ASTRA always says "Commander" in solo and the role name in co-op (Section 1). In
solo the player may rename the Commander (`ui.char.rename`); the default name is used otherwise.

**Crew colours** match the recoloured stripe on the shared crew sprite: Commander red, Chief
Engineer yellow, Astro-Botanist green, Rover Pilot blue, Comms Officer violet. The simulation's
crew ids (`cmdr`, `eng`, `bot`, `sci`) map to Commander, Chief Engineer, Astro-Botanist and Rover
Pilot & Geologist; the Comms Officer is new.

| Character id | Name | Role | Look (for art) |
|---|---|---|---|
| commander | Amara Eze | Commander (solo) | Warm brown skin, short dark twists, calm smile, small gold stud earrings; red stripe. From Nigeria. |
| chief_engineer | Kenji Mori | Chief Engineer (co-op) | Light skin, black hair in a short ponytail, round glasses pushed up, tool belt; yellow stripe. From Japan. |
| astro_botanist | Sofía Ramírez | Astro-Botanist (co-op) | Tan skin, curly brown hair in a bun with a leaf clip, freckles; green stripe. From Chile. |
| rover_pilot | Leo Petrenko | Rover Pilot & Geologist (co-op) | Fair skin, short sandy hair, big friendly grin, dusty knee pads, rock hammer on the belt; blue stripe. From Ukraine. |
| comms_officer | Noor Haddad | Comms & Science Officer (co-op) | Olive skin, dark hair under a violet headscarf, headset with a small microphone; violet stripe. From Jordan. |
| mission_control | Rosa Varga | CAPCOM, Mission Control on Earth (voice and video only) | Grey-streaked dark bob, reading glasses on a cord, mission headset, Earth control-room screens behind. From Hungary. |

| Line ID | Line |
|---|---|
| char.commander.name | Amara Eze |
| char.commander.role | Commander |
| char.commander.bio | Amara flew cargo planes over the Sahara before training for Mars. She can fix a pump, cook a stew and calm a worried crew. Her favourite tool is a checklist. |
| char.commander.trait | "We plan, we try, we learn. Then we try again." |
| char.chief_engineer.name | Kenji Mori |
| char.chief_engineer.role | Chief Engineer |
| char.chief_engineer.bio | Kenji built robots in a Tokyo workshop as a teenager. He talks to machines while he fixes them. He has never met a plant that liked him. |
| char.chief_engineer.trait | "If it's broken, it's just a puzzle." |
| char.astro_botanist.name | Sofía Ramírez |
| char.astro_botanist.role | Astro-Botanist |
| char.astro_botanist.bio | Sofía grew up on a vineyard in Chile and studied plants in deserts. She names every lettuce in the Greenhouse. Wrenches are not her friends. |
| char.astro_botanist.trait | "Happy plants, happy crew." |
| char.rover_pilot.name | Leo Petrenko |
| char.rover_pilot.role | Rover Pilot & Geologist |
| char.rover_pilot.bio | Leo drove rally cars and studied rocks in the Carpathian Mountains. He can read a cliff like a storybook. He always comes home hungry. |
| char.rover_pilot.trait | "Every rock has a story. Let's go find it!" |
| char.comms_officer.name | Noor Haddad |
| char.comms_officer.role | Comms & Science Officer |
| char.comms_officer.bio | Noor tracked satellites from a desert radio station in Jordan. She hears space weather coming before anyone else. Outside, she would rather stay in the Rover. |
| char.comms_officer.trait | "Listen first. The Sun always gives clues." |
| char.mission_control.name | Rosa Varga |
| char.mission_control.role | Mission Control, Earth |
| char.mission_control.bio | Rosa is the CAPCOM: the one voice that talks to the crew from Earth. She has guided spacecraft for thirty years. Her messages arrive minutes late, but always with a smile. |
| char.mission_control.trait | "Ares-Kids, Earth is with you." |
| ui.char.rename | Rename your Commander |

The co-op lobby uses these bios next to the role cards; the `lobbyBlurb` texts in Section 7 stay
as the one-line role summaries.

**Mission Control's voice.** Rosa speaks only in Earth messages (`astra.act3.earth_reply`,
`astra.finale.earth`, and future Earth-window messages). Her style: warm, calm, short. Her first message starts
with "Ares-Kids, this is Mission Control"; later ones start with "Ares-Kids,". She never gives
orders the player cannot follow. Every
message reminds players of the light delay ("sent {delay} ago" is shown by ASTRA, not by Rosa).

**The three drones.** Drones cannot talk; they "speak" in beeps (sound effects) and LED blinks.
They share one body sprite; each has a coloured bumper stripe and its own beep pattern.

| Drone | Nickname | Bumper | Personality | Beep pattern (SFX) |
|---|---|---|---|---|
| Drone #01 | Pip | cyan | Curious and eager; first to wake, first to explore. Tilts its camera at anything new. | Short rising chirps, "bip-bip-BEEP?" |
| Drone #02 | Bumble | amber | Careful and steady; double-checks every weld. A bit slow, never sloppy. | Two low, slow boops, "boo-boop." |
| Drone #03 | Zip | green | Fast and excitable; zooms between jobs. Spins in a circle when a build finishes. | Quick trills, "trrrip-trrrip!" |

| Line ID | Trigger | Line |
|---|---|---|
| astra.char.pip | Right after astra.tut.drone01_wake | Listen to those happy beeps! Let's call Drone #01 "Pip". |
| astra.char.bumble | Right after astra.act1.drone02_wake | Drone #02 likes to take its time and check everything. Meet "Bumble"! |
| astra.char.zip | Right after astra.act2.drone03_wake | Whoa, Drone #03 is fast! We'll call it "Zip". |
| ui.drone.01.name | Drone #01 label | Pip |
| ui.drone.02.name | Drone #02 label | Bumble |
| ui.drone.03.name | Drone #03 label | Zip |

Existing lines keep saying "Drone #01/#02/#03"; the nicknames appear on drone labels and in later
lines.

## Section 3: 20-Sol progression, HP & resource math

A solo Commander finishes all six modules by Sol 15, all Tier 2 upgrades by Sol 19, and reaches the Canyon Anomaly on Sol 20. Power is the planned bottleneck (break-even on Sol 9), and Water slowly drains until ice arrives on Sol 14. All numbers are starting values for playtesting.

### 3.1 Time & starting values

- 1 Sol = 4 real minutes (3 min day, 1 min night). Per-Sol rates apply continuously, pro-rated each tick.
- A build or craft that starts on Sol X and lasts D Sols completes at dawn of Sol X + D.
- Every module takes 2 Sols with 1 drone. Tier 2 installs take 0.5 Sol. The Workshop crafts 1 item per Sol (2 at Tier 2).

| Resource | Solo start | Cap | At 0 |
|---|---|---|---|
| Power | 60 | 100 (250 with Battery T1, 400 with T2) | Non-life-support modules switch off; Emergency Mode |
| Heat | 70 | 100 | Emergency Mode, Heat Pump mini-game |
| Water | 80 | 100 | Greenhouse pauses; Morale −5 per Sol |
| Oxygen | 80 | 100 | Emergency Mode, Valve Balance mini-game |
| Food | 70 | 100 | Emergency rations; Morale −5 per Sol, no fresh-crop HP |
| Morale | 70 | 100 | Builds and crafts 25% slower |
| Spare Parts (SP) | 60 | 999 | Scrap Run always available |
| Astronaut HP | 100 | Role max (90–120) | Med-Rest Mode (Section 3.6) |

### 3.2 Per-astronaut needs (per Sol)

| Need | Amount | Note |
|---|---|---|
| Oxygen | −10 |  |
| Food | −6 | Pilot: −7.5 (Hungry Explorer) |
| Water | −1 | 50 units used, 98% recycled (Section 3.5) |
| Morale | −2 |  |
| Power | −2 | Personal devices and lights |
| Base heat loss | −20 | Whole base, not per astronaut |

### 3.3 Modules: cost, unlock and output (per Sol)

| Module | Unlocks when | Build cost | Tier 1 output | Tier 2 output |
|---|---|---|---|---|
| Solar Array (pre-built, surface) | Start | — | +50 Power | +80 Power; storm loss 50% instead of 70% |
| Bedroom (pre-built) | Start | — | −2 Power, +3 Morale, sleep +12 HP | No tier |
| Kitchen (pre-built) | Start | — | −4 Power, +2 Morale | No tier |
| Water & Air Life Support (pre-built) | Start | — | −12 Power, +14 Oxygen, 98% water recycling | −14 Power, +20 Oxygen, auto-melts Ice Cores |
| Battery & Heating | Sol 1 | 10 SP | −6 Power, +25 Heat, Power cap 250 | −6 Power, +35 Heat, Power cap 400 |
| Workshop | Battery & Heating built | 15 SP | −8 Power, +6 SP, crafting | −10 Power, +10 SP, 2 crafts per Sol |
| Greenhouse | Workshop built | 15 SP + 10 Water | −10 Power, +10 Food, +3 Oxygen, −3 Water, +2 Morale, fresh crops +4 HP | −12 Power, +16 Food, +5 Oxygen, −4 Water, +2 Morale, fresh crops +6 HP |
| Garage & Airlock | Greenhouse build started | 15 SP | −6 Power, expeditions | −6 Power, expeditions −1 Sol (min. 1) |
| Research & Comms Lab | Garage built + Dish Antenna | 20 SP + Dish Antenna | −10 Power, +5 Research, Earth window every 3 Sols | −12 Power, +8 Research, warnings +1 Sol early, Deep Scan |
| Recreation & Storage | Lab build started | 10 SP | −4 Power, +4 Morale, emergency refill once per 5 Sols, exercise station (3.11) | −4 Power, +6 Morale, refill once per 3 Sols |
| Regolith Roof Layer (base upgrade) | Lab build started | 10 SP + 1 Titanium Plate | Right-wing rooms become fully shielded | — |

Extra power rules: each drone actively building uses −5 Power per Sol. During a dust storm, Solar ×0.3 (Tier 2: ×0.5) and Battery & Heating uses ×4 power, because it also runs the base's dust-filter fans, which work overtime in a storm (gameplay value). Real dust storms make Mars days cooler and nights warmer.

Tier 2 recipes are in Section 5.4.

**Emergency refill (note, 2026-11-15).** The Recreation & Storage refill is automatic: when Water, Food or Oxygen drops below 10, the lowest of them gets +30 from the spare stores and ASTRA says `astra.res.storage_save`; then the stores are closed for 5 Sols (Tier 2: 3 Sols). Values are `gameplay`.

### 3.4 Solo balance snapshots (net change per Sol)

| Stage | Power | Heat | Oxygen | Food | Water | Morale | SP | HP (in base) |
|---|---|---|---|---|---|---|---|---|
| Sol 1: pre-built modules only | +30 | −20 | +4 | −6 | −1 | +3 | +2 | +11 |
| Sol 9: + Battery, Workshop, Greenhouse, Garage | 0 | +5 | +7 | +4 | −4 | +5 | +10 | +15 |
| Sol 15: all six at Tier 1 + Solar T2 | +16 | +5 | +7 | +4 | −4 (+ ice) | +9 | +10 | +15 |
| Sol 20: everything at Tier 2 | +8 | +15 | +15 | +10 | −5 (+ ice) | +11 | +14 | +19 |

SP income counts the Workshop, about 1 won mini-game per Sol (+2), and idle-drone salvage (+2). Without Solar T2, Sol 15 Power would be −14 per Sol. ASTRA hints at the upgrade when Power drops below 50.

### 3.5 Water: 98% recycling + ice

Each astronaut uses 50 water units per Sol (drinking, food, washing, breath). The recycler returns 98%, like the ISS system, so only 1 unit is lost per astronaut. Plants, airlocks and broken filters cost much more, and ice from expeditions refills the tank.

```latex
W_{net} = -N \cdot 50 \cdot (1-\eta) - G - 2E + 25I
```

- N = astronauts. η = recycler efficiency: 0.98 normally, 0.70 with a cracked filter (then each astronaut loses 15 per Sol).
- G = Greenhouse uptake: 3 (Tier 1) or 4 (Tier 2). Water becomes plant mass.
- E = airlock cycles this Sol (each expedition costs 2 Water).
- I = Ice Cores melted. Each gives +25 Water (melted in Life Support at any tier; automatic at Tier 2).

Solo, the tank drifts from 80 to about 55 by Sol 14. Expedition 3 brings 3 Ice Cores (+75). After that, the repeatable Ice Run (2 cores, +50) keeps water topped up in sandbox play.

### 3.6 Astronaut HP & radiation formulas

**HP loss on an expedition (spread evenly across the trip):**

```latex
\Delta HP_{exp} = 20 \cdot D \cdot R \cdot (1 - RR) \cdot S_{rover} \cdot S_{suit} \cdot F \cdot M_{fit}
```

- D = duration in Sols. R = route factor: crater floor 1.0, crater rim or delta 1.25, canyon 1.5.
- RR = role Radiation Resistance (Commander 0.15, Engineer 0.10, Pilot 0.25, others 0).
- S_rover = 0.6 with Regolith Radiation Shielding, else 1. S_suit = 0.75 with Suit Radiation Liner, else 1.
- F = 3 for the part of the trip during a solar flare, else 1. Role debuffs multiply the result: Engineer ×1.2, Botanist ×1.25, Comms ×1.3.
- M_fit = low-Fitness multiplier (Section 3.11), measured at launch: 1.0 at Fitness 40 or more, 1.10 at Fitness 16–39, 1.25 at Fitness 15 or less. It is **capped at ×1.25**, so low Fitness can make a trip harder but never impossible (and the rescue rule in Section 5.1 still applies). The Commander HP costs below assume M_fit = 1.0.

**HP loss inside the base (per Sol, pro-rated by time spent in the room):**

Radiation inside the base is never exactly zero. Each room has a shielding factor set by its depth and wall material. In-room HP loss = 20 × factor per Sol, ×3 during a solar flare.

| Where | Shielding (simplified gameplay values) | Factor | Normal (HP per Sol) | During a solar flare |
|---|---|---|---|---|
| Surface, no Rover shielding | None | 1.0 | −20 | −60 |
| Right-wing rooms before the Regolith Roof Layer | About 1 m of regolith | 0.3 | −6 | −18 |
| Left wing, and right wing after the Roof Layer | About 3 m of regolith | 0.05 | −1 | −3 |
| Bedroom storm shelter | Deepest room, water-tank walls | 0.02 | −0.4 | −1.2 |

**HP recovery**

| Source | Amount | Condition |
|---|---|---|
| Sleep | +12 per night | In the base at night (+6 if camping in the Rover) |
| Fresh crops | +4 (Tier 1), +6 (Tier 2), +1 more with Soil Beds | Greenhouse working and Food at 30 or more |
| High morale | +2 per Sol | Morale at 70 or more |
| Field Nurse (Botanist) | +15 | Once per Sol, to another astronaut |
| Med-Rest Mode | Back to 50 HP | HP hit 0; astronaut spends 1 Sol in the Bedroom |

**Commander HP cost per expedition (solo, with the upgrades available on the recommended path)**

| Expedition | Upgrades at launch | HP cost |
|---|---|---|
| 1. Breeze-7 (1 Sol, floor) | None | 17 |
| 2. Pathfinder-X (1 Sol, floor) | None | 17 |
| 3. Crater Rim Ice (1 Sol, rim) | None | 21 |
| 4. Delta Cliffs (2 Sols, delta) | Rover Shielding + Suit Liner | 19 (+ flare, see Dilemma 5) |
| 5. Canyon Anomaly (1 Sol, canyon) | All + Long-Range | 12 |
| Scrap or Ice Run (1 Sol, floor) | None / Shield + Liner | 17 / 8 |

With about +15 HP of nightly recovery, a Commander can run one expedition per Sol and stay above 60 HP. The danger comes from flares and back-to-back trips, which is where the warnings teach planning.

### 3.7 Co-op scaling (N = 2–4 players)

| Quantity | Rule |
|---|---|
| Oxygen, Food, Water need | × N |
| Life tanks (Oxygen, Food, Water) | Capacity and start value × N; the UI shows % |
| Life Support, Greenhouse and recycler output | × N (same per-astronaut balance as solo) |
| Power and Heat production | Unchanged; each astronaut still uses −2 Power |
| Workshop SP income | × (1 + 0.5 × (N − 1)) |
| Breakdown rate | 1 per 2 Sols × (1 + 0.5 × (N − 1)); max open = N + 1 |
| Build speed | +25% per astronaut helping a drone (max 2 helpers) |
| Expedition crew | 1–2 astronauts; each extra crew member gives +25% loot (round down) and pays their own HP |
| Dilemma deltas on Oxygen, Food, Water | × N |
| HP | Tracked per astronaut, role max HP |
| Build and upgrade costs | Unchanged |

With 4 players, personal power use is −8, so Power on Sol 9 is −6 per Sol. That makes Solar Tier 2 a team goal even earlier.

### 3.8 Unlock order & Sol-by-Sol plan (solo)

| Sol | Story beat | Drone #01 | Drone #02 | Drone #03 | Workshop craft | Commander |
|---|---|---|---|---|---|---|
| 1 | Landing, tutorial, Drone #01 wakes | Builds Battery & Heating | Dormant | Dormant | — | Solar Wipe |
| 2 | First freezing night | Battery & Heating | Dormant | Dormant | — | Heat Pump |
| 3 | Battery & Heating done. Dilemma 1 | Builds Workshop | Dormant | Dormant | — | Dilemma choice |
| 4–5 | Dust storm (Sols 4–6). Workshop done at dawn Sol 5 | Workshop | Dormant | Dormant | Sol 5: Repair Kit | Storm repairs |
| 6 | Storm ends. Drone #02 wakes. Act I ends | Salvage | Wakes | Dormant | — | Clean-up |
| 7 | Act II begins | Builds Greenhouse | Builds Garage | Dormant | — | Repairs |
| 8 | Dilemma 2 | Greenhouse | Garage | Dormant | — | Dilemma choice |
| 9 | Greenhouse and Garage done | Salvage | Salvage | Dormant | — | Prep |
| 10 | First harvest | Salvage | Salvage | Dormant | — | Expedition 1 |
| 11 | Dilemma 3 | (Washes soil if chosen) | Salvage | Dormant | Titanium Wheels | Dilemma choice |
| 12 | Pathfinder-X found | Salvage | Salvage | Dormant | Reboot Kit | Expedition 2 |
| 13 | Drone #03 wakes. Act III begins | Builds Lab | Installs Solar T2 | Builds Recreation | Deep Ice Drill | Repairs |
| 14 | Ice found | Lab | Salvage | Recreation | Rover Radiation Shielding | Expedition 3 |
| 15 | Lab and Recreation done | Installs Greenhouse T2 | Installs Life Support T2 | Installs Roof Layer | Suit Radiation Liner | Earth contact |
| 16 | Black box decoded. Dilemma 4 | Salvage | Salvage | Salvage | — | Dilemma choice |
| 17–18 | Delta Cliffs. Dilemma 5 on Sol 18 | Salvage | Salvage | Salvage | — | Expedition 4 |
| 19 | Deep Scan finds the signal | Installs Battery T2 + Workshop T2 | Installs Long-Range Rover | Installs Lab T2 | — | Prep |
| 20 | Finale | Installs Recreation T2 | — | — | — | Expedition 5 |
| 21+ | Free-Play Sandbox | — | — | — | — | — |

Co-op follows the same order, usually 2–3 Sols faster because helpers speed up builds. Story beats trigger on events, not fixed Sols, so slower players see everything.

### 3.9 Spare Parts budget (solo check)

| Sol | Spent on | SP after spending | Income that Sol | SP at dawn next Sol |
|---|---|---|---|---|
| 1 | Battery & Heating 10 | 50 | +2 | 52 |
| 3 | Workshop 15 | 39 | +2 | 41 |
| 5 | Repair Kit 10 | 33 | +6 (storm: no mini-game) | 39 (49 by Sol 7) |
| 7 | Greenhouse 15 + Garage 15 | 19 | +10 | 29 |
| 8 | Dilemma 2 (if A or B) 12 | 17 | +10 | 27 |
| 10 | — | 47 | +10, Expedition 1 +15 | 72 |
| 12 | Reboot Kit 10 (Wheels 10 on Sol 11) | 62 | +10, Expedition 2 +20 | 92 |
| 13 | Lab 20 + Recreation 10 + Solar T2 10 + Ice Drill 10 | 42 | +10 | 52 |
| 14 | Rover Shielding 15 | 37 | +10, Expedition 3 +20 | 67 |
| 15 | Greenhouse T2 10 + Life Support T2 10 + Roof Layer 10 + Suit Liner 10 | 27 | +10 | 37 |
| 18 | — | 57 | +10, Expedition 4 +25 | 92 |
| 19 | Battery T2 10 + Workshop T2 10 + Long-Range 15 + Lab T2 15 | 42 | +14 | 56 |

The balance never drops below 15, which leaves room for crack patches, re-crafting shielding (Dilemma 5) and Scrap Runs.

### 3.10 Daily schedule: the Sol Plan

Every astronaut follows a **Sol Plan**: 24 one-hour slots (Mars-hours) per Sol, each one of five
blocks. With 1 Sol = 4 real minutes, one slot lasts 10 real seconds. Drones have no Sol Plan:
they never sleep, eat or get tired.

| Block | Default (Balanced) | Allowed | What happens |
|---|---|---|---|
| Sleep | 22:00–06:00 (8 h) | 6–10 h, one unbroken block | +1.5 HP per hour slept, in the Bedroom (8 h = the +12 HP of Section 3.6). In the storm shelter or a Rover camp: ×0.5 |
| Meal | 06:00, 12:00, 18:00 (3 × 1 h) | always 3 meals; each can move ±1 h | Uses the Food need of Section 3.2. A missed meal (expedition delay) means emergency rations: −1 Morale |
| Work | 07:00–12:00, 13:00–17:00 (9 h) | 5–12 h | Mini-games, repairs, crafting and drone help happen in Work hours. Each hour above 9: +11% personal work speed, −1 Morale. Each hour below 9: −11% |
| Exercise | 17:00 (1 h) | 0–2 h | Fitness, see Section 3.11 |
| Free | 19:00–22:00 (3 h) | whatever is left | 3 h or more: +2 Morale per Sol. 1–2 h: no change. 0 h: −3 Morale per Sol |

All numbers in this table are **gameplay** values.

**How the player changes it.** Tap an astronaut portrait, then **Sol Plan**. The default view
shows only **three big preset cards** with icons; tap one to choose it. An optional **Advanced**
button opens the 24-slot editor (a bar of 24 coloured slots; drag a block edge to move it one hour
at a time). Most players never need Advanced.

| Preset | Icon | Sleep | Work | Exercise | Free | Morale per Sol from the plan | Use it when |
|---|---|---|---|---|---|---|---|
| Balanced (default) | scales | 8 | 9 | 1 | 3 | +2 (free time 3 h) | most Sols |
| Crunch | hammer | 8 | 11 | 1 | 1 | −2 (two extra Work hours at −1 each; 1 h free gives 0). That is **4 Morale per Sol less than Balanced**. Work speed +22% | a build or repair must finish fast |
| Recover | bed | 9 | 6 | 2 | 4 | +2 (free time 4 h). Work speed −33%; sleep +13.5 HP | after Med-Rest, a flare or an expedition |

In co-op these Morale numbers count ×1/N (see below).

Rules:
- Changes start at the next midnight, so the plan cannot be changed mid-emergency to dodge a cost.
- Emergency Mode and solar-flare shelter orders override the plan while they last.
- **The player always wins over the plan.** If the player sends an astronaut to a task during
  another block (for example a mini-game during Sleep), the task happens now and that hour's block
  effect is lost: a Sleep hour gives no +1.5 HP, an Exercise hour gives no Fitness, a Free hour
  does not count toward free time. A Meal moves to the next hour; if there is no time before the
  next meal, it becomes an emergency ration (−1 Morale). ASTRA says `astra.plan.override` once per
  run, the first time this happens.
- The Sol Plan unlocks at dawn on Sol 2 (`astra.plan.unlock`).

**Solo.** The Commander has one Sol Plan. While the Commander is on an expedition, the base plan
pauses (Base Autopilot, Section 2.1) and the trip uses a fixed field day: 8 h sleep in the Rover
(+6 HP, Section 3.6), meals from the Rover pantry, no exercise.

**Co-op.** Each player edits only their own Sol Plan. When every astronaut's Meal slots share the
same hour, the crew eats together: +1 Morale per shared meal ("Crew dinner"). Morale is shared, so
each astronaut's Free-time and Work effects count ×1/N (N = crew size).

**Implementation note (src/sim).** The simulation already has these five activities and one
DEFAULT_SCHEDULE that equals Balanced. New here: one plan per astronaut, the presets, the
allowed ranges, and the per-hour effects above. The simulation's per-astronaut energy stat is
shown to the player as part of HP.

| Line ID | Trigger | Line |
|---|---|---|
| astra.plan.unlock | Sol 2, dawn | Good morning! Real astronauts follow a daily plan: work, meals, sleep and exercise. Tap your portrait to see your Sol Plan. |
| astra.plan.short_sleep | Sleep set below 7 h | Less sleep means more work time, but you'll get tired and grumpy. Astronauts protect their sleep. |
| astra.plan.no_free | Free time set to 0 h | No free time at all? Everybody needs a break, even on Mars. |
| astra.plan.crunch | Crunch preset chosen | Crunch mode! We'll build faster, but the crew will feel it. Let's not do this every Sol. |
| astra.plan.override | First time the player overrides a block | No problem, let's do it now! You'll miss that hour of {block}, so its bonus is skipped today. |
| ui.plan.title | Sol Plan panel header | SOL PLAN |
| ui.plan.sleep | Block label | Sleep |
| ui.plan.meal | Block label | Meal |
| ui.plan.work | Block label | Work |
| ui.plan.exercise | Block label | Exercise |
| ui.plan.free | Block label | Free time |
| ui.plan.preset.balanced | Preset button | Balanced |
| ui.plan.preset.crunch | Preset button | Crunch |
| ui.plan.preset.recover | Preset button | Recover |
| ui.plan.next_sol | Note under the cards | Changes start at midnight. |
| ui.plan.preset.balanced.desc | Card subtitle | Work, rest and play. Good for most Sols. |
| ui.plan.preset.crunch.desc | Card subtitle | Build faster. The crew gets grumpy. |
| ui.plan.preset.recover.desc | Card subtitle | Extra sleep and exercise. Slower work. |
| ui.plan.advanced | Button | Advanced |
| ui.plan.advanced.hint | Advanced view note | Drag the edges to change each block by one hour. |

### 3.11 Exercise & Fitness

**Real reason.** In weightlessness, astronauts' weight-bearing bones become about 1% less dense
each month without countermeasures, and muscles weaken too, so crews on the space station exercise
about two hours a day on a treadmill, an exercise bike and a weight machine (NASA). Mars has 38%
of Earth's gravity. How much bone and muscle people would lose there is not well known yet: in a
Mars-gravity lab model, rats carrying 40% of their weight lost grip strength in two weeks
(Frontiers in Physiology, 2019). The game treats Mars as "weaker than Earth, so keep exercising".

**Fitness meter.** Each astronaut has Fitness, 0–100, shown as a small dumbbell icon next to HP.

| Rule | Value | Label |
|---|---|---|
| Start | 80 | gameplay |
| Loss per Sol (low gravity) | −10 | approximation (direction is real; the speed is greatly increased so it matters within 20 Sols) |
| 1 h Exercise in Recreation & Storage (exercise bike + resistance rack) | +20 | gameplay |
| 1 h Exercise in the Bedroom before Recreation & Storage is built (stretch bands) | +10 | gameplay |
| 1 h Exercise with Recreation T2 (Habitat Lounge adds a treadmill) | +25 | gameplay |
| Fitness 70 or more | +1 Morale per Sol | gameplay |
| Fitness below 40 | work speed −20%; expedition HP cost ×1.10 (M_fit, Section 3.6) | gameplay |
| Fitness 15 or less | −2 HP per Sol (never below Med-Rest; no death); expedition HP cost ×1.25, the cap | gameplay |

With the Balanced plan (1 h a Sol), Fitness slowly falls before Recreation & Storage exists
(−10 + 10 = 0 at best) and holds or rises after it is built (Sol 15). The Recover preset (2 h)
rebuilds it.

**Where.** Recreation & Storage (Section 3.3) gains an exercise station at Tier 1. On an
expedition there is no exercise.

**Implementation note (src/sim).** The simulation already has a per-astronaut fitness stat,
a low-gravity drain of about 10 per Sol, about +21 per exercise hour, and health harm at
fitness 15 or less. The room-dependent gains and the work-speed and expedition effects are new.

| Line ID | Trigger | Line |
|---|---|---|
| astra.fit.intro | First Exercise hour (Sol 2) | Exercise time! In low gravity, bones and muscles get weaker because they don't have to work as hard. Astronauts on the space station exercise about two hours every day. |
| astra.fit.mars | Second Exercise hour | Mars gravity is 38% of Earth's. Scientists don't know yet how much bone and muscle people would lose here, so we keep exercising to be safe. |
| astra.fit.rec_open | Recreation & Storage built | The Recreation room has an exercise bike and a weight machine, like the ones on the space station. Your workouts count double now! |
| astra.fit.low | Fitness below 40 | Your muscles are getting weak, and that makes work and trips harder. Add an exercise hour to your Sol Plan! |
| astra.fit.critical | Fitness 15 or less | Fitness is very low and it's hurting your health. Let's switch to the Recover plan. |
| ui.fit.label | HUD icon tooltip | Fitness |

## Section 4: Repair & prep mini-games

Nine mini-games, each 10–20 seconds, each tied to a real Mars problem. They open as an overlay on top of the base, so the camera never leaves the cutaway, and failing one only slows a system down.

#### Rules for all mini-games

- Touch targets at least 64 × 64 px. Drag and tap only: no double-tap, no multi-touch.
- One-line instruction plus an animated hand showing the first move.
- Timer ring around the frame (green → yellow → red). No big "FAIL" screen.
- Win: +2 SP, a happy drone chirp, then ASTRA's 2-sentence explanation (full text the first time, a short "Nice work!" afterwards).
- Failure: the system runs at reduced output until retried. Retry is instant and free. After 3 failures in a row, a drone offers to auto-fix it (1 Sol of drone time).
- Surface mini-games (Solar Wipe) are done through a drone camera from the Airlock console, so they cost no HP.
- Solo Commander: standard difficulty, +3 s on every timer. In co-op, the player who opens the mini-game uses their role's modifier.

### 4.1 Solar Panel Static Wipe

**Trigger & real cause:** Sol 1 tutorial; after every dust storm or dust devil; every 5 Sols, panels lose 20% output. Mars dust carries static electricity, so it clings to panels.

**UI & interaction:** Surface view through a drone camera: 3 panels under a butterscotch sky, covered in red dust. Some clumps throw tiny blue sparks: a visual hint only, they are not tapped.
1. Swipe the wiper across the panels.
1. Sticky clumps need 1–2 extra swipes; a small spark pops when one comes off.

**Win / fail:** Win at 90% clean within 20 s (a sun meter fills). On fail, output equals the % cleaned until retried.

**Role modifiers:** Engineer: the wiper is 2× wider. Pilot: dusty clumps are outlined (knows surface dust). Botanist, Comms: standard.

**ASTRA:** "Mars dust is full of static electricity, so it clings to panels like socks to a sweater. Dust on its solar panels is what ended NASA's InSight lander mission in 2022."

### 4.2 Air Dust Filter Scrub

**Trigger & real cause:** About every 4 Sols, always the Sol after a dust storm, and after 3 expeditions. Fine dust rides in on spacesuits through the airlock. Oxygen output −50%.

**UI & interaction:** A square air filter in a wall slot, its 4 × 4 grid of cells coated in red dust; a brush at the bottom.
1. Drag the filter out onto the workbench.
1. Rub each cell with the brush (3 strokes per cell; it gets lighter each stroke).
1. Drag it back into the slot and tap the lock lever.

**Win / fail:** All 16 cells clean and locked within 20 s. On fail, cleaned cells count; Oxygen output stays at −25% until retried.

**Role modifiers:** Engineer: 2 strokes per cell, +5 s. Others: standard.

**ASTRA:** "Every time someone comes in from outside, tiny dust grains ride in on their spacesuit. Clean filters keep that dust out of your lungs."

### 4.3 CO2/O2 Scrubber Valve Balance

**Trigger & real cause:** Oxygen below 30, the Airlock Micro-Leak event, or a stuck valve every ~6 Sols. Breathing out builds up carbon dioxide, and the scrubber must remove it while making oxygen.

**UI & interaction:** Two gauges side by side, "CO2 scrubber" (gray) and "O2 maker" (blue), each with a green SAFE band and a one-line reason under it. Under each gauge sits its own slider (lever) in the same colour. (Reworked after play-testing: three round knobs A, B, C that had to be turned in circles were hard to understand.)
1. Drag the gray lever to the left: the CO2 needle follows it down into SAFE.
1. Drag the blue lever to the right: the O2 needle follows it up into SAFE.
1. A pulsing arrow beside each lever shows the way until its needle is safe; the needles wobble a little because the air keeps changing.
1. Hold both needles in SAFE for 2 s (a "Hold steady" bar fills).

**Win / fail:** Both green for 2 s within 15 s. On fail, Oxygen output −30% until retried; the CO2 gauge glows to show what went wrong.

**Role modifiers:** Engineer: SAFE bands 50% wider, +5 s. Botanist (Wobbly with Wrenches): the needles wobble more, −3 s. Pilot, Comms: standard.

**ASTRA:** "Every breath you breathe out has carbon dioxide in it, and too much makes people sleepy and sick. Our scrubbers grab it. Then our machine pulls oxygen out of Mars's carbon dioxide air, just like NASA's MOXIE did."

### 4.4 Closed-Loop Water Sort

**Trigger & real cause:** Every ~6 Sols, and in Dilemma 2. A cracked filter drops recycling from 98% to 70%, so each astronaut loses 15 water per Sol instead of 1.

**UI & interaction:** A droplet character at the top of a pipe, 3 empty machine slots below, and a tray with 3 machines: Filter (mesh), Boiler (flame), Purifier (purple UV bulb).
1. Drag the machines into the slots in order: Filter → Boiler → Purifier.
1. Tap the tap handle. The droplet flows through and turns from murky brown to clear blue.
1. A wrong order bounces the droplet back and the wrong slot wiggles. Swap and try again.

**Win / fail:** Correct order within 15 s. On fail, recycling stays at 70% until retried.

**Role modifiers:** Botanist: the first slot glows with the right machine, +3 s. Others: standard.

**ASTRA:** "On the space station, sweat, breath and even pee get cleaned back into drinking water. About 98% of it comes back. That last 2% is why we still need ice from the Rover."

### 4.5 Heat Pump Pipe Reroute

**Trigger & real cause:** At dusk when Heat is below 40; after any Heat or Power emergency; during dust storms. Mars nights drop to about −80 °C.

**UI & interaction:** A 4 × 3 grid of pipe tiles. A glowing orange Heating Core on the left, 3 room icons (Bedroom, Kitchen, Greenhouse) on the right, and a sunset bar shrinking across the top.
1. Tap a tile to rotate it 90°.
1. Connected pipes glow orange as warm fluid flows.
1. Connect the core to all 3 rooms before the sun sets.

**Win / fail:** All 3 rooms connected within 20 s. Layouts come from a set of 10 pre-made solvable puzzles. On fail, each unconnected room loses 10 extra Heat that night.

**Role modifiers:** Engineer: 3 tiles start already in the right position. Botanist (Wobbly with Wrenches): one tile is stuck and needs 2 taps per turn, −3 s. Pilot, Comms: standard.

**ASTRA:** "Mars nights can drop to about minus 80 degrees Celsius. We send leftover heat through pipes to where it's needed, just like NASA's Perseverance rover does to stay warm."

### 4.6 Hydroponic LED & Nutrient Match

**Trigger & real cause:** The Hydroponic Nutrient Drift event (Section 6), and Dilemma 4. Without soil, the water must carry all the minerals the roots need, and its mix drifts over time. Food output −40%, fresh-crop HP bonus off.

**UI & interaction:** 3 plant trays (lettuce, potatoes, tomatoes), each with a droopy plant, a drip line and a small color tag. 3 nutrient bottles at the top (green, yellow, purple). An LED switch on the wall.
1. Drag the bottle that matches each tray's tag onto its drip line.
1. Tap the LED switch. Plants perk up under pink-purple light.

**Win / fail:** All 3 matched and lights on within 15 s. A wrong match turns a plant yellow; it recovers on retry. On fail, Food stays at −40%.

**Role modifiers:** Botanist: tags glow, and one tray is auto-matched. Engineer (Not a Gardener): tags are hidden; tap "Ask Botanist" to show them for 3 s (if a Botanist is in the game), otherwise get 2 tries per tray. Pilot, Comms: standard.

**ASTRA:** "Plants mostly use red and blue light, so our LEDs shine those colors and the Greenhouse glows purple. Without soil, the water must carry all the minerals their roots need, so we check it often."

### 4.7 Rover Wheel Pebble Vacuum

**Trigger & real cause:** Before every expedition (required), and after a Bumpy or Rough result. Sharp Martian rocks wedge into treads and damage wheels.

**UI & interaction:** Side view of the Rover with 6 dusty wheels. A vacuum nozzle follows the finger. Two sharp pebbles hide in the treads.
1. Drag the nozzle over each wheel until it shines.
1. Spot the 2 sparkling pebbles and tap to pop them out.
1. If a wheel shows a crack, tap the patch icon (1 SP).

**Win / fail:** 6 clean wheels, 2 pebbles out, cracks patched, within 20 s. On fail, the expedition can still launch, but its risk rises one step.

**Role modifiers:** Pilot: pebbles glow from the start, and risk drops one step on a win. Engineer: crack patches are free. Botanist, Comms: standard.

**ASTRA:** "Sharp, pointy rocks poked holes in NASA's Curiosity rover's metal wheels. A quick clean and check now saves a long walk later!"

### 4.8 Spacesuit Radiation & Pressure Seal Check

**Trigger & real cause:** Before every expedition, once for each crew member going. Mars air is about 100 times thinner than Earth's, and the surface gets much more radiation.

**UI & interaction:** Front view of a spacesuit with leaks showing as puffs of air at 3 random seals (helmet ring, gloves, boots, zipper). A pressure gauge beside it, and a radiation badge on a hook.
1. Tap each puff to snap a seal clamp on it.
1. Drag the radiation badge (dosimeter) onto the suit's chest.
1. If the Suit Radiation Liner is crafted, drag the liner panel into the suit's back.
1. Press and hold PRESSURIZE until the needle is in the green band, then release.

**Win / fail:** All leaks sealed, badge on, gauge green within 15 s. On fail, the Rover waits at the airlock until retried (no Sol lost if fixed the same Sol).

**Role modifiers:** Pilot: 2 leaks instead of 3. Botanist and Comms (surface rookies): 4 leaks, +3 s. Engineer: standard.

**ASTRA:** "Mars air is about 100 times thinner than Earth's, so without a sealed suit you couldn't breathe out there. Your radiation badge counts how much space radiation you get, just like the badges real astronauts wear."

### 4.9 Earth Dish Antenna Alignment

**Trigger & real cause:** When an Earth contact window opens (every 3 Sols after the Lab is built), and after every dust storm. Mars and Earth both move, so the dish must track Earth across the sky.

**UI & interaction:** A night sky with a small blue dot (Earth) drifting slowly. A dish in the corner with two big sliders, Left/Right and Up/Down. Five signal bars above.
1. After a storm only: drag the bent dish edge back into shape (one swipe).
1. Drag the sliders to point the dish's beam (a cone of light) at Earth.
1. Keep 4 or more bars for 3 s while Earth drifts.
1. On a win, a message icon flies toward Earth with a counter: "Arriving in {delay}..." ({delay} is the real Earth-Mars light time on the current Sol; the counter runs sped up)

**Win / fail:** 4+ bars held for 3 s within 20 s. On fail, the window is missed: no Earth message and no Morale bonus until the next window.

**Recurring windows (note, 2026-11-15).** Windows open every 3 Sols counted from the Sol the Lab is finished; Dilemma 4 is the window of its Sol, and its choice starts the next 3-Sol count. The first contact plays `astra.act3.earth_reply`; each later won window gives Morale +5 (`gameplay`). The bent-dish step waits for a dust storm after the Lab: the scripted storm ends before the Lab can exist.

**Role modifiers:** Comms: green zone 2× wider, Earth drifts slower, +5 Morale on success. Engineer: skips the bent-dish step. Pilot, Botanist: standard.

**ASTRA:** "Radio waves travel at the speed of light. Still, a message takes about 3 to 22 minutes to cross between Mars and Earth. Point the dish just right, or the message misses Earth completely!"

## Section 5: Off-screen expeditions, radio logs & upgrade tree

Five story expeditions and one repeatable run all launch from the Garage & Airlock's holographic crater map. The Rover leaves the screen, and the player follows it through a progress bar and a radio log. Each trip costs HP and brings back the parts the next upgrade needs.

### 5.1 How an expedition works (single screen)

1. Tap the Garage & Airlock. The holographic map opens as an overlay: Jezero Crater from above, with glowing target markers.
1. Tap a marker to see its card: duration, HP cost (with the crew's current upgrades), risk, required upgrades and possible loot. Locked targets show a padlock and the missing upgrade.
1. Choose the crew (solo: the Commander; co-op: 1–2 astronauts).
1. Required prep: Rover Wheel Pebble Vacuum (4.7), then a Spacesuit Seal Check (4.8) for each crew member.
1. Cutscene: the airlock cycles (−2 Water), the Rover rolls out the right edge of the screen, and the astronaut avatar vanishes from the base.
1. During the trip, a bar at the top shows progress, crew HP and a radio log. Radio lines appear at set percentages, and some pause the game for a radio decision.
1. On return, the Rover rolls in from the right. A loot screen shows each item with a picture and a one-line "what it's for".

#### Risk outcomes (rolled on return; never a total loss)

| Risk | Smooth (full loot) | Bumpy (full loot, extra wheel repair) | Rough (half loot, back 0.5 Sol late, +5 HP cost) |
|---|---|---|---|
| Low | 85% | 15% | 0% |
| Medium | 60% | 30% | 10% |
| High | 40% | 40% | 20% |

A failed Wheel Vacuum raises risk one step; the Pilot lowers it one step. Story items (Probe Power Core, Black Box, Dish Antenna, the final samples) always drop.

Rescue rule. If a crew member's HP hits 0 on the trip, a rescue drone flies out. The crew comes home right away with half loot (story items included) and goes into Med-Rest. ASTRA plays astra.hp.zero_expedition.

### 5.2 Expedition overview

| # | Target | Sol | Duration | Route | Requires | Risk | Commander HP cost | Loot |
|---|---|---|---|---|---|---|---|---|
| 1 | Crashed Weather Probe Breeze-7, 3 km east (fiction) | 10 | 1 Sol | Crater floor (1.0) | Garage & Airlock | Low | 17 | 15 SP, Probe Power Core, Circuit Board ×3, Titanium Scrap ×2, Weather Sensor |
| 2 | Pathfinder-X Wreck, 8 km north (fiction) | 12 | 1 Sol | Crater floor (1.0) | Titanium Wheels | Medium | 17 | 20 SP, Black Box, Dish Antenna, Solar Cell ×3, Titanium Plate ×3, Circuit Board ×2 |
| 3 | Crater Rim Ice, 12 km northwest (fiction) | 14 | 1 Sol | Crater rim (1.25) | Deep Ice Drill | Medium | 21 | 20 SP, Ice Core ×3, Water Filter Membrane, Titanium Plate ×2, Circuit Board |
| 4 | Ancient Delta Cliffs, 20 km west | 17–18 | 2 Sols | Delta (1.25) | Regolith Radiation Shielding (+ Suit Liner recommended) | High | 19 (27 without Liner) | 25 SP, Rare Battery Cell ×3, Lab Sensor Kit, Mineral Sample ×3, Titanium Plate, Circuit Board ×2 |
| 5 | Canyon Anomaly, 18 km beyond the delta (fiction) | 20 | 1 Sol (2 without Long-Range) | Canyon (1.5) | All 4 Rover upgrades + Lab T2 Deep Scan | Scripted success | 12 | Canyon Samples, Brine Sample, 30 SP |
| R | Scrap & Ice Run (repeatable) | Scrap from 10, Ice from 14 | 1 Sol | Crater floor (1.0) | Garage (Ice mode: Deep Ice Drill) | Low | 17 (8 with Shield + Liner) | Scrap mode: 15 SP + 1 random Circuit Board, Titanium Plate or Solar Cell. Ice mode: Ice Core ×2 |

### 5.3 Radio logs & arrival lines

#### Expedition 1: Breeze-7

| % | Radio log |
|---|---|
| 0 | Rover rolling! Destination: weather probe Breeze-7, 3 kilometers east. |
| 30 | Driving over sand ripples. Mars wind shaped these, just like dunes on Earth. |
| 60 | Found it! Breeze-7 is half buried in dust. Digging it out. |
| 80 | Got its power core and a bag of parts. The core still has a little charge! |
| 100 | Heading home. Put the kettle on, ASTRA! |

ASTRA on return: "Weather probes measure wind, dust and temperature. This one got buried in the storm, but its power core still works. Let's use it to wake Drone #03!"

#### Expedition 2: Pathfinder-X Wreck

| % | Radio log |
|---|---|
| 0 | Rover rolling north. Titanium wheels ready for the boulder field. |
| 25 | Boulders everywhere! Weaving between them slowly. |
| 50 | I see a mast sticking out of the dust... It's Pathfinder-X! |
| 60 | Radio decision: The black box is under a heavy solar panel. How should we get it out? (A) Lift it with the robot arm: safe, takes longer (+0.25 Sol). (B) Dig it out by hand: fast, but more time outside (−5 HP). |
| 80 | Black box secured. Unbolting its big dish antenna too. |
| 100 | Pathfinder-X, you did great. We'll take it from here. Heading home! |

ASTRA on arrival (at 50%): astra.act2.pathfinder_found (Section 1).

#### Expedition 3: Crater Rim Ice

| % | Radio log |
|---|---|
| 0 | Rover heading for the crater rim. It's steep up there. |
| 30 | Climbing slowly. The rim casts a long, cold shadow. |
| 55 | Drill spinning... 1 meter... 2 meters... |
| 70 | ICE! Clear and sparkly. Filling the cargo box. |
| 85 | Radio decision: There's more ice deeper down. (A) Drill one more core: +1 Ice Core, +0.25 Sol, −4 HP. (B) Head home now. |
| 100 | Bringing home enough water for weeks! |

ASTRA on return: "Mars has lots of frozen water, mostly underground and near the poles. Our scan found a small buried patch hiding in this cold shadow. (fiction) Real ice this close to the equator would be a lucky find! Every Ice Core is 25 units of fresh water!"

#### Expedition 4: Ancient Delta Cliffs (2 Sols)

| % | Radio log |
|---|---|
| 0 | Long trip ahead! Radiation shielding packed, suit liner on. |
| 20 | Look left: a little helicopter sitting on a hill. It's Ingenuity! |
| 35 | Reached the delta cliffs. You can see layers of old mud and sand. |
| 50 | Camping in the Rover tonight. Goodnight, base! |
| 60 | Radio decision: Dilemma 5, the space weather warning (Section 6). |
| 80 | Found shiny battery cells in an old supply cache, and some beautiful rocks. |
| 100 | Heading home with the best haul yet! |

ASTRA at 20%: "That's Ingenuity, the first helicopter to fly on another planet, in 2021. It made 72 flights! We look, but never touch. It's a piece of history."

ASTRA at 35%: "Billions of years ago, a river flowed into a lake right here in Jezero Crater. This delta is the mud and sand it left behind. Mud is a great place to look for signs of ancient life."

Expedition 5: Canyon Anomaly — full radio log and finale lines are in Section 1 (radio.exp5.*, astra.finale.*).

#### Scrap & Ice Run (one random line each, from a pool)

| % | Radio log pool |
|---|---|
| 0 | Quick run! Back before dinner. / Off to the scrap field! / Ice drill ready, heading out. |
| 50 | Found a few bolts and a bent panel. / Drill's hitting ice! / Lots of dust today, driving slow. |
| 100 | Coming home with goodies! / Cargo full. See you soon! |

### 5.4 Rover upgrades & module Tier 2 recipes

| Upgrade | Type | Recipe | Unlocks / effect |
|---|---|---|---|
| Repair Kit | Drone | 10 SP | Wakes Drone #02 |
| Reboot Kit | Drone | Probe Power Core + 1 Circuit Board + 10 SP | Wakes Drone #03 |
| Titanium Wheels | Rover | 2 Titanium Scrap + 10 SP | Expedition 2; −1 risk on rocky routes |
| Deep Ice Drill | Rover | 1 Titanium Plate + 1 Circuit Board + 10 SP | Expedition 3, Ice Run |
| Regolith Radiation Shielding | Rover | 1 Titanium Plate + 15 SP | Expedition 4; surface HP loss ×0.6 |
| Suit Radiation Liner | Suit | 1 Circuit Board + 10 SP | Surface HP loss ×0.75 (each suit; co-op crafts 1 per astronaut, extra liners 10 SP) |
| Long-Range Battery (= Garage T2) | Rover | 1 Rare Battery Cell + 1 Titanium Plate + 15 SP | Expedition 5; all trips −1 Sol (min. 1) |
| Regolith Roof Layer | Base | 1 Titanium Plate + 10 SP | Right-wing rooms fully shielded |
| Solar Array T2: Clean-Sweep Panels | Module | 3 Solar Cells + 10 SP | Power +80 |
| Workshop T2: Precision Fabricator | Module | 1 Titanium Plate + 1 Circuit Board + 10 SP | +10 SP, 2 crafts per Sol |
| Greenhouse T2: Vertical LED Farm | Module | 2 Circuit Boards + 10 Water + 10 SP | +16 Food, fresh crops +6 HP |
| Life Support T2: MOXIE-X & Ice Melter | Module | Water Filter Membrane + 2 Ice Cores + 1 Circuit Board + 1 Titanium Plate + 10 SP | +20 Oxygen, auto-melts ice |
| Battery & Heating T2: Deep Cell Bank | Module | 2 Rare Battery Cells + 10 SP | +35 Heat, Power cap 400 |
| Lab T2: Deep Space Array | Module | Lab Sensor Kit + Weather Sensor + 15 SP | Deep Scan, early warnings |
| Recreation T2: Habitat Lounge | Module | 1 Mineral Sample + 10 SP | +6 Morale, refill every 3 Sols |

### 5.5 Component ledger (found vs. required)

| Component | Found in | Used by | Found / required |
|---|---|---|---|
| Circuit Board | Exp 1 ×3, Exp 2 ×2, Exp 3 ×1, Exp 4 ×2 | Reboot Kit, Ice Drill, Suit Liner, Workshop T2, Greenhouse T2 ×2, Life Support T2 | 8 / 7 |
| Titanium Scrap | Exp 1 ×2 | Titanium Wheels | 2 / 2 |
| Titanium Plate | Exp 2 ×3, Exp 3 ×2, Exp 4 ×1 | Ice Drill, Rover Shielding, Roof Layer, Life Support T2, Workshop T2, Long-Range Battery | 6 / 6 |
| Solar Cell | Exp 2 ×3 | Solar Array T2 | 3 / 3 |
| Ice Core | Exp 3 ×3, Ice Run ×2 each | Life Support T2 ×2; spares melt into Water | 3+ / 2 |
| Rare Battery Cell | Exp 4 ×3 | Battery T2 ×2, Long-Range Battery | 3 / 3 |
| Probe Power Core | Exp 1 | Reboot Kit | 1 / 1 |
| Weather Sensor | Exp 1 | Lab T2 | 1 / 1 |
| Dish Antenna | Exp 2 | Research & Comms Lab | 1 / 1 |
| Black Box | Exp 2 | Story: decoded by the Lab on Sol 16 | 1 / 1 |
| Water Filter Membrane | Exp 3 | Life Support T2 | 1 / 1 |
| Lab Sensor Kit | Exp 4 | Lab T2 | 1 / 1 |
| Mineral Sample | Exp 4 ×3 | Recreation T2 (1); each also gives +5 Research when scanned | 3 / 1 |

Timing check: Circuit Boards by Sol 15 are exactly 6 found and 6 used, which is why Workshop T2 waits until Sol 19. Titanium Plates by Sol 15 are 5 found and 4 used. A Rough result or the Engineer's Heavy Toolkit can leave a gap; Scrap Runs drop Circuit Boards, Titanium Plates and Solar Cells, so nothing is ever unobtainable.

## Section 6: Story dilemmas & random Martian events

Five scripted dilemmas teach cause and effect at key story moments; four repeatable events keep the base lively in sandbox play. Every choice costs something, none can end the run, and ASTRA always explains why the result happened.

#### Presentation rules

- The game pauses. ASTRA's panel slides in with a yellow (warning) or red (urgent) header.
- Choices are 3 big cards with icons and up/down arrows for each affected meter, including a heart icon for HP. No exact numbers on the cards.
- After a choice, affected meters get a "Watch what happens" tag until the delayed effect fires. Then ASTRA plays the follow-up and links it to the choice.
- Co-op: any player can propose a choice; the choice locks when a majority taps it, or after 20 s the most-tapped card wins.
- Numbers below are solo. In co-op, Oxygen, Food and Water deltas are × N; HP deltas apply to each named astronaut.

### Dilemma 1: The Dust Storm (Sol 3)

ASTRA 6.7 // WEATHER ALERT: A giant dust storm is rolling across Jezero Crater! For 3 Sols, dust will block about 70% of our sunlight, and our dust-filter fans must work extra hard. Fun fact: dust storms make Mars days cooler and nights warmer. If we do nothing, our batteries could run dry, so how should we get ready?

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Power Saver: turn off the Kitchen stove and Bedroom lights for 3 Sols | Power use −6 per Sol. Morale −3 per Sol (cold meals, dark rooms) | Power ends the storm at about 16. Sol 7: Morale +5 ("We planned ahead!") | "Smart thinking! In 2018, a dust storm covered all of Mars and NASA's Opportunity rover ran out of power. Saving energy kept us safe." |
| B. Top Up: the Commander goes outside to clean and tilt the panels before the storm | Power +40 now. Commander HP −10 (half a Sol on the surface) | Power ends the storm at about 38. Full sleep restores the HP by Sol 4 | "Full batteries before a storm, just like charging a tablet before a long trip. A little radiation outside was worth it this time." |
| C. Keep Everything Running | No change | Sol 6: Power hits 0. Power Emergency, Static Wipe and Heat Pump mini-games, Morale −10. No HP loss (crew sheltered in the Bedroom) | "Oops, the storm drained our batteries. On Mars, the weather decides how much power we get. Next storm, let's prepare!" |

### Dilemma 2: The Cracked Filter (Sol 8)

ASTRA 6.7 // MAINTENANCE ALERT: The water recycler's filter has cracked! We're getting back only 70% of our water instead of 98%. We have 12 Spare Parts: enough to fix the filter OR build a Cargo Trailer for the first Rover trip. Not both!

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Fix the filter (−12 SP) | Water Sort mini-game; recycling back to 98% | SP tight until Sol 10 | "Water first! Without it, nothing else works. The space station recycles 98% of its water, and now so do we again." |
| B. Build the Cargo Trailer (−12 SP) | Water −15 per Sol until fixed | Expedition 1 brings +20 bonus SP. Sol 11: filter fixed automatically (−12 SP). Water about −45 in total | "We spent parts to earn more parts. That's called investing! But wow, look how fast water vanishes at 70%. That's why 98% matters so much." |
| C. Ration water: shorter showers until we can afford the fix | Water loss halved (−7 per Sol). Morale −2 and HP −2 per Sol (thirsty and tired) | Sol 10: Workshop income pays for the fix. Morale and HP recover with sleep | "Using less is a real space trick: astronauts on the space station take sponge baths. It worked, but everyone felt a bit tired and grumpy." |

### Dilemma 3: The Martian Soil Test (Sol 11)

ASTRA 6.7 // CREW IDEA: New idea from the crew: "Why not grow potatoes in Martian soil? It's free, and there's tons of it!" Hmm. Should we try it?

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Plant straight in Martian soil | −10 Water. A potato bed appears | Sol 13: potatoes grow, but ASTRA's scan finds perchlorates before anyone eats them. Harvest composted. Morale −3. Choice B unlocks in the Lab menu | "The plants grew, but they soaked up perchlorates, salty chemicals that are bad for people. Good experiment: now we know! Scientists test things before they eat them." |
| B. Wash the soil first (−20 Water, 1 drone for 1 Sol) | Water dips (tight until Expedition 3) | Sol 13: Soil Beds unlock. Greenhouse +3 Food per Sol and fresh crops +1 HP, for good. +5 Research | "Perchlorates dissolve in water, so rinsing washes a lot of them out. But rinsing can leave some behind, so real scientists are still testing ways to make Mars soil safe for farms." |
| C. Stick with hydroponics | No cost | No bonus. Choice B stays available from the Lab menu | "Safe choice! When you're not sure something is safe, testing first is what real scientists do." |

### Dilemma 4: Cold Plants or Call Home? (Sol 16)

ASTRA 6.7 // POWER ALERT: A very cold night is coming, and the Greenhouse heater needs extra power. But tonight is also our first chance to send Pathfinder-X's log to Earth, and the Lab needs full power too. We can only do one!

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Keep the plants warm | Greenhouse safe. Earth window missed. Morale −5 | Next Earth window on Sol 19 | "Our plants are safe and cozy. Earth will still be there. Our next radio slot is in 3 Sols." |
| B. Call Earth | Antenna Alignment mini-game. On success: Morale +10, Research +10, astra.act3.earth_reply plays | Greenhouse gets cold: Food output −50% and no fresh-crop HP for 2 Sols; Nutrient Match triggers | "Hearing from home made everyone smile! The plants got chilly, though. Most vegetables stop growing when it gets close to freezing." |
| C. Move the trays into the warm Kitchen (1 drone for half a Sol) | Food output −20% for 1 Sol. Lab has enough power for a text-only message: Morale +5 | No further cost | "Clever! We used heat that was already there. When two things need the same power, sometimes there's a third way." |

### Dilemma 5: Space Weather Warning (Sol 18, radio decision on Expedition 4)

ASTRA 6.7 // SPACE WEATHER ALERT: The Sun just shot out a burst of super-fast particles, a solar storm! The fastest particles can reach Mars in less than an hour, so we must decide fast! The base is well shielded under the soil, but the Rover crew is out at the Delta Cliffs. What should they do?

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Race home now | Crew HP −6 (driving through the start of the storm). Trip ends with half loot: Rare Battery Cell ×2, Lab Sensor Kit, Mineral Sample ×1, 10 SP | Short 1 Rare Battery Cell. Expedition 4 becomes repeatable (1 Sol) to collect the rest | "Safety first! We left some treasure behind, but we can always go back. Astronauts never take chances with radiation." |
| B. Shelter under the cliff overhang for 1 Sol | Almost no flare HP loss: −2 (thick rock overhead counts like deep shielding). Morale −3 (a boring day) | Full loot. Rover home on Sol 19, a Sol later; Tier 2 installs that Sol still finish in time for Sol 20 | "Thick rock blocks radiation, just like the soil over our base. Mars has very thin air and no magnetic shield around the whole planet, so we hide behind rock and dirt." |
| C. Keep working behind the Rover's shielding | Crew HP −14 (flare ×3 for half a Sol, reduced by shield, liner and RR). Full loot, on time | Shielding worn out: re-craft for 15 SP before the next trip. Morale −3 | "Our shielding helped a lot, but no shield blocks everything. We got the treasure, and now the crew needs a good rest." |

### Random Martian events (repeatable)

| Event | First possible | Chance per Sol | Cooldown | Early warning (forecast) |
|---|---|---|---|---|
| Solar Flare Radiation Spike | Sol 8 | 10% | 6 Sols | 1 Sol with Lab T2 or Comms Officer (2 with both) |
| Electrostatic Dust Devil | Sol 5 | 15% (daytime) | 4 Sols | None |
| Airlock Micro-Leak | Sol 10 | 10% | 5 Sols | None |
| Hydroponic Nutrient Drift | Sol 10 | 15% | 4 Sols | None |

At most 1 random event per Sol, never on a story-dilemma Sol, and never while the solo Commander is away (Base Autopilot).

#### Event 1: Solar Flare Radiation Spike

Early warning (only with Lab T2 or the Comms Officer's Storm Watch), shown 1 Sol before the flare:

ASTRA 6.7 // SPACE WEATHER WATCH: The Sun has a stormy spot facing Mars. A flare could come soon.

The warning is a **forecast, not a detection**: real forecasters watch active regions on the Sun, but cannot predict the exact time of a flare.

ASTRA 6.7 // SPACE WEATHER ALERT: Solar flare! Its fastest particles can reach Mars in less than an hour. Our underground rooms are well shielded. Anyone outside or in an unfinished room will get a big dose of radiation, so what's the plan?

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Everyone to the Storm Shelter (Bedroom for half a Sol) | Almost no HP loss (−1 in the shelter). Workshop and Greenhouse tasks pause: −3 SP, −5 Food | None | "Safe and sound! In May 2024, a huge solar storm hit Mars. NASA said an astronaut next to Curiosity would have got a dose like 30 chest X-rays at once." |
| B. Keep working | Anyone in an unfinished right-wing room: HP −9 (half a Sol at −18). Anyone in a finished room: HP −2. Anyone on the surface: flare ×3 formula | None. HP recovers with sleep | "We kept working, but some of us took a hit. Next time, let's hide first and work later. Rest brings your energy back, but real radiation adds up over time, so it's better to avoid it." |
| C. Planned shelter (only with an early warning) | Crew shelters at the right moment; drones keep working. Only the tiny shelter dose (−1 HP) | None | "That's what early warnings are for! Our drones are built to handle radiation better than people, but even robots can glitch in a big storm. In 2024, one storm knocked out the star camera on a spacecraft circling Mars for an hour!" |

#### Event 2: Electrostatic Dust Devil

ASTRA 6.7 // WEATHER ALERT: A dust devil, a spinning tornado of dust, is heading straight for our solar panels! It could blow the dust off, or dump a fresh load on them. What should we do?

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Let it pass | Coin flip: 50% panels blown clean (Power +20% for 3 Sols); 50% panels dusted (Power −30% until Static Wipe) | Effect lasts as stated | Clean: "Lucky! Dust devils sometimes cleaned the panels of NASA's Spirit and Opportunity rovers for free." Dusty: "Not so lucky this time. Time to wipe!" |
| B. Tilt the panels flat to stow | Power −50% for the rest of the Sol. No risk | None | "Playing it safe. Stowed panels make less power, but they're safer from the dust." |
| C. Watch from outside, then wipe | Commander (or 1 astronaut) HP −5. Panels guaranteed clean; Power +10% for 3 Sols | None | "Hands-on cleaning did the trick! A little time outside means a little radiation, so keep it short." |

#### Event 3: Airlock Micro-Leak

ASTRA 6.7 // MAINTENANCE ALERT: I hear a tiny hiss. There's a small air leak somewhere in the airlock! We're losing a bit of oxygen and water vapor every Sol. Let's find it!

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Hunt the leak now | Seal Check variant: find the puff on the airlock wall and clamp it. Leak fixed | None | "Found it! In 2020, the space station crew found a tiny leak by watching a floating tea leaf drift toward the hole!" |
| B. Quick tape patch | Leak stops now. −1 SP | Leak returns after 3 Sols at half strength (Oxygen −2, Water −1 per Sol) | "Tape is a great quick fix, but it doesn't last forever. We'll need a proper repair soon." |
| C. Seal the airlock | No expeditions for 1 Sol. A drone fixes the leak (1 Sol of drone time) | Airlock reopens next Sol | "Closing the door stops the leak while the drone works. Sometimes waiting is the safest move." |

If ignored (the alert is dismissed with no choice), the leak costs Oxygen −4 and Water −1 per Sol until fixed.

#### Event 4: Hydroponic Nutrient Drift

ASTRA 6.7 // GREENHOUSE ALERT: The plants look droopy! The nutrient mix in their water has drifted out of balance. Food output is down, and no fresh crops means less HP recovery.

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Fix it now | LED & Nutrient Match mini-game. On win, Greenhouse back to normal | None | "Happy plants! In 2016, astronaut Scott Kelly found moldy zinnia flowers on the space station. He cleaned them and nursed them back to health, and they bloomed!" |
| B. Flush and refill the tank | Water −10. Auto-fixed at the start of next Sol | Food −40% until then | "Fresh water, fresh start. It cost some water, but the plants will bounce back by tomorrow." |
| C. Wait and see | Food output −40%, no fresh-crop HP | After 2 Sols: plants wilt, Food −10, and the mini-game opens automatically | "Waiting made it worse. Plants without soil depend on us for all the minerals their roots need, so it's best to fix problems early." |

## Section 7: Developer-ready JSON schemas

Three templates follow, filled with real game data: the Commander and Chief Engineer roles, Expedition 2 (Pathfinder-X), and Dilemma 5 (a radio decision that hits both base resources and HP). They share one effects vocabulary, so a single effects engine can apply them all. In this repository the data lives in src/data/*.js: those modules export objects with exactly these shapes.

#### Shared conventions

- Resource keys: power, heat, water, oxygen, food, morale, spareParts, research. Astronaut keys: hp, crewHp (every crew member on the current expedition).
- Item ids are snake_case (circuit_board, titanium_plate, black_box).
- Durations are in Sols and may be fractional (0.5). perSol values apply continuously; instant values apply once.
- Player-facing text sits under text or in a line object with an id (localization key from Section 1) and en (English text).
- HP losses on the surface are not hard-coded: they use the formula from Section 3.6. A number marked Estimate is for UI previews and tests only.

### 7.1 astronaut_roles.json

```json
{
  "schemaVersion": 1,
  "roles": [
    {
      "id": "commander",
      "mode": "solo",
      "displayName": "Commander",
      "baseHp": 100,
      "radiationResistance": 0.15,
      "surfaceRadiationMultiplier": 1.0,
      "foodUseMultiplier": 1.0,
      "buffs": [
        {
          "id": "all_rounder",
          "name": "All-Rounder",
          "effects": [ { "type": "miniGameTimerBonusSec", "targets": ["*"], "value": 3 } ]
        },
        {
          "id": "drone_link",
          "name": "Drone Link",
          "effects": [ { "type": "droneQueueSize", "value": 2 } ]
        }
      ],
      "debuffs": [],
      "limits": [
        {
          "id": "one_pair_of_hands",
          "name": "One Pair of Hands",
          "effects": [ { "type": "baseAutopilotWhileAway", "blockNewBreakdowns": true, "deferEvents": true } ]
        }
      ],
      "text": {
        "lobbyBlurb": "A steady leader who can do a bit of everything. Perfect for flying solo!"
      }
    },
    {
      "id": "chief_engineer",
      "mode": "coop",
      "displayName": "Chief Engineer",
      "baseHp": 100,
      "radiationResistance": 0.10,
      "surfaceRadiationMultiplier": 1.2,
      "foodUseMultiplier": 1.0,
      "buffs": [
        {
          "id": "master_mechanic",
          "name": "Master Mechanic",
          "effects": [
            { "type": "miniGameStepReduction", "targets": ["air_filter_scrub", "valve_balance", "heat_pump_reroute", "wheel_pebble_vacuum"], "value": 1 },
            { "type": "miniGameTimerBonusSec", "targets": ["air_filter_scrub", "valve_balance", "heat_pump_reroute", "wheel_pebble_vacuum"], "value": 5 },
            { "type": "freeCrackPatch", "targets": ["wheel_pebble_vacuum"] },
            { "type": "skipStep", "targets": ["dish_antenna_alignment"], "step": "straighten_dish" }
          ]
        },
        {
          "id": "fast_fabricator",
          "name": "Fast Fabricator",
          "effects": [
            { "type": "craftCostMultiplier", "resource": "spareParts", "value": 0.75 },
            { "type": "tier2InstallSolsWhenAssisting", "value": 0 }
          ]
        }
      ],
      "debuffs": [
        {
          "id": "not_a_gardener",
          "name": "Not a Gardener",
          "effects": [
            { "type": "hideMiniGameHints", "targets": ["nutrient_match"], "fallback": { "askRole": "astro_botanist", "revealSec": 3, "triesPerItemIfRoleMissing": 2 } }
          ]
        },
        {
          "id": "heavy_toolkit",
          "name": "Heavy Toolkit",
          "effects": [
            { "type": "expeditionLootItemsDelta", "value": -1, "excludeStoryItems": true }
          ]
        }
      ],
      "dependencyLoops": ["rover_pilot", "astro_botanist", "comms_officer"],
      "missingRoleFallback": {
        "craftCostMultiplier": 1.0,
        "tier2InstallSols": 0.5
      },
      "text": {
        "lobbyBlurb": "Fixes anything, builds everything. Just keep them away from the plants!"
      }
    }
  ]
}
```

The Engineer's Heavy Toolkit HP penalty is stored as surfaceRadiationMultiplier: 1.2, so the HP formula picks it up automatically.

### 7.2 expeditions.json

```json
{
  "schemaVersion": 1,
  "expeditions": [
    {
      "id": "exp_02_pathfinder_wreck",
      "displayName": "Pathfinder-X Wreck",
      "storyAct": 2,
      "mapMarker": { "x": 0.52, "y": 0.18, "icon": "wreck", "distanceKm": 8 },
      "availability": {
        "minSol": 12,
        "allOf": [ { "moduleBuilt": "garage_airlock" }, { "upgradeOwned": "titanium_wheels" } ]
      },
      "durationSols": 1,
      "routeFactor": 1.0,
      "risk": "medium",
      "outcomeOdds": { "smooth": 0.6, "bumpy": 0.3, "rough": 0.1 },
      "crewSize": { "min": 1, "max": 2 },
      "hp": {
        "baseRatePerSol": 20,
        "formula": "baseRatePerSol * durationSols * routeFactor * (1 - RR) * S_rover * S_suit * F * roleSurfaceMultiplier * M_fit (max 1.25)",
        "commanderEstimate": 17
      },
      "prepMiniGames": ["wheel_pebble_vacuum", "suit_seal_check"],
      "airlockCost": { "water": 2 },
      "radioLog": [
        { "atPercent": 0, "line": { "id": "radio.exp2.00", "en": "Rover rolling north. Titanium wheels ready for the boulder field." } },
        { "atPercent": 25, "line": { "id": "radio.exp2.25", "en": "Boulders everywhere! Weaving between them slowly." } },
        { "atPercent": 50, "line": { "id": "radio.exp2.50", "en": "I see a mast sticking out of the dust... It's Pathfinder-X!" }, "astra": { "id": "astra.act2.pathfinder_found", "en": "Commander, look, that's Pathfinder-X! It's been waiting here since 2038. Grab its black box, it recorded everything before the storm. And its big antenna could fix our Comms Lab!" } },
        {
          "atPercent": 60,
          "line": { "id": "radio.exp2.60", "en": "The black box is under a heavy solar panel. How should we get it out?" },
          "decision": {
            "pauseGame": true,
            "choices": [
              { "id": "A_robot_arm", "label": "Lift it with the robot arm", "effects": { "expeditionExtendSols": 0.25 } },
              { "id": "B_dig_by_hand", "label": "Dig it out by hand", "effects": { "crewHp": -5 } }
            ]
          }
        },
        { "atPercent": 80, "line": { "id": "radio.exp2.80", "en": "Black box secured. Unbolting its big dish antenna too." } },
        { "atPercent": 100, "line": { "id": "radio.exp2.100", "en": "Pathfinder-X, you did great. We'll take it from here. Heading home!" } }
      ],
      "loot": {
        "story": [
          { "item": "black_box", "qty": 1 },
          { "item": "dish_antenna", "qty": 1 }
        ],
        "standard": [
          { "item": "spare_parts", "qty": 20 },
          { "item": "solar_cell", "qty": 3 },
          { "item": "titanium_plate", "qty": 3 },
          { "item": "circuit_board", "qty": 2 }
        ],
        "roughMultiplier": 0.5,
        "extraCrewBonus": 0.25
      },
      "onReturn": {
        "astra": { "id": "astra.act2.blackbox_home", "en": "The black box is safe in the Garage, but it's locked with an old code. We need a working Comms Lab to read it." },
        "unlocks": [ { "moduleAvailable": "research_comms_lab" } ]
      },
      "onRescue": { "lootMultiplier": 0.5, "keepStoryItems": true, "crewState": "med_rest" }
    }
  ]
}
```

### 7.3 dilemmas.json

```json
{
  "schemaVersion": 1,
  "dilemmas": [
    {
      "id": "dilemma_05_space_weather",
      "type": "radioDecision",
      "trigger": { "expedition": "exp_04_delta_cliffs", "atPercent": 60, "pauseGame": true },
      "severity": "urgent",
      "text": {
        "header": "SPACE WEATHER ALERT",
        "astraAlert": { "id": "astra.d5.alert", "en": "The Sun just shot out a burst of super-fast particles, a solar storm! The fastest particles can reach Mars in less than an hour, so we must decide fast! The base is well shielded under the soil, but the Rover crew is out at the Delta Cliffs. What should they do?" }
      },
      "choices": [
        {
          "id": "A_race_home",
          "label": "Race home now",
          "previewIcons": [ { "stat": "hp", "direction": "down" }, { "stat": "loot", "direction": "down" } ],
          "immediate": {
            "crewHp": -6,
            "endExpedition": {
              "lootOverride": [
                { "item": "rare_battery_cell", "qty": 2 },
                { "item": "lab_sensor_kit", "qty": 1 },
                { "item": "mineral_sample", "qty": 1 },
                { "item": "spare_parts", "qty": 10 }
              ]
            }
          },
          "delayed": [
            { "afterSols": 0, "when": "onReturn", "unlock": { "repeatableExpedition": "exp_04_delta_cliffs", "durationSols": 1 } }
          ],
          "astraFeedback": { "id": "astra.d5.a", "en": "Safety first! We left some treasure behind, but we can always go back. Astronauts never take chances with radiation." }
        },
        {
          "id": "B_shelter",
          "label": "Shelter under the cliff overhang for 1 Sol",
          "previewIcons": [ { "stat": "time", "direction": "down" }, { "stat": "morale", "direction": "down" } ],
          "immediate": {
            "crewShieldedForSols": 1,
            "expeditionExtendSols": 1,
            "resources": { "morale": -3 }
          },
          "delayed": [],
          "astraFeedback": { "id": "astra.d5.b", "en": "Thick rock blocks radiation, just like the soil over our base. Mars has very thin air and no magnetic shield around the whole planet, so we hide behind rock and dirt." }
        },
        {
          "id": "C_keep_working",
          "label": "Keep working behind the Rover's shielding",
          "previewIcons": [ { "stat": "hp", "direction": "down" }, { "stat": "spareParts", "direction": "down" } ],
          "immediate": {
            "crewHpFormula": { "flareMultiplier": 3, "durationSols": 0.5 },
            "crewHpEstimate": -14,
            "resources": { "morale": -3 }
          },
          "delayed": [
            { "afterSols": 0, "when": "onReturn", "removeUpgrade": "regolith_radiation_shielding", "recraftCost": { "spareParts": 15 } }
          ],
          "astraFeedback": { "id": "astra.d5.c", "en": "Our shielding helped a lot, but no shield blocks everything. We got the treasure, and now the crew needs a good rest." }
        }
      ],
      "coop": { "vote": "majority", "timeoutSec": 20, "resourceScaling": "perCapita" }
    }
  ]
}
```

## Section 8: Science Logbook, Mission Report & badges

Every real science fact ASTRA tells the player becomes a collectible card; at the end of the run a
Mission Report shows what the crew achieved and learned; badges reward real-world good practice.
There is a kid-friendly Mission Rating (stars, never zero) but no "lose" state.

### 8.1 Science Logbook

**Rules**
- A card unlocks the first time its trigger line plays (or its mini-game or follow-up is shown).
  A small "New card!" chip appears on the ASTRA panel; the card is added to the Logbook.
- The Logbook opens from the HUD book icon. Cards sit in a grid, grouped by topic; locked cards
  show a silhouette and "???".
- Each card has: a title, two sentences (under 20 words each), the real mission or organisation,
  an image, and a "How do we know?" link that shows the source name.
- **Core cards (20)** unlock on the main 20-Sol path and each has its own image
  (`logbook.<card>`). **Bonus cards (38)** come from events, rare choices, mini-games and sandbox
  play and share one of six category images (`logbook.cat.sun`, `.surface`, `.iss`, `.rover`,
  `.plants`, `.earth`). Image prompts: `content/handoff/LOGBOOK_IMAGE_PROMPTS.md`.
- Line IDs: `card.<card>.title` and `card.<card>.text`. The table below holds the English text.
- Every card restates a claim from `content/science/FACT_CHECK.md`; the Source column is the
  page that claim was checked against. Story inventions (fiction) never become cards.
- In co-op the Logbook is shared by the crew.

| Card | Tier | Unlocked by | Title | Text | Real mission / source org | Image | Source |
|---|---|---|---|---|---|---|---|
| gravity | core | astra.intro.landing | Mars Gravity | Mars pulls on you with 38% of Earth's gravity. You could jump about two and a half times higher there! | NASA Mars Fact Sheet | logbook.gravity | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html |
| no_shield | core | astra.intro.why_underground | No Global Shield | Mars lost its planet-wide magnetic field billions of years ago. Only small magnetic patches remain in its crust. | MAVEN | logbook.no_shield | https://science.nasa.gov/missions/maven/nasas-maven-illuminates-new-understanding-of-auroras-at-mars/ |
| soil_blanket | core | astra.intro.why_underground | Soil Blanket | Soil overhead blocks a lot of space radiation. Scientists calculate that about 1 to 2.5 meters would protect a Mars base. | Curiosity RAD (model checked against it) | logbook.soil_blanket | https://doi.org/10.1029/2019JE006246 |
| sunlight | core | astra.tut.solar_done | Weaker Sunshine | Mars is farther from the Sun, so it gets about 43% of Earth's sunlight. Solar panels must be big and clean. | NASA Mars Fact Sheet | logbook.sunlight | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html |
| sol | core | astra.tut.done | One Sol | A day on Mars is called a sol. It lasts 24 hours, 39 minutes and 35 seconds. | NASA GISS Mars24 | logbook.sol | https://www.giss.nasa.gov/tools/mars24/help/notes.html |
| blue_sunset | bonus | astra.act1.first_sunset | Blue Sunsets | Near the setting Sun, Mars's sky glows blue, while Earth's sunsets are orange. Scientists think fine dust scattering light causes it. | NASA rover images | logbook.cat.surface | https://science.nasa.gov/image-article/apod-2025-june-15-two-worlds-one-sun/ |
| cold_nights | core | astra.act1.first_dusk | Freezing Nights | Perseverance measured minus 83 °C one night in Jezero Crater. Rovers and bases must keep warm to survive. | Perseverance (MEDA) | logbook.cold_nights | https://www.jpl.nasa.gov/news/nasas-first-weather-report-from-jezero-crater-on-mars/ |
| waste_heat | core | astra.act1.battery_built | Waste Heat | Perseverance's power generator makes extra heat. Warm fluid carries it around the rover to protect its electronics at night. | Perseverance | logbook.waste_heat | https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/power/ |
| global_storms | core | astra.act1.storm_begin | Planet-Wide Storms | Some Martian dust storms grow until they circle the whole planet. NASA called the 2018 storm "planet-encircling". | Mars Reconnaissance Orbiter, Opportunity | logbook.global_storms | https://science.nasa.gov/solar-system/planets/mars/10-things-massive-dust-storm-on-mars/ |
| storm_temps | bonus | Dilemma 1 alert | Warm Stormy Nights | In a dust storm, Mars days get cooler because less sunlight reaches the ground. Nights get warmer because the dusty air heats the ground. | Curiosity | logbook.cat.surface | https://www.nasa.gov/missions/how-a-tiny-curiosity-motor-identified-a-massive-martian-dust-storm/ |
| printed_wrench | core | astra.act1.workshop_built | Printed in Space | In 2014, a 3D printer on the space station made a wrench from a file sent up from Earth. Printing took about four hours. | International Space Station | logbook.printed_wrench | https://www.nasa.gov/mission_pages/station/research/news/3Dratchet_wrench |
| sticky_dust | core | astra.act1.storm_end | Sticky Dust | Martian dust picks up electric charge when grains rub together. The charge makes it cling to solar panels and windows. | NASA dust research | logbook.sticky_dust | https://ntrs.nasa.gov/api/citations/20120003263/downloads/20120003263.pdf |
| sleep_missions | bonus | astra.act1.first_sleep | Sleep in Space | Astronauts follow strict sleep schedules, even before launch. Too little sleep leads to tired mistakes. | International Space Station | logbook.cat.iss | https://www.nasa.gov/missions/station/seven-ways-astronauts-improve-sleep-may-help-you-snooze-better-on-earth/ |
| green_air | bonus | astra.act2.greenhouse_start | Green Air | Plants use light to turn carbon dioxide and water into food and oxygen. Scientists have tested plants for space life support since the 1950s and 60s. | NASA plant research | logbook.cat.plants | https://ntrs.nasa.gov/citations/20170011105 |
| perchlorates | core | astra.act2.greenhouse_built | Perchlorates | In 2008, NASA's Phoenix lander found perchlorate salts in Martian soil. In people, it can upset the thyroid, a small gland in the neck that helps the body grow. | Phoenix; US EPA | logbook.perchlorates | https://www.jpl.nasa.gov/news/missing-piece-inspires-new-look-at-mars-puzzle/ · https://www.epa.gov/sdwa/perchlorate-drinking-water-frequent-questions |
| purple_garden | core | astra.act2.greenhouse_built | Purple Gardens | Plants use mostly red and blue light and reflect green. That's why space gardens under LEDs glow pink and purple. | Veggie (space station) | logbook.purple_garden | https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/ |
| sharp_rocks | core | astra.act2.garage_built | Sharp Rocks | Sharp Martian rocks punched holes in the thin aluminum skin of Curiosity's wheels. Drivers now choose smoother routes. | Curiosity | logbook.sharp_rocks | https://jpl.nasa.gov/news/news.php?release=2014-028 |
| space_salad | core | astra.act2.first_harvest | Space Salad | On August 10, 2015, astronauts on the space station ate red romaine lettuce grown on board. It was the first station-grown crop on the menu. | Veggie (space station) | logbook.space_salad | https://www.nasa.gov/blogs/spacestation/2015/08/10/cosmonauts-complete-russian-spacewalk/ |
| surface_dose | core | astra.act3.radiation_lesson | A Day of Radiation | Curiosity measured how much radiation reaches the Martian surface each day. People in the US get about that much from nature in three months. | Curiosity RAD; US NRC | logbook.surface_dose | https://www.nasa.gov/news-release/nasa-rover-results-include-first-age-measurement-on-mars-and-help-for-human-exploration/ · https://www.nrc.gov/about-nrc/radiation/around-us/doses-daily-lives.html |
| slow_messages | core | astra.act3.lab_built | Slow Messages | Radio waves are as fast as light. Still, a message between Mars and Earth takes about 3 to 22 minutes, depending on where the planets are. | NASA Mars Fact Sheet | logbook.slow_messages | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html |
| chapea | bonus | astra.act3.rec_built | Pretend Mars Home | In NASA's CHAPEA test, four volunteers lived 378 days in a 3D-printed habitat in Houston. They practised life on Mars. | CHAPEA | logbook.cat.earth | https://www.nasa.gov/missions/analog-field-testing/chapea/first-mars-crew-completes-yearlong-simulated-red-planet-nasa-mission/ |
| marsquakes | core | astra.act3.blackbox_react1 | Marsquakes | NASA's InSight lander detected 1,319 marsquakes. Some were caused by space rocks hitting Mars. | InSight | logbook.marsquakes | https://www.jpl.nasa.gov/news/nasa-retires-insight-mars-lander-mission-after-years-of-science/ |
| methane | bonus | astra.act3.blackbox_react2 | Mystery Gas | Curiosity has detected methane in Mars's air, and the amount changes. It could come from rocks and water, or from life, and nobody knows yet. | Curiosity | logbook.cat.rover | https://www.nasa.gov/solar-system/curiositys-mars-methane-mystery-continues/ |
| wet_soil | bonus | astra.act3.roof_built | Building With Soil | Future Mars bases could pile soil on top to block radiation. Soil with water in it works even better, because hydrogen helps. | Curiosity RAD (model checked against it) | logbook.cat.surface | https://doi.org/10.1029/2019JE006246 |
| moxie | core | astra.act3.ls_t2 | Air From Mars | NASA's MOXIE made 122 grams of oxygen from Mars's carbon dioxide air. That's about what a small dog breathes in 10 hours. | Perseverance (MOXIE) | logbook.moxie | https://www.jpl.nasa.gov/news/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/ |
| brine | bonus | astra.act3.deep_scan | Salty Water | Salts like perchlorate lower the temperature at which water freezes. Tiny amounts of salty water may form in Martian soil on some nights. | Curiosity | logbook.cat.surface | https://www.jpl.nasa.gov/news/nasa-mars-rovers-weather-data-bolster-case-for-brine/ |
| rock_pages | bonus | radio.exp5.02 | Rock Pages | Rock layers stack up over time, with the oldest at the bottom. Curiosity reads them to learn about ancient lakes and rivers. | Curiosity | logbook.cat.rover | https://www.jpl.nasa.gov/news/curiosity-peels-back-layers-on-ancient-martian-lake/ |
| leopard_spots | core | astra.finale.leopard | Leopard Spots | In 2024, Perseverance found a rock with light spots ringed in dark material. NASA calls them a possible sign of past life: a clue, not proof. | Perseverance | logbook.leopard_spots | https://www.nasa.gov/news-release/nasa-says-mars-rover-discovered-potential-biosignature-last-year/ |
| sealed_samples | bonus | radio.exp5.06 | Sealed Samples | Perseverance seals rock cores in airtight titanium tubes. They wait on Mars so they could be collected in the future. | Perseverance | logbook.cat.rover | https://www.jpl.nasa.gov/news/nasas-perseverance-rover-collects-first-mars-rock-sample/ |
| long_stay | bonus | astra.sandbox.milestone_50 | A Long Stay | NASA's human mission studies plan about 500 days on the surface of Mars. That's longer than a year on Earth. | NASA Mars Design Reference Architecture 5.0 | logbook.cat.earth | https://www.nasa.gov/wp-content/uploads/2015/09/373665main_nasa-sp-2009-566.pdf |
| hydrogen_shield | bonus | astra.rad.suit_liner | Hydrogen Shield | Materials rich in hydrogen, like water and some plastics, are good at blocking space radiation. Liquid hydrogen is best, but hard to use. | NASA space radiation research | logbook.cat.sun | https://three.jsc.nasa.gov/articles/CucinottaKimChappell0512.pdf |
| dose_adds_up | bonus | astra.tut.hp_intro | Dose Adds Up | Radiation dose adds up over an astronaut's whole career. NASA's limit is 600 millisieverts for a lifetime of spaceflight. | NASA crew health standards | logbook.cat.sun | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf |
| water_98 | bonus | astra.res.water_low | 98% Recycled | The space station recovers about 98% of its water, including from sweat, breath and urine. Every drop counts in space. | International Space Station | logbook.cat.iss | https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/ |
| dust_devils | bonus | astra.t2.solar | Dust Devil Cleaners | In March 2005, passing dust devils cleaned Spirit's solar panels. Its power jumped from about 60% to 93%. | Spirit | logbook.cat.rover | https://science.nasa.gov/mission/mer-spirit/ |
| stacked_farm | bonus | astra.t2.greenhouse | Stacked Farms | Vertical farms grow plants on shelves stacked high. One two-acre indoor farm grows about as much as a 720-acre outdoor farm. | NASA plant research spinoff | logbook.cat.plants | https://spinoff.nasa.gov/indoor-farming |
| rover_marathon | bonus | astra.t2.garage | Rover Marathon | In 2015, Opportunity passed a full marathon distance of 42.195 kilometers. By the end it had driven more than 45 kilometers. | Opportunity | logbook.cat.rover | https://www.jpl.nasa.gov/news/nasas-opportunity-mars-rover-passes-marathon-distance/ |
| insight_dust | bonus | 4.1 ASTRA | Dusty Panels | Dust slowly covered InSight's solar panels until its batteries ran out. NASA ended the mission in December 2022. | InSight | logbook.cat.surface | https://www.jpl.nasa.gov/news/nasa-retires-insight-mars-lander-mission-after-years-of-science/ |
| dust_hitchhikers | bonus | 4.2 ASTRA | Dust Hitchhikers | Fine dust sticks to spacesuits and can ride inside the base. The tiniest grains can reach deep into the lungs. | Perseverance dust studies | logbook.cat.surface | https://www.nasa.gov/missions/mars-2020-perseverance/nasas-perseverance-offers-clues-to-protect-crews-from-mars-dust/ |
| too_much_co2 | bonus | 4.3 ASTRA | Too Much CO₂ | Every breath out adds carbon dioxide to a closed room. Too much causes headaches and tiredness, so scrubbers remove it. | International Space Station | logbook.cat.iss | https://www.nasa.gov/missions/station/iss-research/science-in-space-august-4-2023-spacecraft-air-quality/ |
| thin_air | bonus | 4.8 ASTRA | Thin Air | Mars's air is about 100 times thinner than Earth's. Without a pressure suit, you couldn't breathe outside. | Curiosity | logbook.cat.surface | https://www.jpl.nasa.gov/news/nasa-rover-finds-clues-to-changes-in-mars-atmosphere/ |
| radiation_badge | bonus | 4.8 ASTRA | Radiation Badge | Astronauts wear radiation badges, called dosimeters, that add up the radiation they receive. It is a NASA rule for every crew member. | NASA crew health standards | logbook.cat.iss | https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-tb-050-spacesuits.pdf |
| last_storm | bonus | Dilemma 1, choice A follow-up | Opportunity's Last Storm | In June 2018, a Mars-wide dust storm blocked the sunlight Opportunity needed for power. The rover fell silent and was never heard from again. | Opportunity | logbook.cat.rover | https://www.nasa.gov/news-release/nasas-record-setting-opportunity-rover-mission-on-mars-comes-to-end/ |
| no_showers | bonus | Dilemma 2, choice C follow-up | No Showers in Space | Space station crews can't shower, because water is limited and floats around. They wash with towels and rinseless shampoo. | International Space Station | logbook.cat.iss | https://www.nasa.gov/image-article/astronaut-koichi-wakata-demonstrates-washing-his-hair-space/ |
| plants_soak | bonus | Dilemma 3, choice A follow-up | Plants Soak It Up | Lettuce grown in water with perchlorate stores some of it in its leaves. That's why soil and water are tested before growing food. | Plant science (Environ. Sci. Technol. 2007) | logbook.cat.plants | https://doi.org/10.1021/es062337s |
| soil_wash | bonus | Dilemma 3, choice B follow-up | Washing Soil | Perchlorate dissolves easily in water, but rinsing soil can leave some behind. Scientists are still testing ways to make Mars soil safe for farms. | Soil science (Soil Systems 2021) | logbook.cat.plants | https://doi.org/10.3390/soilsystems5030037 |
| fast_particles | bonus | Dilemma 5 alert; Event 1 alert | Fast Particles | In May 2024, particles from a solar storm reached Mars in just tens of minutes. That leaves little time to take shelter. | MAVEN, Curiosity | logbook.cat.sun | https://www.nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/ |
| cliff_shelter | bonus | Dilemma 5, choice B follow-up | Cliff Shelter | Cliffs and lava tubes could give astronauts extra shielding in a solar storm. Rock works like the soil over a base. | Curiosity RAD | logbook.cat.sun | https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/ |
| flare_forecast | bonus | Event 1 early warning | Space Weather Forecast | Flares start in active regions, magnetic hot spots on the Sun. Forecasters give the chance of a flare, not its exact time. | NOAA Space Weather Prediction Center | logbook.cat.sun | https://swpc-drupal.woc.noaa.gov/phenomena/solar-flares-radio-blackouts |
| thirty_xrays | bonus | Event 1, choice A follow-up | 30 Chest X-rays | On May 20, 2024, Curiosity measured a huge radiation spike. An astronaut there would have got a dose like 30 chest X-rays. | Curiosity RAD | logbook.cat.sun | https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/ |
| tea_leaves | bonus | Event 3, choice A follow-up | Tea Leaf Detective | In 2020, a Russian astronaut on the space station let tea leaves float in a sealed room. The leaves drifted toward a tiny air leak. | International Space Station (Roscosmos report) | logbook.cat.iss | https://www.universetoday.com/148443/the-crew-of-the-iss-has-found-the-source-of-the-stations-air-leak |
| space_flowers | bonus | Event 4, choice A follow-up | Space Flowers | In 2016, zinnias on the space station grew mold after too much water and too little airflow. Scott Kelly cleaned them and they bloomed. | Veggie (space station) | logbook.cat.plants | https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/ |
| weather_station | bonus | Expedition 1, ASTRA on return | Mars Weather Station | Perseverance's MEDA measures temperature, wind, air pressure, dampness and dust. It even measures the size and shape of dust grains. | Perseverance (MEDA) | logbook.cat.rover | https://www.jpl.nasa.gov/news/mars-is-getting-a-new-robotic-meteorologist/ |
| wind_ripples | bonus | Expedition 1 radio, 30% | Wind Ripples | Gentle Martian winds shape sand into ripples, and faster winds build dunes. Their shapes help scientists study Mars's winds. | NASA orbiters and rovers | logbook.cat.surface | https://science.nasa.gov/photojournal/ripples-or-dunes/ |
| hidden_ice | bonus | Expedition 3, ASTRA on return | Hidden Ice | Mars has lots of frozen water near the poles and under the ground in the mid-latitudes. NASA maps it to choose landing sites for astronauts. | Mars Odyssey, MRO (SWIM project) | logbook.cat.surface | https://www.jpl.nasa.gov/news/nasa-is-locating-ice-on-mars-with-this-new-map/ |
| ingenuity | core | Expedition 4, ASTRA at 20% | First Mars Helicopter | Ingenuity first flew on April 19, 2021, the first aircraft on another world. It made 72 flights before its mission ended in 2024. | Ingenuity | logbook.ingenuity | https://www.nasa.gov/news-release/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends/ |
| ancient_lake | bonus | Expedition 4, ASTRA at 35% | Ancient Lake | Billions of years ago, a river flowed into a lake in Jezero Crater and built a delta. Its old mud is a top place to look for signs of past life. | Perseverance | logbook.cat.surface | https://www.nasa.gov/solar-system/nasas-perseverance-rover-arrives-at-delta-for-new-science-campaign/ |
| strong_in_space | bonus | astra.fit.intro | Strong in Space | In space, the bones that carry your weight get about 1% less solid each month without exercise. So station crews exercise about two hours a day. | International Space Station | logbook.cat.iss | https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/ |
| mars_gravity_body | bonus | astra.fit.mars | Unknown at 38% | Nobody knows yet how much bone and muscle people would lose in Mars gravity. In a lab model, rats carrying 40% of their weight lost grip strength in two weeks. | Physiology research (Frontiers in Physiology 2019) | logbook.cat.earth | https://doi.org/10.3389/fphys.2019.00899 |

58 cards (20 core, 38 bonus). New cards are added here, with a FACT_CHECK.md row, whenever a new ASTRA science line
is written.

| Line ID | Trigger | Line |
|---|---|---|
| ui.logbook.title | Logbook header | SCIENCE LOGBOOK |
| ui.logbook.new_card | Chip on the ASTRA panel | New card! |
| ui.logbook.locked | Locked card | ??? |
| ui.logbook.how_we_know | Card button | How do we know? |
| ui.logbook.count | Logbook footer | {unlocked} of {total} cards |
| astra.logbook.first | First card unlocked (Sol 1) | That fact went into your Science Logbook! Every real fact you learn on Mars becomes a card. |

### 8.2 Mission Report

**When.** At the end of Sol 20 (after `ui.finale.card`), and at any time in Free-Play from the
pause menu. Solo and co-op use the same report; co-op shows one column per astronaut.

**What it shows**

| Panel | Contents |
|---|---|
| Crew | Per astronaut: HP now, lowest HP, Fitness now, Med-Rest count, hours spent outside |
| Base | Oxygen, Water, Food, Power, Heat and Morale at the end; number of Emergency Modes |
| Space weather | Solar flares faced; for each, how the crew sheltered and HP lost |
| Modules | Modules built, Tier 2 upgrades, drones awake (of 3) |
| Expeditions | Trips completed, story items found, Ice Cores melted |
| Choices | Each dilemma and random event: the choice made and ASTRA's one-line result |
| Science | Logbook cards unlocked (of 58), with the newest three shown |
| Badges | Badges earned this run (Section 8.3) |

**Mission Rating.** The master instructions require missions, achievements and scoring, so the
report ends with a Mission Rating: three categories, each **1 to 3 stars, never zero**. Wording is
always positive; a lower rating comes with a "Next time, try..." tip, never a failure message.
(The simulation's internal level score stays separate, for balancing only.)

| Category | Measures | ★ | ★★ | ★★★ |
|---|---|---|---|---|
| Crew Care | Average over the run of each astronaut's HP, Fitness and Morale (0–100) | always | 60 or more | 80 or more |
| Base Builder | 1 point per module built (6), Tier 2 upgrade (8) and the Regolith Roof Layer (1); max 15 | always | 8 or more | 13 or more |
| Science Explorer | 1 point per Logbook card + 2 per badge; max 88 | always | 40 or more | 60 or more |

The recommended solo path ends Sol 20 with 15 Base Builder points and about 40 cards plus 5–8
badges (50–56 Science points), so a careful first run earns about 7 of 9 stars; 3 Science stars
need extra events, choices and sandbox play. All thresholds are
gameplay values, tuned in playtests. In co-op the rating is shared; Crew Care averages everyone.

| Line ID | Trigger | Line |
|---|---|---|
| report.title | Report header | MISSION REPORT — ARES-1 |
| report.crew | Panel title | Crew health |
| report.base | Panel title | Base status |
| report.space_weather | Panel title | Space weather |
| report.modules | Panel title | Station built |
| report.expeditions | Panel title | Expeditions |
| report.choices | Panel title | Your choices |
| report.science | Panel title | Science learned |
| report.badges | Panel title | Badges |
| report.outside_hours | Crew row label | Hours outside |
| report.cards | Science line | You unlocked {unlocked} of {total} science cards. |
| report.rating.title | Rating header | MISSION RATING |
| report.rating.total | Under the stars | {stars} of 9 stars! |
| report.rating.crew | Category name | Crew Care |
| report.rating.base | Category name | Base Builder |
| report.rating.science | Category name | Science Explorer |
| report.rating.crew.3 | Crew Care, 3 stars | Great job! Your crew stayed healthy, fit and happy. |
| report.rating.crew.2 | Crew Care, 2 stars | Good care! Next time, try the Recover plan after hard days. |
| report.rating.crew.1 | Crew Care, 1 star | You kept everyone going! Next time, try more sleep and an exercise hour each Sol. |
| report.rating.base.3 | Base Builder, 3 stars | Great job! You finished the whole station and upgraded it. |
| report.rating.base.2 | Base Builder, 2 stars | Good building! Next time, try keeping all three drones busy. |
| report.rating.base.1 | Base Builder, 1 star | You got the base working! Next time, try waking the drones early to build faster. |
| report.rating.science.3 | Science Explorer, 3 stars | Great job! You're a real Mars scientist. |
| report.rating.science.2 | Science Explorer, 2 stars | Good exploring! Next time, try new choices to find more science cards. |
| report.rating.science.1 | Science Explorer, 1 star | You learned real Mars science! Next time, try visiting more places with the Rover. |
| report.no_flare_loss | Space weather line, no flare HP beyond the shelter dose | Nobody took more than the tiny shelter dose from a solar flare. Great planning! |
| astra.report.intro | Report opens | Here's how our mission went, Commander. Every choice taught us something. |
| astra.report.outro | Report closed | Real scientists write reports like this after every mission. Then they plan the next one even better. |

### 8.3 Badges

Badges reward real-world good practice. Each one is earned by an action in the game and links to
the Logbook card that explains the real science. They are shown in the Mission Report and in a
badge shelf in the Logbook. A badge is earned once per run.

| Badge | Name (`badge.<id>.name`) | Earned when (`badge.<id>.text` describes it) | Linked card |
|---|---|---|---|
| perchlorate_wash | Washed the Perchlorates | Dilemma 3: choose B, wash the soil first | soil_wash |
| flare_safe | No HP Lost in a Solar Flare | Every solar flare in the run costs each astronaut at most the shelter dose (1 HP or less) | fast_particles |
| forecaster | Space Weather Forecaster | Use an early warning to choose Event 1, C (planned shelter) | flare_forecast |
| storm_ready | Storm Ready | Dilemma 1: choose A or B, preparing before the dust storm | global_storms |
| closed_loop | Closed Loop | Keep the water recycler at 98% for 10 Sols in a row | water_98 |
| air_from_mars | Air From Mars | Build Life Support Tier 2 (MOXIE-X) | moxie |
| under_the_blanket | Under the Blanket | Build the Regolith Roof Layer | soil_blanket |
| panel_sweeper | Panel Sweeper | Win Solar Panel Static Wipe 5 times | sticky_dust |
| ice_miner | Ice Miner | Melt 5 Ice Cores | hidden_ice |
| strong_bones | Strong Bones | Keep Fitness at 70 or more for 10 Sols in a row | strong_in_space |
| well_rested | Well Rested | Sleep 8 hours or more every Sol from Sol 1 to Sol 6 | sleep_missions |
| first_contact | Message in Minutes | Complete the first Earth contact (Antenna Alignment) | slow_messages |
| space_gardener | Space Gardener | Harvest 50 Food from the Greenhouse | green_air |
| look_dont_touch | Look, Don't Touch | Pass Ingenuity on Expedition 4 | ingenuity |
| biosignature_hunter | Biosignature Hunter | Bring the Canyon Samples home (Expedition 5) | leopard_spots |

| Line ID | Line |
|---|---|
| badge.perchlorate_wash.name | Washed the Perchlorates |
| badge.perchlorate_wash.text | You rinsed a lot of the salty perchlorates out of Mars soil before growing food. |
| badge.flare_safe.name | No HP Lost in a Solar Flare |
| badge.flare_safe.text | Your crew sheltered every time, so no flare cost more than the tiny shelter dose. |
| badge.forecaster.name | Space Weather Forecaster |
| badge.forecaster.text | You used a flare forecast to shelter at just the right time. |
| badge.storm_ready.name | Storm Ready |
| badge.storm_ready.text | You got ready before the dust storm arrived. |
| badge.closed_loop.name | Closed Loop |
| badge.closed_loop.text | Your recycler saved 98% of the water for 10 Sols in a row. |
| badge.air_from_mars.name | Air From Mars |
| badge.air_from_mars.text | You made oxygen from Mars air, like NASA's MOXIE. |
| badge.under_the_blanket.name | Under the Blanket |
| badge.under_the_blanket.text | You covered every room with thick soil to block radiation. |
| badge.panel_sweeper.name | Panel Sweeper |
| badge.panel_sweeper.text | You cleaned the solar panels 5 times. |
| badge.ice_miner.name | Ice Miner |
| badge.ice_miner.text | You melted 5 Ice Cores into fresh water. |
| badge.strong_bones.name | Strong Bones |
| badge.strong_bones.text | You kept your crew fit for 10 Sols in a row. |
| badge.well_rested.name | Well Rested |
| badge.well_rested.text | You slept a full 8 hours every Sol of your first week. |
| badge.first_contact.name | Message in Minutes |
| badge.first_contact.text | You sent your first message across millions of kilometers to Earth. |
| badge.space_gardener.name | Space Gardener |
| badge.space_gardener.text | You grew 50 Food in the Greenhouse. |
| badge.look_dont_touch.name | Look, Don't Touch |
| badge.look_dont_touch.text | You visited Ingenuity and left it just as you found it. |
| badge.biosignature_hunter.name | Biosignature Hunter |
| badge.biosignature_hunter.text | You brought home samples that might hold clues to ancient life. |
| ui.badge.earned | Badge earned! |
| astra.badge.first | Your first badge! Badges show the real things astronauts do to stay safe and do good science. |
