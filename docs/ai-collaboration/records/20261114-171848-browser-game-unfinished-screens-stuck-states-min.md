# Browser game: unfinished screens, stuck states, mini-games

| Field | Value |
|---|---|
| Record | 20261114-171848-browser-game-unfinished-screens-stuck-states-min |
| Kind | review |
| Mode | read-only (sandbox: read-only) |
| Started | 2026-11-14T16:18:48.608Z |
| Duration | 608 s |
| Exit status | 0 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6.1-sol |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1dada-b586-7260-ba95-d4ee2d326917 |
| Tokens used | 207,282 |
| Working-tree changes during run | `docs/ai-collaboration/LOG.md`, `src/campaign/expeditions.js`, `src/campaign/story.js`, `docs/ai-collaboration/records/20261114-171848-campaign-engine-rules-vs-scenario-and-logic-bugs.md` |
| Raw transcript | [raw/20261114-171848-browser-game-unfinished-screens-stuck-states-min.log](raw/20261114-171848-browser-game-unfinished-screens-stuck-states-min.log) |

## Task sent to Codex

Focus files: `SCENARIO.md`, `index.html`, `src/main.js`, `src/ui/campaign-ui.js`, `src/ui/minigames.js`, `src/ui/minigames2.js`, `src/ui/extras.js`, `src/ui/astra-panel.js`, `src/render/campaign-world.js`, `src/render/atlas.js`, `src/flow/intro.js`

Find what is unfinished or broken in the browser game's screens and input handling.

Files: `index.html`, `styles/`, `src/main.js`, `src/ui/*.js`, `src/render/*.js`, `src/flow/*.js`,
`src/audio/*.js`. The engine they drive is `src/campaign/`. `SCENARIO.md` is binding (Sections 1
tutorial and script, 4 mini-games, 8 logbook/report/badges). You cannot open a browser, so this
is a reading review: trace the code paths.

Report, each with file:line and a concrete way to reproduce:
1. Unfinished features: buttons, tabs, menus or states that exist in the UI but do nothing, show
   placeholder text, or call a command the engine does not have; engine features that have no UI
   at all (so the player can never use them); TODO / FIXME / "not yet" comments.
2. Places where the player can get stuck: a modal that cannot be closed, a tutorial step that
   waits for an event that never fires, a mini-game that cannot be won or cannot be quit, input
   ignored while something is animating, the game left paused.
3. The opening sequence (`src/flow/intro.js`, how `src/main.js` drives it): are all the states in
   SCENARIO.md Section 1 reachable in order? Does Skip work from every state? What happens on
   reload in the middle?
4. Mini-games (`src/ui/minigames.js`, `src/ui/minigames2.js`) against SCENARIO.md Section 4: for
   each of the nine, is the win condition, fail condition, retry rule and reward what the scenario
   says? Is any of them impossible or trivial?
5. Save and load: what happens with a save from an older version, a corrupted save, or a full
   localStorage? Is progress lost on reload at any point?
6. Errors a browser would throw: use of undefined variables or missing imports, DOM ids referenced
   in JS that do not exist in `index.html`, assets referenced that are not in the repository
   (check `src/render/atlas.js` against the files under `assets/`), event listeners added
   repeatedly, timers never cleared.
7. Children aged 7-12: text too long or too small, exact numbers a child cannot use, anything
   that needs a keyboard only or a mouse only, colour as the only signal, scary wording.
8. Open pull requests #7 (audio hooks in the UI) and #8 (intro cues carry the typed character)
   are not merged: does the code on `main` already call anything those PRs would add?

End with a short list: "the ten things to fix first", most damaging for a first-time player at
the top.

You may run `node --test "tests/flow.test.mjs" "tests/movers.test.mjs"` and `node -e` scripts
(read-only: do not write files).

## Codex response

## Summary

