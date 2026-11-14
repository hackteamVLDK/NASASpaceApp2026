# Review audio integration

| Field | Value |
|---|---|
| Kind | review |
| Mode | read-only (sandbox: read-only) |
| Date | 2026-11-14 |
| Branches | `feature/audio`, `feature/audio-hooks`, `feature/audio-flow-char` |
| Tool | `node tools/codex/delegate.mjs run --no-record ...`, codex-cli 0.169.0, ChatGPT login, no API key |
| Result | exit 0 in 63 s; no working-tree changes |

## Task sent to Codex

Read-only review of the audio integration for a browser Mars base-builder for kids (plain ES modules,
Web Audio API, no dependencies). Do not edit files.

Review these diffs (use git; the working tree is on feature/audio-hooks):
- git diff main...feature/audio-hooks   (src/audio/soundManager.js, src/audio/audioDirector.js, tests,
  content/handoff/AUDIO_HOOKS.md, and hooks in src/main.js, src/ui/*.js, index.html, styles/game.css)
- git diff feature/audio...feature/audio-flow-char   (one line in src/flow/intro.js)

Requirements the code must meet:
1. No AudioContext before the first user gesture; sfx.unlock() on Start Mission / Continue.
   Importing src/audio/* in Node must not touch window.
2. The campaign simulation (src/campaign, src/sim) stays audio-free; audioDirector subscribes to events.
3. Music via sfx.updateMusic({victory, storm, emergency, canyon, expedition, night}) only when a flag
   changes; priority victory > storm/emergency > canyon > expedition > night > day. Dawn chime at
   night->day. canyon = black-box decoding (Sol 16) and Expedition 5. victory = finale, falls back to
   base music ~30 s into sandbox.
4. Typewriter blip gets the typed char; lore cues: canyonSeismicThump on log.pathfinder.02 and
   radio.exp5.03; brineGeyserFrost on radio.exp5.04 and radio.exp5.05.
5. Mute toggle in the HUD; volumes/mute persisted.

Look for: correctness bugs, double-played sounds, sounds that never fire, timers/intervals that leak
(music loops, setTimeout in storm music after stop), behaviour when muted then unmuted (does music
resume?), hidden-tab handling, throttles that drop needed sounds, save/continue edge cases, and any
requirement above that is not met. Output a numbered list: file:line, severity (high/medium/low),
problem, concrete fix. Be concise. Then list anything you checked and found correct.

## Codex response

## Summary
The integration meets most core requirements, but has problems with hidden-tab playback, volume routing, duplicate effects, and restoring timed music on Continue. The audio tests pass; browser playback was not verified. No files or Git state were changed.

## Findings
1. **Severity: major (high). Location: `src/audio/soundManager.js:94`, `:141`, `:197`.** Hidden-tab suspension is undermined by `init()`, which resumes any suspended context when an SFX plays. Music intervals also keep creating notes while suspended, scheduling them against frozen audio time and potentially stacking them on return. **Fix:** suppress scheduling while hidden, pause music timers, and restart scheduling on visibility restoration.

2. **Severity: major (medium). Location: `src/audio/soundManager.js:132`.** The shared reverb connects directly to the compressor, bypassing both category volume gains. Music or SFX can remain audible with its volume set to zero. **Fix:** route each category’s dry and wet signals through its volume control, using separate reverb paths if necessary.

3. **Severity: major (medium). Location: `src/audio/audioDirector.js:265`; `src/main.js:429`.** Continue clears victory and canyon timing without reconstructing it from the save. Their one-time campaign events will not replay, so continuing after the finale or during decoding selects ordinary base music. **Fix:** save and restore the director’s remaining timed state, or reconstruct the relevant phase and remaining duration when loading.

4. **Severity: minor (low). Location: `src/ui/minigames2.js:44`, `:104`; `src/audio/audioDirector.js:64`.** A valid heat-pump click plays `pipeRotate` twice: once through generic `down`, then through the actual `rotate` action. Clicking outside a tile also plays it. **Fix:** remove the heat-pump `down` mapping and retain the successful rotation hook.

5. **Severity: minor (low). Location: `src/audio/soundManager.js:474`.** Storm echo timeouts are not cancelled by `_stopTrack()`. The track-name guard prevents playback after switching elsewhere, but an old callback can fire into a newly restarted storm track. **Fix:** track and clear timeout handles, or guard callbacks with a track-generation token.

6. **Severity: minor (low). Location: `src/main.js:69`; `index.html:22`.** New mute-button titles hard-code English rather than referencing localization IDs, contrary to `SCENARIO.md`. **Fix:** add approved string IDs and resolve them through the existing strings module.

## Verification
Read the repository rules, available teammate status files, scenario requirements, requested diffs, audio modules/tests, handoff document, and relevant campaign/UI callers. `git_status_Pavlo` was absent.

Ran `node --test src/audio/*.test.mjs`; both test files passed. Checked and found correct:

- AudioContext creation is gated behind unlock; Start Mission and Continue call it.
- Node imports do not require `window`.
- Campaign and simulation code remain audio-free.
- Music priority and flag-change filtering match the requirement.
- Dawn detection, Expedition 5 canyon selection, and live-session victory fallback are implemented.
- Required lore IDs map to the requested effects.
- The separate intro diff forwards the typed character.
- Mute and volumes persist; music intervals continue through mute, allowing playback after unmute.
- Choice-modal guards prevent alerts from repeating every frame.

Could not verify real browser sound quality, autoplay behavior, or background-tab behavior. The full repository test suite was not run.

## Recommendations
Add regression coverage for hidden-tab scheduling, category volume routing, Continue during timed music, storm stop/restart, and actual mini-game hook sequences. Include the audio tests in `npm test`; its current globs exclude `src/audio/*.test.mjs`.

## Main-agent follow-up

| # | Decision | What changed |
|---|---|---|
| 1 | **Accepted.** | `soundManager.js`: a `hidden` flag from `visibilitychange`; no notes are scheduled and `init()` does not resume while hidden. Test added. |
| 2 | **Accepted.** | Each category has its own reverb send feeding its own volume bus, so Music 0 / SFX 0 silence the reverb too. |
| 3 | **Accepted in part.** | `director.reset(s)` restores victory music after the finale until Free-Play (Sol 21); `main.js` passes the loaded save. The canyon window lasts under 2 minutes and is not restored (recorded in DECISIONS). Test added. |
| 4 | **Accepted.** | Removed the heat-pump `down` mapping; only a successful rotation plays `pipeRotate`. |
| 5 | **Accepted.** | `_stopTrack()` bumps a track generation; storm echo timeouts check it. |
| 6 | **Rejected for now.** | The mute button's English title matches the other HUD controls, which are all hard-coded. Adding string IDs means editing `SCENARIO.md`; listed as a follow-up. |
| Rec. | Audio tests in `npm test` | `package.json` is Mykhailo's; noted in `content/handoff/AUDIO_HOOKS.md`. |

Tests after the fixes: `node --test tests/*.test.mjs tools/**/*.test.mjs src/audio/*.test.mjs` →
161/161 pass (main: 144/144). A headless Chromium smoke test (Playwright) confirmed: no AudioContext
before Start Mission, one after; sound during intro and tutorial; mute stops all new sounds and is
saved; mini-game clicks make sounds; no page or console errors.
