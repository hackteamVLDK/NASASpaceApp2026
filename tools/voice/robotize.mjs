#!/usr/bin/env node
/**
 * Give ASTRA's recorded voice a gentle robot sound, without rendering the voice again.
 * The clean recordings are kept in tools/voice/raw/ (not in Git: astra-voice.mjs can always render them again);
 * the filtered files replace assets/audio/astra/<lineId>.mp3. Running it twice never filters twice: it always starts
 * from the clean copy.
 *
 *   node robotize.mjs                 every line
 *   node robotize.mjs --try <id>      write three strengths of one line to tools/voice/try/ to compare
 *
 * The robot part: the spectrum's phase is flattened (a metallic monotone), mixed under the clean voice so a child
 * still understands every word, plus a very short metallic echo and a radio-like band limit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '..', 'assets', 'audio', 'astra');
const RAW = path.join(HERE, 'raw');
const INDEX = path.join(OUT, 'index.json');
export const ROBOT = 0.55; // how much of the robot copy is mixed under the clean voice (0 = clean, 1 = only robot)
const FILTER_ID = `robot-${ROBOT}`;

function filter(src, dst, robot) {
  const graph = `[0:a]aresample=24000,asplit=2[clean][r0];[r0]afftfilt=real='hypot(re,im)':imag='0':win_size=512:overlap=0.75[robot];[clean][robot]amix=inputs=2:weights='${(1 - robot).toFixed(2)} ${robot.toFixed(2)}':normalize=0,aecho=0.8:0.6:9:0.22,highpass=f=140,lowpass=f=7200,loudnorm=I=-18:TP=-2:LRA=7[out]`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-filter_complex', graph, '-map', '[out]', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', dst]);
}

const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
fs.mkdirSync(RAW, { recursive: true });
// keep a clean copy of every recording before the first filtering
for (const { file } of Object.values(index)) {
  const raw = path.join(RAW, file);
  if (!fs.existsSync(raw) && !Object.values(index).find((x) => x.file === file)?.filter) fs.copyFileSync(path.join(OUT, file), raw);
}

const tryAt = process.argv.indexOf('--try');
if (tryAt > 0) {
  const id = process.argv[tryAt + 1];
  const dir = path.join(HERE, 'try');
  fs.mkdirSync(dir, { recursive: true });
  for (const r of [0.3, 0.45, 0.6]) filter(path.join(RAW, index[id].file), path.join(dir, `${id}.robot-${r}.mp3`), r);
  console.log(`wrote 3 strengths of ${id} to ${dir}`);
} else {
  let n = 0;
  for (const [id, x] of Object.entries(index)) {
    if (x.filter === FILTER_ID) continue;
    const raw = path.join(RAW, x.file);
    if (!fs.existsSync(raw)) { console.log(`no clean copy of ${id}: render it again with astra-voice.mjs`); continue; }
    filter(raw, path.join(OUT, x.file), ROBOT);
    x.filter = FILTER_ID;
    x.sec = Number(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(OUT, x.file)]).toString().trim()).toFixed(2));
    n++;
  }
  fs.writeFileSync(INDEX, `${JSON.stringify(index, null, 1)}\n`);
  console.log(`${n} lines filtered (${FILTER_ID})`);
}
