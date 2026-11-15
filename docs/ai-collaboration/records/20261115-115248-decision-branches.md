# Structural decision branches

| Field | Value |
|---|---|
| Record | 20261115-115248-decision-branches |
| Kind | simulation |
| Mode | write (worktree branch `codex/decision-branches`, sandbox: workspace-write) |
| Started | 2026-11-15T10:52:48.809Z |
| Duration | 1454 s |
| Exit status | 0 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6.1-sol |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1ded6-a336-7900-a3a0-045ebcc0a06b |
| Tokens used | 213,307 |
| Files changed by Codex | `src/campaign/choices-data.js`, `src/campaign/data.js`, `src/campaign/engine.js`, `src/campaign/expeditions.js`, `src/campaign/story.js`, `tests/branches.test.mjs` |
| Raw transcript | [raw/20261115-115248-decision-branches.log](raw/20261115-115248-decision-branches.log) |

## Task sent to Codex

Focus files: `SCENARIO.md`, `AGENTS.md`, `src/campaign/story.js`, `src/campaign/choices-data.js`, `src/campaign/engine.js`

# Task B2: make decisions change the game STRUCTURALLY (second pass)

Repository: ARES-KIDS, a browser Mars-base game for children 7-12 (plain ES modules, Node 20+, `npm test`).
Read AGENTS.md. `src/campaign/` is pure and deterministic (seeded RNG only, no DOM, no Date.now / Math.random).
Every tunable number is a named constant with a provenance comment (`gameplay`). New behaviour needs tests.
Run `npm test` before you finish (now: 520 tests, 519 pass, 1 todo); everything must still pass.

You own: src/campaign/story.js, src/campaign/expeditions.js, src/campaign/choices-data.js, src/campaign/engine.js,
src/campaign/data.js, tests/choices.test.mjs, tests/branches.test.mjs (new). You may edit another existing test only
where it asserts an old effect you changed on purpose; list each such edit. Do not touch src/ui, src/render, main.js.

## Where we are
The team lead asked: "decisions must REALLY, very strongly steer your gameplay". A first pass (already merged, see
`choices-data.js`, `applyChoice` in story.js, tests/choices.test.mjs) gave every choice of d1-d5, e1-e3 and the Rover
radio decisions a 6-Sol rate modifier (+-20-40%) and a callback 3 Sols later. Measured result: the paths still play
almost the same (strategy lab always-A / always-B / always-C: finale Sol within ~1 Sol, same 8 stars, same rooms).
Numbers alone are not enough. Also merged: 3 lives with a checkpoint at every decision (src/campaign/lives.js; HP 0
costs a life and rewinds to the last decision), and empty Oxygen/Heat/Water/Food now drain HP. So a risky branch can
really cost a life now, and that is allowed (but every path must stay winnable for a careful player).

## Goal: branches the player can SEE and must PLAN around
For each of d1, d2, d3, d4 and e1, e2, e3, keep the immediate SCENARIO effect, keep or simplify the first-pass
modifier, and give at least TWO of its three choices a structural consequence from this menu (mix them; no two
decisions should feel the same):
1. A follow-up decision card that only this choice leads to, 1-3 Sols later: a new dilemma with id `f1`, `f2`, ...
   (kind 'dilemma', 3 choices a/b/c, started with `startPending` like the others). The UI already renders any pending
   dilemma from these string keys, which you must export in `STRINGS` (choices-data.js): `ui.<id>.header` (short caps
   like "FOLLOW-UP"), `ui.<id>.title`, `astra.<id>.alert` (the card body: ASTRA explains the situation, 1-3 short
   sentences, names the earlier choice), `ui.<id>.a.label`, `ui.<id>.b.label`, `ui.<id>.c.label`. Give `choicePreview`
   lines for them too, and use `choiceBlock` for choices that need resources. Follow-ups apply their own effects.
2. Something opens or closes: a room build or an upgrade becomes available earlier / cheaper, or blocked until a
   repair (block reasons are shown to the player through `unlockReason` in engine.js: add your condition there with a
   clear kid-friendly reason); an expedition opens earlier or is closed until something is done; a recipe needed.
