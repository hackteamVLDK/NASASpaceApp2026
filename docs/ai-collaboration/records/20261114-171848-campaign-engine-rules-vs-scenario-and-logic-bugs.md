# Campaign engine: rules vs SCENARIO and logic bugs

| Field | Value |
|---|---|
| Record | 20261114-171848-campaign-engine-rules-vs-scenario-and-logic-bugs |
| Kind | review |
| Mode | read-only (sandbox: read-only) |
| Started | 2026-11-14T16:18:48.574Z |
| Duration | 590 s |
| Exit status | 0 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6.1-sol |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1dada-b57a-7312-a252-9855213f06e6 |
| Tokens used | 137,741 |
| Working-tree changes during run | `src/campaign/expeditions.js` |
| Raw transcript | [raw/20261114-171848-campaign-engine-rules-vs-scenario-and-logic-bugs.log](raw/20261114-171848-campaign-engine-rules-vs-scenario-and-logic-bugs.log) |

## Task sent to Codex

Focus files: `SCENARIO.md`, `src/campaign/engine.js`, `src/campaign/data.js`, `src/campaign/story.js`, `src/campaign/expeditions.js`, `src/campaign/hazards.js`, `src/campaign/missions.js`, `content/data/game-data.json`

Audit the campaign engine against the binding scenario and look for logic bugs.

The playable game is the 20-Sol campaign in `src/campaign/` (engine.js, data.js, story.js,
expeditions.js, hazards.js, missions.js, logbook.js). `SCENARIO.md` is binding: where the engine
differs from it, that is a finding. The older `src/sim/` is NOT used by the game; ignore it.
`content/data/game-data.json` is machine-readable data extracted from SCENARIO.md; if the commit
that added it mentions an "engine drift report", use it (see `content/tools/`).

Part A — rules. Compare the engine with SCENARIO.md Sections 2.1, 3 (all sub-sections: meters,
per-Sol rates, modules, unlock chain, HP, radiation shielding factors, storm, Sol snapshots),
5 (expeditions: HP formula, risk roll, loot, rescue, radio decisions, upgrade tree) and 6
(dilemmas D1-D5, random events E1-E4). For each difference give: the scenario's rule (section
and the number), what the code does (file:line), and how a player would notice.
Do not report the items already listed as open in `docs/GAMEPLAY_PLAN.md` (P2-P7, P10-P13, M1-M13)
or in `docs/REVIEW_2026-11-14.md` "Still open" — unless you find the list is wrong.

Part B — bugs. Look for real defects, each with a concrete command sequence that triggers it:
1. States the player cannot get out of (soft-locks): a pending card that can never be answered,
   a task that can never be completed, a build that can never finish, an expedition that never
   returns, `canFinale` unreachable after some choice.
2. Meters or counters that can go negative, NaN, or above their cap; rates applied twice or not
   at all; things that happen while paused or while `away` and should not (or the reverse).
3. Commands accepted in a state where they should be refused (double builds, crafting without
   the Workshop, spending below zero, upgrading before building, ordering a drone that is asleep).
4. Save/load: anything in the state that is not plain JSON, or derived data that goes stale.
5. Determinism: `Math.random`, `Date.now`, object-key-order dependence.
6. Dead code: flags that are set and never read, or read and never set.

Part C — tests. Name the five most valuable missing tests for `src/campaign/`.

You may run `node --test "tests/campaign*.test.mjs" "tests/review-fixes.test.mjs" "tests/missions.test.mjs"`
and one-off `node -e` scripts that import the engine (read-only: do not write files).

## Codex response

## Summary

All 49 requested tests pass, but the campaign still differs from the binding scenario in several consequential ways. Confirmed defects include lost stored Power, missing finale content, ineffective repair choices, shortened effects, and commands accepted without required conditions. I found no permanent soft-lock in the paths checked and made no file or Git changes.

## Findings

1. **Severity:** major. **Location:** `src/campaign/story.js:17`.
   
   D1 B should add 40 Power within the battery’s current cap (§3.1, §6 D1). `setRes()` always caps Power at 100: with Battery T1 and 200 Power, `command(s,{type:'choose',choice:'b'})` reduces Power to **100**, instead of increasing it to 240. Use the same capacity calculation as the engine’s regular resource updates.

