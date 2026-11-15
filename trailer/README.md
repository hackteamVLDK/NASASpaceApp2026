# ASTRA gameplay trailer (40 s)

A 40-second trailer for NASA Space Apps Challenge 2026 (Vienna, Team VLDK), cut in Remotion.
Every shot is a screen recording of the real game. Nothing in the game code is changed for the
trailer; the end shot only hides the side panels with capture-time CSS.

| Time | Shot | What it shows |
|---|---|---|
| 0:00 | alarm | The dust storm empties the batteries; Power Emergency |
| 0:04 | decision | Dilemma "The Dust Storm": Top Up → Power +41, Commander HP −10 (HUD zoom) |
| 0:15 | wipe | Mini-game Solar Panel Static Wipe (swipes at 4×, marked) → power back (HUD zoom) |
| 0:24 | build / rover / logbook | A drone build order, the crater map and Rover launch, a Science Logbook card |
| 0:34 | end | The finished base, title, "Team VLDK", "NASA Space Apps Challenge • Vienna" |

Sound: the game's base-day music (ducked under the voice), the game's own sound effects from
each clip, and three voice lines from Kokoro-82M (Apache-2.0, run locally, voice `af_heart`).

## Re-render

From `trailer/` (Node 20+, ffmpeg on PATH, Microsoft Edge installed):

```bash
npm install
node capture/saves.mjs                 # build the saves by playing the campaign engine
# in the repo root: npm run dev        (the game on http://localhost:5173)
node capture/capture.mjs               # record public/clips/*.mp4 + .wav + .marks.json (or: one shot name)
cd tts && npm install && node voice.mjs && cd ..   # voice lines -> public/vo/ (already committed)
npx remotion render Trailer out/trailer-raw.mp4 --codec=h264 --crf=18
ffmpeg -y -i out/trailer-raw.mp4 -vf "scale=in_range=full:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -profile:v high -r 30 \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -c:a aac -b:a 192k -movflags +faststart out/trailer.mp4
```

Preview and edit: `npx remotion studio`. Cut points come from the event marks written next to
each clip (`public/clips/<shot>.marks.json`); if a clip is re-recorded, check the `trimSeconds`
values in `src/Trailer.tsx` against its new marks.

`public/clips/`, `out/` and the capture stills are not in Git; they are rebuilt by the commands above.
`capture/probe.mjs` and `capture/probe2.mjs` list on-screen buttons and world objects, for when the
game's UI changes and the capture selectors need updating.
