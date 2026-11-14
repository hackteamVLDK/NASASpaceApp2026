# Decisions log (Vlad's agent)

One line per decision: what was decided, and why. Newest last. Kept on `main`, like the status
files, so every task branch can add to it without merge conflicts.

- 2026-11-14 · Keep this log on `main`, not on task branches · it is shared by all tasks; on branches it would conflict every merge.
- 2026-11-14 · `gh` not logged in: asked once (push notification is disabled, so in the session text) and continued · the user's rule; PRs and merges wait until gh works.
- 2026-11-14 · Stack the new SCENARIO.md branches: characters on scenario-open-items, astra-voice on characters, readability on astra-voice · all three edit SCENARIO.md; stacking avoids conflicts while earlier PRs are unmerged.
- 2026-11-14 · Readability pass runs last · it touches every player-facing line, including the new character and ASTRA-voice text.
- 2026-11-14 · Characters keep the sim's placeholder first names (Amara, Kenji, Sofia→Sofía, Leo) and add Noor (Comms) and Rosa (Mission Control) · no renames needed in Mykhailo's src/data/crew.js.
- 2026-11-14 · Crew colours: Commander red, Engineer yellow, Botanist green, Pilot blue, Comms violet · first four match the sim's suitColor; violet is free.
- 2026-11-14 · Drones get nicknames (Pip, Bumble, Zip) via new ASTRA lines; existing "Drone #0x" lines unchanged · avoids touching checked lines; personality comes from beeps and bumper colours, since drones can't talk.
- 2026-11-14 · Character art as overlays on the shared crew/drone sprites (crew.heads, drone.bumpers) plus crew.portraits · fits the existing recolour pipeline instead of 5 new body sheets.
- 2026-11-14 · Solo Commander can be renamed (ui.char.rename) · kids like naming their hero; ASTRA still says "Commander", so no line depends on the name.
