# Lives, checkpoints, rewind and danger

| Field | Value |
|---|---|
| Record | 20261115-112622-lives-checkpoints |
| Kind | simulation |
| Mode | write (worktree branch `codex/lives-checkpoints`, sandbox: workspace-write) |
| Started | 2026-11-15T10:26:22.707Z |
| Duration | 838 s |
| Exit status | 0 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6.1-sol |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1debe-7292-7901-8270-fb79d9a95866 |
| Tokens used | 138,037 |
| Files changed by Codex | `src/campaign/data.js`, `src/campaign/engine.js`, `src/campaign/save-migrate.js`, `tests/campaign-fuzz.test.mjs`, `tests/emergency-cost.test.mjs`, `tests/gameover.test.mjs`, `src/campaign/lives.js`, `tests/lives.test.mjs` |
| Raw transcript | [raw/20261115-112622-lives-checkpoints.log](raw/20261115-112622-lives-checkpoints.log) |

## Task sent to Codex

Focus files: `SCENARIO.md`, `AGENTS.md`, `src/campaign/engine.js`, `src/campaign/data.js`

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

# YOUR TASK: A. Lives, checkpoints, rewind, Game Over, and real danger

You own: src/campaign/lives.js (new), src/campaign/engine.js, src/campaign/data.js, src/campaign/save-migrate.js,
tests/lives.test.mjs (new). You may also edit an EXISTING test file only where an assertion checks the old
one-life rule or the old "empty meters never cost HP" rule (tests/gameover.test.mjs, strategy or balance tests);
list every such test edit in your report with the reason. Do not touch story.js, expeditions.js, src/ui, src/render, main.js.

Today: `RULES.hpZeroEndsRun: true` in data.js ends the run at HP 0 (see `endRun`, `endsRunAtZeroHp`, `stepHp`,
and the trip branch in `tick`). `false` follows SCENARIO (Med-Rest, rescue drone). Keep the `false` mode working
exactly as now (no lives, no HP drain from empty meters).

Build, in lives mode (`hpZeroEndsRun` true):
1. `LIVES` constants in data.js (`gameplay`): start 3, restoreHpMin 60 (after a rewind HP is at least this, so the
   player is not dropped into an instant second loss), and the HP drain per Sol while a meter is at 0 in the base:
   oxygen 60, heat 30, water 30, food 20 (sum when several are empty). Not while the Commander is away on a trip.
   Name these clearly; they are `gameplay` values.
2. lives.js: `takeCheckpoint(s, label, kind, id)`, `loseLife(s, emit, reason)` and `STRINGS`. Checkpoint = when a
   decision appears: in `step()`, after a tick, if `s.pending` is set and differs from the pending the last
   checkpoint was taken for, take a checkpoint (the snapshot includes the open card, so a rewind shows the same
   decision again). Also take a 'Mission start' checkpoint in createCampaign, and if a running game has no
   checkpoint (an old save) take one on the first step. Labels: readable English ("The Dust Storm decision",
   "A radio call from the Rover", "Mission start"); look at how dilemmas/events/radio are named in story.js /
   SCENARIO.md; keep it simple (a small id -> label map plus a fallback "The last decision").
3. HP 0 in the base or on a trip -> `loseLife`: lives -= 1, `stats.livesLost` += 1. If lives left > 0: restore the
   snapshot in place (delete own keys, assign parsed snapshot), then keep: lives, livesMax, stats.livesLost,
   the checkpoint itself; set hp = max(hp, restoreHpMin); emit `life-lost` then `rewind` and an ASTRA line
   (`astra.lives.rewind`, calm: the Commander is worn out, the rescue team took over, let's go back to the last
   decision and try another way; and a hint to watch Oxygen/Heat/HP). If no lives left: `endRun` as today (Game Over).
   Note step() stops while `s.pending` is set; after a rewind the card is open again, which is correct.
4. HP drain from empty meters (point 1) inside `stepHp`, plus one ASTRA warning per meter when it hits 0 and HP
   starts to drop (`astra.lives.danger_oxygen` etc.: calm, one clear action). Keep existing emergency logic.
5. save-migrate.js: old saves get lives 3, livesMax 3, checkpoint null, stats.livesLost 0 (follow the file's pattern
   and bump the state version if that is how the file works).
6. The snapshot is stored in the save (localStorage). Keep it reasonable: one checkpoint only, JSON string.
7. Tests (tests/lives.test.mjs): checkpoint taken when a dilemma appears; HP 0 -> lives 2 and state equals the
   checkpoint state (minute, resources, pending card) with hp >= 60; third loss -> status 'over' + gameover event;
   `false` mode unchanged (Med-Rest); empty Oxygen drains HP; trip HP 0 -> life lost; old-save migration;
   determinism (same seed + same commands -> same result after a rewind).