The normal, unskipped opening reaches all prescribed tutorial states, but several later interactions are broken or unfinished. Heat Pump cannot be solved, mini-games cannot be cancelled, saves can silently lose progress, and the finale omits its main science explanations. The 21 permitted tests pass; additional read-only probes confirmed defects those tests do not cover.

## Findings

1. **Heat Pump is impossible to win.** **Severity:** major. **Location:** [src/ui/minigames2.js:86](C:/Users/titov/Desktop/NASA/src/ui/minigames2.js:86).  
   **Reproduce:** Open Heat Pump and rotate the pipes. The search starts at row 0, column 1, although the drawn core enters row 1, column 0. Exhaustively checking all 2,048 distinct rotations produced zero wins and at most two connected rooms. Three timeouts eventually bypass the puzzle. **Fix:** Correct the entry coordinate and validate the scenario’s ten solvable layouts.

2. **Mini-games have no quit control, and drone assistance bypasses the specified rule.** **Severity:** major. **Location:** [index.html:37](C:/Users/titov/Desktop/NASA/index.html:37), [src/ui/minigames2.js:55](C:/Users/titov/Desktop/NASA/src/ui/minigames2.js:55), [src/ui/minigames.js:143](C:/Users/titov/Desktop/NASA/src/ui/minigames.js:143).  
   **Reproduce:** Open any mini-game and try to return to the base. There is no Close, Cancel, or Escape handler. Battery has no timeout, so a player unable to complete it must reload. Other games automatically award a win after three failures, without offering assistance or reserving a drone for one Sol. **Fix:** Add cancellation and an explicit, engine-backed assistance option.

3. **Reload loses recent progress; unavailable storage fails silently.** **Severity:** major. **Location:** [src/main.js:219](C:/Users/titov/Desktop/NASA/src/main.js:219), [src/main.js:406](C:/Users/titov/Desktop/NASA/src/main.js:406).  
   **Reproduce:** Finish a repair, craft, or decision, then reload before the next Sol boundary. Saves occur only when the tutorial finishes and when a Sol changes—up to four real minutes apart at 1×. Reload during the opening/tutorial restarts it, or offers the previous campaign save. A full or blocked `localStorage` silently prevents saving altogether. **Fix:** Save consequential actions and page exits, and display saving failures.

4. **Continue accepts invalid and incompatible save structures.** **Severity:** major. **Location:** [src/main.js:222](C:/Users/titov/Desktop/NASA/src/main.js:222), [src/main.js:445](C:/Users/titov/Desktop/NASA/src/main.js:445).  
   **Reproduce:** Continue a syntactically valid save containing `"drones": null`, or an incomplete nested `modules` object. Loading shallowly overwrites fresh state; the drone loop or subsequent rendering then throws. `version` is never checked. Invalid JSON is caught, but simply removes Continue without explaining what happened. **Fix:** Validate saves, migrate supported versions, preserve defaults recursively, and provide a recovery message.

5. **Missing-art fallback can freeze the opening.** **Severity:** major. **Location:** [src/render/atlas.js:96](C:/Users/titov/Desktop/NASA/src/render/atlas.js:96), [src/render/campaign-world.js:169](C:/Users/titov/Desktop/NASA/src/render/campaign-world.js:169).  
   **Reproduce:** Make `drone.builder.png` fail to load, then start the mission. `unionBox()` reaches `cellRect()`, which dereferences the missing sheet before the drawing fallback runs. A read-only mock reproduced `Cannot read properties of undefined (reading 'width')`. Rendering repeatedly fails and cannot supply tutorial hit boxes. **Fix:** Give bounding-box helpers safe placeholder dimensions too.

6. **The finale never delivers its two central science explanations.** **Severity:** major. **Location:** [src/campaign/expeditions.js:35](C:/Users/titov/Desktop/NASA/src/campaign/expeditions.js:35), [src/campaign/expeditions.js:162](C:/Users/titov/Desktop/NASA/src/campaign/expeditions.js:162).  
   **Reproduce:** Complete Expedition 5. ASTRA lines at 75% and 85% are configured, but ASTRA dispatch only happens inside the radio-marker loop; neither percentage is a radio marker. Consequently, the Cheyava Falls explanation, methane explanation, and associated `leopard_spots` card do not appear. **Fix:** Dispatch ASTRA thresholds independently from radio thresholds.

