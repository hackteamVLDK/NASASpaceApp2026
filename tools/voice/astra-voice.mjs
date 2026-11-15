#!/usr/bin/env node
/**
 * ASTRA 6.7's voice: render every spoken line (src/ui/spoken-text.js) with Kokoro-82M, locally on this computer.
 * Model and voice: onnx-community/Kokoro-82M-v1.0-ONNX (Apache-2.0, weights of hexgrad/Kokoro-82M, Apache-2.0),
 * voice `af_heart`. No online service, no API key.
 *
 *   cd tools/voice && npm install && node astra-voice.mjs          only new or changed lines
 *   node astra-voice.mjs --all                                      every line again
 *
 * Writes assets/audio/astra/<lineId>.mp3 (mono, 24 kHz, 40 kbit/s) and assets/audio/astra/index.json:
 *   { "<lineId>": { "file": "<lineId>.mp3", "sec": 3.4, "text": "the spoken text" } }
 * The game plays a line's file when Voice is on in Settings. Lines with a {placeholder} (filled in while
 * playing, e.g. the Earth-Mars delay) get no file: ASTRA shows them as text only.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KokoroTTS } from 'kokoro-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const OUT = path.join(ROOT, 'assets', 'audio', 'astra');
const INDEX = path.join(OUT, 'index.json');
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const VOICE = 'af_heart';
const SPEED = 0.95; // a little slower than default: the players are 7-12

const { SPOKEN } = await import(pathToFileURL(path.join(ROOT, 'src', 'ui', 'spoken-text.js')).href);
fs.mkdirSync(OUT, { recursive: true });
const index = fs.existsSync(INDEX) && !process.argv.includes('--all') ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : {};
const todo = Object.entries(SPOKEN).filter(([id, text]) => !/\{\w+\}/.test(text) && (index[id]?.text !== text || !fs.existsSync(path.join(OUT, index[id].file))));
console.log(`${Object.keys(SPOKEN).length} spoken lines; ${todo.length} to render`);
if (todo.length) {
  const tts = await KokoroTTS.from_pretrained(MODEL, { dtype: 'q8', device: 'cpu' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-voice-'));
  let n = 0;
  for (const [id, text] of todo) {
    const audio = await tts.generate(text, { voice: VOICE, speed: SPEED });
    const wav = path.join(tmp, 'line.wav');
    await audio.save(wav);
    const file = `${id}.mp3`;
    // trim the silence at both ends, then a gentle level so every line sounds equally loud
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-18:TP=-2:LRA=7', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', path.join(OUT, file)]);
    const sec = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(OUT, file)]).toString().trim());
    index[id] = { file, sec: Number(sec.toFixed(2)), text };
    if (++n % 20 === 0) { console.log(`  ${n}/${todo.length}`); fs.writeFileSync(INDEX, `${JSON.stringify(index, null, 1)}\n`); }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
// forget lines that are no longer spoken
for (const id of Object.keys(index)) if (!(id in SPOKEN) || /\{\w+\}/.test(SPOKEN[id])) { fs.rmSync(path.join(OUT, index[id].file), { force: true }); delete index[id]; }
fs.writeFileSync(INDEX, `${JSON.stringify(Object.fromEntries(Object.entries(index).sort()), null, 1)}\n`);
const total = Object.values(index).reduce((a, x) => a + x.sec, 0);
const bytes = fs.readdirSync(OUT).filter((f) => f.endsWith('.mp3')).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`${Object.keys(index).length} files, ${(total / 60).toFixed(1)} min of speech, ${(bytes / 1048576).toFixed(1)} MB`);
