# Review simulation backend: logic and science

| Field | Value |
|---|---|
| Record | 20261114-113628-review-simulation-backend-logic-and-science |
| Kind | simulation |
| Mode | read-only (sandbox: read-only) |
| Started | 2026-11-14T10:36:28.349Z |
| Duration | 320 s |
| Exit status | 0 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6.1-sol |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1d9a1-4ad9-74d0-a916-e820e7a8cb00 |
| Tokens used | 144,554 |
| Working-tree changes during run | `docs/ARCHITECTURE.md`, `docs/GAME_DESIGN.md`, `docs/GIT_SYNC.md`, `docs/LEVELS.md` |
| Raw transcript | [raw/20261114-113628-review-simulation-backend-logic-and-science.log](raw/20261114-113628-review-simulation-backend-logic-and-science.log) |

## Task sent to Codex

Focus files: `src/sim/crew.js`, `src/sim/resources.js`, `src/sim/sim.js`, `src/sim/objectives.js`, `src/sim/save.js`, `src/sim/radiation.js`, `src/sim/space-weather.js`, `src/sim/constants.js`, `src/data/nasa/reference.js`

Review the Mars colony simulation backend for correctness. It is a pure, deterministic
simulation stepped one Mars-minute at a time (`src/sim/sim.js`). It will be the engine of an
educational game for ages 7+, so two things matter most: the logic must be right, and no
"scientific" claim may be wrong or mislabelled.

Part A — simulation logic. Look for real bugs, with a concrete scenario for each:
1. `src/sim/crew.js`: activity selection, the walking state machine (`startRoute`, `retarget`,
   `stepMovement` — can an astronaut get stuck, teleport, oscillate forever, or end on a
   non-existent edge?), meals (`eat`, `mealHour`/`mealMinutes`), forced sleep, the shelter
   override, EVA cut-off.
2. `src/sim/resources.js`: energy accounting in `stepPower` (is energy conserved? can the
   reserve tiers deadlock or starve the base? order-of-operations issues with `labInUse`),
   oxygen/water/food bookkeeping in `stepLifeSupport`, emergency episodes in `updateAlerts`.
