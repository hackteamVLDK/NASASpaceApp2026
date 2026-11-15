# Jobs panel and three new mini-games

| Field | Value |
|---|---|
| Record | 20261115-112659-jobs-ui-minigames |
| Kind | proposal |
| Mode | write (worktree branch `codex/jobs-ui-minigames`, sandbox: workspace-write) |
| Started | 2026-11-15T10:26:59.736Z |
| Duration | 611 s |
| Exit status | 0 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6.1-sol |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1debf-0025-7690-8325-9ab472885fdd |
| Tokens used | 97,537 |
| Files changed by Codex | `src/ui/jobs-panel.js`, `src/ui/mg-jobs.js`, `styles/jobs.css`, `tests/mg-jobs.test.mjs` |
| Raw transcript | [raw/20261115-112659-jobs-ui-minigames.log](raw/20261115-112659-jobs-ui-minigames.log) |

## Task sent to Codex

Focus files: `SCENARIO.md`, `AGENTS.md`, `src/ui/minigames2.js`, `src/ui/mg-kit.js`, `src/ui/mg-scenes.js`, `src/main.js`

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

# YOUR TASK: D2. Jobs panel and three new mini-games (UI side)

You own ONLY new files: src/ui/jobs-panel.js, src/ui/mg-jobs.js, styles/jobs.css, tests/mg-jobs.test.mjs (new,
pure helpers only, no DOM). Do not edit any existing file (the main agent wires them into main.js, index.html and
campaign-ui.js). src/campaign/jobs.js does not exist in your worktree: `jobBoard` is passed in.

Read first: src/ui/minigames2.js (`startMini2`, its GAMES table, the opts it receives and what it returns),
src/ui/mg-kit.js and src/ui/mg-scenes.js (the shared look: frame, timer ring, pixel scenes), how main.js
`openMini` creates the canvas and calls startMini2, and SCENARIO.md Section 4 (mini-game rules: 10-20 s, timer
ring green -> yellow -> red, no big FAIL screen, instant free retry, praise effort, Reduce motion respected).

1. src/ui/mg-jobs.js: `hasJobMini(game)` and `startJobMini(game, opts)` with exactly the same signature, lifecycle
   and return value as `startMini2` (so main.js can call either). Three games, each 10-15 s, mouse + touch,
   pixel style matching mg-kit/mg-scenes, readable at the existing sizes:
   - `bolt_sprint` "Help the drones": a wall frame with 6-8 bolts; tap the glowing bolt, then the next one lights up
     (keep a steady rhythm; a wrong tap just flashes, never punishes hard). Win: all bolts tight before the timer ends.
     Hint text: "Tap each glowing bolt to tighten it. The drones fit the panels, you lock them."
   - `scrap_hunt` "Scrap hunt": the Mars surface near the base, a scanner circle follows the pointer; hidden scrap
     pieces (5) beep/glow stronger when the scanner is near; tap to pick up 4 of 5 to win. Mixed in: 2 rocks that
     only say "Just a rock!". Hint: "Move the scanner. When it glows, tap to pick up the scrap."
   - `sample_scan` "Microscope": a round microscope view of a soil sample; turn the focus slider until the image is
     sharp, then tap the 3 marked grains that match a reference card (e.g. "salt crystal" / "basalt grain").
     Hint: "Turn the focus until the picture is sharp. Then find the grains from the card."
   Each calls onWin / onFail like the existing games; retry is the caller's business.
2. src/ui/jobs-panel.js: `createJobsPanel({ s, send, openMini, jobBoard })` -> `{ el, update(), count() }`.
   `el` is a panel for the side tabs: a list of job cards (title, text, the `science` sentence in small italic,
   reward chip, Start button disabled with the `block` text when blocked). Start: `const r = send({ type:
   'startJob', job: id })`; check how `send` reports success in main.js; if ok, `openMini(game, { job: id })`.
   `update()` re-renders only when the board changed (signature check, like other panels). `count()` = jobs ready.
   Text comes from the board items (English). Buttons at least 44 px high.
3. styles/jobs.css: styles for the panel and anything the new games need outside the canvas, following
   styles/game.css variables and the dark pixel look.
4. Self-check: open the games in a page if you can (e.g. a small temporary HTML harness in your worktree that you
   delete afterwards, served by `npm run dev`), play each to a win and a timeout, and report what you saw.
   Report real `npm test` numbers.

## Codex response

## Summary

Implemented the Jobs panel and three 15-second mini-games. Only the four owned files changed.

## Files changed — one line each with the reason.

- `src/ui/jobs-panel.js` — job cards, blocked starts, command checks, signature-based updates, and ready count.
- `src/ui/mg-jobs.js` — three games with shared visuals, touch controls, timer, cleanup, and exported strings.
- `styles/jobs.css` — dark panel styling and 44 px buttons.
- `tests/mg-jobs.test.mjs` — seven pure-helper tests.

## How to verify — exact commands and what they printed for you.

- `node --test tests/mg-jobs.test.mjs` — **7 passed, 0 failed**.
- `npm test` — **379 tests: 378 passed, 0 failed, 1 existing Fitness TODO**.
- `node --check src/ui/jobs-panel.js` and `node --check src/ui/mg-jobs.js` — no output; successful.
- `git diff --check` — no whitespace errors.

Headless Chrome: all three games reached wins and timeouts using mouse/touch input; no browser errors. Screenshots inspected. Reduce motion stayed steady, and destruction removed all five listeners.

## Open questions

No blocking questions. Main-agent integration must wire imports, CSS, job results/free retries, and both `STRINGS` exports.

Scenario departures: three additional job games, job-specific rewards, and caller-managed retry instead of repair slowdown/drone assistance. Tagged tuning remains inside the owned module; procedural artwork still needs manifest/prompt registration outside this patch.

## Main-agent follow-up

_Pending. The main agent records here which findings were confirmed, what was fixed, what was rejected and why, and which tests were run._
