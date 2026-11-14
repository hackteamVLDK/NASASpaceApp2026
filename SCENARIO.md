# SCENARIO — ARES-KIDS: The Jezero Signal

Status: Binding game scenario and design specification (v2, 2026-11-14). Source of truth: exported from the Claude Docs "ARES-KIDS: Master Game Design & Story Bible". Edit there or here, but keep both in sync. Audience: Claude Code, Codex and every human contributor. Check your work against this file (see master instructions, section 8).

## How to use this file

- Precedence. For story, gameplay rules, balance numbers and player-facing text, this file wins. For process (Git, agents, assets, sync), the master project instructions win.
- Localization keys. Every player-facing line has an ID (astra.*, radio.*, crawl.*, ui.*). Code must reference IDs, never hard-code English strings.
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

- Daily schedules for astronauts (work / eat / sleep / exercise blocks).
- Exercise as a health mechanic (suggested: an HP or Morale source in the Recreation room).
- Mission scoring and achievements.
- Save/load format and autosave cadence.
- Which real NASA datasets feed the game (suggested first candidates: Curiosity RAD surface radiation, InSight/Perseverance weather data).

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
- (fiction) marks invented story facts. All other science claims are real.

### ASTRA 6.7 guide panel

- **Position & layout:** slide-in panel anchored to the **left side of the screen** (`left: 24px`, `bottom: 24px` or vertically centered left dock, `width: ~360px`).
- **Visual design:**
  - Animated holographic/digital avatar portrait of **ASTRA 6.7** (cyan/amber waveforms or a friendly geometric AI core that animates while "speaking").
  - Header badge: `ASTRA 6.7 // STATION AI`.
  - Typewriter text box with a `Next` / `Got it` button (or auto-advance during cutscenes).
- **Behavior:** appears smoothly from the left edge whenever a new module is built, a survival event triggers, or a scientific fact is unlocked, then slides back out when dismissed so it never blocks the base view. The first appearance (at touchdown) plays an energetic chime.
- **Tone:** adventurous, educational sci-fi realism: accessible science without overwhelming complexity. Genre references: *Fallout Shelter*, *Oxygen Not Included*, *Among Us*.

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
| astra.intro.why_underground | Camera pans into base | Our base is built underground, under a thick blanket of Martian soil. Mars has very thin air and no magnetic shield around the whole planet, so space radiation reaches the ground. The soil above us blocks most of it. |
| astra.intro.status | Tutorial hand-off, camera shows both wings | Good news: the Bedroom, Kitchen and Life Support work. Bad news: everything on the right is just steel frames, and our solar panels are buried in dust. |
| astra.tut.hp_intro | HP bar highlights | This green bar is your HP, your health and energy. Radiation and hard work lower it. Sleep and fresh food bring it back. |
| astra.tut.drone01_click | Drone #01 clicked | That's Drone #01, fast asleep. Its battery is empty, and our solar panels are buried in dust. Let's clean them first! |
| astra.tut.solar_prompt | Solar Wipe opens | First job: clean the solar panels. Tap the sparkly clumps to zap the static, then wipe! |
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
| astra.act1.first_sleep | Sol 1 night ends | Good morning! Sleeping in the Bedroom gave you back 10 HP. Rest is a real part of every space mission. |
| astra.act1.battery_built | Battery & Heating built (Sol 3) | Heating core online! Out on the surface tonight it will drop to about minus 80 degrees Celsius. Our trick: every machine makes a bit of leftover heat, so now we catch it and send it to your rooms. NASA's Perseverance rover stays warm the same way, using spare heat from its power generator. |
| astra.act1.workshop_start | Workshop build starts | Next up: the Workshop. If something breaks on Mars, we can't call a repair shop. We make the parts ourselves. |
| astra.act1.storm_alert | Sol 3, end of day | See Dilemma 1 (Section 6). |
| astra.act1.storm_begin | Sol 4, storm starts | Here it comes! The sky is turning dark orange. Dust storms on Mars can grow big enough to cover the whole planet. |
| astra.act1.storm_mid | Sol 5 | Our panels are only getting a trickle of sunlight. Every bit of saved power helps. |
| astra.act1.workshop_built | Workshop built (Sol 5) | Workshop ready! Mars is too far away to order spare parts, so we'll make our own. In 2014, astronauts on the International Space Station 3D-printed a wrench from a design emailed up from Earth. First job: a Repair Kit for Drone #02! |
| astra.act1.repair_kit_ready | Repair Kit crafted | Repair Kit done! Drag it onto Drone #02 to fix its dusty joints. |
| astra.act1.storm_end | Sol 6, storm ends | The storm is over! Time to clean up. Mars dust is super fine and sticks to everything, like a balloon to your hair. |
| astra.act1.drone02_wake | Drone #02 wakes (Sol 6) | Drone #02 is back online! Two builders means we can build two modules at the same time. Teamwork! |
| astra.act1.end | Act I complete | We survived our first week on Mars! Next, let's grow food and get the Rover rolling. Pathfinder-X's last message is still out there somewhere. |

