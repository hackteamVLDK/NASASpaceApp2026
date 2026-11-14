# Entry scene for the astronaut and a 3-floor base: proposals

| Field | Value |
|---|---|
| Record | 20261114-200625-entry-scene-for-the-astronaut-and-a-3-floor-base |
| Kind | proposal |
| Mode | read-only (sandbox: read-only) |
| Started | 2026-11-14T19:06:25.688Z |
| Duration | 146 s |
| Exit status | 0 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6-astra |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1db74-2b58-7f00-9474-0a2890a894e2 |
| Tokens used | 67 |
| Working-tree changes during run | `src/ui/pipes.js` |
| Raw transcript | [raw/20261114-200625-entry-scene-for-the-astronaut-and-a-3-floor-base.log](raw/20261114-200625-entry-scene-for-the-astronaut-and-a-3-floor-base.log) |

## Task sent to Codex

Focus files: `src/flow/intro.js`, `src/render/campaign-world.js`, `src/render/movers.js`, `src/render/world.js`, `src/campaign/data.js`, `tests/flow.test.mjs`, `SCENARIO.md`

# Task: design proposals for two changes (READ-ONLY, do not edit files)

Project: a browser game (plain ES modules, Canvas 2D). A Mars base builder for children 7-12. Binding spec:
SCENARIO.md (Section 1: "Landing cutscene & tutorial", "Cutscene timeline"; Section 3.6 radiation). The
cutscene is a pure function of time in src/flow/intro.js (tests in tests/flow.test.mjs assert its numbers
against SCENARIO.md, so numbers that SCENARIO.md fixes must not change). The picture is drawn by
src/render/campaign-world.js; bodies move with src/render/movers.js. Answer in English, concrete, with
coordinates and function signatures. Keep the answer under about 220 lines.

## Change A: show how the astronaut enters the building (intro scene)

Today the cutscene shows the lander touching down at 25.0 s next to the airlock dome, the camera pans
underground from 26.5 s, and at 29.0 s an astronaut simply APPEARS in the Bedroom (`astronautAt()` in
src/flow/intro.js, drawn in `drawCampaign()` as `cut.astronaut`), helmet frame at 30.0 s, tutorial from
33.0 s. The player (and the team) want to SEE the person come in: leave the lander, walk to the dome, go
through the airlock, climb down the shaft, step into the left wing, take the helmet off.
SCENARIO fixes: touchdown 25.0 s; "airlock hiss" SFX at 25.8 s (a proposal time in `SFX_CUES`); camera pan
26.5 s - 33.0 s; "29.0 s: the astronaut exits the crew airlock shaft into the left wing and removes the
helmet" (the helmet comes off at 30.0 s in `CUTSCENE.proposals.helmetOffAt`); the camera settles on the
gameplay framing at 31.0 s. The cutscene must stay a pure function of time, and the player must be able to
skip (`skipTarget`) at any moment without a glitch.
Available sprites: crew.eva (4x5 grid: 0-1 idle, 2-7 walk, 8-11 work with a drill, 12-13 digging, 14-15
carrying a box, 16-17 climbing a ladder), crew.indoor (4x6 grid: 0-1 idle, 2-7 walk, 8-11 working at a
console, 12-13 eating, 14-15 sleeping, 16-17 exercising, 18-21 climbing a ladder, 22 lifting the helmet off,
23 holding it), the `airlock` sprite has 2 frames (closed, open door), the lander sprite 2 frames.
World geometry (units): ground line y=1050; shaft x=960 (shaft is x 900-1020, from the surface down); lander
x=1650; airlock dome x=960 (860 wide); the astronaut is about 92 units tall after a planned resize (it was
185); walking speed about 480 units/s, climbing about 320 units/s.
Please propose: (1) a timeline in seconds for every phase (leaves the lander, walks, door opens with the
hiss at 25.8 s, enters, the climb inside the shaft while the camera pans, steps out at 29.0 s, walks to the
bed area, helmet off at 30.0 s, idle) that respects the fixed times above; (2) the function shape, for
example `astronautPathAt(sec, geometry)` returning `{ visible, x, y, sheet, frame, flip }`, with `geometry`
passed in so src/flow/ stays free of drawing code; (3) how the airlock door frame and the lander door should
be shown; (4) what happens when the player skips from any time (must end in the same state as the
tutorial start: Commander standing in the Bedroom); (5) unit tests for it under `node --test`.