2. **Severity:** major. **Location:** `src/campaign/expeditions.js:35`, `src/campaign/expeditions.js:162`.
   
   The finale requires ASTRA lines at 75% and 85% (Section 1), plus Canyon Samples and a Brine Sample (§5.2). ASTRA milestones are checked only inside the radio-milestone loop, whose list contains neither percentage; finale loot also contains no items. Reproduction: launch Expedition 5 from a fully upgraded fixture and `step(s,1440)`—only `astra.finale.home` fires, and loot is `{sp:30,items:{}}`. Process ASTRA milestones independently and include the samples as protected story loot.

3. **Severity:** major. **Location:** `src/campaign/expeditions.js:135`, `src/campaign/expeditions.js:45`.
   
   D5 A promises a repeatable **one-Sol** Expedition 4 (§6 D5). The handler sets `flags.exp4Repeat`, but nothing reads it; `durationMinutes()` still returns 2,880 minutes before Garage T2. Launch Expedition 4, answer D5 A, return, then inspect or launch it again: it remains two Sols and repeats D5. Implement the promised repeat-trip variant and distinguish it from the original story trip.

4. **Severity:** major. **Location:** `src/campaign/expeditions.js:143`, `src/campaign/data.js:111`.
   
   D5 C specifies restoring worn shielding for **15 SP** (§6 D5; §7.3 explicitly gives an SP-only recraft cost). Clearing the upgrade flag sends the player through the original recipe, requiring another Titanium Plate. After choosing C, with sufficient SP but no plate, `command(s,{type:'craft',recipe:'rover_shielding'})` fails. Track worn shielding separately and provide the specified repair cost.

5. **Severity:** major. **Location:** `src/campaign/engine.js:246`, `src/campaign/engine.js:218`, `src/campaign/engine.js:113`.
   
   At zero Water, the Greenhouse must pause; fresh-crop healing requires a working Greenhouse (§3.1, §3.6). Food production stops, but healing and `stats.harvest` continue, and Soil Beds remain an unconditional food modifier. In a dry, powered fixture with Food 80, HP 50 and Morale 0, ordering the Kitchen and stepping 60 minutes increased HP and credited 0.4167 harvested Food despite stopped production. Share an operational-state predicate across production, healing, Soil Beds and harvest accounting.

6. **Severity:** major. **Location:** `src/campaign/engine.js:510`, `src/campaign/story.js:294`.
   
   The Commander cannot perform base work while away (§2.1), but mini-game results remain accepted during expeditions. Launch a trip, then submit `command(s,{type:'miniResult',game:'heat_pump',win:true})`: Heat rises by 12 and SP by 2; the Tasks UI also leaves these games accessible. Validate task eligibility and Commander availability, while allowing autonomous drone work to continue.

7. **Severity:** minor. **Location:** `src/campaign/engine.js:430`, `src/campaign/story.js:296`.
   
   Other command entry points bypass progression: a fresh campaign accepts `wakeDrone` for Drone #03 without a Reboot Kit (§3.8, §5.4), and `miniResult` with `game:'bogus',win:true` awards 2 SP. Restrict direct tutorial waking to Drone #01 and reject unknown or ineligible mini-game results before granting rewards.

8. **Severity:** major. **Location:** `src/campaign/engine.js:500`, `src/campaign/story.js:179`.
   
   Paid choices do not check affordability. With D2 pending and zero SP, choosing A succeeds and offers the repair while SP stays zero; D3 B similarly accepts insufficient Water, despite its 20-Water cost (§6). Check costs before clearing the pending card, and disable unavailable paid choices or offer an explicit fallback.

9. **Severity:** minor. **Location:** `src/campaign/engine.js:500`, `src/campaign/expeditions.js:110`.
   
   Choice commands are not restricted to their pending-card type. At Expedition 2’s radio decision, `command(s,{type:'choose',choice:'a'})` clears the card without extending the trip or setting `decisionDone`; `radio` also accepts unsupported choice values. Validate pending kind and allowed options before changing state.

10. **Severity:** major. **Location:** `src/campaign/expeditions.js:116`.
    
    Radiation depends on trip duration (§3.6), but extending Expedition 2 by 0.25 Sol changes only its end time. Reproduction: launch Expedition 2 and answer radio A—duration increases from 1 to 1.25 Sols, while `away.hpTotal` remains **17**, rather than 21.25 without shielding. Account for exposure during added travel time and distinguish travel extensions from protected shelter time.