### Act II: Reach Out (Sols 7–13)

| Line ID | Trigger | Line |
|---|---|---|
| astra.act2.title | Act card | ACT II: REACH OUT |
| astra.act2.greenhouse_start | Greenhouse build starts (Sol 7) | Drone #01 is building the Greenhouse. Fresh food will keep your energy up, and plants make oxygen too! |
| astra.act2.garage_start | Garage build starts (Sol 7) | Drone #02 is on the Garage & Airlock. Soon we can send the Rover out to explore! |
| astra.act2.greenhouse_built | Greenhouse built (Sol 9) | Greenhouse growing! Why no dirt? Martian soil contains perchlorates, salty chemicals that are bad for people. NASA's Phoenix lander found them in 2008. So our plants grow with their roots in nutrient water, under red and blue LED lights, the colors plants use most. |
| astra.act2.garage_built | Garage & Rover built (Sol 9) | The Rover is ready to roll! Drive carefully: Mars rocks are sharp. NASA's Curiosity rover got holes and cracks in its metal wheels from them. Clean wheels, careful driving! |
| astra.act2.first_harvest | First Greenhouse harvest (Sol 10) | First harvest: fresh lettuce! In 2015, astronauts on the space station ate lettuce they grew in space. Fresh food now gives you extra HP every Sol. |
| astra.act2.map_intro | Holographic map first opened | This is the holographic crater map. Tap a glowing spot to send the Rover. It drives off-screen, and I'll keep you posted by radio. |
| astra.act2.surface_warning | First expedition launch | Heads up! Outside, there's no soil above you, so radiation reaches you. Your HP will drop while you're out there. Don't worry, rest and fresh food bring it back. |
| astra.act2.exp1_arrive | Expedition 1 arrives | See Section 5, Expedition 1. |
| astra.act2.reboot_kit | Reboot Kit crafted (Sol 12) | Reboot Kit ready! We built it with the power core from that old weather probe. On Mars, nothing goes to waste. |
| astra.act2.pathfinder_found | Expedition 2 arrives (Sol 12) | Commander, look! That's Pathfinder-X! It's been waiting here since 2038. Grab its black box, it recorded everything before the storm. And its big antenna could fix our Comms Lab! (fiction) |
| astra.act2.blackbox_home | Expedition 2 returns | The black box is safe in the Garage, but it's locked with an old code. We need a working Comms Lab to read it. |
| astra.act2.drone03_wake | Drone #03 wakes (Sol 13) | Drone #03 reporting for duty! All three builders are awake. Now we can really get moving. |
| astra.act2.end | Act II complete | Three drones, a garden, a Rover and a mystery box. Not bad! Next, let's get the Lab online and find out what Pathfinder-X heard. |

### Act III: The Signal (Sols 14–20)