7. **Ice Run exists in the engine but cannot be selected.** **Severity:** major. **Location:** [src/ui/campaign-ui.js:277](C:/Users/titov/Desktop/NASA/src/ui/campaign-ui.js:277), [src/campaign/expeditions.js:205](C:/Users/titov/Desktop/NASA/src/campaign/expeditions.js:205).  
   **Reproduce:** Craft the Deep Ice Drill and open the repeatable Run marker. There is no Scrap/Ice selector or command setting `flags.runMode`. The trip therefore remains Scrap mode, despite water guidance recommending Ice Runs. **Fix:** Add a validated run-mode command and expose the choice on the map.

8. **Antenna failure does not miss the window and corrupts Dilemma 4’s outcome.** **Severity:** major. **Location:** [src/ui/minigames2.js:55](C:/Users/titov/Desktop/NASA/src/ui/minigames2.js:55), [src/campaign/story.js:323](C:/Users/titov/Desktop/NASA/src/campaign/story.js:323).  
   **Reproduce:** Choose Dilemma 4 B, time out once, then win the retry. The first timeout clears `d4b`; the subsequent win grants only +5 Morale, no +10 Research, and no greenhouse cooling consequence. The scenario requires a missed contact window on failure. **Fix:** Represent window success/failure explicitly and preserve the chosen dilemma context.

9. **Recurring breakdowns and several failure penalties are missing.** **Severity:** major. **Location:** [src/campaign/story.js:26](C:/Users/titov/Desktop/NASA/src/campaign/story.js:26), [src/campaign/story.js:82](C:/Users/titov/Desktop/NASA/src/campaign/story.js:82), [src/campaign/story.js:294](C:/Users/titov/Desktop/NASA/src/campaign/story.js:294).  
   **Reproduce:** Leave systems running across the specified maintenance intervals, or fail Air Filter and Valve Balance. There are no general five-Sol solar degradation, four-Sol/three-expedition filter, six-Sol water/valve, or three-Sol Earth-window schedules. Air Filter never reduces Oxygen production; Valve failure never applies −30% output; Solar cannot report partial cleaning. Heat failure subtracts a flat 10 Heat each attempt instead of applying the room-based nighttime consequence. **Fix:** Implement persistent breakdown state, scheduled triggers, and game-specific result data.

10. **Normal Solar Wipe wins replay tutorial instructions.** **Severity:** major. **Location:** [src/main.js:146](C:/Users/titov/Desktop/NASA/src/main.js:146), [src/main.js:194](C:/Users/titov/Desktop/NASA/src/main.js:194).  
    **Reproduce:** Complete a Solar Wipe from Tasks after the first storm. Every win invokes `onSolarWin()`, sets `tut` to `TUT_BATTERY`, and tells the player to insert Pip’s battery again. Mode remains `play`, so the requested battery overlay never opens. This is misleading tutorial state, rather than a complete simulation lock. **Fix:** Run that transition only during the tutorial.

11. **The promised later soil-washing action is inaccessible.** **Severity:** major. **Location:** [src/campaign/story.js:206](C:/Users/titov/Desktop/NASA/src/campaign/story.js:206), [src/campaign/story.js:271](C:/Users/titov/Desktop/NASA/src/campaign/story.js:271).  
    **Reproduce:** Choose Dilemma 3 A or C, then look for washing in the Lab menu. `washUnlocked` is set, but no UI or command consumes it. Players cannot subsequently obtain Soil Beds through the promised recovery path. **Fix:** Expose a Lab action with the specified cost, drone reservation, and result.

