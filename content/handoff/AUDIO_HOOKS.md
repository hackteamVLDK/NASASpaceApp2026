# Audio hooks: where the game calls the audio director

Audio lives in `src/audio/`:
- `soundManager.js`: the sound engine (`sfx`)
- `audioDirector.js`: decides when sounds play (`audioDirector`)

The campaign simulation (`src/campaign`, `src/sim`) never imports audio; a test enforces that.
Game and UI code report what happened, and the director plays the sound.

Status values:
- **PR-Pavlo**: wired in the hook PR for Pavlo's files (branch `feature/audio-hooks`).
- **PR-Mykhailo**: needs a one-line change in Mykhailo's `src/flow/` (branch `feature/audio-flow-char`).
- **missing UI**: the screen doesn't exist yet. Hook it when it is built.

## Director API

```js
import { audioDirector as audio } from '../audio/audioDirector.js';
audio.gesture();                       // first click: Start Mission / Continue / role select
audio.tick({ s, mode });               // every frame; mode: loading | intro | tutorial | play
audio.campaignEvents(events);          // events returned by step() / command()
audio.flowCue(cue);                    // intro cues from cuesBetween(); cue.char for type-blip
audio.astraLine(lineId, { slideIn });  // a line starts showing in the ASTRA panel
audio.typed(char);                     // one typed character (panel or crawl)
audio.radio(lineId);                   // a radio log line appears (also via campaignEvents)
audio.decisionShown(id);               // a dilemma / event / radio-decision card opens
audio.minigame(game, action);          // mini-game action, see the table below
audio.ui('click' | 'tab' | 'choice');
audio.cue(name, arg);                  // any sfx method name, or a legacy cue name
audio.toggleMute(); audio.setMusicVolume(v); audio.setSfxVolume(v); audio.settings
```

## Hooks

| Event | Call | Where | Status |
|---|---|---|---|
| Start Mission / Continue click | `gesture()` | `src/main.js` boot (via `ui/audio.js` `unlock()`) | PR-Pavlo |
| Continue a save | `reset(s)` after the save is loaded (restores victory music after the finale) | `src/main.js` boot | PR-Pavlo |
| Role select click (co-op lobby) | `gesture()` | lobby screen | missing UI |
| Every frame | `tick({ s, mode })`: music flags, dawn chime, drone work | `src/main.js` `loop()` | PR-Pavlo |
| Campaign events | `campaignEvents(events)` | `src/main.js` `handleEvents()` | PR-Pavlo |
| Intro cues (wind, parachute, rockets, thud, airlock, chime, blips, bass boom) | `flowCue(cue)` | `src/main.js` `loop()` | PR-Pavlo |
| Crawl blips pass the typed character | `cue.char` on `type-blip` cues | `src/flow/intro.js` `cuesBetween()` | PR-Mykhailo |
| ASTRA panel opens / new line | `astraLine(lineId, { slideIn })`: slide-in chime + lore cues + canyon window | `src/ui/astra-panel.js` `update()` | PR-Pavlo |
| ASTRA typewriter | `typed(char)` | `src/ui/astra-panel.js` `update()` | PR-Pavlo |
| ASTRA Next / Got it | `ui('click')` | `src/ui/astra-panel.js` | PR-Pavlo |
| Dilemma / event / radio-decision card | `decisionShown(id)` | `src/ui/campaign-ui.js` `showChoice()` | PR-Pavlo |
| Choice button | `ui('choice')` | `src/ui/campaign-ui.js` `showChoice()` | PR-Pavlo |
| Side-panel tabs | `ui('tab')` | `src/ui/campaign-ui.js` | PR-Pavlo |
| Other buttons (map, report, missions, gauges, skip) | `ui('click')` | `src/ui/*.js`, `src/main.js` | PR-Pavlo |
| HUD mute toggle | `toggleMute()` | `index.html` `#hud` + `src/main.js` | PR-Pavlo |
| Music / SFX sliders | `setMusicVolume(v)`, `setSfxVolume(v)` (0–1, saved) | settings / pause screen | missing UI |
| Badge earned | `cue('win')` | `src/main.js` `checkAllBadges()` | PR-Pavlo |

