# Errors list: what is wrong, why, and how to fix it

One place for every known problem of the playable game. Add a row when you find one; change its status
when it is fixed. [SCENARIO.md](../SCENARIO.md) stays the reference: a fix never edits it, and a conflict is
written down here instead.

- **Status:** `FIXED` (with the commit or batch), `OPEN` (nobody is on it), `CLAIMED <who>`, `DECISION` (needs
  the team: SCENARIO is silent or says something else).
- **Source:** `PLAYER` (reported by someone who played), `CODEX <record>` (a read-only review by the Codex
  helper, see [ai-collaboration/](ai-collaboration/README.md); the record has the long answer),
  `OWN` (found by the main agent), `BROWSER` (seen in a real browser run).
- The Codex helper was asked for the root cause and a fix for the player's reports; where it answered, its proposal
  is the one used (the record is named). Where it had no tokens or no answer, the fix is the main agent's.

Records used:
R1 `records/20261114-171848-browser-game-unfinished-screens-stuck-states-min.md`,
R2 `records/20261114-171848-campaign-engine-rules-vs-scenario-and-logic-bugs.md`,
R3 `records/20261114-195843-pipe-mini-game-energy-gauge-and-pause-bugs-root-.md`,
R4 `records/20261114-200625-entry-scene-for-the-astronaut-and-a-3-floor-base.md`.

---

## A. Reported by the player (2026-11-14)

| # | The player says | Cause | Fix | Source | Status |
|---|---|---|---|---|---|
| A1 | The character is far too big; 2 times smaller. | The Commander was drawn 185 units tall in rooms 270 units tall, taller than the room doors (about 110) and the bunk beds (about 115 long). Drones (118) were taller than the person would now be. | People 92 units, drones 66, the Rover 190 wide, so their proportions to each other and to the doors, beds and the dome hatch hold. Hit boxes keep a comfortable minimum size. | PLAYER | FIXED |
| A2 | The levels are too deep; 3 floors in total is fine. The last two floors need work. | The right wing stacked six rooms on six floors; floors 5 and 6 were cut off at the bottom of the screen. | Three floors. Left wing as before (Bedroom, Kitchen, Life Support). Right wing two rooms wide: Battery and Workshop, Greenhouse and Lab, Recreation. Same 600 x 270 room art. Camera re-framed (zoom 0.5, centre x 1260). SCENARIO line 16 allows it ("not a fixed layout"). | PLAYER, R4 | FIXED |
| A3 | We need an intro scene: how a person goes into the building. | The cutscene only made an astronaut appear in the Bedroom at 29.0 s. | The astronaut steps out of the lander, walks to the dome, the hatch opens (hiss at 25.8 s), he climbs down the shaft while the camera pans, steps into the left wing at 29.0 s, and takes the helmet off at 30.0 s. Pure function of time, so Skip ends in the same state. Fixed SCENARIO times are kept. | PLAYER, R4 | FIXED |
| A4 | The pipe mini-game does not work correctly. | The heat search started at row 0, column 1; the drawn core enters row 1, column 0. 0 of 2048 states could win, at most 2 rooms ever connected, and three timeouts gave a free win. | One-line inlet fix, the puzzle moved into `src/ui/pipes.js` with 10 solvable layouts, scrambles that are never solved in 2 taps, a "tap a pipe" hint with an animated hand, tiles that cannot turn do not click, a Back button. | PLAYER, R1 #1, R3 | FIXED |
| A5 | The energy indicator is broken. | The bar is fill = power / capacity (88 / 250 with a battery) but showed only "88". It also went red under 25% of capacity (62) while the warning starts under 20. Building the battery made the bar drop. | Show "88 / 250", the same warning limits as the Threats strip (Power 20, Water, Oxygen, Food 25, Morale 30, HP 40), amber for low and red for empty, a tooltip, and the Resources screen uses the real capacity. | PLAYER, R3 #4 #5 | FIXED |
| A6 | When time is stopped, the character does not stop. | Movement and sprite frames ran on the wall clock. | One world clock that only runs while the game runs (not paused, no card, no mini-game); characters, drones, the Rover and the weather freeze with it. Interface pulses keep the wall clock. | PLAYER, R3 #6 | FIXED |
| A7 | The Missions window should list only the current Act, and change with the Act. | It listed every Act and every optional goal at once. | Only the current Act (and its optional goals); finished Acts show as done chips; it changes when the Act changes. | PLAYER | FIXED |
| A8 | The sleeping person lies on a fifth bed that appears at random; he should sleep in one of the four. | The sleeping sprite carries its own bed, drawn over the room's bunk beds. | The bed is cut away from the sprite (person, pillow and blanket only) and the person lies in the lower-left bunk of the room art. The Commander walks to the bunk before he lies down. | PLAYER | FIXED |
| A9 | Why is the Garage at the bottom? It must be on the surface. | It was frame 4 of the right wing, underground, so the Rover drove out through solid soil. SCENARIO line 16 lists the "Garage airlock" as a surface structure. | The Garage & Airlock is a surface building to the right of the dome; the Rover parks in it and drives out of the right edge; the Commander and drones reach it over the surface. | PLAYER | FIXED |
| A10 | The vehicles overlap each other. | Drones rested at fixed 92-unit steps, closer than their width, and the last one stood inside the Rover. | Rest places are spaced by drone width and kept clear of the Rover's parking place; two bodies never share a spot. | PLAYER | FIXED |
| A11 | These little squares cannot be clicked. | Dormant Drones #02 and #03 were drawn on the surface as two tiny selection squares with nothing behind them (my mistake, see C1). | They sit in the Garage frame as SCENARIO says; clicking a dormant drone tells what wakes it (or wakes it, if the kit is ready). | PLAYER, R1 #21 | FIXED |
| A12 | My water ran out and nothing warned me; the character was fine. Warn about a low important resource. | The Threats strip skipped a meter at exactly 0 (`> 0` test), Water and Food have no emergency, and the one ASTRA line fires only once. | Every important meter warns when low and when empty: Threats chip (amber "Low", red "No water"), toast and sound at the moment it crosses, the gauge turns amber then red and pulses, ASTRA says it again when the meter hits 0. SCENARIO has no HP loss for 0 Water: kept (Greenhouse pause and Morale -5 a Sol are in the engine). | PLAYER | FIXED |

