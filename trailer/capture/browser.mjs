/**
 * Shared browser helpers for capturing gameplay: Microsoft Edge driven by playwright-core,
 * a 1920x1080 page, a JPEG screencast recorder (CDP) and an audio tap on the game's WebAudio output.
 * Nothing here changes the game: it loads http://localhost:5173 and uses its public hooks
 * (window.__ares, the save slot in localStorage, real mouse input).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
export const SAVE_KEY = 'ares-kids-save-v1';

/** Route every connection to the speakers into a MediaRecorder as well, so the game's own music and sounds can be saved. */
const AUDIO_TAP = `
(() => {
  const proto = AudioNode.prototype;
  const orig = proto.connect;
  const taps = new WeakMap();
  proto.connect = function (target, ...rest) {
    const out = orig.call(this, target, ...rest);
    try {
      if (target instanceof AudioDestinationNode) {
        const ctx = this.context;
        let tap = taps.get(ctx);
        if (!tap) { tap = ctx.createMediaStreamDestination(); taps.set(ctx, tap); window.__tapStream = tap.stream; }
        orig.call(this, tap);
      }
    } catch (e) { /* never break the game's audio */ }
    return out;
  };
  window.__startAudio = () => {
    if (!window.__tapStream) return false;
    window.__chunks = [];
    window.__rec = new MediaRecorder(window.__tapStream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
    window.__rec.ondataavailable = (e) => { if (e.data.size) window.__chunks.push(e.data); };
    window.__rec.start(250);
    return true;
  };
  window.__stopAudio = () => new Promise((resolve) => {
    if (!window.__rec) return resolve(null);
    window.__rec.onstop = async () => {
      const blob = new Blob(window.__chunks, { type: 'audio/webm' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      resolve(btoa(s));
    };
    window.__rec.stop();
  });
})();
`;

export async function openGame({ headless = true, save = null, query = '' } = {}) {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless,
    args: ['--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=1', '--hide-scrollbars'],
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await context.addInitScript(AUDIO_TAP);
  // a clean start: sound on, normal interface size, the prepared save (if any) in the slot
  await context.addInitScript(({ key, save }) => {
    try {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.clear();
        if (save) localStorage.setItem(key, save);
        sessionStorage.setItem('__seeded', '1');
      }
    } catch { /* ignore */ }
  }, { key: SAVE_KEY, save: save ? JSON.stringify(save) : null });
  const page = await context.newPage();
  await page.goto(GAME_URL + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ares && document.querySelector('#startBtn') && !document.querySelector('#startBtn').hidden, null, { timeout: 30000 });
  return { browser, context, page };
}

/** Continue the prepared save (the "Continue mission" button). */
export async function continueSave(page) {
  await page.click('#contBtn');
  await page.waitForFunction(() => window.__ares.mode === 'play');
}

/** Screen recorder: CDP screencast frames with timestamps, encoded to a constant 30 fps H.264 file. */
export async function startRecording(page) {
  const cdp = await page.context().newCDPSession(page);
  const frames = []; // { name, t }: each frame goes to disk at once, so long shots do not fill the memory
  const dir = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'trailer-frames-'));
  cdp.on('Page.screencastFrame', async (f) => {
    const name = `f${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push({ name, t: f.metadata.timestamp });
    fs.writeFileSync(path.join(dir, name), Buffer.from(f.data, 'base64'));
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closing */ }
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  return {
    cdp,
    frames,
    t0,
    marks: {},
    /** Time of an event, in seconds from the first recorded frame. */
    mark(name) { this.marks[name] = Number((Date.now() / 1000 - (frames[0]?.t ?? Date.now() / 1000)).toFixed(2)); },
    /** Stop and write `file` (mp4). Returns the clip length in seconds. */
    async stop(file) {
      await cdp.send('Page.stopScreencast');
      await new Promise((r) => setTimeout(r, 200));
      if (frames.length < 2) throw new Error('no frames recorded');
      const lines = ['ffconcat version 1.0'];
      frames.forEach((f, i) => {
        const next = frames[i + 1];
        lines.push(`file '${f.name}'`, `duration ${next ? Math.max(0.001, next.t - f.t).toFixed(4) : '0.0333'}`);
      });
      lines.push(`file '${frames.at(-1).name}'`);
      fs.writeFileSync(path.join(dir, 'list.txt'), lines.join('\n'));
      const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
        '-vf', 'fps=30,scale=1920:1080:flags=neighbor,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', file], { encoding: 'utf8' });
      fs.rmSync(dir, { recursive: true, force: true });
      if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
      return frames.at(-1).t - frames[0].t;
    },
  };
}

/** Save the audio recorded by the tap (webm/opus) as 48 kHz WAV. */
export async function saveAudio(page, file) {
  const b64 = await page.evaluate(() => window.__stopAudio());
  if (!b64) return false;
  const tmp = `${file}.webm`;
  fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ar', '48000', '-ac', '2', file], { encoding: 'utf8' });
  fs.rmSync(tmp, { force: true });
  if (r.status !== 0) throw new Error(`ffmpeg audio failed: ${r.stderr}`);
  return true;
}

/** Where a world point (game canvas coordinates) is on the screen. */
export async function worldToScreen(page, wx, wy) {
  return page.evaluate(([wx, wy]) => {
    const v = window.__ares.view();
    const c = document.querySelector('#game').getBoundingClientRect();
    const sx = (wx - v.cx) * v.zoom + 1920 / 2;
    const sy = (wy - v.cy) * v.zoom + 1080 / 2;
    return { x: c.left + (sx / 1920) * c.width, y: c.top + (sy / 1080) * c.height };
  }, [wx, wy]);
}

/** Centre of a clickable world object (module:battery, drone:drone-01, crew:cmdr, surface). */
export async function hitCenter(page, id) {
  const h = await page.evaluate((id) => window.__ares.hits.find((x) => x.id === id), id);
  if (!h) throw new Error(`no hit box ${id}`);
  return worldToScreen(page, h.x + h.w / 2, h.y + h.h / 2);
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
