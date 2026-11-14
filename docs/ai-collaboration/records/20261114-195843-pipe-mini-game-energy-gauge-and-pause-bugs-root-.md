# Pipe mini-game, energy gauge and pause bugs: root causes and fixes

| Field | Value |
|---|---|
| Record | 20261114-195843-pipe-mini-game-energy-gauge-and-pause-bugs-root- |
| Kind | bug |
| Mode | read-only (sandbox: read-only) |
| Started | 2026-11-14T18:58:43.111Z |
| Duration | 281 s |
| Exit status | 0 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6-astra |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1db6d-204c-73d0-9811-7eda1b5c1bd2 |
| Tokens used | 73 |
| Working-tree changes during run | none |
| Raw transcript | [raw/20261114-195843-pipe-mini-game-energy-gauge-and-pause-bugs-root-.log](raw/20261114-195843-pipe-mini-game-energy-gauge-and-pause-bugs-root-.log) |

## Task sent to Codex

Focus files: `src/ui/minigames2.js`, `src/ui/campaign-ui.js`, `src/main.js`, `src/render/campaign-world.js`, `src/render/movers.js`, `src/campaign/hazards.js`, `src/campaign/data.js`, `src/campaign/story.js`, `styles/game.css`, `SCENARIO.md`

# Task: find the real defects behind three reported bugs, and propose concrete fixes (READ-ONLY, do not edit files)

Project: a browser game (plain ES modules, no build step, Canvas 2D + a DOM interface). A Mars base builder
for children aged 7-12. Binding spec: SCENARIO.md (sections 3.1, 3.3, 4.5 are the relevant ones). The
simulation (src/campaign) is pure and deterministic; src/render and src/ui only read state and send commands.
Answer in English. Be concrete: name the file and line, say what is wrong, and give the smallest code change
that fixes it. If you are not sure something is a bug, say so and say how to check it.

## Bug 1: "The pipe mini-game does not work correctly"

The mini-game is `heatPump()` in src/ui/minigames2.js (SCENARIO 4.5, "Heat Pump Pipe Reroute"), run through the
shared `scaffold()` in the same file and opened by `openMini()` in src/main.js. The overlay is `#mgWrap` /
`#mg` (index.html, styles/game.css: `#mgWrap { zoom: calc(var(--ui) * 0.85) }`, and the whole `#stage` is
scaled by a CSS transform in `fit()` in src/main.js).

What the player saw: a 4x3 grid of dark tiles with orange pipes, a CORE box on the left, rooms Bedroom /
Kitchen / Greenhouse on the right (Kitchen and Greenhouse green, Bedroom grey), the timer ring almost empty
(red), and under the board a generic hint "Follow the one-line instruction at the top. You have time!".
The player says it "does not work correctly" but did not say how.

Please check, one by one, and report what is really wrong:
1. Pointer mapping: `pt()` maps `e.clientX/Y` with `getBoundingClientRect()` of the canvas. Is that correct
   when the overlay sits inside an element with CSS `zoom` AND inside a parent with a CSS `transform: scale`?
   (Think about current Chromium, which standardised `zoom`.) Would a tap land on the wrong tile? Propose a
   mapping that is correct in every case (for example `offsetX/offsetY` based, or `getBoundingClientRect`
   compared with `canvas.clientWidth`).
2. The puzzle: `SOLVED`, `rot()`, `reach()`, `down()`. Is it always solvable? Can it start already solved
   (give the probability)? Are symmetric tiles (straight pipes, the cross) handled correctly? Does `reach()`
   follow pipes correctly when a pipe points to an empty tile? Is the highlight (orange / grey) consistent
   with what `reach()` computed?
3. Timer and retry in `scaffold()`: what happens at timeout (the penalty in `onMini` in src/campaign/story.js
   for `heat_pump`: Heat -10 on every failed attempt, then a free retry, then after 3 failures "a drone helps"
   and it counts as a win). Is that consistent with SCENARIO 4.5 and the rules for all mini-games in
   SCENARIO section 4 ("Failure: the system runs at reduced output until retried. Retry is instant and free")?
   Is the 23 s limit (20 s + 3 s solo bonus) too short for children for THIS puzzle?