## Change B: a shallower base, 3 floors instead of 6

The base is now 6 floors deep: a left wing with Bedroom, Kitchen, Life Support (floors 1-3, one room per
floor) and a right wing with six buildable rooms stacked on floors 1-6 (Workshop, Lab, Battery & Heating,
Garage & Airlock, Greenhouse, Recreation & Storage). Each room is 600 x 270 units; the shaft (120 wide) runs
between the wings. The players say it is too deep and want 3 floors in total. SCENARIO.md line 16 allows it:
"The 'left wing' and 'right wing' are logical groups, not a fixed layout. Rooms may sit on several floors as
long as the camera stays on one cutaway screen." Plan: keep the left wing as it is (3 floors) and make the
right wing two rooms wide, three floors tall, rooms still 600 x 270 so the existing room art is reused.
Layout data is `LAYOUT` in src/campaign/data.js (`rooms: { id: { wing, floor } }`, `wingWidth`, `floors`).
Please propose: (1) which room goes where, with reasons from the story order (Battery Sol 1, Workshop Sol 3,
Greenhouse and Garage Sol 7, Lab and Recreation Sol 13, Roof layer after the Lab) and from gameplay (the
Rover must roll out of the right edge of the screen from the Garage; the Roof Layer is a soil band over the
right wing; radiation factors in SCENARIO 3.6 are per wing, not per floor); (2) the new `LAYOUT` shape and
the exact numbers (x of the second right column, total base width, camera framing: the base must fit on a
1920 x 1080 screen with a top bar of 98 px, the side panels (left tracker x 14-470, ASTRA panel bottom-left,
right panel x 1450-1900) and still show a surface strip of at least 120 px under the top bar; give zoom,
centre x and centre y); (3) the list of code places that must change (anything that assumes one column in
the right wing, `floors: 6`, hit boxes, the shaft drawing, the roof band, anchors for the Commander and
drones, the Rover parking and exit, hazard markers, the radiation overlay), and what could silently break;
(4) tests to add.

## Output format
Two sections (A, B). Each: the proposal, the numbers, the risks, the tests.

## Codex response

## Summary

Both changes are feasible while retaining touchdown at 25.0 seconds, shaft exit at 29.0, camera settling at 31.0, and tutorial start at 33.0. Use a time-sampled entry path and a column-aware room layout shared by drawing, movement anchors, and hit testing. The current 21 flow/movement tests pass, but several scenario inconsistencies and hard-coded coordinates need attention.

## Findings

