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
- 2026-11-14 · ASTRA voice guide lives in SCENARIO.md Section 1 and is linked from AGENTS.md · AGENTS.md is not listed as owned in any git_status file; all agents read it.
- 2026-11-14 · Readability limits: ASTRA sentences ≤20 words and ≤4 sentences per line; UI ≤15 words · user's limits plus the voice guide; existing lines over 4 sentences were tightened, not split, to keep line IDs.
- 2026-11-14 · Hard words explained at first use in play order (radiation, microbes, carbon dioxide, scrubbers, shielding) or replaced (modules→rooms, evidence→clues, orbiter→spacecraft circling Mars) · ages 7–8; meaning unchanged.
- 2026-11-14 · Logbook cards drop unit names kids can't use (millisieverts, micrograys) but keep the comparison · cards are for 7–12; the number stays in FACT_CHECK.md.
- 2026-11-14 · "safe under the soil" → "well shielded" in two alerts · radiation underground is reduced, never zero (AGENTS.md rule).
- 2026-11-14 · "(fiction)" is a writers' note, never shown in game · several Line cells contain the tag; code must strip it.
- 2026-11-14 · Codex review hit the ChatGPT usage limit; retried after the reset time Codex gave · no API key or other login used, per AGENTS.md.
- 2026-11-14 · Codex review (tasks 1–3): accepted 4 findings, with finding 1 only partly (cards use the 20-word 8.1 limit, not 15) · details in content/ai-collaboration/records/20261114-characters-voice-readability-review.md.
- 2026-11-14 · EVA art keeps the existing gold-tinted visor; no helmet head overlay · consistent with crew.eva; crew told apart by stripe colour.
- 2026-11-14 · No PRs opened or merged: gh still not logged in · user's rule; branches are pushed and ready.
- 2026-11-14 · gh logged in; no new PRs opened · the user had already merged #2–#4 into main, which (stacked) brought in all 5 branches; main tests 85/88 as expected.
