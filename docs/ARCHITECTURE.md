# Architecture

No build step, no dependencies. Plain ES modules that run both in the browser and in Node.

```
index.html, styles/        prototype page (text only, no art yet)
src/
  sim/                     THE GAME. Pure simulation, no DOM, deterministic.
  data/                    Levels, base layout, crew roster, NASA reference values and datasets.
  ui/                      Browser-only: storage, the prototype dashboard. Later: HUD.
  render/                  (not built yet) canvas renderer that draws the state with real assets.
  main.js                  Browser entry point: game loop, wires sim to ui.
tests/                     node --test, simulation only.
tools/
  git-sync/                Two-way Git sync service.
  codex/                   Delegation to the local Codex CLI.
  balance/                 Headless level runner for tuning.
  data/                    Scripts that build files in src/data from raw NASA downloads.
  dev-server.mjs           Static file server for local play.
assets/
  prompts/                 One prompt file per asset + the style guide.
  manifests/               asset-manifest.json: every asset and its honest status.
  incoming/                Where teammates drop generated images.
docs/                      Design, levels, architecture, sync, assets, AI collaboration records.
git_status_<Name>          One status file per device's agent (see AGENTS.md).
```

## The one rule

**`src/sim/` knows nothing about the screen.** It takes a state and commands, and returns a
new state and events. Everything else — drawing, sound, buttons, saving to disk — sits
outside and can be replaced without touching it.

```
            commands                     events, state
  UI  ───────────────────►  src/sim  ───────────────────►  UI / renderer
 (buttons)   applyCommand()   step()      (read only)       (draws, plays sounds)
```

That is why the game could be built and tested before a single image existed, and why the
art can arrive later without risk to the logic.

## Simulation API

Everything outside `src/sim/` imports from [src/sim/index.js](../src/sim/index.js) only.

```js
import { createGame, step, applyCommand, serialize, deserialize } from './sim/index.js';

const game = createGame('L1-first-sols', { seed: 1 });        // plain data object
const events = step(game, 60);                                 // advance one Mars-hour
applyCommand(game, { type: 'assign', crew: 'sci', job: 'explore' });
applyCommand(game, { type: 'shelter', on: true });
localStorage.setItem('save', serialize(game));
```

| Function | Purpose |
|---|---|
| `createGame(levelId, { seed })` | new game state for a level |
| `step(state, minutes)` | advance; returns the events that happened |
| `applyCommand(state, cmd)` | player action; returns `{ ok }` or `{ ok: false, error }` |
| `summary(state)`, `roomReport(state, room)`, `reserves(state)` | read-only views for the UI |
| `evaluateObjectives`, `scoreBreakdown`, `starRating` | progress and results |
| `serialize` / `deserialize` | game save as text, validated on load |
| `newProfile`, `recordResult`, `serializeProfile`, `deserializeProfile` | campaign progress |

**Commands:** `assign { crew, job }` · `shelter { on }` · `autoAllClear { on }` ·
`startProject { project }` · `pauseProject`.

**Events** (returned by `step`, described for players in `src/sim/messages.js`):
`sol-start`, `storm-warning`, `storm-start`, `storm-end`, `all-clear`, `dust-storm-start`,
`dust-storm-end`, `dust-devil`, `emergency`, `emergency-over`, `dose-warning`,
`crew-grounded`, `project-done`, `achievement`, `hint`, `level-complete`, `level-failed`.

## Inside the simulation

| Module | Owns |
|---|---|
| `sim.js` | `createGame`, the one-minute step, commands, storm lifecycle, hints, log |
| `crew.js` | what each astronaut does: schedule, walking, work, meals, sleep, dose, mood, health |
| `resources.js` | power and load shedding, oxygen, water, greenhouse, wear, emergencies |
| `radiation.js` | shielding layers → transmission → dose rate |
| `space-weather.js` | storm shapes; turning the NASA DONKI catalogue into game storms |
| `objectives.js` | objectives, score, stars, achievements |
| `pathfinding.js` | shortest routes through the room graph |
| `save.js` | save text and campaign profile, with validation |
| `messages.js` | every player-facing sentence about an event |
| `constants.js` | every tunable number, each with a provenance tag |
| `rng.js` | seeded random numbers; the generator state lives in the game state |

Order within one simulated minute: environment → power → crew → life support → vitals →
achievements, hints, log, end-of-level check.

### Determinism

Same level + same seed + same commands at the same minutes = the same game, bit for bit.
No `Math.random()`, no `Date.now()`, no hidden module state that affects results. Two tests
guard this: replaying a game twice, and stepping in one call versus minute by minute. It is
what makes saves exact, bugs reproducible, and balance runs comparable.

### State

One plain object, JSON-serialisable, no classes. Top-level keys: `levelId`, `minute`,
`status`, `resources`, `systems`, `power`, `alerts`, `emergencies`, `env`, `crew[]`,
`projects`, `extraShielding`, `storms[]`, `dustStorms[]`, `science`, `stats`, `objectives[]`,
`achievements[]`, `hintsShown[]`, `log[]`, `rng`, `result`.

Changing the shape of the state means bumping `STATE_VERSION` in `sim.js`; old saves are then
refused with a clear message (migration is not written yet).

## Data and provenance

- `src/data/nasa/reference.js` — NASA values with sources. Nothing else may be tagged
  `nasa-measurement`; a test enforces that tagged tuning values match this table.
- `src/data/nasa/donki-sep-2024.js` — generated from the NASA DONKI API by
  `tools/data/build-donki-sep.mjs`. Do not edit by hand.
- `src/sim/constants.js` — `TUNING` (numbers) and `TUNING_PROVENANCE` (tag + reason for each).
  A test fails if a number is added without its provenance entry.

## Rendering (planned)

The renderer will be a function of the state: given `state` and the asset manifest, draw.
What it needs is already there:

- room positions: `floor`, `col`, `span` in `src/data/base-layout.js`;
- where each astronaut is: `crew[i].location`, and while walking `crew[i].move`
  (`from`, `to`, `total`, `left`) to interpolate the position along the edge;
- what they are doing: `crew[i].activity` (`sleep`, `walk`, `work`, `meal`, `exercise`,
  `free`, `shelter`, `recover`) → which animation;
- time of day and weather: `clockAt(state.minute)`, `state.env`.

Assets are looked up by id through `assets/manifests/asset-manifest.json`, so art can be
swapped in without code changes. See [ASSET_PIPELINE.md](ASSET_PIPELINE.md).

## Tests

`npm test` runs everything; `npm run test:sim` only the simulation (under a second);
`npm run test:sync` the Git sync integration tests (about two minutes — they create real
throwaway repositories in the temp directory).
