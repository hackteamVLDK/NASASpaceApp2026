# SCENARIO — binding game scenario and design specification

**Every agent must read this file before starting any task that touches gameplay, story,
UI, cutscenes, tutorial, art or audio, and must check its result against it before
finishing.** If a change conflicts with this file, stop and report the conflict instead of
diverging. Only the team changes this file; agents do not edit it on their own initiative.

**Covers:** Intro & AI guide ("ASTRA 6.7"). New scenario parts are added below as new numbered sections.

## 1. Context & Target Audience
- **Project:** 2D Mars Survival Tycoon / Base Builder (inspired by *Fallout Shelter*, *Oxygen Not Included*, and *Among Us*).
- **Target Audience:** Children aged 7–12 (NASA Space Apps Challenge).
- **In-Game Language:** English (clear, engaging, age-appropriate sci-fi vocabulary).
- **Tone:** Adventurous, educational sci-fi realism (accessible science without overwhelming complexity).
- **Narrator / Guide:** **ASTRA 6.7** — onboard station AI.

---

## 2. UI Component: ASTRA 6.7 Guide Window
- **Position & Layout:** Slide-in panel anchored to the **left side of the screen** (`left: 24px`, `bottom: 24px` or vertically centered left dock, `width: ~360px`).
- **Visual Design:**
  - Animated holographic/digital avatar portrait of **ASTRA 6.7** (cyan/amber waveforms or friendly geometric AI core that animates while "speaking").
  - Header badge: `ASTRA 6.7 // STATION AI`.
  - Typewriter text box with a `Next` / `Got it` button (or auto-advance during cutscenes).
- **Behavior:** Appears smoothly from the left edge whenever a new module is built, a survival event triggers, or a scientific fact is unlocked, then slides back out when dismissed so it never blocks the base view.

---

## 3. Sequence Part A: *Among Us*-Style Text Intro (`0.0s – 10.0s`)
- **Visual Style (Reference: *Among Us* Role Reveal / Intro Screen):**
  - Pitch-black background (`#05070A`) with subtle drifting starfield particles and a faint horizontal scanline/vignette effect.
  - Centered, bold sci-fi sans-serif typography with a crisp **typewriter reveal effect**.
  - **Audio:** Classic *Among Us*-style high-pitched electronic blip/chirp synchronized with each revealed character, followed by a low bass boom on the final line.
- **Text Sequence (Sequential Lines):**
  1. `YEAR 2042. MISSION: ARES-KIDS.` *(pause 0.8s)*
  2. `A squad of builder drones was sent ahead to construct our underground Mars base...` *(pause 1.0s)*
  3. `Until a massive dust storm hit Jezero Crater.` *(pause 1.0s)*
  4. `The drones went to sleep. The station is only half-built.` *(pause 1.2s)*
  5. *(Highlighted in Martian Orange `#FF6B35`)* **`IT'S UP TO YOU TO WAKE THEM UP AND SURVIVE.`**
- **Transition (`10.0s`):** Screen fades/wipes into the top sky of the 2D Mars world canvas (`CUTSCENE_LANDING`). Skippable via `Skip >>` in the top-right corner.

---

## 4. Sequence Part B: Landing Cutscene (`10.0s – 24.0s`)
- **Scene Layout:** Single vertical 2D world canvas (`1920 x 3200 px` logical units), side-view cutaway cross-section:
  - **Top Zone (`Y: 0` to `Y: 1100`):** Dusty orange Martian sky, distant Jezero Crater mountains, surface ground line at `Y: 1050` (Airlock dome, dust-covered solar panels, bent antenna, regolith mound, 2 buried dormant drones).
  - **Subterranean Zone (`Y: 1100` to `Y: 3200`):** Cutaway of Martian crust housing the 2D base:
    - *Left Wing (Operational, warm light):* Bedroom, Dining Room, basic Water & Air Life Support.
    - *Right Wing (Unfinished, dark steel frames in sand):* Workshop, Research & Comms Lab, Battery & Heating, Rover Garage + **Drone #01** with a blinking red LED.

### Timeline & Animation (Silent / Visual Storytelling + SFX, no AI popup yet)
- **Phase 1: Atmospheric Descent (`10.0s – 14.0s`)**
  - Camera locked on upper Martian sky (`Y: 400`).
  - Mars Lander descends on a red-and-white parachute (`Y: -150 -> Y: 650`). At `13.2s`, parachute detaches and drifts left.
  - **SFX:** Martian wind hum + parachute deploy.
- **Phase 2: Retro-Rocket Touchdown (`14.0s – 17.5s`)**
  - Camera tracks Lander down to surface (`Y: 850`).
  - `14.0s`: 4 bottom thrusters ignite (animated flame sprites), slowing descent.
  - `16.0s`: Touchdown at `Y: 1050` next to the Airlock Dome. Subtle camera shake (`±4px`, `0.3s`) + red dust particle burst.
  - **SFX:** Retro-rocket roar -> metallic landing thud -> airlock hiss.
- **Phase 3: Underground X-Ray Pan (`17.5s – 24.0s`)**
  - Camera pans smoothly downward (`Y: 850 -> Y: 2100`, ease-in-out) slicing through the red Martian soil layers into the underground base cutaway.
  - `20.0s`: Astronaut exits the Airlock shaft into the left living quarters and removes helmet.
  - `22.0s`: Camera locks on the base overview; **Drone #01** blinks red (`1Hz`) in the unfinished right wing.

---

## 5. Interactive Tutorial Hand-Off (`24.0s+`)
- **Game State Change:** Switch from `CUTSCENE_LANDING` to `TUTORIAL_STEP_1`.
- **UI Trigger:** The **ASTRA 6.7** window slides in from the left (`left: 24px`) with an energetic chime.
- **Visual Cues:** Dim all modules except **Drone #01**; spawn a pulsing yellow wrench icon above **Drone #01**.
- **ASTRA 6.7 Dialogue (Left Panel):**
  > "Touchdown confirmed! Welcome to Ares-1, Commander.
  >
  > Look above us—that thick layer of Martian soil shields our base from deadly space radiation! Because Mars has no magnetic field like Earth, living underground keeps us safe.
  >
  > Right now, only Water, Air, and Sleeping Quarters are online. Let's wake up **Drone #01** so we can finish building the station! **Click on the sleeping drone.**"
- **Action Trigger:** Clicking **Drone #01** closes/minimizes ASTRA's prompt and launches the `DroneRepairMiniGame` modal (wipe Martian dust off solar panel + reconnect 2 colored wires).

---

## 6. AI Implementation Rules
1. **Modular UI:** Build `AstraGuidePanel` as a standalone reusable React/Canvas UI component (`props: { isOpen, message, mood, onClose }`) so any game system (module completion, dust storms, rover expeditions) can trigger ASTRA 6.7 on the left side of the screen.
2. **State Machine:** Implement clean states: `INTRO_TEXT` -> `DESCENT` -> `TOUCHDOWN` -> `UNDERGROUND_PAN` -> `TUTORIAL_HANDOFF`.
3. **Fallback Graphics:** If custom sprites are not yet loaded, render clean geometric placeholders with clear labels (`LANDER`, `AIRLOCK`, `DRONE_01`, `LIFE_SUPPORT`) at the exact coordinates so gameplay flow can be tested immediately.
