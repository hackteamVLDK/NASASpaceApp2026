# Independent tests for Sol Plan and Fitness

| Field | Value |
|---|---|
| Record | 20261115-073832-independent-tests-for-sol-plan-and-fitness |
| Kind | tests |
| Mode | write (worktree branch `codex/independent-tests-for-sol-plan-and-fitness`, sandbox: workspace-write) |
| Started | 2026-11-15T06:38:32.712Z |
| Duration | 281 s |
| Exit status | 0 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6.1-sol |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1dded-d7cd-7fb1-946a-23f9f65a027a |
| Tokens used | 66,322 |
| Files changed by Codex | `tests/fitness.test.mjs` |
| Raw transcript | [raw/20261115-073832-independent-tests-for-sol-plan-and-fitness.log](raw/20261115-073832-independent-tests-for-sol-plan-and-fitness.log) |

## Task sent to Codex

Focus files: `SCENARIO.md`, `src/campaign/plan.js`, `tests/engine-fixes.test.mjs`

Write ONE new test file, `tests/fitness.test.mjs`, that checks the campaign engine against SCENARIO.md
sections 3.10 (Sol Plan) and 3.11 (Exercise & Fitness). Write the tests from the SCENARIO text, not from
the implementation: the point is an independent check. Edit no other file.

Run with: `node --test tests/fitness.test.mjs`. Style: `node:test` + `node:assert/strict`, like
`tests/engine-fixes.test.mjs` (read it for the helpers `readyBase` and how to advance time).

API (already implemented):
- `import { createCampaign, step, command, rates, locationAt } from '../src/campaign/engine.js'`
  `step(s, minutes)` advances Mars minutes (1 Sol = 1440). `s.minute`, Sol = floor(minute / 1440) + 1.
  A fresh campaign starts at Sol 1, 07:00. Wake Drone #01 first: `command(s, { type: 'wakeDrone', drone: 'drone-01' })`.
  If `s.pending` is set, the game waits: answer with `command(s, { type: 'choose', choice: 'a' })`.
- `s.fitness` (0..100, starts 80), `s.plan` ('balanced' | 'crunch' | 'recover'), `s.planNext`.
- `command(s, { type: 'setPlan', plan })`: refused on Sol 1; from Sol 2 it sets `planNext`, which becomes `plan` at the next midnight.
- `import { PLANS, planHours, workSpeed, fitMult, fitnessPerHour, exercisePlace, blockAt } from '../src/campaign/plan.js'`
- `import { FITNESS } from '../src/campaign/data.js'`, `import { hpCost, EXPEDITIONS } from '../src/campaign/expeditions.js'`
- `import { BADGES, buildReport } from '../src/campaign/logbook.js'` (badge `strong_bones` has `.test(s)`).
- Modules: `s.modules.recreation.status = 'online'` builds it in a fixture; `s.modules.recreation.tier = 2`.
- ASTRA lines come back from `step()` as events `{ type: 'astra', lineId }`.

Cover at least:
1. The three presets have the hours of the 3.10 preset table (sleep, work, exercise, free) and 3 meals at 06, 12, 18; every plan has 24 slots.
2. setPlan: refused on Sol 1; on Sol 2 the plan does not change until the next midnight; an unknown plan is refused.
3. Fitness loses about 10 per Sol and gains about +10 per exercise hour in the Bedroom (net about 0 with Balanced
   before Recreation exists), +20 in Recreation, +25 with Recreation Tier 2 (use a tolerance; the loss is spread over the Sol).
4. Recover (2 exercise hours) raises Fitness faster than Balanced once Recreation exists.
5. Fitness below 40: `workSpeed` x0.8; trips: `fitMult` 1.10 below 40, 1.25 at 15 or less, and never more than 1.25.
6. Crunch: work speed +22% (two Work hours above 9); Recover: -33%.
7. Fitness at 15 or less costs HP over a Sol (compare two otherwise equal fixtures).
8. ASTRA: `astra.fit.intro` at the first exercise hour, `astra.fit.mars` at the second, `astra.plan.unlock` on Sol 2,
   `astra.fit.low` once when Fitness falls below 40.
9. Strong Bones: true after 10 Sols in a row at Fitness 70 or more, false after 9.
10. While the Commander is away on a trip, he does not exercise (Fitness only falls).

If a test fails because the engine disagrees with SCENARIO, keep the test, mark it with `{ todo: 'engine differs: ...' }`
and explain in one line. Report at the end: which tests pass, which are todo and why.

## Codex response

## Summary

Added 30 scenario-based tests: **26 pass, 4 TODO, 0 failures**.

Passing checks cover presets, plan validation and midnight activation, Fitness drain and exercise gains, Recover, speed and trip penalties, critical HP loss, ASTRA triggers, badge streaks, and no exercise while away.

## Files changed

- [tests/fitness.test.mjs](/C:/Users/titov/Desktop/NASA/.codex-worktrees/independent-tests-for-sol-plan-and-fitness/tests/fitness.test.mjs) — independent checks for SCENARIO §§3.10–3.11 and Strong Bones.

## How to verify

`node --test tests/fitness.test.mjs`

Printed: `tests 30`, `pass 26`, `fail 0`, `todo 4`. Exit code **0**.

## Open questions

Four engine disagreements remain as executable TODOs:

- Fitness ≥70 gives no specified +1 Morale bonus.
- `astra.fit.intro` fires on Sol 1 instead of Sol 2.
- `astra.plan.unlock` fires at midnight instead of dawn.
- Strong Bones checks midnight Fitness, allowing dips below 70 during a qualifying Sol.

## Main-agent follow-up

_Pending. The main agent records here which findings were confirmed, what was fixed, what was rejected and why, and which tests were run._
