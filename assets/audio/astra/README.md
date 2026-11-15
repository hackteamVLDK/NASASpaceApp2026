# ASTRA 6.7's voice

One MP3 per spoken line (`<lineId>.mp3`, mono, 24 kHz, 40 kbit/s) and `index.json` (file, length, the text spoken).

- Text: `src/ui/spoken-text.js` (one or two short sentences per ASTRA line; the full lines stay in SCENARIO.md).
- Voice: Kokoro-82M (`onnx-community/Kokoro-82M-v1.0-ONNX`, Apache-2.0; weights of `hexgrad/Kokoro-82M`, Apache-2.0),
  voice `af_heart`, speed 0.95, rendered locally (no online service).
- Made by `tools/voice/astra-voice.mjs` (`cd tools/voice && npm install && node astra-voice.mjs`; it renders only new or
  changed lines). Lines with a `{placeholder}` have no recording and stay text only.
- Check (2026-11-15): 12 lines transcribed locally with Whisper base.en matched 97% of the words on average.
- Players can switch the voice off: Settings > ASTRA voice.