1. **A — Visible astronaut entry**

   **Severity:** major  
   **Location:** `src/flow/intro.js:171`, `src/render/campaign-world.js:233`  
   **Problem:** The astronaut becomes visible directly at the Bedroom anchor; the renderer ignores any entry path. The airlock also opens whenever the astronaut is visible, leaving it open throughout the underground scene.  
   **Suggested fix:** Sample astronaut position, animation, and door state directly from cutscene time.

   **Proposal and numbers**

   Use feet coordinates throughout. Keep the ground line at **1050**, with the existing sprite feet offset giving **1058**. Bedroom feet are **1494** (`1240 + 270 − 16`).

   | Time | Action | Feet coordinates / animation |
   |---|---|---|
   | 25.00–25.10 | Touchdown; astronaut still inside | Hidden; landed lander |
   | 25.10–25.30 | Step out of the lander hatch | `(1626,1058) → (1530,1058)`; EVA walk, facing left |
   | 25.30–25.80 | Walk toward dome entrance | `(1530,1058) → (1390,1058)`; EVA walk |
   | 25.80 | Dome door opens; existing hiss fires | Outer door frame 1 |
   | 25.80–26.70 | Enter dome and cross vestibule | `(1390,1058) → (960,1058)`; EVA walk |
   | 26.70–27.35 | Outer door closes; brief airlock cycle | `(960,1058)`; EVA idle |
   | 27.35–28.7125 | Descend shaft | `(960,1058) → (960,1494)`; EVA ladder frames 16–17 |
   | 28.7125–29.00 | Step into left wing | `(960,1494) → (870,1494)`; EVA walk |
   | 29.00–29.5625 | Walk to Bedroom standing position | `(870,1494) → (600,1494)`; EVA walk |
   | 29.5625–30.00 | Lift helmet | `(600,1494)`; indoor frame 22 |
   | 30.00–30.50 | Hold removed helmet | Same position; indoor frame 23 |
   | 30.50 onward | Stand idle | Same position; indoor frame 0 |

   Maximum walking speed is **480 units/s**; descent is exactly **320 units/s**. The dome entrance at **1390** is its geometric right edge (`960 + 860/2`); confirm the actual painted doorway before finalizing this anchor.

   Keep the camera pan beginning at **26.5**, settling at **31**, with the flow remaining `UNDERGROUND_PAN` until **33**.

   Suggested interfaces:

   ```js
   astronautPathAt(sec, geometry)
   // => { visible, x, y, sheet, frame, flip, helmetOn, phase }

   entryDoorsAt(sec)
   // => { airlockFrame, landerFrame }

   openingFrameAt(sec, geometry)
   // existing fields + astronaut pose, doors, cameraX
   ```

   Pass plain geometry from the application layer:

   ```js
   {
     landerHatch: { x: 1626, y: 1058 },
     landerExit:  { x: 1530, y: 1058 },
     domeDoor:   { x: 1390, y: 1058 },
     shaftTop:   { x: 960,  y: 1058 },
     shaftExit:  { x: 960,  y: 1494 },
     bedroomEntry: { x: 870, y: 1494 },
     bedroomStand: { x: 600, y: 1494 }
   }
   ```

   Use atlas names `crewEva` and `crewIndoor`. Walking frames are `2 + floor(phaseElapsed * fps) % 6`; ladder frames are `16 + floor(phaseElapsed * fps) % 2`. Store proposed timings, animation rates, and **92-unit** body height in tagged data, rather than introducing magic numbers into flow logic.

   **Doors and rendering**

   - Airlock frame 1 only during **[25.8, 26.7)**; frame 0 otherwise during the intro.
   - The lander’s two frames represent **folded legs** and **landed legs with hatch ajar**, according to `assets/prompts/lander.craft.md:22`. They are not independent door states. Use frame 0 before touchdown and frame 1 afterward; do not close the hatch by reverting to the flight frame.
   - Draw the astronaut after room/shaft backgrounds, with a foreground doorway mask where necessary. Keep the shaft visible during descent.
   - Use cutscene time for frame selection; do not advance an ordinary mutable mover during the intro.
   - Keep EVA appearance through descent and Bedroom arrival; `onSurface()` alone would remove the suit prematurely underground.

   **Skip and handoff**

   Preserve `skipTarget`: crawl skips to **19**, cutscene skips to **33**, tutorial times remain unchanged. A single skip from the crawl therefore does **not** immediately reach the tutorial; that is the existing contract.

   Natural completion and cutscene skipping should call the same handoff routine:

   - Sample the terminal pose at **33**.
   - Place the Commander mover at `(600,1494)`, clear its path, reset facing, and target the same Bedroom anchor.
   - Close the airlock, stop intro audio, clear obsolete intro dialogue, and enter `TUT_HP` once.
   - Keep `prevFlowT` aligned with the skipped time so skipped sound cues are not replayed.
   - Place dormant drones in their tutorial positions independently of prior rendered frames.

   **Risks / specification conflicts**

   - `SCENARIO.md:171` says helmet removal occurs at **29.0**, whereas the requested existing proposal completes it at **30.0**. The sequence above follows the requested 30.0 time; report this explicitly rather than claiming exact scenario compliance.
   - The hatch/door coordinates are proposed anchors, not verified sprite measurements.
   - Matching body height alone does not ensure consistent scale across EVA, climbing, and helmet frames; inspect shared bounds and feet alignment.

   **Tests**

   - Sample every boundary at `t−ε`, `t`, and `t+ε`; assert continuous position and expected phase.
   - Assert invisibility before emergence, left-wing position at 29, helmet off at 30, and terminal Bedroom position at 33.
   - Assert walking/climbing speed limits, valid sprite frame ranges, and descent only at shaft center.
   - Sample timestamps out of order; results must match and geometry must remain unchanged.
   - Assert door interval and exactly one hiss when crossing 25.8.
   - Compare natural handoff with skipping from every intro phase; verify identical mover, tutorial, and door state.
   - Retain existing scenario timing assertions.

