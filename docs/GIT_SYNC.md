# Git sync

Keeps every teammate's folder and GitHub in step automatically. It is ordinary Git
underneath — commits, fetches, merges and pushes you could type yourself.

Repository: `https://github.com/hackteamVLDK/NASASpaceApp2026.git`, branch `main`.

## Start it

```bash
npm run sync
```

Leave that terminal open. Every 15 seconds it:

1. fetches `main` from GitHub;
2. commits your changes, once the files have been still for 4 seconds;
3. brings in teammates' commits;
4. pushes.

You need Git 2.38 or newer, Node 20 or newer, and to be signed in to GitHub in Git (if
`git pull` works without asking for a password, you are set).

| Command | What it does |
|---|---|
| `npm run sync` | run until Ctrl+C |
| `npm run sync:once` | one cycle, then exit |
| `npm run sync:status` | branch, ahead/behind, pauses, last result |
| `npm run sync:pause -- --owner NAME --reason "why"` | stop syncing (see below) |
| `npm run sync:resume -- --owner NAME` | continue; `--all` releases every pause |

## What it will never do

- **Force-push.** It cannot overwrite a teammate's commits.
- **Reset or rebase your working folder.** It only ever moves your files forward with a
  fast-forward, and Git refuses that up front if it would overwrite a file you have changed,
  an untracked file, or an ignored file.
- **Commit secrets.** Files named like `.env`, `*.pem`, `*.key`, `id_rsa*`, `auth.json`,
  `*.token` are never staged. If one is already in a commit you made by hand, the push is
  refused until you remove it. Matching is on the file name only, not the folder.
- **Interrupt manual Git work.** If a merge, rebase or cherry-pick is under way, or you have
  partly staged a file, it waits.

Everything else in the project is shared: the repository is private, so code, docs, assets,
prompts and AI collaboration records are all pushed.

## What you will see

```
[12:01:15] COMMIT   sync: add 2, update 1 files in src/sim, docs (3 files)
[12:01:17] PUSH     1 commit(s) to origin/main
[12:01:32] PULL     2 new commit(s) from origin/main, 5 file(s) changed
[12:01:32] PULL       a1b2c3d Vlad: sync: update assets/incoming/rover.png
[12:01:32] TEAM     git_status_Vlad was updated — read it to see what that agent is working on
```

On Windows a notification also pops up for incoming commits and conflicts
(`"desktop": false` in the config turns it off).

When you and a teammate both committed in the same window, the two are merged automatically
and a commit called `sync: merge N remote commits from origin/main` appears. That is normal.

## Pausing — for agents and for big changes

Pause before work that would be broken if pushed half-finished: a multi-file refactor, or
integrating another agent's branch.

```bash
npm run sync:pause -- --owner main-agent --reason "integrating codex/radiation-tests"
# ... work ...
npm run sync:resume -- --owner main-agent
```

- Several people or agents can hold a pause at once; syncing resumes when the last one lets go.
- `pause` **waits** until any cycle already running has finished. When it returns, nothing is
  in flight. If it prints a warning instead, a cycle is still running: wait and check
  `npm run sync:status`.
- Write-mode Codex tasks (`tools/codex/delegate.mjs run --write`) pause automatically and
  stay paused until `delegate.mjs cleanup`.
- Pauses and locks live in `.git/colony-sync/`. They are local to your machine and never
  synced.

## Conflicts

A conflict means you and a teammate changed the **same lines** of the same file. Changes to
different lines, or different files, merge by themselves.

When it happens, nothing in your folder is touched. You see:

```
CONFLICT cannot combine local and remote changes automatically — both sides changed: docs/LEVELS.md
CONFLICT Your commits are safe locally and backed up on the remote as "sync-conflict/mykhailo-3fa9c1-19ba07b4".
```

Your work is committed locally and also pushed to a backup branch, so it is safe and your
teammates can see it. Syncing of `main` waits for you:

```bash
npm run sync:pause
git pull origin main          # Git marks the conflicting lines in the file
# edit the file: keep what should stay, delete the <<<<<<< ======= >>>>>>> markers
git add <file>
git commit
npm run sync:resume
```

After that the backup branch can be deleted on GitHub.

To avoid conflicts in the first place, use the `git_status_<Name>` files (see
[AGENTS.md](../AGENTS.md)): say what you are editing, and look at what others are editing.

## Settings

[tools/git-sync/sync.config.json](../tools/git-sync/sync.config.json)

| Setting | Default | Meaning |
|---|---|---|
| `intervalSeconds` | 15 | time between cycles |
| `debounceSeconds` | 4 | a file must be unchanged this long before it is committed |
| `maxDebounceWaitSeconds` | 60 | commit anyway after this long, even if files keep changing |
| `branch` | `""` | empty = whatever branch you are on; set a name to sync only that branch |
| `remote` | `origin` | |
| `maxFileSizeMB` | 50 | larger new files are skipped with a warning (GitHub rejects files over 100 MB) |
| `blockedPatterns` | see file | file names never synced |
| `notify.bell`, `notify.desktop` | true | terminal bell and Windows notification |

Branches starting with `codex/` or `sync-conflict/` are never synced.

## Troubleshooting

| You see | Meaning | Do |
|---|---|---|
| `PAUSED` | someone holds a pause | `npm run sync:status` shows who and for how long; `npm run sync:resume -- --all` if it was forgotten |
| `BUSY … (index.lock)` | another Git program is running, or crashed | close other Git tools; if nothing is running, delete `.git/index.lock` |
| `BUSY partially staged…` | you staged part of a file by hand | finish your commit, or `git add -A` |
| `BUSY on branch "…"` | you are on a branch that is not synced | switch back to `main`, or it is intended |
| `OFFLINE` | GitHub unreachable | local commits continue; it catches up when the network returns |
| `WAIT … files you are still editing` | a teammate changed a file you have unsaved-to-Git edits in | nothing; it retries after your edit is committed |
| `BLOCKED incoming files already exist here` | a teammate added a file that exists in your folder as an untracked or ignored file | move or delete your copy |
| `BLOCKED … secret-looking files` | a commit you made contains a secret | remove it from that commit (`git reset --soft HEAD~1`, unstage the file, commit again) |
| `Another sync daemon is already running` | it is already running in another terminal | use that one |
| `Git 2.38 or newer is required` | old Git | update Git |

Log file: `.git/colony-sync/sync.log`.

## How it stays safe

The design was reviewed independently and reworked after that review — the record, with
each finding and what was done, is in
[ai-collaboration/records/](ai-collaboration/records/20261114-105947-review-git-sync-service-for-data-loss-risks.md).

- A merge is first computed off to the side (`git merge-tree`), without touching your files.
  Only if it is clean is a merge commit created and your folder fast-forwarded to it.
- One lock makes sure two cycles never run at once, whether from the daemon or `--once`.
- 19 integration tests cover two-way sync, automatic merges, conflicts, pauses, secrets,
  ignored files, renames and unusual file names: `npm run test:sync`.

Known limits: submodules are not supported; true simultaneous-write races rely on Git's own
checks rather than on tests of ours; the Windows notification is untested by automation.