| Line ID | Trigger | Line |
|---|---|---|
| astra.act3.title | Act card | ACT III: THE SIGNAL |
| astra.act3.lab_start | Lab build starts (Sol 13) | Pathfinder-X's antenna fits perfectly! Drone #01 is building the Research & Comms Lab. |
| astra.act3.radiation_lesson | Sol 14, Roof Layer recipe unlocks | To explore farther, we need better shielding. On Mars's surface, you get about as much radiation in one day as people on Earth get from nature in three months. Packing soil around our rooms and the Rover blocks most of it. |
| astra.act3.lab_built | Lab built (Sol 15) | Comms Lab online! Radio messages travel at the speed of light, the fastest thing there is. But Mars is so far away that a message takes between about 3 and 22 minutes to reach Earth. So no live video calls: we send video letters and wait. |
| astra.act3.rec_built | Recreation & Storage built (Sol 15) | Recreation room open! In NASA's CHAPEA test, four volunteers lived for 378 days inside a 3D-printed pretend Mars home in Texas. Games, music and spare supplies helped them stay strong. Now we have them too! |
| astra.act3.blackbox_decode_start | Sol 16 morning | Decoding the black box... Old code, new tricks. Got it! Playing Pathfinder-X's last log. |
| log.pathfinder.01 | Black box playback | PATHFINDER-X LOG. SOL 1,247. (fiction) |
| log.pathfinder.02 | Black box playback | Seismic pulse detected. Interval: 37 minutes. Repeating. |
| log.pathfinder.03 | Black box playback | Methane spike: 40 parts per billion. Source: canyon floor, 18 kilometers west. |
| log.pathfinder.04 | Black box playback | Warning: dust storm approaching. Switching to sleep mo— |
| astra.act3.blackbox_react1 | After playback | A thump every 37 minutes, like a clock. NASA's InSight lander felt more than 1,300 marsquakes, but quakes don't usually keep a schedule. Something down there is repeating. |
| astra.act3.blackbox_react2 | After playback | And methane! On Earth, most methane comes from living things, like microbes. But it can also come from water reacting with certain rocks. NASA's Curiosity rover has sniffed methane on Mars too, and scientists are still working out where it comes from. |
| astra.act3.earth_reply | First Earth contact succeeds | Message from Earth, sent 14 minutes ago: "Ares-Kids, this is Mission Control. We heard Pathfinder-X's log. Go find that signal, and stay safe!" (fiction) |
| astra.act3.roof_built | Regolith Roof Layer built (Sol 16) | Regolith Roof Layer finished! Every room is now under thick soil, so almost all the radiation stays outside. Scientists think a few meters of soil could protect real Mars bases. |
| astra.act3.ls_t2 | Life Support Tier 2 (Sol 16) | Life Support upgraded! Mars air is mostly carbon dioxide, and our new unit pulls oxygen out of it. NASA's MOXIE did this on Mars and made 122 grams of oxygen, about what a small dog breathes in 10 hours! And we melt ice to top up our water loop. |
| astra.act3.deep_scan | Lab Tier 2 Deep Scan (Sol 19) | Deep Scan complete! The pulse comes from a pocket under the canyon floor. My readings say: salty liquid water. Salt keeps water from freezing, even in the Martian cold. (the canyon pocket is fiction) |
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
| astra.finale.leopard | 75% | In 2024, NASA's Perseverance rover found a rock with spots just like these, here in Jezero Crater. It's called Cheyava Falls. In 2025, scientists said its spots are one of the best possible clues of ancient life on Mars found so far. A clue, not proof, but a really good one! |
| astra.finale.methane | 85% | So where does the methane come from? Salty water reacting with rocks can make methane with no life at all. Or, long ago, tiny microbes might have made it. Only more evidence can tell us which. |
| radio.exp5.06 | 95% | RADIO: Samples sealed in tubes, just like Perseverance does. Heading home! |
| astra.finale.home | Rover returns | Mission accomplished, Commander! You rebuilt a whole base, woke three drones, and found a salty spring next to what may be the oldest clues of life on Mars. |
| astra.finale.earth | +1 minute | Message from Earth, sent 14 minutes ago: "Ares-Kids, the whole world is cheering for you. Bring those samples home!" |
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
| astra.hp.25 | HP below 25 | HP is low! Let's get you somewhere safe. Rest and fresh food will help you recover. |
| astra.hp.zero_base | HP hits 0 in the base | You're worn out. Into Med-Rest Mode for 1 Sol. The drones and I will keep things running. See you tomorrow! |
| astra.hp.zero_expedition | HP hits 0 on an expedition | Your HP hit zero, so I'm sending a rescue drone. It will bring you and some of the loot home safely. |
| astra.hp.medrest_end | Med-Rest ends | Good morning! You're rested and back at 50 HP. Eat something fresh to get stronger. |
| astra.hp.full | HP reaches 100 (max once per Sol) | HP back to 100! You're ready for anything. |
| astra.rad.partial_room | Astronaut enters a room without the Roof Layer | This room's roof isn't finished yet, so a little radiation gets in. Don't hang around here too long! |
| astra.rad.suit_liner | Suit Radiation Liner crafted | New suit liner! Materials full of hydrogen, like water and some plastics, are great at blocking space radiation. |
| astra.rad.rover_shield | Rover Radiation Shielding crafted | We packed Martian soil bricks around the Rover cabin. Mars soil makes a great shield, and there's plenty of it! |