2. **B — Three floors, two right-hand columns**

   **Severity:** major  
   **Location:** `src/campaign/data.js:61`, `src/render/campaign-world.js:20`, `src/render/movers.js:86`, `src/main.js:237`  
   **Problem:** Room rectangles assume one column per wing; camera/input transforms assume center x=960; Rover and drone parking coordinates assume the old Garage location. Changing only `floors` and room assignments would overlap rooms and silently misalign interactions.  
   **Suggested fix:** Introduce explicit columns and shared geometry helpers, then update all consumers together.

   **Proposal and numbers**

   | Floor | Left wing, x=300 | Right column 0, x=1020 | Right column 1, x=1620 |
   |---|---|---|---|
   | 1, y=1240 | Bedroom | Battery & Heating | Garage & Airlock |
   | 2, y=1510 | Kitchen | Workshop | Greenhouse |
   | 3, y=1780 | Water & Air Life Support | Research & Comms Lab | Recreation & Storage |

   Battery stays near the shaft for the Sol 1 tutorial. Workshop occupies the next inner room for Sol 3; Greenhouse and Garage use the outer column for Sol 7. Lab and Recreation share the bottom floor for Sol 13. Garage occupies the upper outer corner for the shortest external vehicle access.

   ```js
   {
     groundY: 1050,
     firstFloorY: 1240,
     floorHeight: 270,
     floors: 3,
     leftX: 300,
     shaftX: 900,
     shaftWidth: 120,
     rightX: 1020,
     roomWidth: 600,
     columns: { left: 1, right: 2 },
     rooms: {
       bedroom:    { wing: 'left',  floor: 1, column: 0 },
       kitchen:    { wing: 'left',  floor: 2, column: 0 },
       lifesupport:{ wing: 'left',  floor: 3, column: 0 },
       battery:    { wing: 'right', floor: 1, column: 0 },
       garage:     { wing: 'right', floor: 1, column: 1 },
       workshop:   { wing: 'right', floor: 2, column: 0 },
       greenhouse: { wing: 'right', floor: 2, column: 1 },
       lab:        { wing: 'right', floor: 3, column: 0 },
       recreation: { wing: 'right', floor: 3, column: 1 }
     }
   }
   ```

   Remove the ambiguous `wingWidth` field after updating consumers. Room width remains **600**; right-wing width becomes **1200**.

   Base bounds: **x=300…2220**, **y=1240…2050**. Total width including shaft: **1920 units**.

   Suggested pure helpers:

   ```js
   roomRect(layout, id)
   wingRect(layout, wing)
   baseBounds(layout)
   worldToScreen(point, view)
   screenToWorld(point, view)
   roverGeometry(layout, view, screen)
   ```

   **Camera**

   Use gameplay view **zoom=0.48, centerX=1260, centerY=1650**.

   With `screen = screenCenter + zoom * (world − cameraCenter)`:

   | Feature | Screen coordinates |
   |---|---|
   | Base horizontal extent | x=499.2…1420.8 |
   | Ground line | y=252 |
   | Surface strip below 98px top bar | **154px** |
   | First-floor top | y=343.2 |
   | Base bottom | y=732 |
   | Shaft center | x=816 |

   This leaves **29.2px** between the base and each stated side-panel boundary. Each room renders at **288×129.6px**; a 92-unit astronaut is approximately **44px** tall.

   Set `surfaceStripTopY` to **525**. Interpolate camera x from **960 to 1260** during **26.5–31.0**, using the same easing as y/zoom. ASTRA must stay inside the left-side reserved area; its actual full bounds still need visual verification.

   **Movement, roof, and Rover**

   - Add visible connecting doorways at **x=1620** on all three floors. The current routing can traverse horizontally through inner rooms, but their artwork must show a passage even while unbuilt.
   - Keep the crew shaft at **900…1020**, ending at **2050**.
   - Roof band: **`{x:1020, y:1204, w:1200, h:36}`**; spread roof-work anchors across both columns.
   - Derive drone rest positions from the Garage rectangle, not `LAYOUT.rightX`. Proposed x positions: **1725, 1817, 1909**, feet y=1494.
   - With the planned half-size Rover, use **width=150**, parking at **(2070,1494)** and boarding at **(1970,1494)**.
   - Show a vehicle access tunnel from the Garage’s right wall toward the screen edge; otherwise it drives through solid soil. Keep this separate from the crew dome/shaft.
   - At this camera, the right viewport edge is world **x=3260**. Choose **outX=3360**, placing the entire 150-unit Rover beyond it.
   - Remove the current early fade if “roll out of the screen” is literal; hide only after it clears the viewport. Return along the reversed route.
   - Extend soil/sky coverage to at least **x=3400**; current `SOIL.x1=3170` leaves an uncovered right strip.

   **Required code audit**

   | Location | Required change / silent failure |
   |---|---|
   | `src/campaign/data.js:61` | Add columns; retain IDs, wing identity, and story unlock rules. |
   | `src/render/campaign-world.js:20` | Make `roomRect` column-aware; room hit boxes, highlights, and radiation rectangles then follow it. |
   | `src/render/campaign-world.js:26` | Derive Commander, roof, shaft, and drone anchors from geometry. |
   | `src/render/campaign-world.js:42` | Move Garage rest positions; distinguish intro mounds from post-intro dormant drones. |
   | `src/render/campaign-world.js:61` | Replace fixed camera x with `S.cx`. |
   | `src/render/campaign-world.js:79` | Derive shaft bottom from three floors; verify final shaft tile cropping. |
   | `src/render/campaign-world.js:153` | Expand power-blackout overlay and roof band to both columns. |
   | `src/render/campaign-world.js:160` | Update Rover drawing, boarding, and hit-box dimensions. |
   | `src/render/campaign-world.js:242` | Use shared room/surface anchors for hazards; handle non-room targets safely. |
   | `src/render/campaign-world.js:250` | Preserve per-room radiation values; expand surface overlay coverage as needed. |
   | `src/render/movers.js:86` | Derive Rover geometry; verify routes through outer-column doorways. |
   | `src/render/world.js:13` | Expand shared soil bounds; separate shared geometry from the legacy renderer if practical. |
   | `src/flow/intro.js:129` | Replace gameplay framing; expose camera x. |
   | `src/main.js:228` | Update current view and inverse pointer transform together. |
   | `src/main.js:332` | Update boarding/return anchors and pass new camera/entry fields through rendering. |

   **Risks / specification conflicts**

   - The base now reaches **x=2220**, exceeding the declared **1920-wide logical world** in `SCENARIO.md:150`, although it fits the 1920px screen. Distinguish viewport dimensions from world bounds and obtain a documented scenario resolution.
   - `SCENARIO.md:16` mentions lower radiation on deeper floors; `:589` describes the Bedroom as deepest. Keeping the Bedroom on floor 1 preserves the requested layout but retains that inconsistency.
   - Preserve the explicit Section 3.6 factors: right **0.3** before roof, right/left **0.05** after shielding, Bedroom **0.02**. Do not invent a floor multiplier or zero radiation.
   - Dormant Drones #02/#03 currently remain at mounds (`campaign-world.js:44`); Section 1 requires them in the Garage after the pan.

   **Tests**

   - Assert nine distinct room rectangles, six right-wing rooms, three floors, no overlaps, and exact base bounds.
   - Check all room centers and corners through world/screen round trips, including CSS-scaled canvas input.
   - Assert base containment between panels, surface strip ≥120px, and shaft ending at 2050.
   - Exercise routes between every room pair, including outer-column destinations and unfinished inner rooms.
   - Verify roof/blackout coverage includes both columns; hazard/highlight rectangles match their targets.
   - Assert Garage drone/boarding/parking anchors lie inside the room; Rover fully clears the viewport before hiding.
   - Verify shielding values remain unchanged across floors and columns, before/after roof and during flares.
   - Replace layout-specific floor-5 examples in `tests/movers.test.mjs` with actual room floors; retain separate generic routing tests if useful.

## Verification

Read `AGENTS.md`, all three coordination status files, the relevant scenario sections, all seven focus files, and supporting main-loop, atlas, sprite-prompt, and movement-test code. Ran `node --test tests/flow.test.mjs tests/movers.test.mjs`: **21 passed, 0 failed**.

No files or Git state were changed. Camera bounds were calculated from the proposed transform; browser rendering, actual sprite doorway placement, ASTRA overlap, and visual handoff continuity were not checked.

## Recommendations

Resolve the three scenario wording conflicts first: helmet timing, logical world width, and Bedroom depth. Then implement shared geometry/transforms before changing either animation or layout, and visually check the entry boundaries, tutorial handoff, outer-column passages, and Rover departure.

## Warnings

- The working tree changed while Codex was running: src/ui/pipes.js. The sandbox was read-only, so these are most likely concurrent edits by the main agent or a person — Codex may have reviewed an older version of those files.

## Main-agent follow-up

_Pending. The main agent records here which findings were confirmed, what was fixed, what was rejected and why, and which tests were run._
