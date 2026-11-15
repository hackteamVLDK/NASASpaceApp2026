// Generate the trailer's three voice lines locally with Kokoro-82M (Apache-2.0 weights and voices).
//   node voice.mjs  -> ../public/vo/line1.wav ... line3.wav
import fs from 'node:fs';
import { KokoroTTS } from 'kokoro-js';

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const VOICE = 'af_heart';
const LINES = [
  ['line1', 'Your mission is to keep the outpost alive.'],
  ['line2', 'When a storm hits, you decide how to save power.'],
  ['line3', 'Clean the panels to bring the power back.'],
];

const info = await fetch(`https://huggingface.co/api/models/${MODEL}`).then((r) => r.json()).catch(() => null);
const base = await fetch('https://huggingface.co/api/models/hexgrad/Kokoro-82M').then((r) => r.json()).catch(() => null);
console.log(`license tags: ${MODEL}: ${info?.cardData?.license ?? info?.tags?.find((t) => t.startsWith('license:')) ?? '?'}; hexgrad/Kokoro-82M: ${base?.cardData?.license ?? base?.tags?.find((t) => t.startsWith('license:')) ?? '?'}`);

const tts = await KokoroTTS.from_pretrained(MODEL, { dtype: 'q8', device: 'cpu' });
fs.mkdirSync('../public/vo', { recursive: true });
for (const [name, text] of LINES) {
  const audio = await tts.generate(text, { voice: VOICE, speed: 0.95 });
  await audio.save(`../public/vo/${name}.wav`);
  console.log(`${name}: ${(audio.audio.length / audio.sampling_rate).toFixed(2)} s  "${text}"`);
}