11. **Severity:** major. **Location:** `src/campaign/engine.js:245`, `src/campaign/expeditions.js:141`.
    
    Suit protection is inconsistently applied. The Suit Liner must multiply surface radiation by 0.75 (§5.4), but walking outside uses the same loss with or without it; D5 C also subtracts a fixed 14 HP even when the recommended liner is absent. An outside hour with a liner lost 0.8333 HP instead of 0.625 under the surface shielding table. Route radiation damage through shared calculations using the applicable equipment.

12. **Severity:** minor. **Location:** `src/campaign/expeditions.js:74`.
    
    Titanium Wheels’ “−1 risk on rocky routes” effect (§5.4) has no implementation. With wheels installed, launching Pathfinder-X still assigns `medium` risk; wheels are read only as an unlock condition. Implement the route modifier, clarifying whether the overview table’s risk is before or after that modifier.

13. **Severity:** major. **Location:** `src/campaign/story.js:264`.
    
    D1 C requires a Power emergency, Static Wipe, Heat Pump and Morale −10 (§6 D1). Its timer never adds Heat Pump, and subtracts Morale only if Power was still above zero. With Power already zero when the timer fires, the promised Morale penalty is skipped. Apply the scripted consequences independently of the current Power value and add both required tasks.

14. **Severity:** major. **Location:** `src/campaign/story.js:202`, `src/campaign/story.js:220`, `src/campaign/story.js:247`.
    
    Three choices omit their required drone work: D3 B needs one drone for one Sol, D4 C needs half a Sol, and E3 C needs one Sol (§6). Choosing any of them leaves every drone’s task unchanged, so all can continue building or salvaging while the benefit proceeds. Represent these as drone jobs and validate or queue their allocation.

15. **Severity:** minor. **Location:** `src/campaign/story.js:221`.
    
    D4 C specifies Greenhouse Food output −20% for one Sol (§6 D4). The code subtracts a flat 2 Food per Sol until next dawn: at the normal Sol 16, 18:00 trigger this lasts **12 hours**, and at Tier 2 the specified reduction would be 3.2 rather than 2. Apply a proportional Greenhouse modifier for the full duration.

16. **Severity:** major. **Location:** `src/campaign/story.js:98`, `src/campaign/hazards.js:19`.
    
    E1’s Lab T2 forecast should precede the flare by one Sol and authorize planned shelter for that event (§6 E1). It currently warns at midnight for a 10:00 flare—**10 hours**—and never clears `flareWarned`. After answering a warned flare, the watch remains visible and future flares retain planned shelter eligibility. Store an event-specific forecast and consume it when that event resolves.

17. **Severity:** minor. **Location:** `src/campaign/story.js:90`, `src/campaign/story.js:284`.
    
    “Never on a story-dilemma Sol” is enforced using fixed calendar exclusions rather than actual deferred dilemmas (§6). In a Sol 9 fixture with D2 still outstanding, scheduling a random event for 10:00 produces the event first; after answering it and stepping one minute, D2 opens on the same Sol. Arbitrate scheduled events against actual pending/deferred story beats.

18. **Severity:** major. **Location:** `src/campaign/story.js:246`.
    
    E3 B promises that a tape patch stops the leak immediately (§6 E3). If a previous patch’s leak has returned, choosing B again leaves both `leak` and `leak_w` modifiers active while charging the SP and scheduling another return. Remove existing leak modifiers immediately; likewise ensure sealing the airlock suspends an existing leak during repair.

19. **Severity:** minor. **Location:** `src/campaign/story.js:240`, `src/campaign/story.js:247`.
    
    Several elapsed durations are implemented as calendar cutoffs. At 10:00, E2 C’s three-Sol bonus lasts **68 hours**, E3 C’s one-Sol closure lasts **20 hours**, and E2 B’s “rest of this Sol” penalty continues until 06:00 next Sol (§6 E2/E3). Use `s.minute + duration * SOL` for elapsed durations and the actual Sol boundary for “rest of this Sol.”

