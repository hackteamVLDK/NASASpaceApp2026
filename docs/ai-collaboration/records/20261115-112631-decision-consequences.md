# Decisions that change the game

| Field | Value |
|---|---|
| Record | 20261115-112631-decision-consequences |
| Kind | simulation |
| Mode | write (worktree branch `codex/decision-consequences`, sandbox: workspace-write) |
| Started | 2026-11-15T10:26:31.951Z |
| Duration | 1097 s |
| Exit status | 0 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6.1-sol |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1debe-9489-7800-b82a-4fa7b05ec521 |
| Tokens used | 148,943 |
| Files changed by Codex | `src/campaign/expeditions.js`, `src/campaign/story.js`, `tests/strings-emitted.test.mjs`, `src/campaign/choices-data.js`, `tests/choices.test.mjs` |
| Raw transcript | [raw/20261115-112631-decision-consequences.log](raw/20261115-112631-decision-consequences.log) |

## Task sent to Codex

Focus files: `SCENARIO.md`, `AGENTS.md`, `src/campaign/story.js`, `src/campaign/expeditions.js`, `docs/ERRORS.md`

# Shared contract for the gameplay batch (5 parallel tasks)

Repository: ARES-KIDS, a browser Mars-base game for children 7-12 (plain ES modules, no build, no deps, Node 20+).
Read AGENTS.md first. `src/campaign/` is the pure deterministic engine (no DOM, no Date.now, no Math.random:
use the campaign's seeded RNG the way story.js / expeditions.js already do). Every tunable number lives in a
named constant with a provenance comment (`gameplay` / `approximation` / `nasa-measurement`). New behaviour
needs tests (`node --test`). Run `npm test` before you finish: everything must pass (baseline: 372 tests,
371 pass, 1 todo). Five tasks run in parallel in separate worktrees: edit ONLY the files your task owns.
Other tasks' modules do not exist in your worktree; code against the interfaces below, never create stubs
for them (the main agent integrates).

The team lead (Mykhailo) asked for three changes. SCENARIO.md is the binding scenario and says the opposite
on some points ("No death, no Game Over", "no lose state", empty meters never cost HP). The lead decided to
override that. So: follow this contract where it conflicts with SCENARIO.md, keep everything else in line
with SCENARIO.md, and list every deviation from SCENARIO.md in your final report. Do not edit SCENARIO.md.

Player-facing text: plain English for kids, short. ASTRA 6.7 voice: calm, never scary, no words like death,
die, dying, kill, doom, "you failed"; praise effort, explain consequences calmly, never wrong about science.
Losing a life is told as "the Commander is worn out, the rescue team takes over and we go back to the last
decision", never as dying. Any science fact must be true and simple.

New ASTRA/UI line IDs that are not in SCENARIO.md: the module that emits them exports
`export const STRINGS = Object.freeze({ 'astra.xxx.yyy': 'English text', ... })`. The main agent merges
these into the string table (content/data/strings.en.json is generated from SCENARIO.md: never edit it).
ASTRA lines are emitted as `{ type: 'astra', lineId, mood }` like the existing code.

## The three features

1. Decisions change the game a lot (task B).
2. You can lose (task A): 3 lives; a checkpoint is taken whenever a decision appears; when the Commander's
   HP hits 0 a life is lost and the game rewinds to the last checkpoint (the decision card is open again);
   when the last life is lost: Game Over (the existing `endRun` / Game Over screen). Empty life-support
   meters now hurt HP, so neglect can really lose a life.
3. Something to do while rooms are being built (tasks C, D2): a job board with short active jobs.

## Interfaces (names are fixed; all tasks rely on them)

### Engine state (task A adds, everyone may read)
- `s.lives` (number, starts at `LIVES.start` = 3), `s.livesMax` (3)
- `s.checkpoint` = `{ sol, minute, label, kind, id, snap }` or null. `label` is short English for the UI
  (e.g. "The Dust Storm decision", "Mission start"). `snap` is the JSON string of the state taken when the
  decision card appeared (without the `checkpoint` field itself).
- `s.stats.livesLost` (number)
- Events: `{ type: 'life-lost', livesLeft, reason: 'hp' | 'trip', checkpoint: { sol, label } }`,
  `{ type: 'rewind', sol, label }` (emitted right after the state was restored), existing
  `{ type: 'gameover', reason, sol }` when the last life is gone.
- Restoring is done IN PLACE on the same object `s` (the UI keeps a reference to it).

### Decisions (task B adds)
- `src/campaign/choices-data.js` exports `choicePreview(pendingId, choice)` -> array of 1-3 short English
  strings (max ~8 words each) that tell the player what the choice will change, now and later
  (e.g. ["Power +40 now", "HP -10 now", "Batteries wear out faster"]). Unknown id -> [].
- `s.path` = `{ [pendingId]: choice }` record of every decision made (also kept in `s.choices` as today).

### Jobs (task C adds the engine side, D2 the UI side)
- `src/campaign/jobs.js` exports:
  - `jobFields()` -> `{ job: null, jobCooldowns: {}, jobStats: { done: 0, assists: 0 } }` (main agent merges
    it into createCampaign and save migration)
  - `jobBoard(s)` -> array of `{ id, title, text, science, game, reward, hours, block, module }`:
    `id` e.g. `'assist:workshop'`, `'scrap_hunt'`; `game` = the mini-game id to open; `reward` = short
    English ("Build +25%", "Spare Parts +6 to 10"); `block` = null or a short English reason it cannot
    start now (cooldown with time left, needs a room, storm, night, busy...). Ordered: assists first.
  - `jobCommand(s, cmd, emit)` handles `{ type: 'startJob', job }` and `{ type: 'jobResult', job, win }`;
    returns `{ ok: true }` / `{ ok: false, error }`, or `null` when `cmd.type` is not a job command.
  - `stepJobs(s, emit, now)` called every engine minute (clears a job left open for more than 2 h).
  - `jobBuildMult(s)` -> multiplier (>= 1) for drone build/upgrade speed from the drone tune-up job.
  - `STRINGS` for any ASTRA lines it emits.
  - Events: `{ type: 'job-start', job, game }`, `{ type: 'job-done', job, win, reward }`.
- Job mini-games: `bolt_sprint` (help build), `scrap_hunt` (look for useful scrap near the base),
  `sample_scan` (Lab microscope). Existing games may also be reused by a job, e.g. `nutrient_match`
  (greenhouse) or `wheel_vacuum` (drone tune-up).
- UI side: `src/ui/jobs-panel.js` exports `createJobsPanel({ s, send, openMini, jobBoard })` ->
  `{ el, update() }`. A Start button sends `{ type: 'startJob', job: id }`; if `ok`, it calls
  `openMini(game, { job: id })`. The main agent routes the mini-game result to `{ type: 'jobResult', job, win }`.
- `src/ui/mg-jobs.js` exports `hasJobMini(game)` and `startJobMini(game, opts)` with the SAME signature and
  return value as `startMini2` in src/ui/minigames2.js.

# YOUR TASK: B. Decisions that really change the game

You own: src/campaign/story.js, src/campaign/expeditions.js, src/campaign/choices-data.js (new),
tests/choices.test.mjs (new). You may edit an EXISTING test only where it asserts an old dilemma effect you changed
on purpose; list each such edit with the reason. Do not touch engine.js, data.js, src/ui, main.js. If you need a new
constant, put it in choices-data.js (with provenance) instead of data.js.

Today the dilemmas (d1-d5), events (e1-e3) and Rover radio decisions mostly give a small one-off change, so the
game plays almost the same whatever the player picks (see docs/ERRORS.md C7: ignoring things changes nothing).
Read SCENARIO.md Section 6 (dilemmas and events) and `applyChoice` / `runTimer` in story.js and the radio
decisions in expeditions.js.

Goal: every choice must shape the rest of the run in a way the player can feel and plan around. For EACH choice of
d1-d5 and e1-e3 (and the radio decisions where it fits) keep its immediate SCENARIO effect, and add:
1. A lasting consequence (at least 5 Sols, or for the rest of the run) that changes what the player can do or must
   do, not just a number. Good kinds: unlock or lock a room, an upgrade, an expedition, a recipe or a shortcut; a
   resource rate changed by 20-40%; a new recurring chore/mini-game task; a drone busy or freed; a risk that can
   cost HP (it can now cost a life: task A makes HP 0 lose a life and rewind to this decision).
2. A callback 2-5 Sols later: an ASTRA line (and an effect) that names the earlier choice ("Remember when we
   chose to call Earth? ..."), so the player sees the link between choice and result.
3. Choices must be real trade-offs: no strictly best option; a safe choice costs time or resources, a bold choice
   risks HP or a system. Every path must still be finishable: the existing strategy tests (always A, always B,
   always C) must still reach the finale. Keep the science true (SCENARIO texts explain the real science; keep them).
4. `s.path[pendingId] = choice` for every decision.
5. choices-data.js: the constants of all new effects (provenance `gameplay`), `choicePreview(id, choice)` (short
   lines: the immediate effect AND the lasting one, e.g. ["Power +40 now", "HP -10", "Battery wears: -20% for 6 Sols"]),
   and `STRINGS` for every new ASTRA line (voice rules in the contract; each callback line under ~25 words).
6. Tests: each choice's lasting effect and callback happen (and do not happen for the other choices); previews
   exist for every choice of every dilemma/event; run `node tools/balance/strategy-lab.mjs` and report, per strategy,
   finale Sol and stars, before and after. The strategies that pick different choices should now end differently
   (different finale Sol, rooms, stars or Research). Report that table.

Report: a table "decision / choice / lasting effect / callback" (this is the design the team will read), files,
real test numbers, strategy table, and every deviation from SCENARIO.md.

## Codex response

## Summary

Implemented lasting consequences and callbacks for all **28 dilemma, event, and radio options**, preserving existing immediate effects. Added previews, decision paths, recurring upkeep, save compatibility, and 67 tests.

All effects below last **6 Sols**. Each callback explicitly recalls the choice and grants the listed reward after **3 Sols**. SP means Spare Parts.

| Decision | Choice | Lasting effect | Callback |
|---|---|---|---|
| d1 | A | Room power use −20%; Workshop SP −20% | Power Saver: Morale +4 |
| d1 | B | Solar +20%; recurring wipes, −6 Power/Sol while pending | Tilted panels: SP +4 |
| d1 | C | Research +30%; Workshop SP −30% | Battery study: Research +5 |
| d2 | A | Recycler water loss −30%; Workshop SP −20% | Filter checks: Water +8 |
| d2 | B | Scrap Run SP +40%; Water −3/Sol | Cargo Trailer: SP +8 |
| d2 | C | Recycler water loss −30%; Greenhouse Food −20% | Rationing: Water +10 |
| d3 | A | Research +30%; Greenhouse Food −20% | Soil experiment: Research +8 |
| d3 | B | Research +20%; Water −2/Sol; existing permanent Soil Beds retained | Washed beds: Food +8 |
| d3 | C | Greenhouse Food +20%; its power use +30% | Hydroponics: Food +8 |
| d4 | A | Greenhouse Food +30%; Research −30% | Warm plants: Food +10 |
| d4 | B | Research +40%; Lab power use +30% | Earth advice: Research +10 |
| d4 | C | Greenhouse power use −20%; drone occupied ¼ Sol every 2 Sols | Shared warmth: Power +15 |
| d5 | A | Future trips −20% duration; Scrap Run SP −20% | Lighter travel: SP +6 |
| d5 | B | Travel HP-loss rate −30%; trips +20% duration | Covered stops: Research +8 |
| d5 | C | Scrap Run SP +40%; travel HP-loss rate +20% | Extra collecting: SP +10 |
| e1 | A | Travel HP-loss rate −20%; Workshop SP −20% | Shelter practice: Food +6 |
| e1 | B | Workshop SP +40%; recurring seal checks, −4 HP/Sol while pending | Continued work: SP +6 |
| e1 | C | Research +30%; drone occupied ¼ Sol every 2 Sols | Forecast records: Research +8 |
| e2 | A | Scrap Run SP +30%; travel HP-loss rate +20% | New collecting spots: SP +6 |
| e2 | B | Solar −20%; travel HP-loss rate −30% | Sheltered setup: Power +15 |
| e2 | C | Solar +20%; recurring wipes, −8 Power/Sol while pending | Panel tilts: Power +15 |
| e3 | A | Life Support Oxygen +20%; Workshop SP −20% | Tested seals: Oxygen +10 |
| e3 | B | Scrap Run SP +30%; recurring valve checks, −2 Water/Sol while pending | Saved time: SP +6 |
| e3 | C | Recycler water loss −30%; trips +20% duration | Airlock checks: Water +10 |
| Expedition 2 radio | A | Travel HP-loss rate −20%; trips +20% duration | Careful route: Research +6 |
| Expedition 2 radio | B | Scrap Run SP +30%; travel HP-loss rate +20% | Direct route: SP +8 |
| Expedition 3 radio | A | Ice Runs gain one core; Power −4/Sol | Ice survey: Water +10 |
| Expedition 3 radio | B | Trips −20% duration; Scrap Run SP −20% | Lighter load: Power +15 |

Authorized deviations from SCENARIO.md:

- The table adds consequences, upkeep, rewards, and dialogue beyond Section 6’s specified outcomes.
- Choice modifiers change Sections 3–5’s resource budgets, expedition durations, HP costs, and repeatable loot. The special one-Sol Delta return remains unchanged.
- Pending seal checks can drain HP, following the lead’s override of the guarantee that choices cannot end a run.
- Numeric previews follow the delegated contract, overriding Section 6’s “No exact numbers” presentation rule.
- SCENARIO.md and its generated strings were not edited.

## Files changed — one line each with the reason.

- [story.js](/C:/Users/titov/Desktop/NASA/.codex-worktrees/decision-consequences/src/campaign/story.js): applies lasting effects, callbacks, paths, and recurring upkeep.
- [expeditions.js](/C:/Users/titov/Desktop/NASA/.codex-worktrees/decision-consequences/src/campaign/expeditions.js): applies route/cargo consequences and records radio choices.
- [choices-data.js](/C:/Users/titov/Desktop/NASA/.codex-worktrees/decision-consequences/src/campaign/choices-data.js): defines gameplay constants, previews, and callback strings.
- [choices.test.mjs](/C:/Users/titov/Desktop/NASA/.codex-worktrees/decision-consequences/tests/choices.test.mjs): adds 67 branch, callback, persistence, maintenance, and strategy tests.
- [strings-emitted.test.mjs](/C:/Users/titov/Desktop/NASA/.codex-worktrees/decision-consequences/tests/strings-emitted.test.mjs): extends its old scenario-only string registration to include the new callback effects; existing assertions remain intact.

## How to verify — exact commands and what they printed for you.

- `npm test` — **439 tests, 438 pass, 0 fail, 1 existing Fitness todo**.
- `node --test tests/choices.test.mjs` — **67 pass, 0 fail**.
- `node --test tests/choices.test.mjs tests/save-validate.test.mjs tests/strings-emitted.test.mjs` — **73 pass**, including 600 damaged-save cases.
- `git diff --check` — no output.
- `node tools/balance/strategy-lab.mjs` — eight seeds per strategy, 30 Sols; before/after results:

| Strategy | Finale Sol before → after | Stars before → after |
|---|---|---|
| recommended | 19–22 → 19–21 | 8 → 8 |
| idle | — → — | 3 → 3 |
| idle-c | — → — | 3 → 3 |
| no-minigames | 21–24 → 21–23 | 4–7 → 5–8 |
| ignore-minigames | 20–23 → 20–21 | 8 → 7–8 |
| build-only | — → — | 6 → 6 |
| no-expeditions | — → — | 6 → 6 |
| rush | 18–20 → 17–19 | 5–6 → 5–6 |
| trip-spam | 19–21 → 19–21 | 8 → 8 |
| hoard | — → — | 4–5 → 5 |
| always-b | 21–23 → 20–22 | 8 → 8 |
| always-c | 20–25 → 19–24 | 8 → 8 |
| cheat-minispam | — → — | 3 → 3 |
| cheat-heatspam | — → — | 3 → 3 |

All **24/24 A/B/C runs finished**. Seed 1 details from `node tools/balance/strategy-lab.mjs --only recommended,always-b,always-c --seeds 1 --verbose`:

| Path | Finale Sol before → after | Research before → after |
|---|---|---|
| A | 19 → 19 | 137 → 128 |
| B | 22 → 21 | 126 → 174 |
| C | 21 → 20 | 129 → 134 |

## Open questions

No design blockers. Integration needs:

- Merge exported `STRINGS` and connect `choicePreview()` to decision cards.
- Initialize `s.path = {}` in campaign creation/migration; this patch initializes it on the first decision.
- Display Research modifiers in Resources. They already apply through `storyMinute`; avoid applying them twice.
- Rerun strategies after task A’s lives and empty-meter HP penalties are integrated.

No commits or branch changes were made.

## Main-agent follow-up

_Pending. The main agent records here which findings were confirmed, what was fixed, what was rejected and why, and which tests were run._
