# Asset pipeline

How the game's pictures get from an idea to the screen. **The agent writes the list and the
prompts. The team generates the images.** No agent generates images or spends paid credits.

- What to draw: [assets/manifests/asset-manifest.json](../assets/manifests/asset-manifest.json) — the single source of truth
- Ready-to-paste prompts: [assets/prompts/](../assets/prompts/README.md) — generated from the manifest
- Rules of the look: [assets/prompts/STYLE_GUIDE.md](../assets/prompts/STYLE_GUIDE.md)
- What is in the world: [SCENARIO.md](../SCENARIO.md) (binding)

## The principle: one style anchor, everything else "in the same style"

1. Generate `style.anchor` (the whole base Ares-1 as one picture) in several variants.
2. The team picks **one**. Save it as `assets/art/style/anchor.png`.
3. Every other asset is generated with the anchor attached as a reference image, with the
   words "make this asset in the same style" (already in each prompt). Assets that must fit
   each other (`module.finished` ↔ `module.unfinished`, `crew.eva` ↔ `crew.indoor`, the
   drones on the mound ↔ `drone.builder`) also attach each other; the prompt file lists them.

## Steps for one asset

| Step | Who | What |
|---|---|---|
| 1 | team | Open `assets/prompts/<id>.md`, attach the listed reference images, paste the prompt into the image tool |
| 2 | team | Pick the best result; save as `assets/incoming/<id>.png` (the exact name is in the prompt file) |
| 3 | team | Set `"status": "received"` in the manifest and run `npm run assets:prompts` |
| 4 | whoever processes art | Scale down by a whole number, re-quantise to the shared palette, cut sprite sheets into cells, remove a magenta `#FF00FF` background; save to the `file` path under `assets/art/` → `processed` |
| 5 | game code | Load and draw it → `integrated` |
| 6 | team | Check it on screen → `final` |

Statuses are listed in the manifest. **Honesty rule (AGENTS.md):** an asset is never marked
`processed`, `integrated` or `final` unless the image file exists; a test checks it.
Code-drawn placeholders are `procedural-standin` and never final.

## Sizes, in one place

The scenario's world is 1920 × 3200 units. **PROPOSAL:** 5 units = 1 art pixel (every
coordinate in the scenario divides by 5), so the world is 384 × 640 art pixels and the screen
window (1920 × 1080 units) is 384 × 216, scaled ×5 on a full-HD screen.

| Thing | Units | Art pixels |
|---|---|---|
| Module (one room) | 600 × 270 | 120 × 54 |
| Ladder shaft | 120 × 270 | 24 × 54 |
| Astronaut (height) | 175 | 35 |
| Airlock dome | 180 × 120 | 36 × 24 |
| Ground line | Y 1050 | Y 210 |

Image tools do not produce exact pixel art. Ask for a large picture, then scale it down by a
whole number; the prompts say so. Sprite sheets are strict grids so they can be cut by size.

## Fallbacks (SCENARIO section 6, rule 3)

Until a picture exists, the game draws clean geometric placeholders with clear labels at the
exact coordinates: `LANDER`, `AIRLOCK`, `DRONE_01`, `LIFE_SUPPORT`. So the whole opening can
be tested without art. Placeholders have the status `procedural-standin`.

## Audio

The manifest also lists the sounds the scenario names (typewriter blip, bass boom, wind hum,
parachute, retro-rocket, landing thud, airlock hiss, ASTRA chime). Their times are in
`src/flow/intro.js` (`SFX_CUES`, `cuesBetween`). Files go into `assets/audio/` (not created
yet; no audio tool is part of the pipeline).

## Changing the list

1. Edit `assets/manifests/asset-manifest.json`.
2. `npm run assets:prompts` regenerates the prompt files; `npm run assets:check` fails if
   they are stale. `npm test` includes the same check, plus checks that sheet sizes match
   their grids and that the world numbers match `src/data/base-layout.js`.
3. If you add something the scenario does not contain, write `PROPOSAL` in its notes.

## Open points that affect art

See [LEVELS.md](LEVELS.md), "Open points in the scenario": how many astronauts arrive and who
they are (portraits, recolouring), whether the Hydroponics bay exists, and the real layout
of rooms inside the wings.