20. **Severity:** major. **Location:** `src/campaign/story.js:251`, `src/campaign/story.js:276`, `src/campaign/story.js:320`.
    
    Repairing nutrient drift does not cancel its delayed wilt. Choose E4 C, win Nutrient Match before the deadline, then advance to the timer: Food still drops by 10 and another repair task appears despite `mult.food === 1`. Cancel obsolete hazard timers on repair or guard them with the active hazard instance; automatic recovery should also restore all related flags consistently.

21. **Severity:** minor. **Location:** `src/campaign/story.js:249`, `src/campaign/expeditions.js:125`.
    
    Some required explanations never play. Completing E4 A’s repair emits the generic first-win science line rather than `astra.e4.a`; E4 C’s wilt timer emits no follow-up, and no D5 branch emits `astra.d5.a/b/c`. Reproduce by resolving those choices and collecting emitted ASTRA IDs. Emit the choice-specific explanation when its consequence occurs, as Section 6 requires.

22. **Severity:** minor. **Location:** `src/campaign/engine.js:183`, `src/campaign/engine.js:188`.
    
    Two timing rules differ from §3.1. Construction and crafting slow at Morale **below 30**, although the resource table specifies the slowdown at zero; a fixture at Morale 20 completes only 37.5% of a two-Sol build in one Sol. Builds also finish at their starting clock time—starting Battery at Sol 1, 18:00 finished at Sol 3, 18:00—rather than the specified dawn. Align these rules or explicitly reconcile the scenario before changing it.

23. **Severity:** minor. **Location:** `src/campaign/hazards.js:17`, `src/campaign/hazards.js:45`.
    
    Derived resource information contradicts upgraded equipment. Storm text always says 30% sunlight despite Solar T2 retaining 50% (§3.3), and `meterReport()` assumes a Power cap of 100 despite 250/400 battery capacities (§3.1). For example, Power 200 with Battery T1 and positive income reports “Growing” instead of time until full. Derive both displays from the same equipment values used by simulation.

## Verification

- Read `AGENTS.md`, available team status files, the relevant scenario sections, all focus files, campaign helpers/logbook, existing campaign tests, and supporting UI/entry-point code.
- Read both exclusion documents and omitted their listed open implementation gaps.
- Ran:
  
  ```text
  node --test "tests/campaign*.test.mjs" "tests/review-fixes.test.mjs" "tests/missions.test.mjs"
  ```
  
  **49 passed; 0 failed.**
- Ran read-only, in-memory Node probes for the reproductions above. Advanced-state fixtures supplied completed modules, equipment or pending cards; no saved files were edited.
- Confirmed `game-data.json` matches fresh extraction, with no extraction or consistency errors. A direct comparison found no differences across 33 module-output/recipe comparisons.
- Used the drift-report implementation identified by commit `72337ec`. Its Windows filesystem-path import fails with `ERR_UNSUPPORTED_ESM_URL_SCHEME`, so its result could not establish engine consistency; the direct comparison used valid module imports.
- A JSON save/restore during an extended expedition produced identical subsequent state and events. Found no executable `Math.random()` or `Date.now()` in `src/campaign/`.
- Did not run a browser session or exhaustively enumerate every choice combination. No permanent soft-lock was reproduced.

## Recommendations

The five most valuable missing tests are:

1. **Finale milestone and loot contract:** assert both science lines, both protected sample items, and correct behavior after JSON restoration midway through the trip.
2. **D5 branch lifecycle:** exercise A/B/C through return, repeat-trip duration, shielding repair cost, explanations and rescue.
3. **Command rejection matrix:** test insufficient resources, wrong pending-card kinds, unauthorized waking, unknown mini-games and base tasks while away.
4. **Operational Greenhouse accounting:** verify Food, healing, Soil Beds and harvest credit together under zero Water, blackout and nutrient drift.
5. **Timed-effect lifecycle:** verify exact durations, forecast consumption, repair cancellation, recurring leak patches and deferred-event/dilemma collisions.

## Warnings

- The working tree changed while Codex was running: src/campaign/expeditions.js. The sandbox was read-only, so these are most likely concurrent edits by the main agent or a person — Codex may have reviewed an older version of those files.

## Main-agent follow-up

_Pending. The main agent records here which findings were confirmed, what was fixed, what was rejected and why, and which tests were run._
