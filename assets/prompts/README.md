# Asset prompts — index

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

Order of work: **generate `style.anchor` first and choose one result together.** Every other
asset is then generated with that image attached as the style reference. See
[STYLE_GUIDE.md](STYLE_GUIDE.md) and [../../docs/ASSET_PIPELINE.md](../../docs/ASSET_PIPELINE.md).

| Tier | Asset | What | Status | Needs first |
|---|---|---|---|---|
| 0 | [style.anchor](style.anchor.md) | Style anchor — Ares-1 in one picture | received | — |
| 1 | [bg.sky](bg.sky.md) | Martian sky and Jezero Crater rim | received | style.anchor |
| 1 | [terrain.tiles](terrain.tiles.md) | Martian soil and sand — tile set | received | style.anchor |
| 1 | [surface.airlock](surface.airlock.md) | Surface habitat with the Airlock dome | received | style.anchor |
| 1 | [surface.solar-panels](surface.solar-panels.md) | Solar panels — dusty and clean | received | style.anchor |
| 1 | [surface.antenna](surface.antenna.md) | Radio tower and dish — bent and repaired | received | style.anchor |
| 1 | [surface.mound](surface.mound.md) | Regolith mound with buried drones | awaiting-generation | style.anchor, drone.builder |
| 1 | [lander.craft](lander.craft.md) | Mars lander | received | style.anchor |
| 1 | [lander.parachute](lander.parachute.md) | Parachute and thruster flames | received | style.anchor |
| 1 | [fx.dust-burst](fx.dust-burst.md) | Red dust burst at touchdown | received | style.anchor |
| 1 | [crew.indoor](crew.indoor.md) | Astronaut, indoor jumpsuit — sprite sheet | received | style.anchor |
| 1 | [crew.eva](crew.eva.md) | Astronaut, EVA suit — sprite sheet | awaiting-generation | style.anchor, crew.indoor |
| 1 | [drone.builder](drone.builder.md) | Builder drone (Drone #01, #02, #03) — sprite sheet | received | style.anchor |
| 1 | [astra.avatar](astra.avatar.md) | ASTRA 6.7 — animated avatar | received | style.anchor |
| 1 | [module.bedroom](module.bedroom.md) | Bedroom (left wing, online) | received | style.anchor |
| 1 | [module.dining](module.dining.md) | Dining Room (left wing, online) | received | style.anchor |
| 1 | [module.lifesupport](module.lifesupport.md) | Water & Air Life Support (left wing, online) | received | style.anchor |
| 1 | [module.unfinished](module.unfinished.md) | Right wing, unfinished — four frames | received | style.anchor, drone.builder |
| 1 | [module.finished](module.finished.md) | Right wing, finished — four frames | awaiting-generation | style.anchor, module.unfinished, vehicle.rover |
| 2 | [prop.shaft](prop.shaft.md) | Ladder shaft | received | style.anchor |
| 2 | [vehicle.rover](vehicle.rover.md) | Rover | received | style.anchor |
| 2 | [room.hydroponics](room.hydroponics.md) | Hydroponics bay (proposed module) | awaiting-generation | style.anchor |
| 1 | [minigame.drone-repair](minigame.drone-repair.md) | DroneRepairMiniGame — modal art | received | style.anchor, drone.builder |
| 1 | [ui.astra-panel](ui.astra-panel.md) | ASTRA panel frame and buttons | awaiting-generation | style.anchor, astra.avatar |
| 2 | [ui.icons](ui.icons.md) | HUD icons | awaiting-generation | style.anchor |
| 2 | [fx.weather](fx.weather.md) | Weather and storm overlays | awaiting-generation | style.anchor |
| 2 | [ext.upgrades](ext.upgrades.md) | Surface upgrades | awaiting-generation | style.anchor, surface.airlock |
| 3 | [crew.portraits](crew.portraits.md) | Crew portraits | awaiting-lore | style.anchor, crew.indoor |
| 3 | [ui.title](ui.title.md) | Title screen and logo | awaiting-lore | style.anchor |

## Sound

| Id | When | What | Status |
|---|---|---|---|
| `sfx.type-blip` | every revealed character of the text intro | Among Us-style high-pitched electronic blip/chirp | awaiting-generation |
| `sfx.bass-boom` | final line of the text intro | Low bass boom | awaiting-generation |
| `sfx.wind-hum` | 10.0 s onwards, looped | Martian wind hum | awaiting-generation |
| `sfx.parachute-deploy` | 10.0 s | Parachute deploy | awaiting-generation |
| `sfx.retro-rocket-roar` | 14.0 s | Retro-rocket roar | awaiting-generation |
| `sfx.landing-thud` | 16.0 s | Metallic landing thud | awaiting-generation |
| `sfx.airlock-hiss` | 16.8 s (PROPOSAL; scenario gives only the order) | Airlock hiss | awaiting-generation |
| `sfx.astra-chime` | 24.0 s, ASTRA slides in | Energetic chime | awaiting-generation |