12. **Sol Plans and Fitness are absent from the playable campaign.** **Severity:** major. **Location:** [src/campaign/engine.js:28](C:/Users/titov/Desktop/NASA/src/campaign/engine.js:28), [src/ui/campaign-ui.js:49](C:/Users/titov/Desktop/NASA/src/ui/campaign-ui.js:49), [src/campaign/logbook.js:82](C:/Users/titov/Desktop/NASA/src/campaign/logbook.js:82).  
    **Reproduce:** Reach Sol 2 and select the Commander. There is no portrait/Sol Plan screen, preset selection, Fitness meter, or exercise system. Strong Bones is omitted, the Fitness cards cannot unlock, and Crew Care excludes Fitness. **Fix:** Connect the specified campaign mechanics, controls, statistics, and rewards.

13. **Wheel Vacuum accepts hover cleaning and cannot produce the intended failed-launch path.** **Severity:** minor. **Location:** [src/ui/minigames2.js:304](C:/Users/titov/Desktop/NASA/src/ui/minigames2.js:304), [src/main.js:158](C:/Users/titov/Desktop/NASA/src/main.js:158).  
    **Reproduce:** Move the mouse over wheels without pressing, then tap the two pebbles. Cleaning still progresses; a probe completed it this way. Cracks and paid patches are absent. The prep chain also waits for a win, overwriting a failed wheel result before launch, so the advertised higher-risk launch cannot occur through this UI. **Fix:** Require a held pointer, implement patches, and permit the scenario’s failed-wheel continuation.

14. **Battery completion can fire twice.** **Severity:** minor. **Location:** [src/ui/minigames.js:170](C:/Users/titov/Desktop/NASA/src/ui/minigames.js:170), [src/ui/minigames.js:186](C:/Users/titov/Desktop/NASA/src/ui/minigames.js:186).  
    **Reproduce:** Plug in the cable and tap the plugged connector during its 800 ms completion animation. Input remains active and schedules another completion callback. A probe produced two `onDone()` calls, causing duplicate tutorial transitions and dialogue. **Fix:** Disable input after `done`, make completion idempotent, and cancel pending completion timers on destruction.

15. **Skip drops transition sounds; repeat-play tap-to-skip is missing.** **Severity:** minor. **Location:** [src/main.js:276](C:/Users/titov/Desktop/NASA/src/main.js:276), [src/flow/intro.js:203](C:/Users/titov/Desktop/NASA/src/flow/intro.js:203).  
    **Reproduce:** Skip during the crawl. Time jumps to exactly 19 seconds and the previous time is reset, so the `(previous, current]` cue calculation never dispatches the wind/parachute cues at 19 seconds. A second Skip reaches the tutorial, bypassing landing dialogue and its cards. Completing a playthrough never enables the specified tap-anywhere shortcut. **Fix:** Handle transition cues explicitly and persist the first-playthrough flag.

16. **ASTRA’s queue does not implement the prescribed cutscene interruption behavior.** **Severity:** minor. **Location:** [src/flow/astra.js:53](C:/Users/titov/Desktop/NASA/src/flow/astra.js:53), [src/ui/astra-panel.js:41](C:/Users/titov/Desktop/NASA/src/ui/astra-panel.js:41).  
    **Reproduce:** Watch touchdown without pressing Next. The underground line becomes due while the landing line types, but is merely queued; the current line is not completed immediately with the specified 1.5-second hold. Dialogue consequently trails the camera and carries into the tutorial. **Fix:** Give timed cues the required finish-and-hold behavior.

17. **Mission Report and badge accounting are incomplete.** **Severity:** minor. **Location:** [src/ui/campaign-ui.js:178](C:/Users/titov/Desktop/NASA/src/ui/campaign-ui.js:178), [src/ui/campaign-ui.js:258](C:/Users/titov/Desktop/NASA/src/ui/campaign-ui.js:258), [src/campaign/logbook.js:93](C:/Users/titov/Desktop/NASA/src/campaign/logbook.js:93).  
    **Reproduce:** Finish the finale and inspect the report. Finale dismissal does not open it automatically. It lacks per-flare shelter/loss records, found story items, choice outcomes, and the newest three cards. Well Rested checks elapsed time and absence of Med-Rest, rather than eight hours of sleep on every required Sol. Expedition 5 also returns no Canyon/Brine inventory items. **Fix:** Record and display the specified evidence, and chain finale dismissal into the report.

