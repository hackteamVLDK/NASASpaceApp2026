# AGENTS.md — shared rules for every AI agent in this repository

Applies to the main agent, to Codex, and to agents running on teammates' devices.
Main-agent-only rules are in [CLAUDE.md](CLAUDE.md); nothing there contradicts this file.

## Project

**Mars colony simulator** for NASA Space Apps Challenge 2026: a browser-based 2D pixel-art,
side-view cutaway of a partly buried Mars base. It teaches real engineering trade-offs
(life support, power, radiation shielding) to children aged 7–12 and adults.

- **Scenario (binding): [SCENARIO.md](SCENARIO.md)**
- Design: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)
- Architecture and module boundaries: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Art pipeline: [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md)
- Git sync: [docs/GIT_SYNC.md](docs/GIT_SYNC.md)
- Agent collaboration records: [docs/ai-collaboration/](docs/ai-collaboration/README.md)

## Scenario compliance (mandatory)

[SCENARIO.md](SCENARIO.md) is the binding game scenario. Every agent, on every task that
touches gameplay, story, UI, cutscenes, tutorial, art, or audio:

1. Reads `SCENARIO.md` **before** starting the task.
2. Checks the result against it **before** finishing: states, timings, coordinates, texts,
   colours, component names and props must match.
3. Reports any deviation or conflict explicitly instead of silently diverging.
4. Does not edit `SCENARIO.md` unless a team member asks for that change.

If `SCENARIO.md` and another document disagree, `SCENARIO.md` wins.

Any player-facing ASTRA 6.7 line must follow the **ASTRA 6.7 voice guide** in `SCENARIO.md`
(Section 1): short, never scary, never wrong about science, praise effort, explain consequences calmly.

## Commands

| Task | Command |
|---|---|
| Run the game | `npm run dev`, then open http://localhost:5173 |
| All tests | `npm test` |
| Simulation tests only | `npm run test:sim` |
| Sync service (runs forever) | `npm run sync` |
| One sync cycle | `npm run sync:once` |
| Pause / resume / inspect sync | `npm run sync:pause`, `npm run sync:resume`, `npm run sync:status` |
| Check Codex is usable | `node tools/codex/delegate.mjs check` |

No build step and no dependencies: plain ES modules, Node 20+ for tools and tests.

## Team coordination: `git_status_<Name>` files

Several agents work from different devices. Each one keeps one status file in the
repository root, shared through Git sync (so it arrives with a short delay):

- `git_status_Mykhailo`, `git_status_Vlad`, `git_status_Pavlo`

Rules:

1. **Before starting work**, read the other agents' status files. Do not start on files
   another agent lists as being edited.
2. **Edit only your own file.** Never modify another agent's status file.
3. Keep your file current — update it when you start a task and when you finish one. It has
   these sections: `DOING NOW`, `DONE`, `NEXT`, `FILES / FOLDERS I AM EDITING`, `FREE FOR OTHERS`.
4. Need a file someone else holds? Say so in your own status file and wait for theirs to change.

## Roles

| | Main agent | Secondary agent (Codex) |
|---|---|---|
| Owns | architecture, planning, game implementation, asset integration, final integration, all Git operations | delegated review, bug investigation, algorithm and simulation verification, performance analysis, test generation, alternative proposals |
| Default access | read/write | **read-only** |

Codex is called through `tools/codex/delegate.mjs`, which uses the local Codex CLI and the
existing ChatGPT login. **Never use the OpenAI API, never ask for or read an API key, and
never open, copy, or print authentication token files.**

## Safe concurrent work

- Two agents never edit the same file at the same time.
- Codex reviews are read-only. If Codex must write, it works in its own Git worktree and
  branch (`codex/<slug>`), on an explicit list of owned paths; the main agent reviews the
  diff, integrates it, and runs the tests.
- The sync service must be **paused** during any unfinished multi-agent integration:
  `npm run sync:pause -- --owner <name> --reason "<why>"`, then `npm run sync:resume -- --owner <name>`.
  Write-mode delegation pauses it automatically.
- Secondary agents do not commit, push, rebase, or switch branches in the main working tree.

## Git

- `main` is the shared branch. The sync service commits, rebases onto the remote, and pushes
  every 15 seconds. It never force-pushes.
- Commit messages describe the change. **Do not mention AI tools or agent names, and do not
  add `Co-Authored-By` trailers.**
- Never commit secrets (`.env`, keys, tokens). Everything else in the project is shared.

## Code conventions

- `src/sim/` is a pure, deterministic simulation: no DOM, no `Date.now()`, no
  `Math.random()` (use the seeded RNG in `src/sim/rng.js`). It must run under `node --test`.
- `src/render/` and `src/ui/` read simulation state and send commands; they never change
  state directly.
- Every tunable number lives in `src/sim/constants.js` or `src/data/` and carries a
  provenance tag (below). No magic numbers inside logic.
- New simulation behaviour needs a test in `tests/`.

## Scientific accuracy

Every value shown to the player or used by the simulation is tagged with one of:

| Tag | Meaning |
|---|---|
| `nasa-measurement` | A value measured or published by NASA, with a citation |
| `approximation` | A scientifically motivated simplification of a real relationship |
| `gameplay` | A value chosen for pacing or fun, not a claim about Mars |

Do not present an `approximation` or `gameplay` value as a NASA measurement. Radiation
underground is reduced, never exactly zero.

## Visual assets

- One style guide: [assets/prompts/STYLE_GUIDE.md](assets/prompts/STYLE_GUIDE.md).
- Every asset has a prompt file in `assets/prompts/` and an entry in
  `assets/manifests/asset-manifest.json` with an honest `status`.
- Code-drawn sprites are development stand-ins (`status: "procedural-standin"`), never final
  art. Do not mark an asset `final` unless a real image file exists and renders correctly.
