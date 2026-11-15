# Pitch deck: ARES-KIDS, The Jezero Signal

The 90-second hackathon pitch: 7 slides, one HTML file, works offline.
Its story: the problem and the game (slides 1-5), then **the mission** (slide 6) and **the promise** (slide 7).

**Open `index.html` in a browser** (double-click, then F11 for full screen).
`ARES-KIDS-pitch.pdf` is a static backup (7 pages, no animation) for a laptop that misbehaves.

| Key | What it does |
|---|---|
| Arrows, Space, PageUp / PageDown, 1-7, Home / End | move between slides (swipe on a touch screen) |
| N | speaker notes: the script of the slide and its time window (use on a second screen or while rehearsing) |
| T / Shift+T | rehearsal clock: start or pause / reset. Green inside the slide's window, amber and red when early or late |
| E | edit the text in the browser (kept in this browser); Ctrl+S downloads a copy of the page |

## Timing: 206 words, about 137 words per minute

| Slide | Time | Seconds |
|---|---|---|
| 1 Hook | 0:00-0:11 | 11 |
| 2 The Game | 0:11-0:23 | 12 |
| 3 Core Loop | 0:23-0:37 | 14 |
| 4 Audience | 0:37-0:45 | 8 |
| 5 Tech Stack | 0:45-0:55 | 10 |
| 6 Our Mission | 0:55-1:14 | 19 |
| 7 Our Promise | 1:14-1:30 | 16 |

The script of each slide is in the `notesData` block at the end of `index.html`. A slide shows at most 15 words.

## The mission, in the team's own words

Slide 6 follows the project description of the team (`content/submission/PROJECT_DESCRIPTION.md` and `PITCH.md` on the branch
`content/space-apps-submission`): children hear that people will live on Mars, but the hard parts are invisible (the air, the water, the
radiation, the dust). The mission is to make that science playable, and to teach kids to ask "how do we know?".
The picture is an X-ray of the base at night: five invisible things (solar power, dust storms, radiation, oxygen, water) appear as markers.

## Keep the claims honest

Checked against [docs/submission/DEMO_VIDEO.md](../docs/submission/DEMO_VIDEO.md) ("Do not say") and the sources of the project:

- **"Every number labelled"**: NASA data, approximation or game value ([SCENARIO.md](../SCENARIO.md), "Data labels").
- **"100 claims fact-checked"**: [content/science/FACT_CHECK.md](../content/science/FACT_CHECK.md) (100 checked, 84 correct, 16 fixed).
- **"51 NASA-linked logbook cards"**: [src/campaign/logbook.js](../src/campaign/logbook.js) has 58 cards, 51 of them cite a NASA source.
- **"The Mars crews of 2042"**: the game's own intro crawl says "YEAR 2042" (`crawl.06` in `content/data/strings.en.json`).
- **"Come play." (slide 7)** needs a way to play: a public link or a laptop with the game running. There is no GitHub Pages deploy yet
  ([docs/ERRORS.md](../docs/ERRORS.md) C18).
- **Audience.** The pitch brief says Subnautica and Surviving Mars fans; [SCENARIO.md](../SCENARIO.md) says children 7-12 and adults. Slide 4 shows both.
- **"Radiation shielding", "seventy percent", "twenty sols", "nine mini-games"**: [README.md](../README.md) and [SCENARIO.md](../SCENARIO.md).
- The DONKI solar-storm data is only in the old `src/sim` engine, so it is not mentioned.

## What is in the folder

- `index.html`: all CSS and JS. The theme (colours, fonts) is at the top, in `:root`.
- `assets/`: screenshots of the running game (1920 x 1080 window, taken with Playwright in Edge), the icons and the Pip sprite cut from the game's own
  atlas, and two self-hosted fonts (Pixelify Sans, Chakra Petch, SIL Open Font License).
- The pictures show the procedural stand-in art of the game, not final art.