8. Balance: run `node tools/balance/strategy-lab.mjs` (read its header for options) before and after. The
   recommended/smart strategies must still reach the finale with 0 lives lost. Report for each strategy: lives lost,
   Game Over yes/no, finale Sol, stars. It is GOOD if idle/neglect strategies now lose lives or reach Game Over;
   if they never lose a life, tell us which numbers would change that.

Report: files changed, the design in 10 lines, test result (real numbers), strategy table, SCENARIO deviations.

## Codex response

## Summary

1. Campaigns start with three lives.
2. Mission start gets a checkpoint.
3. Every decision appearance replaces that checkpoint.
4. Snapshots include the open card and exclude previous checkpoints.
5. HP 0 costs one life.
6. Rewind restores state in place and keeps loss counters.
7. Restored HP is at least 60.
8. The third loss triggers existing Game Over behavior.
9. Empty Oxygen/Heat/Water/Food drain HP only while home.
10. Med-Rest mode remains unchanged; saves migrate to version 2.

## Files changed — one line each with the reason.

- `src/campaign/lives.js` — checkpoint restoration, life-loss events, and five exported ASTRA strings.
- `src/campaign/engine.js` — checkpoint timing, danger drain, and immediate stopping after rewind.
- `src/campaign/data.js` — provenance-tagged lives and drain constants.
- `src/campaign/save-migrate.js` — old-save defaults and checkpoint validation.
- `tests/lives.test.mjs` — 21 new tests covering lives, restoration, danger, migration, and determinism.
- `tests/gameover.test.mjs` — existing Game Over checks now exercise the final life; legacy safety checks use Med-Rest mode.
- `tests/emergency-cost.test.mjs` — the old “no HP change” assertion now explicitly tests Med-Rest mode.
- `tests/campaign-fuzz.test.mjs` — restore the external surface tracker after rewind and stop commands after Game Over.

## How to verify

- `node --test tests/lives.test.mjs tests/gameover.test.mjs tests/emergency-cost.test.mjs tests/campaign-fuzz.test.mjs` — **34 passed, 0 failed**.
- `npm test` — **393 tests: 392 passed, 0 failed, 1 existing TODO**.
- `git diff --check` — no output.
- `node tools/balance/strategy-lab.mjs` — completed before and after, eight seeds per strategy.

After-change results below include lives/Game Over counters measured through read-only, in-memory instrumentation of the lab.

| Strategy | Lives lost | Game Over | Finale Sol | Stars |
|---|---:|---:|---:|---:|
| recommended | 0 | 0/8 | 19–22 | 8 |
| idle | 3 | 8/8 | — | 3 |
| idle-c | 3 | 8/8 | — | 3 |
| no-minigames | 0–3 | 1/8 | 21–25; 6/8 finished | 3–7 |
| ignore-minigames | 0 | 0/8 | 20–23 | 8 |
| build-only | 3 | 8/8 | — | 6 |
| no-expeditions | 3 | 8/8 | — | 6 |
| rush | 0 | 0/8 | 18–20 | 5–6 |
| trip-spam | 0 | 0/8 | 19–21 | 8 |
| hoard | 3 | 8/8 | — | 4–5 |
| always-b | 0 | 0/8 | 21–23 | 8 |
| always-c | 0 | 0/8 | 20–25 | 8 |
| cheat-minispam | 3 | 8/8 | — | 3 |
| cheat-heatspam | 1–3 | 2/8 | — | 3 |

Before changes, no strategy reached Game Over. Recommended results remain unchanged. Previously idle HP stayed above 90 despite empty supplies; neglect now costs lives without further tuning.

## Open questions

No implementation questions. Integration must merge `lives.js`’s five `STRINGS` entries into the runtime string table.

Authorized SCENARIO deviations:

- Three lives and Game Over override the core “no lose state” rule.
- Base HP 0 uses rewind with at least 60 HP instead of Med-Rest.
- Trip HP 0 uses life loss/rewind instead of partial-loot rescue and Med-Rest.
- Empty Oxygen, Heat, Water, and Food now damage HP in lives mode.
- Checkpoints and five new ASTRA lines extend the scenario.

`SCENARIO.md` was unchanged. No commits or branch changes were made.

## Main-agent follow-up

_Pending. The main agent records here which findings were confirmed, what was fixed, what was rejected and why, and which tests were run._
