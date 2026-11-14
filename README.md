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

The whole 20-Sol story of [SCENARIO.md](SCENARIO.md) v2, solo (one Commander and three builder drones):

1. **Text crawl** (19 s, `Skip >>`) and the **landing cutscene**.
2. **Tutorial**: HP bar, click the sleeping **Drone #01**, win the *Solar Panel Static Wipe*, drag the
   battery into the hatch and snap the cable, then tap **Battery & Heating** and press **Build**.
3. **Act I-III**: finish the six right-wing modules with the drones (Base tab), craft parts in the Workshop,
   wake Drones #02 and #03, survive the dust storm and the dilemmas, send the Rover to five places from the
   crater map (Garage), read the radio, decode Pathfinder-X's black box, and reach the **Canyon Anomaly**.
4. **Mini-games** when the base needs them: Static Wipe, Heat Pump Pipes, Valve Balance, Water Sort, Nutrient
   Match, Air Filter, Antenna Alignment, Wheel Pebble Vacuum, Suit Seal Check.
5. **Science Logbook** (58 cards), **badges** and the **Mission Report** with a 9-star rating; then **Free-Play**.

Space pauses, the game saves each Sol (Continue mission).

## Where things are

| Path | What |
|---|---|
| `index.html`, `styles/`, `src/main.js` | the page, its look, the game loop and tutorial |
| `src/campaign/` | THE GAME'S SIMULATION (SCENARIO v2): economy, modules, drones, story, dilemmas, expeditions, logbook. Pure, deterministic, no DOM |
| `src/sim/` | the first, hourly-schedule simulation. No longer used by the game; kept with its tests |
| `src/flow/` | the opening from SCENARIO.md as data and functions of time, ASTRA 6.7, strings by line ID |
| `src/render/`, `src/ui/` | canvas drawing, HUD, ASTRA panel, mini-games, sound (read state, send commands) |
| `content/` | the story bible's data: `content/data/strings.en.json` holds every player-facing line |
| `assets/` | art: `incoming/` generated images, `manifests/` the asset list, `prompts/` generation prompts |
| `docs/` | design, levels, architecture, asset pipeline |
| `tools/` | dev server, Git sync, balance runner, asset generation and checking |

Team rules for people and AI agents: [AGENTS.md](AGENTS.md). Never commit secrets (`.env`, keys).