## B. Found by Codex reviews (not yet fixed unless marked)

Engine items live in `src/campaign/expeditions.js` and `story.js`, which Mykhailo's agent has claimed
(see `git_status_Mykhailo`); they are listed so nothing is lost.

| # | Problem | Where | Fix (from the record) | Source | Status |
|---|---|---|---|---|---|
| B1 | Heat Pump cannot be won. | `minigames2.js` | See A4. | R1 #1 | FIXED |
| B2 | Mini-games have no way out; three failures give a free win without the drone offer. | `index.html`, `minigames2.js` | Back button on every mini-game (not during the tutorial). The drone offer needs an engine job (1 Sol of drone time). | R1 #2 | FIXED (Back); OPEN (drone job) |
| B3 | Reload loses progress between Sols; blocked storage fails silently. | `main.js` | Save after consequential commands and on page exit; show a message when saving fails. | R1 #3 | OPEN |
| B4 | Continue accepts invalid or old saves. | `main.js` | Validate and migrate by `version`; merge defaults deeply; say what happened. | R1 #4 | OPEN |
| B5 | A missing sheet throws before the placeholder is drawn. | `atlas.js` | Safe placeholder sizes in `bbox`, `unionBox`, `cellRect`. | R1 #5 | OPEN |
| B6 | The finale's ASTRA lines at 75% and 85% never fire; Expedition 5 brings no Canyon or Brine Sample. | `expeditions.js` | Dispatch ASTRA marks apart from radio marks; add the protected samples. | R1 #6, R2 #2 | CLAIMED Mykhailo |
| B7 | Ice Run cannot be chosen; any story trip can be repeated for full loot. | `campaign-ui.js`, `expeditions.js` | Run-mode command and map selector; a done lock for story trips. | R1 #7 | CLAIMED Mykhailo |
| B8 | A failed antenna try clears Dilemma 4 B and loses its outcome. | `story.js` | Keep the dilemma context until the window ends. | R1 #8 | OPEN |
| B9 | Recurring breakdowns and several failure penalties are missing. | `story.js` | Persistent breakdown state with schedules (plan P2). | R1 #9 | OPEN |
| B10 | Every Solar Wipe win replays the tutorial battery step. | `main.js` | Tutorial transitions only in the tutorial. | R1 #10 | FIXED |
| B11 | Washing the soil (Dilemma 3 A or C) has no button. | UI, `story.js` | A Lab action with its cost and drone time. | R1 #11 | OPEN |
| B12 | Sol Plans and Fitness are missing. | everywhere | SCENARIO 3.10 and 3.11. | R1 #12 | OPEN |
| B13 | Wheel Vacuum cleans on mouse hover without a press. | `minigames2.js` | Clean only while the pointer is down. | R1 #13 | FIXED |
| B14 | The battery step can finish twice. | `minigames.js` | Ignore input after done; cancel the timer. | R1 #14 | FIXED |
| B15 | Skip drops the transition sounds; ASTRA does not finish a line when the next is due. | `main.js`, `astra.js` | Fire cues for a skipped interval; finish-and-hold. | R1 #15 #16 | OPEN |
| B16 | The report and badge accounting are incomplete; the Logbook has no pictures. | `campaign-ui.js` | Record flare shelter and loss, story items; show images. | R1 #17 #18 | OPEN |
| B17 | The Run radio shows string keys. | `expeditions.js` | Use `radio.run.<percent>.<variant>`. | R1 #19 | CLAIMED Mykhailo |
| B18 | Small screens and big interface sizes clip cards. | CSS | Scrollable cards, real pixel targets. | R1 #20 | OPEN |
| B19 | The audio director is not connected. | `main.js` | PR #7 (Pavlo) and PR #8 (Mykhailo). | R1 #22 | OPEN |
| B20 | Dilemma 1 B caps Power at 100 even with a battery; Dilemma 5 A repeat trip and C repair cost are not implemented; Dilemma 3 B, 4 C and Event 3 C need drone jobs; timed effects use calendar cut-offs. | `story.js`, `expeditions.js` | R2 has 23 numbered items with a fix each. | R2 | OPEN (Mykhailo's files) |

## C. Found by the main agent

| # | Problem | Fix | Status |
|---|---|---|---|
| C1 | I moved dormant Drones #02 and #03 onto the surface mounds in the last batch. SCENARIO says "from here on they sit dormant in the Garage & Airlock frame"; the mounds are for the cutscene only. That deviation also caused A11. | Reverted (see A11). The dig-out animation plays in the Garage when the kit wakes them. | FIXED |
| C2 | The 22 fixes of [REVIEW_2026-11-14.md](REVIEW_2026-11-14.md). | | FIXED |
| C3 | Two tests fail on the current `main` because of Mykhailo's work in progress on `expeditions.js` and `story.js` (`radio.expice.00`, the +2 SP replay test). | Not touched; theirs. | CLAIMED Mykhailo |
