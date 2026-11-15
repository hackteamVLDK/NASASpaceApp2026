# Pitch deck: ARES-KIDS, The Jezero Signal

The 90-second hackathon pitch: 7 slides, one HTML file, works offline.
Our NASA Space Apps 2026 challenge: **Build a Junior Astronaut Mission Trainer**.

| Slide | What it says |
|---|---|
| 1 Hook | the title, the challenge, "Survive Mars. Build the base." |
| 2 Our Mission | make the invisible science of Mars playable, and why it matters (a kid who is 8 today is a Mars crew member in 2042) |
| 3 Our Approach | how we spark curiosity in young explorers: hands-on tasks, a kind guide (ASTRA), real NASA places and missions, a mystery signal |
| 4 In the Game | how the game does it: an X-ray of the base, where radiation, oxygen, water, storms and solar power become things you decide |
| 5 Core Loop | gather resources, manage oxygen, build the base, survive the dust storm; how it is built (pure JavaScript, any browser) |
| 6 The Story | 20 Sols in three acts and one mystery signal; the story is fiction, the science is real |
| 7 Our Promise | every number labelled, 100 claims fact-checked, 51 NASA-linked logbook cards, nine mini-games |

**Open `index.html` in a browser** (double-click, then F11 for full screen).
`ARES-KIDS-pitch.pdf` is a static backup (7 pages, no animation) for a laptop that misbehaves.

| Key | What it does |
|---|---|
| Arrows, Space, PageUp / PageDown, 1-7, Home / End | move between slides (swipe on a touch screen) |
| N | speaker notes: the script of the slide and its time window (use on a second screen or while rehearsing) |
| T / Shift+T | rehearsal clock: start or pause / reset. Green inside the slide's window, amber and red when early or late |
| E | edit the text in the browser (kept in this browser); Ctrl+S downloads a copy of the page |

## Timing: 203 words, about 135 words per minute

| Slide | Time | Seconds |
|---|---|---|
| 1 Hook | 0:00-0:12 | 12 |
| 2 Our Mission | 0:12-0:27 | 15 |
| 3 Our Approach | 0:27-0:40 | 13 |
| 4 In the Game | 0:40-0:57 | 17 |
| 5 Core Loop | 0:57-1:07 | 10 |
| 6 The Story | 1:07-1:18 | 11 |
| 7 Our Promise | 1:18-1:30 | 12 |

The script of each slide is in the `notesData` block at the end of `index.html`.
Slides 1 and 7 are kept short (20 and 15 words); the explanation slides 2-6 carry 23 to 38 words each.

## The mission, in the team's own words

Slides 2 and 3 follow the project description of the team (`content/submission/PROJECT_DESCRIPTION.md` and `PITCH.md` on the branch
`content/space-apps-submission`): children hear that people will live on Mars, but the hard parts are invisible (the air, the water, the
radiation, the dust). The mission is to make that science playable, and to teach kids to ask "how do we know?".

## Keep the claims honest

Checked against [docs/submission/DEMO_VIDEO.md](../docs/submission/DEMO_VIDEO.md) ("Do not say") and the sources of the project:

- **The challenge title** was taken from the team's message ("Astronaft" corrected to "Astronaut"). The official challenge page could not be opened
  from the build machine (certificate error), so the challenge statement itself is not quoted anywhere: check the title and wording on spaceappschallenge.org.
- **"Age 8 today" to "Mars crew in 2042", "16 years"**: the game's own intro crawl says "YEAR 2042" (`crawl.06` in `content/data/strings.en.json`); 2042 minus 2026.
- **"Most space games skip the science"** is the team's own claim from the project description. It is an opinion; soften it if a judge asks.
- **ASTRA's "Close! Try once more."** is the game's own retry line ([SCENARIO.md](../SCENARIO.md) section 4). **Real NASA places and missions**: Jezero Crater, Perseverance, MOXIE and the ISS appear in ASTRA's lines.
- **Slide 4 labels**: "Clean the panels" is the Solar Wipe mini-game; "Storms cut solar power" is 70% in [SCENARIO.md](../SCENARIO.md); "Soil shields the rooms" (radiation is reduced,
  never zero); "Oxygen from CO2" is the MOXIE line and the Valve Balance mini-game; "Recycle 98% of water" is the ISS figure; "9 mini-games, each tied to a real Mars problem" is SCENARIO section 4.
- **Slide 5**: plain ES modules and a canvas, no engine and no build step ([README.md](../README.md)). "Any browser, no install" holds for the player; a public link still needs a deploy (below).
- **Slide 6**: Acts and Sols come from the story table of [SCENARIO.md](../SCENARIO.md) (Wake Up 1-6, Reach Out 7-13, The Signal 14-20). The signal and the black box are fiction there too, which is why the slide says so.
- **"Every number labelled"**: NASA data, approximation or game value ([SCENARIO.md](../SCENARIO.md), "Data labels").
- **"100 claims fact-checked"**: [content/science/FACT_CHECK.md](../content/science/FACT_CHECK.md) (100 checked, 84 correct, 16 fixed).
- **"51 NASA-linked logbook cards"**: [src/campaign/logbook.js](../src/campaign/logbook.js) has 58 cards, 51 of them cite a NASA source.
- **"Come play." (slide 7)** needs a way to play: a public link or a laptop with the game running. There is no GitHub Pages deploy yet ([docs/ERRORS.md](../docs/ERRORS.md) C18).
- The DONKI solar-storm data is only in the old `src/sim` engine, so it is not mentioned.

## What is in the folder

- `index.html`: all CSS and JS. The theme (colours, fonts) is at the top, in `:root`.
- `assets/`: screenshots of the running game (1920 x 1080 window, taken with Playwright in Edge), the icons and the characters (ASTRA, the Commander, the astronaut, Pip, the Rover, the antenna)
  cut from the game's own atlas, and two self-hosted fonts (Pixelify Sans, Chakra Petch, SIL Open Font License).
- The pictures show the procedural stand-in art of the game, not final art.
