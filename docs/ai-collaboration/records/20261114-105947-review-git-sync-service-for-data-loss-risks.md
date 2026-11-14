# Review Git sync service for data-loss risks

| Field | Value |
|---|---|
| Record | 20261114-105947-review-git-sync-service-for-data-loss-risks |
| Kind | review |
| Mode | read-only (sandbox: read-only) |
| Started | 2026-11-14T09:59:47.257Z |
| Duration | 394 s |
| Exit status | 0 |
| Codex CLI | codex-cli 0.169.0 |
| Model | gpt-6.1-sol |
| Authentication | Logged in using ChatGPT — no API key |
| Codex session | 01a1d97f-b53a-7b61-a883-b11b23fa2e9a |
| Tokens used | 99,893 |
| Working-tree changes during run | `src/data/nasa/donki-sep-2024.js`, `tools/data/build-donki-sep.mjs` (created by the main agent while the review ran — not by Codex) |
| Raw transcript | [raw/20261114-105947-review-git-sync-service-for-data-loss-risks.log](raw/20261114-105947-review-git-sync-service-for-data-loss-risks.log) |

## Task sent to Codex

Focus files: `tools/git-sync/sync.mjs`, `tools/git-sync/lock.mjs`, `tools/git-sync/test/sync.test.mjs`

Review the two-way Git synchronisation service for data-loss and correctness risks.

Context: three teammates each run `node tools/git-sync/sync.mjs` on their own machine against the
same GitHub repository and branch (`main`). One cycle runs every 15 seconds: fetch, commit local
changes after a debounce, fast-forward or rebase onto the remote, push. People and AI agents edit
files in the working tree while the daemon runs. Platforms: Windows 11 (primary), macOS, Linux.

Answer these questions concretely, citing code lines:

1. Can any path through `runCycle` lose or overwrite uncommitted local work, or a teammate's
   pushed commits? Consider: a file saved between `readStatus` and `git add`; a file saved during
   `git rebase`; untracked files that collide with incoming files; the failed-rebase path and the
   `rebase --abort` + HEAD check; `update-ref` after push.
2. Is the conflict path sound? (abort, backup branch push, repeated cycles while still in conflict,
   new local commits made while in conflict.)
3. Are the pause locks and the daemon lock race-free enough for this use? What happens if a pause
   is acquired in the middle of a cycle?
4. Is the porcelain / name-status parsing correct for renames, copies, paths with spaces or
   non-ASCII characters, and submodules?
5. Is the blocked-file handling correct (`:(exclude,literal)` pathspecs, files in subdirectories,
   patterns matched on basename only)? Can a secret still slip through?
6. Anything Windows-specific that will break (CRLF, long paths, antivirus/index.lock, `powershell.exe` toast)?
7. Which important behaviours are NOT covered by `tools/git-sync/test/sync.test.mjs`?

You may run `node --test "tools/git-sync/test/*.test.mjs"` (it only touches the OS temp directory).

## Codex response

## Summary

The service has credible paths that can discard uncommitted work, overwrite ignored files, or publish secrets. Normal non-force pushes protect teammates’ existing remote commits, but pause handling and daemon locking do not reliably exclude concurrent operations. The current tests cover sequential happy paths and basic conflicts, leaving the most consequential races untested.

## Findings