18. **Logbook artwork and organization are unfinished.** **Severity:** minor. **Location:** [src/ui/campaign-ui.js:153](C:/Users/titov/Desktop/NASA/src/ui/campaign-ui.js:153), [src/ui/campaign-ui.js:171](C:/Users/titov/Desktop/NASA/src/ui/campaign-ui.js:171).  
    **Reproduce:** Open Logbook and an unlocked card. Cards are an ungrouped text grid; the detail view has no image. There is no HUD book icon, and earned badges are text spans without links to their science cards. **Fix:** Add the specified navigation, topic grouping, images with honest placeholders, and badge links.

19. **Run radio displays localization keys, and radio history disappears.** **Severity:** minor. **Location:** [src/campaign/expeditions.js:167](C:/Users/titov/Desktop/NASA/src/campaign/expeditions.js:167), [src/ui/campaign-ui.js:304](C:/Users/titov/Desktop/NASA/src/ui/campaign-ui.js:304).  
    **Reproduce:** Launch a repeatable Run: it emits `radio.exprun.00` and similar IDs, while strings contain `radio.run.<percent>.<variant>`. Reload mid-expedition: previous messages vanish because history is UI-local while fired markers remain saved. Messages also lack Sol/time prefixes. **Fix:** Select valid run-pool IDs and persist timestamped radio entries.

20. **Small screens and enlarged UI expose readability and modal risks.** **Severity:** minor. **Location:** [src/main.js:33](C:/Users/titov/Desktop/NASA/src/main.js:33), [styles/game.css:53](C:/Users/titov/Desktop/NASA/styles/game.css:53), [styles/game.css:77](C:/Users/titov/Desktop/NASA/styles/game.css:77), [src/ui/minigames2.js:204](C:/Users/titov/Desktop/NASA/src/ui/minigames2.js:204).  
    **Reproduce:** Use a phone-sized viewport, or raise UI size and open a long Resources panel. The entire fixed 1920×1080 stage shrinks, including text and touch targets. Most cards lack height limits/scrolling, so enlarged content can clip their sole Close button. Nutrient Match relies exclusively on matching colors; most games lack the required animated first-move hand. **Fix:** Use responsive sizing, actual-pixel target minimums, scrollable cards, and matching symbols. Clipping requires browser confirmation.

21. **Post-intro drone placement contradicts the scenario.** **Severity:** minor. **Location:** [src/render/campaign-world.js:44](C:/Users/titov/Desktop/NASA/src/render/campaign-world.js:44), [src/render/campaign-world.js:89](C:/Users/titov/Desktop/NASA/src/render/campaign-world.js:89).  
    **Reproduce:** Finish the underground pan. Bumble and Zip remain buried on the surface until awakened, instead of waiting dormant in the Garage frame from 31 seconds onward. **Fix:** Separate cutscene mound placement from gameplay dormant placement.

22. **The merged audio director is unused, but main does not depend on unmerged APIs.** **Severity:** note. **Location:** [src/main.js:22](C:/Users/titov/Desktop/NASA/src/main.js:22), [src/ui/audio.js:10](C:/Users/titov/Desktop/NASA/src/ui/audio.js:10), [src/flow/intro.js:209](C:/Users/titov/Desktop/NASA/src/flow/intro.js:209).  
    **Reproduce:** Start and play: browser code uses the older procedural effects module, never calls the director’s `tick`, `campaignEvents`, or `flowCue`, and has no mute/settings controls. Type-blip cues lack `char`. Thus PRs #7/#8 provide missing integration, rather than fixing calls to currently undefined functions. Co-op lobby, role selection/modifiers, and Commander renaming are also absent. **Fix:** Integrate the pending hooks and implement the missing screens.

