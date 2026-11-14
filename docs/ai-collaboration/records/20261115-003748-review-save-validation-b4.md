# Review save validation (B4)

| Field | Value |
|---|---|
| Record | 20261115-003748-review-save-validation-b4 |
| Kind | review |
| Mode | read-only (sandbox: read-only) |
| Started | 2026-11-14T23:37:48.385Z |
| Duration | 125 s |
| Exit status | 1 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6-astra |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1dc6c-9fb2-7861-a132-4048bbe93cf4 |
| Tokens used | 102 |
| Working-tree changes during run | none |
| Raw transcript | [raw/20261115-003748-review-save-validation-b4.log](raw/20261115-003748-review-save-validation-b4.log) |

## Task sent to Codex

Focus files: `src/campaign/save-migrate.js`, `tests/save-validate.test.mjs`

# Review task: save validation (docs/ERRORS.md B4 / D-T9), read-only

You are reviewing a fix in a browser game (plain ES modules, Node 20+ for tests; no DOM in the files below).

## What changed
- `src/campaign/save-migrate.js`: `restoreSave(saved)` now checks a saved game before "Continue" loads it:
  1. `validateState(state)`: shape of rooms (modules), drones, drone jobs/queues, tasks, timers, modifiers, the pending card, the trip (`away`), the Workshop job, items/kits and more, plus references between them (a job must name a real room);
  2. numbers: a meter that is not a finite number is reset (progress is kept);
  3. a dry run: the restored state is cloned and plays one Sol (`step(probe, 1440)`, after answering a pending card) inside try/catch; any throw refuses the save.
  `restoreSave` must never throw; it returns `{ ok: true, state, upgraded }` or `{ ok: false, reason, newer? }`.
- `tests/save-validate.test.mjs`: snapshots of random games must load back unchanged; 47 hand-made damages; a prototype-pollution check; 400 random damages.
- `src/main.js` (boot, search for `restoreSave`): a refused save (except one from a NEWER build) is copied to `ares-kids-save-v1-damaged` and removed from the main key.
- The state shape is `createCampaign()` in `src/campaign/engine.js`; jobs are created in `startJob` (engine.js) and `droneChore` (story.js); tasks by `addTask` (story.js); `s.away` by `startExpedition` (expeditions.js).

## What I want from you
1. **False refusals**: find a VALID save (one the game itself can produce) that `restoreSave` refuses. Read every place in `src/campaign/*.js` that writes to `s.tasks`, `s.timers`, `s.mods`, `s.pending`, `s.away`, `s.crafting`, `s.order`, `s.medRest`, `s.storm`, `s.items`, `s.kits`, `s.mult`, drone `task`/`queue`. A whitelist that is too narrow is the main risk (one such bug was already found: `wheel_vacuum` is a task too).
2. **Missed damage**: find a damaged save (one changed value at any path, in a JSON copy of a real mid-game state) that `restoreSave` ACCEPTS but that makes `step()`, `command()` or the UI code in `src/ui/campaign-ui.js` / `src/ui/extras.js` / `src/render/campaign-world.js` throw later than the one simulated Sol (for example something that only matters during a trip, a card, a craft, a story timer, Sol 15+, or when drawing). Give a minimal reproduction.
3. **Dry-run side effects**: does `step(probe, ...)` or `command(probe, ...)` touch anything outside the cloned state (module-level caches, `Date.now`, `Math.random`)?
4. **Data loss**: look at the main.js logic around `restoreSave` (copy to `-damaged`, remove the main key). Any path where a player loses a save that could still be loaded, or where `setItem` of a null value writes the string "null"?
5. **Test weaknesses**: what would a wrong or lazy implementation still pass?

Run small throwaway scripts with `node -e` or `node --input-type=module -e` to reproduce things; do not write files in the repository. Report numbered findings, each with: severity (high/medium/low), a minimal reproduction or the exact lines, and a suggested fix. If you find nothing for a point, say so and say what you tried.

## Codex response

_Codex returned no final message._

## Errors

```text
✔ building follows the unlock chain and costs (3.3), takes 2 Sols with one drone, and needs a drone (23.2308ms)
✔ the scenario unlock order: Battery -> Workshop -> Greenhouse -> Garage -> Lab (+ Dish Antenna) -> Recreation, Roof (0.2593ms)
✔ Sol 1 plays out as the story says: dusk lines, heat warning task, first sleep (13.6194ms)
✔ Dilemma 1 appears at the end of Sol 3 and pauses the game; every choice has its follow-up (149.0817ms)
✔ Dilemma 1 choice C drains the battery on Sol 6: power emergency, morale -10 (scripted) (32.5989ms)
✔ the scripted dust storm runs Sols 4-6 and leaves a Static Wipe task (19.843ms)
✔ crafting needs the Workshop; the Repair Kit wakes Drone #02 and ends Act I (6.1669ms)
✔ expedition HP costs match the scenario table (3.6): 17, 17, 21, 19, 12 (0.3142ms)
✔ expedition 1: launch needs the Garage, costs 2 Water, streams radio lines, returns loot (7.4498ms)
✔ expedition 2 stops at 60% for the radio decision; A takes longer, B costs 5 HP (19.2564ms)
✔ expedition requirements follow 5.2 (0.2749ms)
✔ HP: a night in the Bedroom restores about 11 HP net (3.6) (7.9455ms)
✔ SCENARIO rule (hpZeroEndsRun off): HP 0 sends the Commander to Med-Rest for a Sol, then back at 50 HP (6.2028ms)
✔ oxygen 0 raises an emergency and the mini-game restores it (0.5243ms)
✔ the mini-game rewards: +2 Spare Parts per win, the explanation only the first time (0.1062ms)
✔ upgrades and recipes reference real strings and items (0.109ms)
✔ same seed and commands give the same game (deterministic) (41.955ms)
✔ no meter ever goes NaN or negative over 30 idle Sols; the clock is right (114.3199ms)
✔ Drone Link: a busy drone keeps up to 2 jobs waiting and starts them by itself (7.5031ms)
✔ a queued job that cannot start (not enough parts) is dropped with a note, not stuck (8.8588ms)
✔ an order sends the Commander to a finished room for a while; unfinished rooms are refused (1.056ms)
✔ ASTRA warns about HP once per drop and celebrates a full recovery (0.4825ms)
✔ a current save loads unchanged (20.3051ms)
✔ an older save gets the missing fields and keeps what the player had (9.6859ms)
✔ broken, finished or newer saves are refused with a reason (0.3326ms)
✔ B11: after Dilemma 3 A or C the soil can be washed later from the Lab (22.7789ms)
ℹ tests 34
ℹ suites 0
ℹ pass 34
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1677.6857

ERROR: You’ve hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/settings/usage to purchase more credits or try again at 12:59 AM.
ERROR: You’ve hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/settings/usage to purchase more credits or try again at 12:59 AM.
tokens used
102 627

```

## Main-agent follow-up

_Pending. The main agent records here which findings were confirmed, what was fixed, what was rejected and why, and which tests were run._
