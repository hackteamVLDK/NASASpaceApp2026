# ARES-KIDS: The Jezero Signal

A browser game for **NASA Space Apps Challenge 2026**: a 2D pixel-art side-view cutaway of a partly
finished underground Mars base. Builder drones fell asleep in a dust storm; you land, wake them,
finish the base and keep the crew alive. It teaches real trade-offs (life support, power,
radiation shielding) to children aged 7-12 and adults. The binding story is [SCENARIO.md](SCENARIO.md).

## Run it

Needs Node 20+ and a modern browser. No install step, no build.

```bash
npm run dev          # then open http://localhost:5173
npm test             # all tests
```

Click **Start mission** (browsers need a click before they allow sound).

## What you can play today

1. **Text crawl** (19 s, `Skip >>` top right) and **landing cutscene**.
2. **Tutorial**: read the HP bar, click the sleeping **Drone #01**, win the *Solar Panel Static Wipe*
   (tap the sparking clumps, then swipe), drag the battery into the hatch and plug in the cable,
   then tap **Battery & Heating** and press **Build**.
3. **Play**: give each astronaut a job (Crew panel), finish the right wing, give the *shelter order*
   when a solar storm warning comes, keep oxygen, water, food and power up for 6 sols. Space pauses.

## Where things are

| Path | What |
|---|---|
| `index.html`, `styles/`, `src/main.js` | the page, its look, the game loop and tutorial |
| `src/sim/` | the simulation: pure, deterministic, no DOM |
| `src/flow/` | the opening from SCENARIO.md as data and functions of time, ASTRA 6.7, strings by line ID |
| `src/render/`, `src/ui/` | canvas drawing, HUD, ASTRA panel, mini-games, sound (read state, send commands) |
| `content/` | the story bible's data: `content/data/strings.en.json` holds every player-facing line |
| `assets/` | art: `incoming/` generated images, `manifests/` the asset list, `prompts/` generation prompts |
| `docs/` | design, levels, architecture, asset pipeline |
| `tools/` | dev server, Git sync, balance runner, asset generation and checking |

Team rules for people and AI agents: [AGENTS.md](AGENTS.md). Never commit secrets (`.env`, keys).
