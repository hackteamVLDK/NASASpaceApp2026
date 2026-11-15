// Voice-over for video/ARES-KIDS_trailer_B_facts.mp4: one Kokoro-82M line per part (Apache-2.0, run locally),
// each line repeats the part's on-screen fact. The music is ducked under the voice (sidechain), then loudness
// is normalised. The source video is not changed.
//   node facts-voice.mjs  -> ../../video/voice/facts-*.wav + ../../video/ARES-KIDS_trailer_B_facts_voice.mp4
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { KokoroTTS } from 'kokoro-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_DIR = path.join(HERE, '..', '..', 'video');
const SRC = path.join(VIDEO_DIR, 'ARES-KIDS_trailer_B_facts.mp4');
const OUT = path.join(VIDEO_DIR, 'ARES-KIDS_trailer_B_facts_voice.mp4');
const VO = path.join(VIDEO_DIR, 'voice');
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const VOICE = 'af_heart';
// Kokoro speaks about 26 dB under full scale, level with the ducked music; +9 dB puts it ~8 dB above the music
const VOICE_GAIN_DB = 9;

// [name, start s, end of its part s, text]. Parts (cuts in the video): 0-5, 5-11, 11-17, 17-22, 22-26, 26-30.
const LINES = [
  ['facts-1', 0.4, 5, 'On Mars, gravity is only thirty-eight percent of Earth\'s.'],
  ['facts-2', 5.4, 11, 'Mars gets less than half of Earth\'s sunlight. Keep the solar panels clean.'],
  ['facts-3', 11.4, 17, 'Call Earth. A radio message can take up to twenty-two minutes to get there.'],
  ['facts-4', 17.4, 22, 'Learn real science, like why sunsets on Mars glow blue.'],
  ['facts-5', 22.3, 26, 'Keep your crew healthy, and earn up to nine stars.'],
  ['facts-6', 26.4, 30, 'Ares Kids, made by Team V L D K.'],
];

const tts = await KokoroTTS.from_pretrained(MODEL, { dtype: 'q8', device: 'cpu' });
fs.mkdirSync(VO, { recursive: true });
for (const [name, start, end, text] of LINES) {
  const room = end - start - 0.25;
  let speed = 1.0;
  let audio = await tts.generate(text, { voice: VOICE, speed });
  // a line must end before its part does; speak a little faster if it does not fit (never past 1.15)
  while (audio.audio.length / audio.sampling_rate > room && speed < 1.15) {
    speed = Number((speed + 0.05).toFixed(2));
    audio = await tts.generate(text, { voice: VOICE, speed });
  }
  const secs = audio.audio.length / audio.sampling_rate;
  await audio.save(path.join(VO, `${name}.wav`));
  console.log(`${name}: ${start}-${(start + secs).toFixed(2)} s (part ends ${end}) speed ${speed}${secs > room ? '  TOO LONG' : ''}  "${text}"`);
}

// voice track: each line delayed to its start; music ducked by the voice; then -16 LUFS / -1.5 dBTP
const inputs = ['-y', '-hide_banner', '-loglevel', 'error', '-i', SRC];
for (const [name] of LINES) inputs.push('-i', path.join(VO, `${name}.wav`));
const delays = LINES.map(([, start], i) => `[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(start * 1000)}:all=1[v${i}]`);
const filter = [
  ...delays,
  `${LINES.map((_, i) => `[v${i}]`).join('')}amix=inputs=${LINES.length}:normalize=0,volume=${VOICE_GAIN_DB}dB,alimiter=limit=0.89,apad[voice]`,
  '[voice]asplit=2[vmix][vkey]',
  '[0:a]aresample=48000[music]',
  '[music][vkey]sidechaincompress=threshold=0.015:ratio=4:attack=30:release=450:makeup=1[ducked]',
  '[ducked][vmix]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]',
].join(';');
execFileSync('ffmpeg', [...inputs, '-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
console.log(`written ${OUT}`);
