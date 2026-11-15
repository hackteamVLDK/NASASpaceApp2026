# Demo video: 30 seconds (version 2, 2026-11-15)

Replaces `content/submission/DEMO_VIDEO_SCRIPT.md` on the `content/space-apps-submission` branch, which was
written before the browser game existed ("the browser game is not built yet"). Everything below is
**in the playable game on `main` today**; nothing planned is shown.

## Rules we are writing to

- Video **up to 30 seconds**, **English subtitles required** (speaking another language is allowed),
  hosted behind a **public link** (YouTube or Google Drive); files cannot be uploaded to the Space Apps site.
- Open by introducing yourself and your team.
- Judged on **Impact, Creativity, Validity, Relevance, Presentation**.
- Sources: [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/),
  [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide).
  The pages found were the 2025 versions: open the 2026 guide in a browser and confirm before uploading.
- Deadline (from the 2026 event page, as quoted by search results): **Sun 15 Nov 2026, 23:59 local time**.

## Do not say

- **Not** "real 2024 solar storms from NASA DONKI": that data is only in the old `src/sim` engine; the
  playable campaign does not use it. Saying it would hurt *Validity*.
- **Not** co-op, crew of four, or a Sol Plan screen: not in the playable game yet.

## Facts we may say (checked on `main`, 2026-11-15)

| Claim | Where it is true |
|---|---|
| 20-Sol story, Jezero Crater, ASTRA 6.7 station AI | `SCENARIO.md`, `src/campaign/` |
| 9 repair mini-games | `src/campaign/story.js` `MINI_GAMES` |
| 5 Rover expeditions + repeatable Scrap and Ice Runs | `src/campaign/expeditions.js` |
| 58 Science Logbook cards, 51 linked to a NASA source; 15 badges | `src/campaign/logbook.js` |
| 100 science claims fact-checked, 16 fixed | `content/science/FACT_CHECK.md` |
| Every number labelled NASA data, approximation or game value | `SCENARIO.md` "Data labels" |
| Underground rooms get less radiation, never zero; 98% water recycling (ISS); oxygen from CO2 (MOXIE) | `src/campaign/data.js`, ASTRA lines |
| Nobody dies: HP 0 means rest | `SCENARIO.md` core rules. *Check A28 first:* if the team keeps the Game Over rule, cut the last sentence |

## Shot list and voice-over (about 72 words, 2.4 words per second)

| Time | Shot (from the game, 1920x1080) | Voice-over = subtitle |
|---|---|---|
| 0:00-0:03 | Intro crawl typing "YEAR 2042. MISSION: ARES-KIDS." | We're Mykhailo, Vlad and Pavlo, team hackteamVLDK. This is ARES-KIDS. |
| 0:03-0:07 | Landing: parachute, retro-rockets, camera pans down into the base | Kids aged seven to twelve land in Jezero Crater and rebuild a half-buried Mars base. |
| 0:07-0:12 | Base cutaway; ASTRA panel slides in; Drone #01 wakes | ASTRA, the station AI, explains real science: soil over the rooms blocks radiation. |
| 0:12-0:17 | Dust storm darkens the sky, then the Solar Wipe mini-game | Dust storms, freezing nights and solar flares become nine quick repair games. |
| 0:17-0:22 | Crater map, the Rover drives out, radio log, loot screen | The Rover explores the crater and brings back parts to grow the base. |
| 0:22-0:27 | Logbook card with its NASA source; Mission Report stars | Each event unlocks a card from a real NASA mission. We fact-checked a hundred claims. |
| 0:27-0:30 | Title card and the repository link | No one dies here. You learn why. Thanks! |

## Capturing the shots

1. `npm run dev`, open the game in a 1920x1080 browser window, browser zoom 100%.
2. The intro and landing play by themselves (0:00-0:12): record from New game.
3. The storm comes on Sols 4-6; the Rover needs the Garage. To reach those scenes quickly, record a
   prepared save, or a teammate plays ahead and records only the moments above.
4. Keep each clip 4-6 seconds; cut on movement.
5. Subtitles: `DEMO_VIDEO.en.srt` (next to this file). Burn them in, or upload the `.srt` with the video.
6. Upload as Public or "anyone with the link"; open the link in a private window to test it.