### System lines: resources & emergencies

| Line ID | Trigger | Line |
|---|---|---|
| astra.res.oxygen_low | Oxygen below 25 | Oxygen is getting low. Let's check the air scrubbers! |
| astra.res.oxygen_zero | Oxygen hits 0 | Oxygen emergency! Everyone into the Bedroom, it has backup air tanks. Fix the scrubber valves to get us breathing easy again. |
| astra.res.heat_zero | Heat hits 0 | Heat emergency! The pipes are freezing. Reroute the heat pump now, and grab a blanket! |
| astra.res.power_zero | Power hits 0 | Power emergency! I've switched off everything except life support. Let's get the panels clean. |
| astra.res.water_low | Water below 25 | Water is running low. Our recycler saves 98%, but we still lose a little every day. Time for an Ice Run! |
| astra.res.food_low | Food below 25 | Food stores are low. Check the Greenhouse, and keep those plants happy! |
| astra.res.morale_low | Morale below 30 | The crew is feeling down. A visit to the Recreation room or a message from Earth would help. |
| astra.res.storage_save | Storage auto-refill fires | Good thing we packed spares! I opened the emergency stores. |
| astra.coop.role_missing | Co-op task with no matching role | Nobody on our crew is trained for this. You can still do it, it'll just take a bit longer. |

### Module Tier 2 upgrade lines

| Line ID | Upgrade | Line |
|---|---|---|
| astra.t2.solar | Clean-Sweep Panels | New panels with brushes and a tilt motor! Gusts of wind sometimes cleaned the solar panels of NASA's Spirit and Opportunity rovers, but we'd rather not wait for luck. |
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
| Recreation & Storage | Lab build started | 10 SP | −4 Power, +4 Morale, emergency refill once per 5 Sols | −4 Power, +6 Morale, refill once per 3 Sols |
| Regolith Roof Layer (base upgrade) | Lab build started | 10 SP + 1 Titanium Plate | Right-wing rooms become fully shielded | — |

Extra power rules: each drone actively building uses −5 Power per Sol. During a dust storm, Solar ×0.3 (Tier 2: ×0.5) and Battery & Heating uses ×4 power, because the heaters work overtime.

