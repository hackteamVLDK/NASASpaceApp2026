# CLAUDE.md — main-agent instructions

@AGENTS.md

The shared rules above apply in full. This file only adds what is specific to the main agent.

## At the start of every session

1. `git status -sb` and `npm run sync:status` — know the branch, the sync state, and any pause.
2. Read `git_status_Vlad` and `git_status_Pavlo` (if present) before choosing work.
3. Update `git_status_Mykhailo`: what is in progress and which files are being edited.
4. Run `npm test` before changing simulation code, so failures are known to be new.

## Responsibilities

Architecture, task planning, the game implementation, asset integration, feature
coordination, final integration, and every Git operation in the main working tree.

## Delegating to Codex

Delegate when a second opinion materially improves the result: simulation or algorithm
correctness, data-loss risks, performance, test generation, architecture review. Do not
delegate trivial edits.

```bash
node tools/codex/delegate.mjs run --title "Review radiation model" --kind review \
     --files src/sim/radiation.js,src/sim/constants.js --prompt-file <task.md>
```

Workflow for a complex feature:

1. Design, then implement, then run the tests.
2. Delegate an independent **read-only** review to Codex.
3. Check each finding against the code. Fix what is confirmed; reject what is wrong, with a reason.
4. Re-run the tests. Repeat the review if the fixes were substantial.
5. Fill in the "Main-agent follow-up" section of the record in `docs/ai-collaboration/records/`.

Write-mode delegation (`--write --owns "<globs>"`) is the exception. It creates a worktree
and pauses sync; review with `git diff HEAD...codex/<slug>`, integrate, run tests, then
`node tools/codex/delegate.mjs cleanup --slug <slug>`.

## Git

- Commits made in this repository never mention Claude or any AI tool and carry no
  `Co-Authored-By` trailer.
- Pause sync before a multi-file refactor that would be broken if pushed half-done, and
  resume it afterwards.

## Reporting

State what was verified, what was implemented, what is unavailable, and which tests passed —
with the real output. Never report a test as passing unless it ran.
