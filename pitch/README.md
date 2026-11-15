# Pitch deck: ARES-KIDS, The Jezero Signal

The 90-second hackathon pitch: 7 slides, one HTML file, works offline.

**Open `index.html` in a browser** (double-click, then F11 for full screen).
`ARES-KIDS-pitch.pdf` is a static backup (7 pages, no animation) for a laptop that misbehaves.

| Key | What it does |
|---|---|
| Arrows, Space, PageUp / PageDown, 1-7, Home / End | move between slides (swipe on a touch screen) |
| N | speaker notes: the script of the slide and its time window (use on a second screen or while rehearsing) |
| T / Shift+T | rehearsal clock: start or pause / reset. Green inside the slide's window, amber and red when early or late |
| E | edit the text in the browser (kept in this browser); Ctrl+S downloads a copy of the page |

## Timing: 205 words, about 137 words per minute

| Slide | Time | Seconds |
|---|---|---|
| 1 Hook | 0:00-0:11 | 11 |
| 2 The Game | 0:11-0:26 | 15 |
| 3 Core Loop | 0:26-0:44 | 18 |
| 4 Audience | 0:44-0:57 | 13 |
| 5 Tech Stack | 0:57-1:07 | 10 |
| 6 Business Model | 1:07-1:18 | 11 |
| 7 Closing | 1:18-1:30 | 12 |

The script of each slide is in the `notesData` block at the end of `index.html`. A slide shows at most 15 words.

## Keep the claims honest

Checked against [docs/submission/DEMO_VIDEO.md](../docs/submission/DEMO_VIDEO.md) ("Do not say") and the sources of the project:

- **"Playable now in your browser"** (slide 7) is true for judges only with a public link. There is no GitHub Pages deploy yet
  ([docs/ERRORS.md](../docs/ERRORS.md) C18). Until there is, say "playable now" together with a live demo or a local run.
- **"Next stop: Steam"** is a plan. The game is a browser game today; a Steam release needs a desktop wrapper that does not exist yet.
- **Audience.** The pitch brief says Subnautica and Surviving Mars fans; [SCENARIO.md](../SCENARIO.md) says children 7-12 and adults. Slide 4 shows both.
- **"The Earth-Mars radio delay is calculated from NASA orbital data"**: [src/data/nasa/lightTime.js](../src/data/nasa/lightTime.js)
  (NASA/JPL elements, labelled `approximation`). The DONKI solar-storm data is only in the old `src/sim` engine, so it is not mentioned.
- **"Twenty sols", "nine mini-games", "cuts your solar power by seventy percent"**: [README.md](../README.md) and [SCENARIO.md](../SCENARIO.md).

## What is in the folder

- `index.html`: all CSS and JS. The theme (colours, fonts) is at the top, in `:root`.
- `assets/`: screenshots of the running game (1920 x 1080 window, taken with Playwright in Edge), the icons and the Pip sprite cut from the game's own
  atlas, and two self-hosted fonts (Pixelify Sans, Chakra Petch, SIL Open Font License).
- The pictures show the procedural stand-in art of the game, not final art.
