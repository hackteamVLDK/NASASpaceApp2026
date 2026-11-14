# Decisions log (Vlad's agent)

One line per decision: what was decided, and why. Newest last. Kept on `main`, like the status
files, so every task branch can add to it without merge conflicts.

- 2026-11-14 · Keep this log on `main`, not on task branches · it is shared by all tasks; on branches it would conflict every merge.
- 2026-11-14 · `gh` not logged in: asked once (push notification is disabled, so in the session text) and continued · the user's rule; PRs and merges wait until gh works.
- 2026-11-14 · Stack the new SCENARIO.md branches: characters on scenario-open-items, astra-voice on characters, readability on astra-voice · all three edit SCENARIO.md; stacking avoids conflicts while earlier PRs are unmerged.
- 2026-11-14 · Readability pass runs last · it touches every player-facing line, including the new character and ASTRA-voice text.
