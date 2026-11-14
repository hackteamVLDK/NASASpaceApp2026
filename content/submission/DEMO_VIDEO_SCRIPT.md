# Demo video script (30 seconds)

**Official limit:** demo video up to **30 seconds**, with **English subtitles**, hosted at a
**public link** (NASA Space Apps Project Submission Guide,
https://www.spaceappschallenge.org/resources/project-submission-guide/ — confirm the limit in a
browser before recording). The guide asks you to open by introducing yourself and your team.

**Honesty rule for this video:** the browser game is not built yet, so we show only what exists:
the script, the running simulation, the NASA data and the fact-check. Anything else is labelled
"planned" on screen.

Total spoken words: ~75 (about 2.5 words per second, comfortable for 30 s).

| Time | On screen | Voice-over (English, also burned in as subtitles) |
|---|---|---|
| 0:00–0:04 | Black screen, typewriter text: `ARES-KIDS: THE JEZERO SIGNAL`, then the team name. | "Hi, I'm Vlad from team hackteamVLDK. This is ARES-KIDS." |
| 0:04–0:09 | `SCENARIO.md` scrolling through the intro crawl and ASTRA 6.7 lines; caption "Game script for ages 7–12". | "A Mars base-builder for kids aged seven to twelve, set in real Jezero Crater." |
| 0:09–0:16 | Terminal: `node tools/balance/run-level.mjs`, one line per Sol, crew radiation dose in mSv, the storm shelter objective marked done. Caption "Simulation engine: built". | "Our engine already simulates air, water, power, and radiation room by room, with real 2024 solar storms from NASA's DONKI database." |
| 0:16–0:23 | `content/science/FACT_CHECK.md` table: verdict and source columns, rows with NASA links. Caption "75 claims checked". | "We checked seventy-five science claims against NASA and peer-reviewed sources, and labelled every number: NASA data, approximation, or game value." |
| 0:23–0:28 | Art style guide and asset prompts (`assets/prompts/`); caption "Art and browser game: planned". | "Next: pixel art and the browser game." |
| 0:28–0:30 | Repository URL on black. | "Thanks!" |

## Recording notes

- Record the screen at 1920×1080; enlarge the terminal font so the dose numbers are readable on a phone.
- Run the level runner once before recording so the output is ready; do not edit its output.
- Subtitles: burn them in, or upload an English `.srt` with the video.
- Upload as public (or "anyone with the link") and test the link in a private browser window.