## Verification

- Read repository instructions and available team status files; `git_status_Pavlo` was absent. Reviewed the scenario, specified browser files, campaign command/event paths, styles, string IDs, asset mapping, and audio handoff.
- Ran `node --test "tests/flow.test.mjs" "tests/movers.test.mjs"`: **21 passed, zero failed**.
- Read-only Node probes confirmed the impossible Heat Pump, hover-based wheel cleaning, duplicate battery completion, missing-art exception, antenna retry consequences, and missing finale explanations.
- All **27 atlas image paths exist**; checked relative imports also resolve. No additional missing-DOM-ID exception was established.
- The checkout advanced during review to `cb88b34`; among reviewed game paths, the intervening change affected the dormant sound engine. UI/flow findings remained applicable.
- No browser was opened. Layout, real touch behavior, visual asset crops, and audible playback remain unverified. GitHub requests for PRs #7/#8 returned 404; their intended integration was checked through local code and `AUDIO_HOOKS.md`.

All nine mini-games were traced. Normal wins share **+2 SP**, a win sound, and first-time ASTRA explanation; repeat wins use “Nice work!” The common retry/assistance problems are described above.

| Mini-game | Win and solo timer | Failure/retry comparison |
|---|---|---|
| Solar Wipe | ≥90% clean, 23 s | Partial output is not reported; retries reset cleaning. Normal-play win invokes tutorial code. |
| Air Filter | 16 cells ×3 strokes, then lock; 23 s | Pull/reinsert drags are simplified to taps. Required Oxygen penalties are absent. |
| Valve Balance | Both bands held 2 s; 18 s | Win is reachable; required −30% Oxygen-output failure effect is absent. |
| Water Sort | Correct order and tap; 18 s | Win restores 98% recycling. Existing 70% recycling persists on failure. Global assistance rule differs. |
| Heat Pump | Three connected rooms; 23 s | Impossible. Each timeout immediately removes 10 Heat; automatic assistance eventually awards success. |
| Nutrient Match | Three matching bottles plus LEDs; 18 s | Reachable; existing nutrient-drift reduction persists until success. Color-only matching; no first-move hand. |
| Wheel Vacuum | Six clean wheels, two pebbles; 23 s | Hover cleans; cracks absent; UI cannot continue to launch with failed prep. |
| Suit Seal | Three seals, badge, pressure release; 18 s | Reachable; failure keeps prep open. Crafted-liner insertion and randomized seal positions are absent. |
| Antenna | ≥4 bars held 3 s; 23 s | Reachable; failure retries instead of missing the window. Storm straightening and message-flight animation are absent. |

## Recommendations

The ten things to fix first:

1. Correct Heat Pump’s entry tile and verify every puzzle is solvable.
2. Add mini-game cancellation and proper drone assistance.
3. Save important actions and clearly report storage failures.
4. Validate and migrate saves before applying them.
5. Make missing-art fallback safe throughout rendering.
6. Separate normal Solar Wipe completion from tutorial transitions.
7. Restore the finale’s missing science lines and rewards.
8. Correct antenna failure, contact windows, and Dilemma 4 outcomes.
9. Expose Ice Run and deferred soil washing.
10. Implement maintenance consequences, then verify readable, closable screens on small displays.

## Warnings

- The working tree changed while Codex was running: docs/ai-collaboration/LOG.md, src/campaign/expeditions.js, src/campaign/story.js, docs/ai-collaboration/records/20261114-171848-campaign-engine-rules-vs-scenario-and-logic-bugs.md. The sandbox was read-only, so these are most likely concurrent edits by the main agent or a person — Codex may have reviewed an older version of those files.

## Main-agent follow-up

_Pending. The main agent records here which findings were confirmed, what was fixed, what was rejected and why, and which tests were run._