3. Damage that must be repaired: e.g. a battery cell cracked (power cap -30% until the player crafts/does a repair
   task), a drone knocked dormant (needs a Repair Kit), a mini-game task that keeps coming back every 2 Sols until
   a Workshop repair. The player must act or keep paying.
4. A different later situation: e.g. the next storm or flare hits harder or softer; a crew/drone helper appears
   only on one path; a bonus Logbook card / badge only on one path; the finale needs one more or one less step.
Keep the science true and simple (SCENARIO.md's own explanations are correct; reuse them). ASTRA voice: calm, never
scary, no death/dying words, praise effort, explain consequences. Each new line under ~30 words.
There must be no strictly best choice: a safe choice costs time or resources; a bold one risks HP, a system or a
life. A careless player on a bold path can lose a life; a careful one can always recover.

## Proof (put the numbers in your report)
- tests/branches.test.mjs: each structural consequence happens on its choice and not on the others; each follow-up
  card appears only on its path, can be answered, and its effects apply; every block has a way out (repair/craft).
- `node tools/balance/strategy-lab.mjs` (read its header): recommended, always-b, always-c must still reach the
  finale in 8/8 runs; and the always-A/B/C paths must now differ clearly: finale Sol spread of 3+ Sols between
  paths OR different rooms/T2/cards/badges, and at least one path where a sloppy strategy loses a life. Report a
  before/after table. If the lab has no always-a strategy, compare recommended (mostly A) with always-b and always-c.
- `npm test` all green.

## Report
1. A design table: decision / choice / immediate (SCENARIO) / structural consequence / follow-up card (if any).
   The team will read this to update SCENARIO.md, so be precise.
2. Files changed, real test numbers, the strategy table, every deviation from SCENARIO.md.

## Codex response

## Summary

Implemented structural consequences for **14 choices across all seven requested decisions**, including eight exclusive follow-up cards. Immediate scenario effects remain intact.

| Decision | Choice | Immediate scenario effect | Structural consequence | Follow-up |
|---|---|---|---|---|
| d1 | A | Save Power; lose Morale | Recreation opens once Workshop is online | — |
| d1 | B | +40 Power, −10 HP | Motor inspection trades parts, power/time, or Morale | f1, +1 Sol |
| d1 | C | No immediate change | Existing Sol-6 emergency retained | — |
| d2 | A | −12 SP; Water Sort | Roof opens after Garage, before Lab | — |
| d2 | B | −12 SP; cracked recycler | Scrap Runs require trailer balancing; original Expedition-1 bonus retained | f2, +1 Sol |
| d2 | C | Ration water | Existing rationing and automatic repair retained | — |
| d3 | A | −10 Water | Greenhouse upgrades wait for test-tray resolution | f3, +2 Sols |
| d3 | B | −20 Water; drone occupied | Permanent Soil Beds retained | — |
| d3 | C | No immediate cost | Choose lamp wiring, heat repair, or remove extra trays | f4, +1 Sol |
| d4 | A | −5 Morale; postpone Earth contact | Canyon requires a route plan | f5, +1 Sol |
| d4 | B | Antenna task; call rewards and cold-plant consequences | Canyon requires calibration or timed map checking | f6, +1 Sol |
| d4 | C | Move trays; temporary food reduction | Existing drone chores retained | — |
| e1 | A | Shelter costs retained | Existing modifiers retained | — |
| e1 | B | Location-dependent HP loss | Recurring seal checks; skipped checks add −24 HP/Sol until Workshop T2 repairs | — |
| e1 | C | −1 HP | Parts or testing can enable forecasts before Lab T2 | f7, +1 Sol |
| e2 | A | Existing solar coin flip | Existing modifiers retained | — |
| e2 | B | Half solar output for remaining Sol | Solar Wipe required before Scrap Runs or solar upgrades | — |
| e2 | C | −5 HP; solar boost | Recurring wipes; skipped checks add −18 Power/Sol until Workshop T2 repairs | — |
| e3 | A | Valve repair task | Repair gates roof construction and expeditions 4/5 | — |
| e3 | B | −1 SP; temporary tape patch | Choose lasting repair, airlock closure, or continued checks | f8, +3 Sols |
| e3 | C | Airlock/drone occupied for one Sol | Existing closure retained | — |

Follow-ups wait while away or another card is pending.

| Card | A | B | C |
|---|---|---|---|
| f1 | −8 SP | −20 Power; travel/solar upgrades paused 1 Sol | −3 Morale |
| f2 | −8 SP + Wheel Vacuum | Scrap Runs closed 2 Sols | −3 Morale; cancel extended scrap/water-use plan |
| f3 | −5 Water + Nutrient Match | −20 Water; Soil Beds after 2 Sols | −5 Morale, +8 Research; compost |
| f4 | −10 SP, +5 Research | Heat Pump repair gates farm expansion | +5 Research; cancel extra-tray plan |
| f5 | Canyon opens after 1 Sol | Opens after 3 Sols; +15 Research | −15 Food; opens immediately |
| f6 | −12 SP + Antenna Alignment | Opens after 4 Sols; +20 Research | −8 HP; opens after 2 Sols |
| f7 | −6 SP; enable forecasts | Lab upgrades paused 2 Sols, then forecasts enabled | +8 Research; cancel forecast plan |
| f8 | −8 SP + Valve Balance | Travel closed 2 Sols; leak stops immediately | Recurring valve checks; skipped checks add −6 Oxygen/Sol until Workshop T2 |

All f1 answers end the extended solar plan. Every card has a free answer.

**Before/after strategy results:** eight seeds, 30-Sol limit.

| Strategy | Finale runs before → after | Finale Sol before → after | Rounded mean cards before → after |
|---|---:|---:|---:|
| Recommended | 8/8 → **8/8** | 19–21 → **19–27** | 47 → 48 |
| Always-B | 8/8 → **8/8** | 20–22 → **20–27** | 48 → 47 |
| Always-C | 8/8 → **8/8** | 19–24 → **19–24** | 47 → 47 |

Matched seed 2 finishes on Sol **27 / 25 / 20**, a **seven-Sol spread**. Cards are **48 / 48 / 47**; badges **10 / 12 / 12**.

A controlled e1-B test loses **one life** when seal checks are ignored. Maintaining the same stocked base loses **zero lives** and finishes at **100 HP**.

**Scenario deviations:** the tables describe new Section-6 extensions: early unlocks, gates, forecasts, upkeep, follow-up costs and timings. Some follow-up answers deliberately end first-pass modifiers early. `SCENARIO.md` was not edited; no existing immediate scenario effect was changed.

## Files changed — one line each with the reason.

- [story.js](src/campaign/story.js): Follow-up scheduling, structural gates, repairs, upkeep, forecasts and defensive save handling.
- [choices-data.js](src/campaign/choices-data.js): Follow-up strings, previews and recovery explanations.
- [data.js](src/campaign/data.js): Named gameplay constants for new costs, delays and penalties.
- [engine.js](src/campaign/engine.js): Early build unlocks and upgrade gate enforcement.
- [expeditions.js](src/campaign/expeditions.js): Consistent map, launch and finale restrictions.
- [branches.test.mjs](tests/branches.test.mjs): 33 new tests covering exclusivity, effects, recovery, persistence and strategy outcomes.

No existing tests were edited. No commits were made.

## How to verify — exact commands and what they printed for you.

- `npm test` — **553 tests; 552 pass; 0 fail; 1 existing TODO**.
- `node --test tests/branches.test.mjs tests/choices.test.mjs` — **100 tests; 100 pass; 0 fail**.
- `node --test tests/save-validate.test.mjs` — **5 tests; 5 pass**, including 600 random corruption cases.
- `node tools/balance/strategy-lab.mjs` — recommended, always-B and always-C each printed **8/8** finale completion.
- `git diff --check` — no output.

## Open questions

None blocking integration. The main agent should incorporate the new branch tables into `SCENARIO.md`.

The existing Fitness/Morale conflict remains the single TODO. Blocked upgrade commands explain their restriction after clicking; existing upgrade buttons retain their appearance.

## Main-agent follow-up

_Pending. The main agent records here which findings were confirmed, what was fixed, what was rejected and why, and which tests were run._