### Campaign events → sounds (inside the director)

| Event | Sound |
|---|---|
| `built`, `upgraded`, `crafted` | `moduleComplete` |
| `drone-awake` | `droneWake` |
| `emergency` | `alertEmergency` |
| `storm` (on) | `alertWarning` |
| `launched` | `airlockCycle` + `roverDepart` |
| `returned` | `airlockCycle` |
| `radio` | `radioPing` + lore cue |
| `astra` `astra.hp.zero_base` / `zero_expedition` | `medRestActivate` |
| `finale` | victory music on |
| `sandbox` | victory music ends 30 s later |
| night → day (from `tick`) | `solDawnChime` |
| a drone building in daylight (from `tick`) | `droneBuildTick`, at most every 2.5 s |

### Music flags (`tick` → `sfx.updateMusic`)

Priority: victory > storm/emergency > canyon > expedition > night > day.

| Flag | From |
|---|---|
| `victory` | `finale` event, until 30 s into Free-Play |
| `storm` | `s.storm`, or the pending decision is `e1` (solar flare) or `d5` (space weather) |
| `emergency` | any `s.emergency[*]` |
| `canyon` | Expedition 5 (`s.away.id === 5`), or the black box decoding: from `astra.act3.blackbox_decode_start` until 8 s after `astra.act3.blackbox_react2` shows (120 s at most) |
| `expedition` | `s.away` |
| `night` | 22:00–6:00 (`isNight`) |

No music during the intro crawl and landing cutscene.

### Lore cues by line ID

| Line | Sound |
|---|---|
| `log.pathfinder.02`, `radio.exp5.03` | `canyonSeismicThump` |
| `radio.exp5.04`, `radio.exp5.05` | `brineGeyserFrost` |

### Mini-games (`minigame(game, action)`)

`win` → `minigameWin` for every game. `move` repeats at most every 160 ms and only while the
pointer is pressed (the scaffold checks this).

| Game | Actions → sound |
|---|---|
| `solar_wipe` | `zap` → staticZap, `move`/`wipe` → brushWipe |
| `battery` | `insert`, `cable` → suitClampSnap |
| `air_filter` | `pull` → uiClick, `move` → brushWipe, `lock` → suitClampSnap |
| `valve_balance` | `down`/`move` → waterValveTurn |
| `water_sort` | `place` → suitClampSnap, `tap` → waterValveTurn |
| `heat_pump` | `rotate` → pipeRotate |
| `nutrient_match` | `drop` → nutrientDrop, `led` → uiClick |
| `wheel_vacuum` | `move` → vacuumHum, `pebble` → pebblePop, `patch` → suitClampSnap |
| `suit_seal` | `clamp` → suitClampSnap, `badge` → uiClick, `liner` → suitClampSnap |
| `antenna` | `move` → uiTabSwitch, `lock` → antennaLock (when 4+ bars are first reached) |

### Legacy cue names (still accepted by `cue()`)

`click`→uiClick, `win`→minigameWin, `zap`→staticZap, `chirp`→radioPing, `alert`→alertWarning,
`astra-chime`→astraSlideIn, `type-blip`→typewriterBlip, `bass-boom`→canyonSeismicThump,
`wind-hum`→landerDescent, `parachute-deploy`→brushWipe, `retro-rocket-roar`→landerDescent,
`landing-thud`→landerTouchdown, `airlock-hiss`→airlockCycle.

## Not hooked yet

- **Music / SFX sliders:** no settings or pause screen exists. The values are already saved by the
  engine, so a screen only needs to call `setMusicVolume` / `setSfxVolume` and read `settings`.
- **Role select:** no co-op lobby exists. Call `gesture()` from its first click.
- **Crawl characters:** until the Mykhailo PR is merged, crawl blips play without a character. That
  is fine; the character only skips spaces.
- **Audio tests are not in `npm test`:** its globs don't include `src/audio/*.test.mjs`, and
  `package.json` is Mykhailo's. Run them with `node --test src/audio/*.test.mjs` until he adds them.