4. Usability: SCENARIO says "One-line instruction plus an animated hand showing the first move", and
   "Layouts come from a set of 10 pre-made solvable puzzles". The current code has one layout with random
   rotations and no hint about tapping a tile. Propose a design for 10 solvable layouts (give the 10 grids
   as arrays of bitmasks N=1, E=2, S=4, W=8 in the "solved" orientation, each one with the core entering
   tile row 1 col 0 from the west and exits on the east edge of rows 0, 1, 2), how to scramble them so the
   puzzle is never already solved and needs at least 3 taps, and how to draw the animated hand.
Give a ranked list of the defects (most likely cause of "does not work correctly" first).

## Bug 2: "The energy indicator is broken"

The HUD gauges are built in `createUi()` in src/ui/campaign-ui.js (`gaugeDefs`, `update()`), styled in
styles/game.css (`.gauge`, `.gauge.low`). The Power meter has a variable capacity in the simulation
(src/campaign/data.js `CAP.power` 100, `MODULES.battery.powerCap` [250, 400]; src/campaign/engine.js
`powerCap()`), SCENARIO 3.1: "Power: cap 100 (250 with Battery T1, 400 with T2)".
What the player saw: the gauge shows the number 88 but the bar is only about one third full (88 / 250), and
it turns red ("low" class when the bar is under 25%, i.e. under 62 units) while the Threats strip only warns
"Low power" under 20 units (src/campaign/hazards.js). When the Battery is built the bar suddenly drops.
Please: say exactly why it looks broken, check every other gauge for the same kind of problem (Heat, Water,
Oxygen, Food, Morale, Spare Parts, HP), and propose the fix: what the bar and the number should show for a
meter with a variable capacity, which threshold should colour the bar (use the same limits as the warnings in
src/campaign/hazards.js and src/campaign/engine.js `checkMeters`), and a short tooltip text for children.

## Bug 3: "When time is stopped, the character does not stop"

In play mode the player can pause (`#speed [data-speed="0"]`, `speed` variable in src/main.js). The simulation
stops, but the Commander keeps walking and the sprites keep animating. Relevant code: `loop()` / `render()` in
src/main.js, `drawCampaign()` in src/render/campaign-world.js (movers from src/render/movers.js are advanced
with `S.dtMs` on every frame, and sprite frames are chosen from the wall-clock `nowMs`).
Please propose the fix: a separate "world animation clock" that only advances while the game runs (not paused,
no modal open, no mini-game, no pending decision card), used for character, drone and Rover animation and
for the movers, while interface pulses (selection outline, hazard icons, tutorial marker) keep using the wall
clock. Say which `nowMs` uses in drawCampaign should switch and which should not, and how to keep the
tutorial and the intro cutscene (where the simulation does not run but the world must still animate)
working.

## Output format
For each bug: Findings (ranked), Root cause, Proposed change (code), How to test it (a unit test that runs
under `node --test`, or a browser check). Keep the whole answer under about 250 lines.

## Codex response

## Summary

The pipe puzzle is **impossible to complete** because its traversal starts at the wrong tile; this directly explains the reported room colours. The Power bar calculates capacity correctly but hides its denominator and uses inconsistent warning thresholds. Pausing stops simulation time while movement, sprite animation, and Rover transitions continue on wall-clock time.

## Findings