Tier 2 recipes are in Section 5.4.

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
\Delta HP_{exp} = 20 \cdot D \cdot R \cdot (1 - RR) \cdot S_{rover} \cdot S_{suit} \cdot F
```

- D = duration in Sols. R = route factor: crater floor 1.0, crater rim or delta 1.25, canyon 1.5.
- RR = role Radiation Resistance (Commander 0.15, Engineer 0.10, Pilot 0.25, others 0).
- S_rover = 0.6 with Regolith Radiation Shielding, else 1. S_suit = 0.75 with Suit Radiation Liner, else 1.
- F = 3 for the part of the trip during a solar flare, else 1. Role debuffs multiply the result: Engineer ×1.2, Botanist ×1.25, Comms ×1.3.

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

**UI & interaction:** Surface view through a drone camera: 3 panels under a butterscotch sky, covered in red dust. Some clumps throw tiny blue sparks.
1. Tap each sparking clump to zap its static. It stops sparking.
1. Swipe the wiper across the panels.
1. A clump that wasn't zapped smears back; tap it, then wipe again.

**Win / fail:** Win at 90% clean within 20 s (a sun meter fills). On fail, output equals the % cleaned until retried.

**Role modifiers:** Engineer: one zap clears 2 neighboring clumps. Pilot: clumps are outlined (knows surface dust). Botanist, Comms: standard.

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

**UI & interaction:** Two gauges side by side, CO2 (gray) and O2 (blue), each needle needing to sit in a green band. Three round valve knobs below.
1. Turn knob A (drag in a circle) to lower CO2.
1. Turn knob B to raise O2.
1. Knob C nudges both: use it to fine-tune.
1. Hold both needles in green for 2 s.

**Win / fail:** Both green for 2 s within 15 s. On fail, Oxygen output −30% until retried; the CO2 gauge glows to show what went wrong.

**Role modifiers:** Engineer: green bands 50% wider, +5 s. Botanist (Wobbly with Wrenches): needles drift slightly after release, −3 s. Pilot, Comms: standard.

**ASTRA:** "Every breath you breathe out has carbon dioxide in it, and too much makes people sleepy and sick. Our scrubbers grab it, and our machine pulls oxygen out of Mars's carbon dioxide air, just like NASA's MOXIE did on Mars."

### 4.4 Closed-Loop Water Sort

**Trigger & real cause:** Every ~6 Sols, and in Dilemma 2. A cracked filter drops recycling from 98% to 70%, so each astronaut loses 15 water per Sol instead of 1.

**UI & interaction:** A droplet character at the top of a pipe, 3 empty machine slots below, and a tray with 3 machines: Filter (mesh), Boiler (flame), Purifier (purple UV bulb).
1. Drag the machines into the slots in order: Filter → Boiler → Purifier.
1. Tap the tap handle. The droplet flows through and turns from murky brown to clear blue.
1. A wrong order bounces the droplet back and the wrong slot wiggles. Swap and try again.

**Win / fail:** Correct order within 15 s. On fail, recycling stays at 70% until retried.

**Role modifiers:** Botanist: the first slot glows with the right machine, +3 s. Others: standard.

**ASTRA:** "On the space station, sweat, breath and even pee get cleaned back into drinking water, and 98% of it comes back. That last 2% is why we still need ice from the Rover."

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

**Trigger & real cause:** The Hydroponic Nutrient Drift event (Section 6), and Dilemma 4. Without soil, the water must carry every nutrient, and its mix drifts over time. Food output −40%, fresh-crop HP bonus off.

**UI & interaction:** 3 plant trays (lettuce, potatoes, tomatoes), each with a droopy plant, a drip line and a small color tag. 3 nutrient bottles at the top (green, yellow, purple). An LED switch on the wall.
1. Drag the bottle that matches each tray's tag onto its drip line.
1. Tap the LED switch. Plants perk up under pink-purple light.

**Win / fail:** All 3 matched and lights on within 15 s. A wrong match turns a plant yellow; it recovers on retry. On fail, Food stays at −40%.

**Role modifiers:** Botanist: tags glow, and one tray is auto-matched. Engineer (Not a Gardener): tags are hidden; tap "Ask Botanist" to show them for 3 s (if a Botanist is in the game), otherwise get 2 tries per tray. Pilot, Comms: standard.

**ASTRA:** "Plants mostly use red and blue light, so our LEDs shine those colors and the Greenhouse glows purple. Without soil, the water must carry every nutrient the plants need, so we check it often."

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
1. On a win, a message icon flies toward Earth with a counter: "Arriving in 14 minutes..."

**Win / fail:** 4+ bars held for 3 s within 20 s. On fail, the window is missed: no Earth message and no Morale bonus until the next window.

**Role modifiers:** Comms: green zone 2× wider, Earth drifts slower, +5 Morale on success. Engineer: skips the bent-dish step. Pilot, Botanist: standard.

**ASTRA:** "Radio waves travel at the speed of light, but a message still takes about 3 to 22 minutes to cross between Mars and Earth. Point the dish just right, or the message misses Earth completely!"

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
| 3 | Crater Rim Ice, 12 km northwest | 14 | 1 Sol | Crater rim (1.25) | Deep Ice Drill | Medium | 21 | 20 SP, Ice Core ×3, Water Filter Membrane, Titanium Plate ×2, Circuit Board |
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
| 60 | Radio decision: The black box is under a heavy solar panel. (A) Lift it with the Rover's robot arm: safe, takes longer (+0.25 Sol). (B) Dig it out by hand: fast, but more time outside (−5 HP). |
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

ASTRA on return: "Mars has lots of frozen water, mostly underground and near the poles. Our scan found a small buried patch hiding in this cold shadow. Every Ice Core is 25 units of fresh water!"

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

ASTRA at 35%: "Billions of years ago, a river flowed into a lake right here in Jezero Crater. This delta is the mud and sand it left behind, and mud is a great place to look for signs of ancient life."

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

ASTRA 6.7 // WEATHER ALERT: A giant dust storm is rolling across Jezero Crater! For 3 Sols, dust will block about 70% of the sunlight on our solar panels, and the heaters will have to work extra hard. If we do nothing, our batteries could run dry. How should we get ready?

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
| B. Wash the soil first (−20 Water, 1 drone for 1 Sol) | Water dips (tight until Expedition 3) | Sol 13: Soil Beds unlock. Greenhouse +3 Food per Sol and fresh crops +1 HP, for good. +5 Research | "Perchlorates dissolve in water, so we rinsed them away. Scientists are studying ideas like this for real Mars farms!" |
| C. Stick with hydroponics | No cost | No bonus. Choice B stays available from the Lab menu | "Safe choice! When you're not sure something is safe, testing first is what real scientists do." |

### Dilemma 4: Cold Plants or Call Home? (Sol 16)

ASTRA 6.7 // POWER ALERT: A very cold night is coming, and the Greenhouse heater needs extra power. But tonight is also our first chance to send Pathfinder-X's log to Earth, and the Lab needs full power too. We can only do one!

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Keep the plants warm | Greenhouse safe. Earth window missed. Morale −5 | Next Earth window on Sol 19 | "Our plants are safe and cozy. Earth will still be there in 3 Sols. Mars and Earth keep moving, so we wait for the next good window." |
| B. Call Earth | Antenna Alignment mini-game. On success: Morale +10, Research +10, astra.act3.earth_reply plays | Greenhouse gets cold: Food output −50% and no fresh-crop HP for 2 Sols; Nutrient Match triggers | "Hearing from home made everyone smile! The plants got chilly, though. Most vegetables stop growing when it gets close to freezing." |
| C. Move the trays into the warm Kitchen (1 drone for half a Sol) | Food output −20% for 1 Sol. Lab has enough power for a text-only message: Morale +5 | No further cost | "Clever! We used heat that was already there. When two things need the same power, sometimes there's a third way." |

### Dilemma 5: Space Weather Warning (Sol 18, radio decision on Expedition 4)

ASTRA 6.7 // SPACE WEATHER ALERT: The Sun just shot out a burst of super-fast particles, a solar storm! It will reach Mars in about 2 hours. The base is safe under the soil, but the Rover crew is out at the Delta Cliffs. What should they do?

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Race home now | Crew HP −6 (driving through the start of the storm). Trip ends with half loot: Rare Battery Cell ×2, Lab Sensor Kit, Mineral Sample ×1, 10 SP | Short 1 Rare Battery Cell. Expedition 4 becomes repeatable (1 Sol) to collect the rest | "Safety first! We left some treasure behind, but we can always go back. Astronauts never take chances with radiation." |
| B. Shelter under the cliff overhang for 1 Sol | Almost no flare HP loss: −2 (thick rock overhead counts like deep shielding). Morale −3 (a boring day) | Full loot. Rover home on Sol 19, a Sol later; Tier 2 installs that Sol still finish in time for Sol 20 | "Thick rock blocks radiation, just like the soil over our base. Mars has very thin air and no magnetic shield around the whole planet, so we hide behind rock and dirt." |
| C. Keep working behind the Rover's shielding | Crew HP −14 (flare ×3 for half a Sol, reduced by shield, liner and RR). Full loot, on time | Shielding worn out: re-craft for 15 SP before the next trip. Morale −3 | "Our shielding helped a lot, but no shield blocks everything. We got the treasure, and now the crew needs a good rest." |

### Random Martian events (repeatable)

| Event | First possible | Chance per Sol | Cooldown | Early warning |
|---|---|---|---|---|
| Solar Flare Radiation Spike | Sol 8 | 10% | 6 Sols | 1 Sol with Lab T2 or Comms Officer (2 with both) |
| Electrostatic Dust Devil | Sol 5 | 15% (daytime) | 4 Sols | None |
| Airlock Micro-Leak | Sol 10 | 10% | 5 Sols | None |
| Hydroponic Nutrient Drift | Sol 10 | 15% | 4 Sols | None |

At most 1 random event per Sol, never on a story-dilemma Sol, and never while the solo Commander is away (Base Autopilot).

#### Event 1: Solar Flare Radiation Spike

ASTRA 6.7 // SPACE WEATHER ALERT: Solar flare detected! A burst of fast particles from the Sun will hit Mars in about 2 hours. Our underground rooms are safe, but anyone outside or in an unfinished room will get a big dose. What's the plan?

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Everyone to the Storm Shelter (Bedroom for half a Sol) | Almost no HP loss (−1 in the shelter). Workshop and Greenhouse tasks pause: −3 SP, −5 Food | None | "Safe and sound! In May 2024, a solar storm hit Mars so hard that NASA said an astronaut next to the Curiosity rover would have got a dose like 30 chest X-rays at once." |
| B. Keep working | Anyone in an unfinished right-wing room: HP −9 (half a Sol at −18). Anyone in a finished room: HP −2. Anyone on the surface: flare ×3 formula | None. HP recovers with sleep | "We kept working, but some of us took a hit. Next time, let's hide first and work later. HP comes back, but it's better not to lose it." |
| C. Planned shelter (only with an early warning) | Crew shelters at the right moment; drones keep working. Only the tiny shelter dose (−1 HP) | None | "That's what early warnings are for! Robots don't mind radiation as much as people, so the drones kept building while we stayed safe." |

#### Event 2: Electrostatic Dust Devil

ASTRA 6.7 // WEATHER ALERT: A dust devil, a spinning tornado of dust, is heading straight for our solar panels! It could blow the dust off, or dump a fresh load on them. What should we do?

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Let it pass | Coin flip: 50% panels blown clean (Power +20% for 3 Sols); 50% panels dusted (Power −30% until Static Wipe) | Effect lasts as stated | Clean: "Lucky! Dust devils sometimes cleaned the panels of NASA's Spirit and Opportunity rovers for free." Dusty: "Not so lucky this time. Time to wipe!" |
| B. Tilt the panels flat to stow | Power −50% for the rest of the Sol. No risk | None | "Playing it safe. Stowed panels make less power, but they don't get buried." |
| C. Watch from outside, then wipe | Commander (or 1 astronaut) HP −5. Panels guaranteed clean; Power +10% for 3 Sols | None | "Hands-on cleaning works every time! A little time outside means a little radiation, so keep it short." |

#### Event 3: Airlock Micro-Leak

ASTRA 6.7 // MAINTENANCE ALERT: I hear a tiny hiss. There's a small air leak somewhere in the airlock! We're losing a bit of oxygen and water vapor every Sol. Let's find it!

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Hunt the leak now | Seal Check variant: find the puff on the airlock wall and clamp it. Leak fixed | None | "Found it! In 2020, astronauts on the space station found a tiny leak by watching a floating tea leaf drift toward the hole!" |
| B. Quick tape patch | Leak stops now. −1 SP | Leak returns after 3 Sols at half strength (Oxygen −2, Water −1 per Sol) | "Tape is a great quick fix, but it doesn't last forever. We'll need a proper repair soon." |
| C. Seal the airlock | No expeditions for 1 Sol. A drone fixes the leak (1 Sol of drone time) | Airlock reopens next Sol | "Closing the door stops the leak while the drone works. Sometimes waiting is the safest move." |

If ignored (the alert is dismissed with no choice), the leak costs Oxygen −4 and Water −1 per Sol until fixed.

#### Event 4: Hydroponic Nutrient Drift

ASTRA 6.7 // GREENHOUSE ALERT: The plants look droopy! The nutrient mix in their water has drifted out of balance. Food output is down, and no fresh crops means less HP recovery.

| Choice | Immediate | Delayed | ASTRA follow-up |
|---|---|---|---|
| A. Fix it now | LED & Nutrient Match mini-game. On win, Greenhouse back to normal | None | "Happy plants! In 2016, astronaut Scott Kelly rescued sick zinnia flowers on the space station by changing how he watered them, and they bloomed!" |
| B. Flush and refill the tank | Water −10. Auto-fixed at the start of next Sol | Food −40% until then | "Fresh water, fresh start. It cost some water, but the plants will bounce back by tomorrow." |
| C. Wait and see | Food output −40%, no fresh-crop HP | After 2 Sols: plants wilt, Food −10, and the mini-game opens automatically | "Waiting made it worse. Plants without soil depend on us for every nutrient, so it's best to fix problems early." |

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
        "formula": "baseRatePerSol * durationSols * routeFactor * (1 - RR) * S_rover * S_suit * F * roleSurfaceMultiplier",
        "commanderEstimate": 17
      },
      "prepMiniGames": ["wheel_pebble_vacuum", "suit_seal_check"],
      "airlockCost": { "water": 2 },
      "radioLog": [
        { "atPercent": 0, "line": { "id": "radio.exp2.00", "en": "Rover rolling north. Titanium wheels ready for the boulder field." } },
        { "atPercent": 25, "line": { "id": "radio.exp2.25", "en": "Boulders everywhere! Weaving between them slowly." } },
        { "atPercent": 50, "line": { "id": "radio.exp2.50", "en": "I see a mast sticking out of the dust... It's Pathfinder-X!" }, "astra": { "id": "astra.act2.pathfinder_found", "en": "Commander, look! That's Pathfinder-X! It's been waiting here since 2038. Grab its black box, it recorded everything before the storm. And its big antenna could fix our Comms Lab!" } },
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
        "astraAlert": { "id": "astra.d5.alert", "en": "The Sun just shot out a burst of super-fast particles, a solar storm! It will reach Mars in about 2 hours. The base is safe under the soil, but the Rover crew is out at the Delta Cliffs. What should they do?" }
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
          "label": "Shelter under the cliff",
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
          "label": "Keep working behind the shielding",
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