1. **Severity:** major. **Location:** [tools/git-sync/sync.mjs:396](/C:/Users/titov/Desktop/NASA/tools/git-sync/sync.mjs:396), lines 399–402. **Problem:** Rebase changes the working tree while editors remain active; an editor save made during rebase can subsequently be discarded by `rebase --abort`. Git’s implementation performs a hard working-tree reset on abort. The service ignores the abort result and checks only HEAD equality, which cannot establish that uncommitted bytes, index state, branch attachment, or rebase cleanup survived. **Why it matters:** HEAD can be restored perfectly while newly saved work disappears. **Suggested fix:** Integrate in an isolated worktree, and coordinate changes to the live checkout with writers. Check abort success and operation state explicitly; preserve unexpected working-tree changes before recovery. [Git abort implementation](https://github.com/git/git/blob/v2.54.0/builtin/rebase.c#L1313-L1335).

2. **Severity:** major. **Location:** [tools/git-sync/sync.mjs:120](/C:/Users/titov/Desktop/NASA/tools/git-sync/sync.mjs:120), lines 367 and 396. **Problem:** Status omits ignored files, and fast-forward merge runs without `--no-overwrite-ignore`. An ignored local `.env`, asset, or runtime file can therefore be overwritten when an incoming commit tracks that path. Ordinary **nonignored** untracked collisions generally make Git refuse integration; ignored collisions have different protection. **Why it matters:** This is a loss path even without concurrent editing. **Suggested fix:** Add `--no-overwrite-ignore` to merge, and check incoming paths against ignored local files before either integration method. [Git documents ignored-file overwriting as the default](https://git-scm.com/docs/git-merge#Documentation/git-merge.txt---overwrite-ignore).

3. **Severity:** major. **Location:** [tools/git-sync/sync.mjs:275](/C:/Users/titov/Desktop/NASA/tools/git-sync/sync.mjs:275). **Problem:** `git add -A .` overwrites the user’s existing index. For example, stage version B of a tracked file, then restore its working copy to HEAD’s version A: the daemon replaces staged B with A, potentially leaving B only as an unreachable blob. A save between `readStatus` and `add` also bypasses the earlier debounce check; staging takes the newer working-copy bytes. **Why it matters:** Staged-only work is not preserved, and debounce does not guarantee a stable snapshot. **Suggested fix:** Stand down when user-staged changes exist, or preserve the index through an explicitly designed snapshot mechanism. Stage only validated paths and recheck their stability.

4. **Severity:** major. **Location:** [tools/git-sync/sync.mjs:307](/C:/Users/titov/Desktop/NASA/tools/git-sync/sync.mjs:307), lines 576–578; [tools/git-sync/lock.mjs:40](/C:/Users/titov/Desktop/NASA/tools/git-sync/lock.mjs:40). **Problem:** Pauses are checked once at cycle entry. Acquiring a pause during fetch returns “Sync paused” immediately, while that cycle can still commit, rebase, and push. Additionally, `listPauses` returns an empty list on any directory-read error, allowing synchronization despite an unreadable pause directory. **Why it matters:** Callers cannot safely start integration work after the pause command returns. **Suggested fix:** Make pause acquisition a barrier: publish the pause, wait for active-cycle ownership to end, and require new cycles to check pauses under the same mutex. Fail closed on directory errors other than a known absent directory.

5. **Severity:** major. **Location:** [tools/git-sync/sync.mjs:486](/C:/Users/titov/Desktop/NASA/tools/git-sync/sync.mjs:486), lines 525 and 587–588. **Problem:** Daemon locking is a read/check followed by an ordinary overwrite. Two starters can both acquire it; a partially written lock is also treated as replaceable. Shutdown unconditionally removes the pathname without checking ownership. `--once` bypasses daemon locking altogether. **Why it matters:** Concurrent cycles can interleave commits, rebases, aborts, and reference updates. Git’s individual locks do not serialize the whole cycle. **Suggested fix:** Use atomic ownership acquisition with safe stale-lock recovery, verify ownership before release, and serialize daemon cycles and `--once` through the same mechanism.

6. **Severity:** major. **Location:** [tools/git-sync/lock.mjs:24](/C:/Users/titov/Desktop/NASA/tools/git-sync/lock.mjs:24), lines 25–27. **Problem:** Relative Git-directory results are resolved against `repo`, although Git produced them relative to `start`. From this repository’s `tools` directory, `--git-common-dir` returns `../.git`; the code computes `C:\Users\titov\Desktop\.git` instead of `C:\Users\titov\Desktop\NASA\.git`. **Why it matters:** A pause issued from a subdirectory can use different state from the root daemon and fail to stop it. **Suggested fix:** Request absolute Git-directory paths or resolve relative results against `start`.

7. **Severity:** major. **Location:** [tools/git-sync/sync.mjs:253](/C:/Users/titov/Desktop/NASA/tools/git-sync/sync.mjs:253), lines 263–276 and 442. **Problem:** Secret exclusions apply only to entries classified `??`. A force-staged `.env` is classified as added, receives a warning, and is committed; tracked secrets are deliberately synchronized. New files appearing after status can bypass this scan, and already committed outgoing history is never checked. **Why it matters:** Secrets can reach both `main` and conflict-backup branches. **Suggested fix:** Reject blocked staged paths regardless of tracking status and validate outgoing commits before either push. The `:(exclude,literal)` syntax itself is sound here, including nested paths and spaces, because Git runs at the repository root. Basename matching catches `keys/server.pem`, but configuration patterns containing directories cannot match; document basename-only semantics or support root-relative matching explicitly. [Git pathspec semantics](https://git-scm.com/docs/gitglossary#Documentation/gitglossary.txt-aiddefpathspecapathspec).

8. **Severity:** major. **Location:** [tools/git-sync/sync.mjs:398](/C:/Users/titov/Desktop/NASA/tools/git-sync/sync.mjs:398), lines 406–422. **Problem:** Conflict state does not suspend integration: every cycle repeats the rebase and abort. `lastConflict` suppresses notifications **and backup attempts**, and is set before the backup succeeds. A transient backup failure is therefore never retried for an unchanged signature in the running daemon. **Why it matters:** Repeated checkout/reset activity continues around active editors, while the remote backup can remain missing. **Suggested fix:** Persist an unresolved-conflict state, separate notification suppression from backup retry state, and retry backups with backoff. Appended local commits currently change the signature and normally fast-forward the existing backup; rewritten history or colliding backup names can reject the push. Include a unique device identity and pinned commit ID in backup naming.

9. **Severity:** major. **Location:** [tools/git-sync/sync.mjs:396](/C:/Users/titov/Desktop/NASA/tools/git-sync/sync.mjs:396). **Problem:** Plain rebase drops local merge commits. Content introduced only in a merge commit—such as a manual amendment—can disappear during an otherwise successful rebase. **Why it matters:** This loses integrated work without entering the backup/conflict path. **Suggested fix:** Detect local merge commits and require explicit integration, or adopt a merge-based policy. Merely adding `--rebase-merges` does not guarantee preservation of manual merge resolutions. [Git rebase documentation](https://git-scm.com/docs/git-rebase#Documentation/git-rebase.txt---rebase-mergesrebase-cousinsno-rebase-cousins).

10. **Severity:** minor. **Location:** [tools/git-sync/sync.mjs:129](/C:/Users/titov/Desktop/NASA/tools/git-sync/sync.mjs:129), lines 160–162 and 394. **Problem:** Status consumes the second pathname only when **X** is `R`/`C`; rename/copy records in **Y** leave the source pathname interpreted as another status record. Staged name-status parsing consumes both paths correctly, but labels copies as renames. Incoming-file and conflict lists use newline-delimited, potentially quoted output. **Why it matters:** Debounce/path classification can use fabricated entries, copy messages are inaccurate, and unusual incoming filenames are misreported. **Suggested fix:** Recognize rename/copy status in either column, retain `C`, and use NUL-delimited output throughout. Ordinary spaces and valid UTF-8 non-ASCII names are otherwise handled correctly by the two NUL-based parsers. [Git porcelain format](https://git-scm.com/docs/git-status#_porcelain_format_version_1).

11. **Severity:** minor. **Location:** [tools/git-sync/sync.mjs:120](/C:/Users/titov/Desktop/NASA/tools/git-sync/sync.mjs:120), lines 276, 367 and 442. **Problem:** Submodules receive no dedicated handling. Dirty child content cannot be committed through the parent’s `git add`; it can indefinitely block integration. A changed child HEAD can be committed and pushed as a gitlink without checking that the child commit exists remotely. **Why it matters:** If submodules are introduced, a successful parent sync can publish an unavailable dependency revision. **Suggested fix:** Explicitly reject unsupported submodule states, or verify child-commit availability and manage child synchronization. [Git documents the porcelain submodule limitations](https://git-scm.com/docs/git-status#_short_format).

12. **Severity:** minor. **Location:** [tools/git-sync/sync.mjs:442](/C:/Users/titov/Desktop/NASA/tools/git-sync/sync.mjs:442), line 445. **Problem:** After push, `update-ref` resolves the then-current `HEAD`, rather than the commit actually pushed, and performs no expected-old-value check. A concurrent commit, checkout, or fetch can make the tracking reference inaccurate or overwrite fresher tracking information; update failure is ignored. **Why it matters:** Local ahead/behind reporting becomes unreliable. This changes a **local tracking reference**, not GitHub’s branch. **Suggested fix:** Pin the pushed OID and use a checked reference update, or remove this redundant update and rely on Git’s normal tracking update/fetch behavior. The non-force push itself rejects replacement of divergent teammate history. [Git push rules](https://git-scm.com/docs/git-push#_description).

## Verification

Read `AGENTS.md`, the available teammate status file, all three focus files, `sync.config.json`, `.gitignore`, `.gitattributes`, and relevant delegation pause call sites. `docs/GIT_SYNC.md` was absent.

Ran `node --test "tools/git-sync/test/*.test.mjs"` using Node v24.18.0 and Git 2.54.0.windows.1:

- **1 passed:** commit-message test.
- **9 failed during setup:** the read-only sandbox denied `mkdtemp` with `EPERM`; no integration behavior was exercised.

Ran file-free, in-memory probes against extracted functions. These confirmed Y-column rename misparsing, copy mislabeling, continued commit/push after a mid-fetch pause, and two conflict rebases with only one failed-backup attempt. Read-only Git queries confirmed the subdirectory path-resolution error. These probes verify control flow, not real Git concurrency.

Important behaviors absent from `sync.test.mjs`:

- Concurrent saves, partial writes, staged-only content, and secret creation between status and staging.
- Ignored/untracked incoming-path collisions; failed aborts and partial checkout failures.
- Concurrent daemon startup, daemon/`--once` overlap, mid-cycle pauses, and subdirectory invocation.
- Persistent-daemon backup retries, new commits during conflict, rewritten backup history, and local merge commits. The repeated-conflict test starts a new process each time.
- Push races, rejected/protected pushes, network timeouts, and concurrent tracking-reference updates.
- Copies, Y-column renames, unusual/non-ASCII paths, submodules, and Windows filesystem failures.

Windows observations: existing `.gitattributes` reduces CRLF churn, but tests explicitly disable `autocrlf`, so they do not verify production settings. Long paths remain dependent on Git configuration; [Git for Windows documents that limitation](https://gitforwindows.org/git-cannot-create-a-file-or-directory-with-a-long-path.html). A stale `index.lock` causes indefinite `busy` status; antivirus or checkout failures can enter the generic conflict path. PowerShell notification text is safely passed through environment variables, but subprocess failure is ignored and toast delivery was not tested. No repository files or Git state were changed.

## Recommendations

1. Fix cycle exclusion and make pause acquisition wait for an idle service.
2. Preserve the live working tree and user index; prevent ignored-file overwrites.
3. Enforce secret checks before commits and both push paths.
4. Add deterministic race/failure tests before relying on this daemon for unattended synchronization.

## Warnings

- ~~Codex changed files during a READ-ONLY task~~ — **false alarm from the delegation tool.** Both
  files were created by the main agent while the review was running; Codex ran in a read-only
  sandbox (which even refused `mkdtemp` for the tests). The tool's wording was corrected so that
  read-only runs report "working-tree changes during run" instead of blaming Codex.

## Main-agent follow-up

Each finding was checked against the code. Result: 11 confirmed and fixed, 1 confirmed and
documented as unsupported. The sync core was redesigned rather than patched.

| # | Finding | Verdict | What was done |
|---|---|---|---|
| 1 | A file saved during `git rebase` can be destroyed by `rebase --abort` | **Confirmed** (abort is a hard reset) | Rebase removed entirely. The merge is computed off to the side with `git merge-tree --write-tree`; the working tree is only ever moved by `git merge --ff-only`, which checks first and changes nothing if a local file would be overwritten. There is no abort path any more. |
| 2 | Ignored local files overwritten by a fast-forward | **Confirmed** | `--no-overwrite-ignore` on every fast-forward; a collision is reported as `BLOCKED`. Test: "an ignored local file is never overwritten…". |
| 3 | `git add -A` clobbers a hand-staged index; debounce bypass between status and add | **Confirmed** | Partially staged or unmerged files now count as manual Git work and the service stands back. Only the exact paths from the status scan are staged (`--pathspec-from-file`, literal). Test: "partially staged files…". |
| 4 | Pause checked only at cycle start; `listPauses` fails open | **Confirmed** | Pause is now a barrier: it publishes the pause and waits for the cycle lock to clear. The cycle re-checks pauses before commit, integrate and push. Unreadable pause directory now counts as paused. Test: "pause waits for a running cycle…". |
| 5 | Daemon lock not atomic; `--once` bypasses it | **Confirmed** | Atomic `O_EXCL` lock files with stale-owner recovery and ownership check on release. One cycle lock serialises the daemon and `--once`. |
| 6 | Lock directory resolved wrongly from a subdirectory | **Confirmed** (real bug) | `rev-parse` for the Git directories now runs from the repository root. Test: "a pause issued from a subdirectory…". |
| 7 | Force-staged or hand-committed secrets are synced | **Confirmed** | Staged secret-looking files are unstaged whatever their status; changes to tracked secret-looking files are not synced; outgoing commits are scanned before every push and before the conflict backup. Basename-only matching is now documented. Test: "a force-staged secret…". |
| 8 | Conflict state repeats rebase+abort; failed backup never retried | **Confirmed** | Conflict detection no longer touches the working tree, so repeating it is harmless. Backup success is tracked separately and retried. Backup branch names include a random per-clone device id, with a second name as fallback. |
| 9 | Plain rebase drops local merge commits | **Confirmed**, now moot | No rebase is performed. Test: "a conflict the user resolves by hand lets sync continue" (a hand-made merge commit survives). |
| 10 | Status parser misses renames in the Y column; copies labelled as renames; newline-delimited name lists | **Confirmed** | Parser handles R/C in either column and keeps the original path; copies keep `C`; file lists use `-z` and `core.quotePath=false`. Tests: "status parsing…", "file names with spaces and non-ASCII…". |
| 11 | Submodules are not handled | **Confirmed**, not fixed | The project has no submodules. The service now warns once if `.gitmodules` exists; documented as unsupported in `docs/GIT_SYNC.md`. |
| 12 | `update-ref` after push uses whatever HEAD is by then | **Confirmed** | Removed. The push names the exact commit id; Git updates the tracking ref itself. |

Not changed, by decision: a file saved in the instant between the status scan and `git add`
may be committed slightly early. That is not data loss (the next cycle commits the final
version) and the alternative, hashing every file twice, costs more than it protects.

Consequence of the redesign: history is no longer linear — when two devices commit in the same
window, a `sync: merge N remote commit(s)` commit appears. Accepted in exchange for never
resetting the working tree.

Tests after the fixes: `node --test "tools/git-sync/test/*.test.mjs"` — **19 passed, 0 failed**
(10 original + 9 new regression tests). Note Codex could not run the integration tests itself:
its read-only sandbox denies creating the temp directory they need.

Not covered by tests, stated plainly: true concurrency (a save landing during a fast-forward
relies on Git's own documented check, not on a test of ours), network timeouts, protected
branches, and the Windows toast notification.