1. **Severity: major — Bug 1, highest priority: incorrect inlet makes every puzzle unwinnable.**  
   **Location:** `src/ui/minigames2.js:86`.

   **Root cause:** The queue contains `[0, 1, Wd]`, interpreted as **row 0, column 1**, although the CORE enters **row 1, column 0**.

   The incorrectly seeded upper elbow must face west to receive imaginary heat. Its only useful orientation then faces south, feeding Kitchen and Greenhouse through the cross. It cannot also face east toward Bedroom. This precisely matches the screenshot description.

   **Smallest fix:**
   ```js
   const q = [[1, 0, Wd]];
   ```

   **Puzzle checks:**

   - Current implementation: **0 of 2,048 distinct orientations win**.
   - Corrected inlet: every scramble is solvable by rotating tiles back.
   - After correction, unrestricted random scrambling starts solved with probability **1/2,048 ≈ 0.0488%**: seven straight pipes each have two orientations, two elbows each have four; the cross and blanks are invariant.
   - `rot()` correctly cycles N → E → S → W. Straight pipes repeat after two turns; the cross never changes. Clicking the cross currently plays a click despite doing nothing—disable its interaction or mark it fixed.
   - `reach()` correctly rejects empty tiles and nonreciprocal connections at line 90. A pipe facing an empty tile does **not** transmit heat into it.
   - Orange highlighting correctly follows `seen`; room colours correctly follow `rooms`. Both therefore consistently display the **wrong source**, rather than having separate colouring bugs.
   - `down()` uses the same tile spacing as drawing, so its row/column arithmetic is correct.

   **How to test:** Extract the pure rotation/traversal functions for `node --test`. Assert that the supplied solved grid reaches all three rooms, a disconnected inlet reaches none, and an empty neighbouring tile is never visited. Exhaustively enumerate the current layout’s 2,048 distinct orientations.

   **Pointer mapping assessment — no confirmed defect:** `pt()` at line 15 already normalizes viewport coordinates against the displayed canvas rectangle. In current standards-conforming Chromium, that rectangle includes CSS zoom and ancestor transforms. Multiplying by zoom again would introduce an error. See the [CSS Viewport geometry rules](https://drafts.csswg.org/css-viewport/#zoom-property) and [CSSOM View](https://drafts.csswg.org/cssom-view/#dom-element-getboundingclientrect).

   Keep the current mapping for this borderless, padding-free canvas and positive scale/translation transforms:
   ```js
   const r = canvas.getBoundingClientRect();
   return {
     x: (e.clientX - r.left) * canvas.width / r.width,
     y: (e.clientY - r.top) * canvas.height / r.height,
   };
   ```
   An alternative inside a pointer handler targeting this canvas is:
   ```js
   return {
     x: e.offsetX * canvas.width / canvas.clientWidth,
     y: e.offsetY * canvas.height / canvas.clientHeight,
   };
   ```
   Neither should be advertised as universal for arbitrary borders, padding, rotated ancestors, or legacy browser behaviour. For this application’s zoom-plus-scale combinations, the existing rectangle mapping is appropriate.

   **Browser check:** At several window sizes, UI scales, and browser zoom levels, tap every tile centre and near each boundary. Confirm exactly the expected nonfixed tile rotates. I did not run this browser check.

2. **Severity: minor — Bug 1, second priority: missing interaction guidance and puzzle variety.**  
   **Location:** `src/ui/minigames2.js:75`, `src/ui/minigames2.js:107`, `src/main.js:148`; requirements at `SCENARIO.md:802` and `SCENARIO.md:879`.

   **Root cause:** There is one layout, no animated first-move hand, and no instruction explaining that tapping rotates a pipe. The generic reassurance is particularly unhelpful while the impossible puzzle’s timer expires. The specified sunset bar is also absent.

   **Proposed change:** Use “Tap pipes to turn them. Connect the core to all three rooms.” through the localization system. Add the sunset bar and an animated hand over a useful rotatable tile.

   These **10 validated solved grids** use N=1, E=2, S=4, W=8. Each admits heat from the west at `[1][0]` and feeds east-facing exits at `[0][3]`, `[1][3]`, `[2][3]`:
   ```js
   const PIPE_LAYOUTS = [
     [[6,10,10,10], [15,10,10,10], [3,10,10,10]],
     [[6,10,10,10], [11,14,10,10], [0,3,10,10]],
     [[6,10,10,10], [11,10,14,10], [0,0,3,10]],
     [[6,10,10,10], [11,10,10,14], [0,0,0,3]],
     [[0,6,10,10], [14,11,10,10], [3,10,10,10]],
     [[0,6,10,10], [10,15,10,10], [0,3,10,10]],
     [[0,6,10,10], [10,11,14,10], [0,0,3,10]],
     [[0,6,10,10], [10,11,10,14], [0,0,0,3]],
     [[0,0,6,10], [14,10,11,10], [3,10,10,10]],
     [[0,0,6,10], [10,14,11,10], [0,3,10,10]],
   ];
   ```

   **Scrambling algorithm:**

   - Select a layout; clone it before mutation.
   - Scramble using each tile’s **distinct** orientations, excluding blanks and crosses from selectable targets.
   - Prefer candidates requiring 3–6 clockwise taps to restore the stored solution.
   - Reject any candidate from which a win is reachable in **zero, one, or two taps**, using bounded breadth-first search over actual tile rotations.
   - Distance from the stored solution alone is insufficient: another winning arrangement might be nearer.
   - Use bounded generation attempts and a prevalidated fallback scramble per layout.
   - Store layouts, difficulty limits, and animation timings in data with `gameplay` provenance.

   For the hand, select the first tile on a verified solution sequence and draw a hand sprite centred over it with a repeating approach/press motion and expanding tap ring. Use mini-game elapsed time for the animation; stop the demonstration after the first valid rotation. A new hand asset must follow the prompt/manifest rules.

   **How to test:** For every layout, assert three reachable exits in its solved orientation. For every accepted scramble, assert no win within two taps and replay its known solution successfully. Browser-check that children can discover tapping without an adult explanation.

   **Timer judgement:** `20 + 3 = 23 seconds` is correct for the solo Commander. After fixing the inlet, unrestricted scrambling averages **6.5 minimum taps** for this layout, with a maximum of 13. Whether 23 seconds is sufficient for children needs playtesting; the current unwinnable puzzle cannot establish that. Keep the specified timer and first reduce confusion and scramble difficulty; changing its duration requires a scenario decision.

3. **Severity: major — Bug 1, third priority: repeated deductions and instant automatic success violate failure rules.**  
   **Location:** `src/ui/minigames2.js:55`, `src/main.js:144`, `src/campaign/story.js:328`; requirements at `SCENARIO.md:805` and `SCENARIO.md:879`.

   **Root cause:** Every timeout immediately sends failure and deducts 10 Heat, regardless of disconnected rooms. The third timeout deducts another 10, then grants a win after 900 ms, including the normal +12 Heat and reward. There is no offer, drone reservation, or one-Sol repair.

   Retrying itself has no entry fee, which is correct. However, repeatedly deducting a flat amount immediately is not the specified **10 extra Heat per unconnected room that night**. Section 4.5 provides the specific consequence; the general free-retry rule does not mean there can be no system consequence.

   **Proposed change:** This needs a small command/state extension, not just deleting `onFail()`:
   ```js
   // UI reports the timeout outcome:
   onFail({ unconnectedRooms: 3 - reach().rooms.size });

   // main.js forwards it:
   send({ type: 'miniResult', game, win: false, unconnectedRooms });
   ```
   Validate the integer range 0–3 in the campaign command handler. Record the unresolved room count on the task/incident, then apply the specified night loss once per incident/night; retries update that record rather than stack immediate deductions. Clear the unresolved condition when repaired.

   Replace third-failure `onWin()` with **Retry / Ask a drone**. Accepting assistance should issue a simulation command that reserves an available drone for one Sol and completes only when that job finishes. Do not leave an unclosable mini-game overlay stopping simulation while awaiting completion.

   The scenario does not precisely specify whether a successful retry before night cancels an already-recorded loss; my proposed interpretation is that repairing it before night prevents that loss. Confirm that interpretation with the scenario owner.

   **How to test:** Under `node --test`, verify 0/1/2/3 disconnected rooms, repeated failures without stacking, repair before night, and exactly one night application. Verify three failures merely offer assistance, and accepted assistance consumes one drone-Sol before completion.

4. **Severity: major — Bug 2: capacity is hidden and warning colours use the wrong criterion.**  
   **Location:** `src/ui/campaign-ui.js:28`, `src/ui/campaign-ui.js:324`, `src/ui/campaign-ui.js:325`, `styles/game.css:20`.

   **Root cause:** At 88 Power with capacity 250, **35.2% is the correct fill**. Showing only `88` makes that look like an incorrect percentage. Building the battery increases storage space without adding stored energy, so the proportional fill legitimately drops.

   The actual threshold defect is `f < 0.25`: Power becomes red below 62.5 at T1 and 100 at T2, although the hazard warning starts below **20 units**.

   | Gauge | Capacity / number | Warning condition |
   |---|---|---|
   | Power | `powerCap(s)`; show `88 / 250` | `<20`; emergency at zero or active emergency |
   | Heat | 100 | No positive low threshold in the checked hazard rules; emergency at zero or active emergency |
   | Water | 100 | `<25`; zero remains a shortage |
   | Oxygen | 100 | `<25`; emergency at zero or active emergency |
   | Food | 100 | `<25`; zero remains a shortage |
   | Morale | 100 | `<30`, currently incorrectly `<25` |
   | Spare Parts | 999; number only | No defined low threshold; existing bar is hidden |
   | HP | `s.hpMax`; show current/max | `<40`, currently incorrectly `<25% of role maximum`; show Med-Rest separately |

   **Proposed change:** Keep capacity-relative fill. Share capacity and threshold helpers between HUD, hazards, and simulation checks; reuse `powerCap(s)` rather than duplicating 100/250/400.

   ```js
   const cap = e.d.max();
   e.bar.style.width = `${Math.max(0, Math.min(1, v / cap)) * 100}%`;
   e.val.textContent = k === 'sp' ? Math.round(v) : `${Math.round(v)} / ${cap}`;

   const limit = LOW_LIMITS[k]; // power 20; water/oxygen/food 25; morale 30; hp 40
   const alarm = ['power', 'heat', 'oxygen'].includes(k)
     && (v <= 0 || s.emergency[k]);
   const warn = limit != null && v < limit && !(k === 'hp' && s.medRest);
   e.g.classList.toggle('low', warn || alarm);
   ```
   For exact agreement with Threats severity, use separate amber `.warn` and red `.alarm` classes. Do not copy the hazard strip’s `v > 0` exclusion into the HUD: an empty water/food meter should not appear healthy. Heat’s `<40` mini-game trigger in Section 4.5 is not currently a shared low-meter warning.

   Suggested child-friendly Power tooltip: **“88 power stored out of 250. A bigger battery holds more. Below 20 is low.”** Localize the text and allow enough HUD width for `400 / 400`.

   **How to test:** Check capacities 100/250/400 with unchanged stored Power; fill changes but the numerator does not. Test just below, at, and above every threshold, including HP maxima 90–120, zero resources, and active emergency recovery.

5. **Severity: minor — Bug 2: the Resources explanation also assumes Power capacity is 100.**  
   **Location:** `src/campaign/hazards.js:47`, used by `src/ui/extras.js:84`.

   **Root cause:** `meterReport()` calculates time until full using 100 for every non-SP resource. At 88/250 it predicts time to 100, reinforcing the HUD confusion.

   **Proposed change:** Pass the actual capacity into `meterReport()`, or use a shared capacity helper outside a circular engine/hazards dependency:
   ```js
   const cap = capacity; // powerCap(s), s.hpMax, or CAP[key], as appropriate
   ```
   Keep SP’s forecast treatment explicit.

   **How to test:** With Power 88, capacity 250, and net +10/Sol, expect **16.2 Sols until full**, not 1.2.

6. **Severity: major — Bug 3: world rendering has no pause-aware clock.**  
   **Location:** `src/main.js:107`, `src/main.js:351`, `src/main.js:362`, `src/main.js:414`; `src/render/campaign-world.js:181`, `src/render/campaign-world.js:212`.

   **Root cause:** Simulation stepping is gated, but render receives wall-clock delta every frame. Paused speed explicitly falls back to movement pace 1. Sprite frames and Rover timestamps also use wall time.

   **Proposed change:** Maintain one world clock, advancing independently of whether simulation ticks happen:
   ```js
   let worldMs = 0;

   // In loop(), after mode/decision/modal updates; dt already uses a clamped frame delta:
   const blocked = Boolean(mini || ui?.modalOpen || s?.pending);
   const worldRunning =
     mode === 'intro' ||
     (mode === 'tutorial' && !blocked) ||
     (mode === 'play' && speed > 0 && !blocked);
   const pace = mode === 'play' ? Math.min(4, speed) : 1;
   const worldDtMs = worldRunning ? dt * 1000 * pace : 0;
   worldMs += worldDtMs;

   if (mode === 'play' && worldDtMs > 0) stepRover(worldMs);
   render(now, worldMs, worldDtMs);
   ```
   Pass `worldMs`, `worldDtMs`, and `pace: 1` into `drawCampaign`; delta already includes pace. Remove the separate render-time delta calculation. Set `rover.boardAt` and `rover.t0` to `worldMs` in launch/return handlers, so their origin matches `stepRover()`.

   Use clocks as follows:

   | `drawCampaign` locations | Clock |
   |---|---|
   | Stars 74; storm particles 114 | World |
   | Rover sprite 163 | World |
   | Drone digging deadline/comparison 176–178 | World |
   | All drone sprite frames 185–191 | World |
   | Commander frames 217–224 | World |
   | Buried-drone discovery LED 195 | Wall; retain as an attention cue |
   | Hazard pulse 240 | Wall |
   | Tutorial marker 270–271 | Wall |
   | Selection outline 275 | Wall |
   | Cutscene thrusters 97 | `flowT * 1000`, matching the cutscene timeline |

   Advance movers only when `worldDtMs > 0`. **Calling `advance(m, 0)` is insufficient for an exact visual freeze:** `src/render/movers.js:60` resets `moving` and `climbing`, switching the sprite to idle. Either skip advancement at zero or early-return before those resets.

   Also gate drone awakening/placement and actor goal changes while frozen. If paused commands can change pose-driving state such as `s.where`, retain each actor’s last rendered pose/frame until world animation resumes.

   Intro continues through its existing `flowT`; tutorial world animation runs at 1× despite simulation being stopped. Tutorial mini-games still freeze the background. Interface pulses remain active throughout.

   **How to test:** Unit-test a pure clock helper across play, pause, modal, mini-game, pending decision, tutorial, and intro states. Verify paused updates preserve mover position **and flags**, digging time remaining, Rover phase/progress, and sprite frames. Browser-check pause during walking, climbing, digging, boarding, and return; wait several seconds and resume without a jump. Confirm tutorial and landing still animate.

## Verification

- Read repository rules, available Mykhailo/Vlad status files, relevant scenario sections, all focus files, and supporting engine, UI, and test code. `git_status_Pavlo` was absent.
- Exhaustively enumerated **2,048** distinct original-layout orientations: **zero wins before the inlet fix; one winning orientation afterward**.
- Executed the actual extracted `heatPump()` with stubbed drawing/audio: solved orientation fails before the one-line fix and succeeds afterward.
- Validated all ten proposed grids against reciprocal connectivity from the correct inlet.
- Confirmed experimentally that `advance(m, 0)` preserves position but resets movement flags.
- Ran:
  ```text
  node --test tests/movers.test.mjs tests/campaign.test.mjs tests/review-regressions.test.mjs tests/review-fixes.test.mjs
  ```
  **63 passed, 1 failed.** `tests/campaign.test.mjs:272` expects 64 SP after repeating a completed tutorial win, but receives 62. The current task guard rejects that replay; the test should offer a fresh valid task before expecting another reward.
- No files or Git state changed. Browser input, visual layout, and child usability were not tested. An initial extraction harness lacked a drawing helper; it was corrected in memory and rerun successfully.

## Recommendations

1. Apply the one-line inlet correction first, with a solved-board regression test.
2. Fix HUD capacity labels/thresholds and introduce the shared world animation clock.
3. Coordinate failure-state changes with the main agent: Mykhailo’s status explicitly claims `story.js`’s `onMini`.
4. Add curated scrambles and first-move guidance, then playtest the specified 23-second solo limit.

## Main-agent follow-up

_Pending. The main agent records here which findings were confirmed, what was fixed, what was rejected and why, and which tests were run._