3. `src/sim/sim.js`: storm lifecycle (warning -> active -> done, overlapping storms, storms that
   start before the level's first minute, `endStormEpisode`, `autoAllClear`), hints, end-of-level,
   `applyCommand` validation and the project `paid` flag.
4. `src/sim/objectives.js`: can an objective be reported `done` when it should not be (or
   `failed` when still achievable)? Is `starRating` consistent with `evaluateObjectives`?
5. `src/sim/save.js`: can a tampered save crash or corrupt `step()`? Is anything the simulation
   relies on missing from `validateState`?
6. Determinism: anything that depends on object key order, floating-point accumulation across
   different step sizes, or hidden mutable module state (`pathfinding.js` cache)?

Part B — science and provenance. Check `src/sim/radiation.js`, `src/sim/space-weather.js`,
`src/sim/constants.js`, `src/data/nasa/reference.js`:
7. Unit errors (mSv/day vs per hour vs per Mars-minute; g/cm^2; kWh vs kW; Earth day vs sol).
8. Is any value tagged `nasa-measurement` that is not actually a NASA measurement, or stated
   with a wrong number or source? Flag anything you are not confident is correct and say why.
   Do not "correct" a number unless you are sure; say "unverified" instead.
9. Does the shielding model do what its comments claim (depth, material, never zero, SPE easier
   to stop than GCR)? Any regime where it gives a physically backwards answer?
10. Is anything presented to the player as fact (see `FACTS` and `src/sim/messages.js`) that is
    wrong or misleading for a child?

Part C — tests. Which important behaviours in Part A have no test in `tests/`? List the five
most valuable missing tests.

You may run `node --test "tests/**/*.test.mjs"` and `node tools/balance/run-level.mjs <levelId> --policy idle|shelter|smart`.

## Codex response

## Summary

All 49 existing tests pass, but targeted reproductions found save-validation failures, a fatal oxygen reserve-policy failure, and incorrect storm accounting at time boundaries. The main time, energy, and radiation unit conversions are correct. I found no routing invariant violation across 336,000 crew-minutes of changing assignments and shelter orders.

## Findings

1. **Severity: major** — **Location:** `src/sim/save.js:54`  
   **Problem:** Validation accepts states that immediately crash or silently corrupt the simulation. Reproductions included movement without `rest` crashing on `.length`, an unknown storm class crashing during dose calculation, invalid shielding crashing radiation calculation, and missing `stormDoseMsv` or `stats.foodGrownKg` becoming `NaN`.  
   **Why it matters:** A damaged save can pass the player-facing validation and fail during play.  
   **Suggested fix:** Validate all consumed nested fields, including movement timing and graph connectivity, storm classes/statuses, project definitions/status/progress/`paid`, counters, objectives, shielding, and emergency fields. Validate bounds and cross-field invariants; reconstruct derived fields where practical.

2. **Severity: major** — **Location:** `src/sim/resources.js:41`, `src/sim/resources.js:55`  
   **Problem:** The oxygen generator’s battery reserve applies even when oxygen is exhausted. With four crew, midnight, an empty oxygen tank, water available, and 64 kWh stored, the mission fails after 100 minutes while **55.4 kWh remains**. The generator stays shed throughout.  
   **Why it matters:** The base preserves heating reserves while allowing preventable suffocation, without a player command to override the choice.  
   **Suggested fix:** Make critical oxygen demand override its normal reserve threshold, while retaining explicit prioritization of essential loads.

3. **Severity: major** — **Location:** `src/sim/sim.js:109`, `src/sim/sim.js:173`  
   **Problem:** Already-expired pending storms are activated and immediately counted as safely sheltered. A storm spanning minutes 0–300, with the level starting at minute 360, awards a sheltered storm with zero exposure. If another storm is already underway but still pending later in the array, this processing can also emit `all-clear` before activating that storm.  
   **Why it matters:** Objectives and achievements receive false credit, and shelter can lift during an active storm.  
   **Suggested fix:** Normalize all storm statuses before generating episode transitions. Skip credit for entirely pre-mission storms and decide all-clear from the complete current storm set.

4. **Severity: minor** — **Location:** `src/sim/sim.js:252`  
   **Problem:** A storm ending exactly at `endMinute` never receives its ending transition. Reproducing a minor storm ending at minute 7200 leaves it `active` after mission completion; the sheltered-storm objective fails despite the crew riding out its entire duration underground.  
   **Why it matters:** Mission-end scoring depends on an unprocessed boundary.  
   **Suggested fix:** Settle environment episodes ending at the final boundary before evaluating objectives, without applying another minute of consumption or dose.

5. **Severity: minor** — **Location:** `src/sim/sim.js:310`  
   **Problem:** Project lookup accepts inherited properties. Calling `startProject` with `project: 'toString'`, `'constructor'`, or `'__proto__'` throws instead of returning `{ ok: false }`.  
   **Why it matters:** The command-validation boundary does not safely reject every unknown project ID.  
   **Suggested fix:** Require a string ID that is an own property of both the level’s project state and `PROJECTS`.

6. **Severity: minor** — **Location:** `src/sim/resources.js:36`, `src/sim/sim.js:243`  
   **Problem:** Lab demand uses the previous minute’s activity. In normal play, the scientist arrives at minute 440, is marked `work` during minute 440–441, but receives no lab power or science until the following minute. Conversely, departure can charge one extra minute of lab power.  
   **Why it matters:** Power demand and productive work disagree at activity transitions.  
   **Suggested fix:** Determine current-minute movement/activity intent before allocating power, then execute work using that allocation.

7. **Severity: minor** — **Location:** `src/sim/radiation.js:28`, `src/sim/radiation.js:49`  
   **Problem:** Material effectiveness also amplifies the shared secondary-particle buildup curve. At equal mass of 5 g/cm², GCR transmission is approximately **1.0141 for aluminium, 1.0189 for water, and 1.0200 for polyethylene**: the declared better materials become worse.  
   **Why it matters:** This reverses the model’s stated material lesson in the thin-shield regime. NASA’s shielding analysis supports polyethylene’s advantages over aluminium; the precise Mars-specific curves remain a modeling question. [NASA shielding analysis](https://ntrs.nasa.gov/citations/19980006777)  
   **Suggested fix:** Model attenuation and secondary production separately, with material-dependent buildup, then verify equal-mass comparisons across thin and thick shields.

8. **Severity: major** — **Location:** `src/sim/messages.js:27`, `src/sim/space-weather.js:72`  
   **Problem:** DONKI events become messages saying the event “has reached Mars,” although the bundled dataset explicitly says it does not establish whether or when those events reached Mars. Separately labeling strength as gameplay does not resolve the simulated arrival-time claim.  
   **Why it matters:** Player-facing text turns spacecraft detections elsewhere into purported historical Mars events.  
   **Suggested fix:** Preserve the measured detection timestamp separately from simulated Mars arrival. Describe these events as game scenarios based on real detections and carry that distinction into the mission log.

9. **Severity: minor** — **Location:** `src/data/levels.js:94`  
   **Problem:** The scripted `2024-05-20T06:00Z` timing is tagged `nasa-measurement`, while its own source note says the hour is approximate. NASA’s cited report supports the date and 8,100 μGy measurement, but does not establish this hour. [NASA/JPL report](https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/)  
   **Why it matters:** One provenance tag conflates a measured date with an invented time.  
   **Suggested fix:** Store measured date and approximate hour separately, or tag the composite timestamp as an approximation.

10. **Severity: note** — **Location:** `src/data/nasa/reference.js:25`, `src/data/nasa/reference.js:43`, `src/sim/constants.js:193`, `src/sim/constants.js:218`  
    **Problem:** Some source claims remain unresolved:
    - The cited current Mars Fact Sheet lists mean surface gravity as **3.73 m/s²**, whereas the reference uses 3.71. This is a citation/definition mismatch; I am not recommending changing the number without identifying its intended definition. [Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)
    - The **1.27 kg/person/day food figure remains unverified** against an accessible primary source establishing both stated packaging quantities.
    - The attenuation calibration and the May 2024 quality factor near 1.5 remain **unverified calibrations**. Their approximation tags are appropriate, but the tests establish internal consistency and plausibility, not agreement with measured transport data.  
    **Why it matters:** Educational provenance should be independently traceable.  
    **Suggested fix:** Add precise URLs/page references and distinguish published quantities, arithmetic derivations, and model assumptions.

## Verification

- Read `AGENTS.md`, the available coordination status file, all focus files, supporting layout/level/RNG/pathfinding/message modules, all three simulation test files, and the balance runner.
- Ran `node --test "tests/**/*.test.mjs"`: **49 passed, 0 failed**.
- Ran the balance runner with `--policy smart`: L2 completed with two stars; L3 completed with one.
- Ran in-memory reproductions for malformed saves, reserve starvation, expired/concurrent storm initialization, mission-end storm accounting, inherited project IDs, lab transitions, and shielding comparisons.
- Checked movement edges, remaining routes, destinations, and timing across **336,000 crew-minutes**. The pathfinding cache returns independent route arrays; I found no cache-induced state leak.
- Found no additional defect in ordinary meal scheduling, forced-sleep selection, shelter destination overrides, EVA cutoff, emergency grace tracking, project payment on resume, or consistency between objective evaluation and star rating.
- Verified key science sources, including [sol length](https://www.giss.nasa.gov/tools/mars24/help/notes.html), [surface radiation and atmospheric column](https://www.scienceintheclassroom.org/sites/default/files/research-papers/1244797.full_.pdf), and [water consumption/recovery](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/). No Earth-day/sol, kW/kWh, or areal-density conversion error was found.
- Could not inspect browser presentation: `src/ui/` and `src/main.js` were absent. `docs/ARCHITECTURE.md` was also absent. I did not independently re-fetch all 119 DONKI records.
- No files or Git state were changed.

## Recommendations

The five most valuable missing tests are:

1. **Malformed-save rejection:** nested-field deletions, invalid enums, disconnected movement routes, invalid shielding, and project/payment invariants.
2. **Storm boundary matrix:** ordinary overlaps, expired pre-start storms, active storms at initialization, touching episodes, auto-all-clear disabled, and storms ending at mission end.
3. **Power conservation and survival priorities:** verify the energy equation, battery-cap overflow, reserve thresholds, and oxygen recovery from an empty tank below the normal reserve.
4. **Lab transition accounting:** arrival, meal departure, reassignment, grounding, and power restoration should align demand with actual work.
5. **Crew transition regressions:** forced-sleep recovery interrupted by meals, partial meals, repeated mid-edge retargeting, and return travel after the EVA cutoff.

## Warnings

- The working tree changed while Codex was running: docs/ARCHITECTURE.md, docs/GAME_DESIGN.md, docs/GIT_SYNC.md, docs/LEVELS.md. The sandbox was read-only, so these are most likely concurrent edits by the main agent or a person — Codex may have reviewed an older version of those files.

## Main-agent follow-up

The working-tree changes listed above were documentation files the main agent wrote while the
review ran; the reviewed code (`src/sim/`, `src/data/`) was not touched during the review.

Each finding was checked against the code. All ten were confirmed; nine were fixed and one
(part of finding 10) is recorded as an open limitation.

| # | Finding | Verdict | What was done |
|---|---|---|---|
| 1 | `validateState` accepts saves that crash or produce `NaN` later | **Confirmed** | Validation rewritten in three layers: every consumed field is checked for type, range and enum (movement must follow real corridors with consistent timing); derived data (`extraShielding`) is rebuilt instead of trusted; and a copy of the state is stepped once — if that throws or yields a non-finite number, the save is refused. Test: 18 tampered saves, each refused. |
| 2 | Oxygen generator stays shed under its battery reserve while the crew suffocate | **Confirmed** (reproduced: mission failed with 55 kWh left) | Critical override: below 3 kg of oxygen the generator ignores its reserve; below 20 L of water so does the recycler. Follow-up found by the new test: an empty tank with a working generator was still treated as vacuum, so harm from missing air and water is now proportional to the shortfall. |
| 3 | Storms already over at level start are counted as "sheltered"; `all-clear` could fire while another storm was about to activate | **Confirmed** | Storm lifecycle rewritten in two passes (starts, then ends) with an explicit `stormEpisode` flag, so episode decisions use the complete picture. Storms wholly before the level are dropped at setup and, defensively, closed without credit at run time. |
| 4 | A storm ending exactly at the last minute, or still active at the end, is never settled | **Confirmed** | `finish()` settles any storm still active before objectives are evaluated, on the dose received so far, without simulating an extra minute. |
| 5 | `startProject` with `toString` / `__proto__` throws | **Confirmed** | All lookups keyed by ids from commands or saves use an own-property check (`has()` in `src/sim/util.js`): projects, jobs, crew, rooms, levels, materials, storm classes. |
| 6 | Lab power lags the scientist's activity by one minute | **Confirmed** | Crew step split into `planCrewMember` (decide and move) and `actCrewMember` (act). Power is allocated in between, so the lab draws power in exactly the minutes someone works in it. Test asserts this minute by minute. |
| 7 | In thin shields, "better" materials came out slightly worse against cosmic rays | **Confirmed** (the build-up term was scaled by effectiveness) | Attenuation and secondary production are now separate: each material has a `secondaries` yield (aluminium 1.3, regolith 1.0, water 0.6, polyethylene 0.5). Test checks polyethylene < water < regolith < aluminium for both radiation types from 2 to 300 g/cm². Side effect, intended: a bare surface module now reads 106% instead of 102%. |
| 8 | Log text said DONKI storms "reached Mars" | **Confirmed** — the most important finding for an educational game | Message reworded ("The … solar storm has begun"); storm labels no longer mention Mars; every storm carries an `about` text separating the real near-Earth detection from the imagined arrival, and `timing.note` states that using the detection time as the Mars arrival time is a game assumption. Level 2's tagline no longer says the storms "are real". |
| 9 | The 20 May 2024 storm's time was tagged `nasa-measurement` although its hour is invented | **Confirmed** | Timing re-tagged `approximation`, with a note that the date is measured and the hour is our choice. |
| 10 | Unresolved source claims | **Partly fixed** | Checked against primary or NASA-hosted sources by the main agent: Mars surface gravity corrected from 3.71 to **3.73 m/s²** (NASA Mars Fact Sheet, "Surface gravity (mean)"); irradiance 586.2 W/m², pressure 6.36 mb and CO₂ 95.1% confirmed on the same sheet. Food: the 3.8 lb-including-1 lb-packaging figure is confirmed as NASA Facts "Food for Space Flight" (1996, Shuttle era); the 1.27 kg is now marked `derived` and described as our subtraction. Oxygen 0.84 kg/day re-described as a NASA MSFC planning value with its real range. MOXIE (122 g, 12 g/h), the 600 mSv career limit and Pathfinder's 0.28%/sol confirmed by search. **Still open:** the attenuation lengths and the quality factor of about 1.5 remain plausibility calibrations, not fits to transport data — now stated in `radiation.js` and `docs/GAME_DESIGN.md`. |

Tests after the fixes: `node --test "tests/**/*.test.mjs"` — **65 passed, 0 failed** (49 before
the review + 16 regression tests in `tests/review-regressions.test.mjs`, covering four of the
five test gaps Codex listed; "crew transition regressions" is covered only in part).

Balance re-checked with `tools/balance/run-level.mjs` on all three levels and three policies:
levels 1 and 2 unchanged; level 3 no longer aborts when untouched (thirst is now gradual) and
is still marked draft.

`STATE_VERSION` was raised to 2 because the state gained `stormEpisode` and `shortfall`.
