#!/usr/bin/env node
/**
 * Record the trailer's gameplay shots from the real game (http://localhost:5173, `npm run dev` first).
 * Each shot loads a save made by capture/saves.mjs, plays it with real mouse input, and writes
 *   public/clips/<shot>.mp4   1920x1080, 30 fps, H.264 (the screen)
 *   public/clips/<shot>.wav   the game's own music and sounds, from its WebAudio output
 *   capture/stills/<shot>-before.png / -after.png   the state before and after the key action
 *
 *   node capture/capture.mjs            all shots
 *   node capture/capture.mjs wipe       one shot
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGame, continueSave, startRecording, saveAudio, hitCenter, wait } from './browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIPS = path.join(HERE, '..', 'public', 'clips');
const STILLS = path.join(HERE, 'stills');
fs.mkdirSync(CLIPS, { recursive: true });
fs.mkdirSync(STILLS, { recursive: true });
const loadSave = (name) => JSON.parse(fs.readFileSync(path.join(HERE, 'saves', `${name}.json`), 'utf8'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function setSpeed(page, x) { await page.click(`#speed [data-speed="${x}"]`); }
async function still(page, shot, tag) { await page.screenshot({ path: path.join(STILLS, `${shot}-${tag}.png`) }); }
async function clickAt(page, p) { await page.mouse.move(p.x, p.y, { steps: 8 }); await wait(150); await page.mouse.click(p.x, p.y); }

/** Run one shot: open the save, record from `Continue` to the end of `play`. */
async function shot(name, saveName, play, { css = '' } = {}) {
  log(`--- ${name}`);
  const { browser, page } = await openGame({ save: loadSave(saveName) });
  if (css) await page.addStyleTag({ content: css });
  try {
    const rec = await startRecording(page);
    await continueSave(page);
    // clips keep the game's sound effects; the music is recorded once, as one continuous bed (music.wav)
    await page.evaluate(() => import('/src/audio/soundManager.js').then((m) => m.sfx.setMusicVolume(0)));
    await page.evaluate(() => window.__startAudio());
    await play(page, rec);
    const audioOk = await saveAudio(page, path.join(CLIPS, `${name}.wav`));
    const secs = await rec.stop(path.join(CLIPS, `${name}.mp4`));
    fs.writeFileSync(path.join(CLIPS, `${name}.marks.json`), JSON.stringify({ ...rec.marks, length: Number(secs.toFixed(2)) }, null, 1));
    log(`${name} marks: ${JSON.stringify(rec.marks)}`);
    log(`${name}: ${secs.toFixed(1)} s of video, audio ${audioOk ? 'saved' : 'MISSING'}`);
  } finally {
    await browser.close();
  }
}

const SHOTS = {
  // 0:00 The base in the dust storm; the batteries run dry and the Power Emergency fires.
  alarm: () => shot('alarm', 'alarm', async (page, rec) => {
    await setSpeed(page, '3');
    await wait(1500);
    await still(page, 'alarm', 'before');
    await page.waitForFunction(() => window.__ares.s.emergency.power === true, null, { timeout: 30000 });
    rec.mark('emergency');
    log('power emergency fired');
    await wait(3500);
    await still(page, 'alarm', 'after');
  }),

  // 0:04 Dilemma 1, "The Dust Storm": choose Top Up. Power +40 now, Commander HP -10.
  decision: () => shot('decision', 'decision', async (page, rec) => {
    await page.waitForFunction(() => window.__ares.s.pending?.id === 'd1', null, { timeout: 30000 });
    rec.mark('card');
    await wait(3500); // time to read the card
    await still(page, 'decision', 'before');
    const before = await page.evaluate(() => ({ power: window.__ares.s.res.power, hp: window.__ares.s.hp }));
    const choice = page.locator('button', { hasText: /Top Up/i }).first();
    const box = await choice.boundingBox();
    if (!box) throw new Error('Top Up choice not found');
    await clickAt(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    rec.mark('click');
    await wait(4500);
    const after = await page.evaluate(() => ({ power: window.__ares.s.res.power, hp: window.__ares.s.hp }));
    log(`decision: power ${before.power.toFixed(0)} -> ${after.power.toFixed(0)}, HP ${before.hp.toFixed(0)} -> ${after.hp.toFixed(0)}`);
    await still(page, 'decision', 'after');
  }),

  // 0:15 The Static Wipe mini-game from the Tasks list: swipe the dust off; the Power Emergency ends.
  wipe: () => shot('wipe', 'wipe', async (page, rec) => {
    await setSpeed(page, '1');
    await wait(1500);
    await still(page, 'wipe', 'before');
    await page.click('#side button:has-text("Tasks")');
    await wait(700);
    // each task card has a "Play" button above its title: take the Play button of the Static Wipe card
    const tb = await page.evaluate(() => {
      const plays = [...document.querySelectorAll('#side button')].filter((b) => /^Play$/.test(b.textContent.trim()) && b.offsetParent);
      const b = plays.find((p) => /Static Wipe/i.test(p.parentElement?.textContent ?? ''));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    if (!tb) throw new Error('Static Wipe task button not found');
    await clickAt(page, { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 });
    await page.waitForSelector('#mgWrap:not([hidden])');
    rec.mark('open');
    await wait(1200);
    await still(page, 'wipe', 'game');
    const g = await page.evaluate(() => { const c = document.querySelector('#mg'); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, sx: r.width / c.width, sy: r.height / c.height }; });
    const P = (x, y) => ({ x: g.x + x * g.sx, y: g.y + y * g.sy });
    const drag = async (x0, y, x1, steps = 14) => {
      const a = P(x0, y);
      const b = P(x1, y);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps });
      await page.mouse.up();
    };
    const panels = [0, 1, 2].map((i) => ({ x: 22 + i * 355, y: 150, w: 340, h: 226 }));
    const clumps = [[0, 120, 100], [1, 210, 130], [2, 150, 90]];
    const done = () => page.evaluate(() => document.querySelector('#mgWrap').hidden);
    // a player's pace: about 0.4 s per stroke; repeat until the game counts the win
    const t0 = Date.now();
    rec.mark('swipe');
    for (const [pi, cx, cy] of clumps) for (let k = 0; k < 3; k++) { const p = panels[pi]; await drag(p.x + cx - 60, p.y + cy, p.x + cx + 60, 10); }
    log(`wipe: clumps done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    // the brush is 32 px wide: four rows cover the counted middle of a panel (14%-86% of its height)
    for (let round = 0; round < 2 && !(await done()); round++) {
      for (const p of panels) for (const v of [0.22, 0.42, 0.62, 0.8]) if (!(await done())) await drag(p.x + 10, p.y + v * p.h + round * 9, p.x + p.w - 10, 18);
      log(`wipe: round ${round + 1} at ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
    await still(page, 'wipe', 'swiped');
    await page.waitForSelector('#mgWrap[hidden]', { state: 'attached', timeout: 15000 });
    rec.mark('won');
    log(`wipe: won; power ${await page.evaluate(() => window.__ares.s.res.power.toFixed(1))}, emergency ${await page.evaluate(() => window.__ares.s.emergency.power)}`);
    await wait(4000);
    await still(page, 'wipe', 'after');
  }),

  // 0:24 A drone order: tap Pip, tap the Workshop frame; Pip goes and builds.
  build: () => shot('build', 'build', async (page, rec) => {
    await setSpeed(page, '1');
    await wait(1200);
    await still(page, 'build', 'before');
    await clickAt(page, await hitCenter(page, 'drone:drone-01'));
    rec.mark('pip');
    await wait(900);
    await clickAt(page, await hitCenter(page, 'module:workshop'));
    rec.mark('frame');
    await wait(2500);
    await setSpeed(page, '8');
    rec.mark('fast');
    await wait(4000);
    log(`build: workshop ${await page.evaluate(() => `${window.__ares.s.modules.workshop.status} ${Math.round(window.__ares.s.modules.workshop.progress * 100)}%`)}`);
    await still(page, 'build', 'after');
  }),

  // 0:27 The crater map, then the Rover rolls out and the radio log starts.
  rover: () => shot('rover', 'rover', async (page, rec) => {
    await setSpeed(page, '1');
    await wait(1000);
    const mapBtn = await page.locator('#mapBtn').boundingBox();
    await clickAt(page, { x: mapBtn.x + mapBtn.width / 2, y: mapBtn.y + mapBtn.height / 2 });
    rec.mark('map');
    await wait(800);
    const m1 = page.locator('button.marker', { hasText: '#1' }).first();
    const mb = await m1.boundingBox();
    if (mb) await clickAt(page, { x: mb.x + mb.width / 2, y: mb.y + mb.height / 2 });
    rec.mark('target');
    await wait(2200);
    await still(page, 'rover', 'before');
    await page.click('#mapClose');
    // what "Prepare and launch" sends once the two prep mini-games are done (src/main.js launchWithPrep)
    await page.evaluate(() => window.__ares.send({ type: 'launch', expedition: 1 }));
    rec.mark('launch');
    await wait(5000);
    await setSpeed(page, '8');
    await wait(3000);
    await still(page, 'rover', 'after');
  }),

  // 0:30 The Science Logbook: open it and read one card.
  logbook: () => shot('logbook', 'end', async (page, rec) => {
    await setSpeed(page, '0');
    await wait(800);
    await page.click('#side button:has-text("Logbook")');
    rec.mark('grid');
    await wait(1500);
    await still(page, 'logbook', 'before');
    const card = page.locator('#side button', { hasText: /Soil Blanket/i }).first();
    const cb = await card.boundingBox().catch(() => null);
    if (cb) { await clickAt(page, { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 }); rec.mark('card'); }
    else log('logbook: card "Soil Blanket" not found as a button; keeping the grid');
    await wait(3500);
    await still(page, 'logbook', 'after');
  }),

  // 0:34 The finished base, for the end title. Panels hidden with capture CSS only, the game is untouched.
  end: () => shot('end', 'end', async (page) => {
    await setSpeed(page, '1');
    await wait(7000);
    await still(page, 'end', 'after');
  }, { css: '#side, #goals, #astra, #toast, .missions, #tracker, #crewPanel { visibility: hidden !important; }' }),
};

/** The game's base-day music (src/audio/soundManager.js), 45 s, effects muted: the trailer's music bed. */
SHOTS.music = async () => {
  log('--- music');
  const { browser, page } = await openGame({ save: loadSave('end') });
  try {
    await continueSave(page);
    await page.evaluate(() => import('/src/audio/soundManager.js').then((m) => { m.sfx.setSfxVolume(0); m.sfx.setMusicVolume(1); m.sfx.playMusic('base_day'); }));
    await page.evaluate(() => window.__startAudio());
    await wait(45000);
    log(`music: ${(await saveAudio(page, path.join(CLIPS, 'music.wav'))) ? 'saved' : 'MISSING'}`);
  } finally {
    await browser.close();
  }
};

const only = process.argv.slice(2);
for (const [name, run] of Object.entries(SHOTS)) {
  if (only.length && !only.includes(name)) continue;
  try { await run(); } catch (e) { log(`${name} FAILED: ${e.message}`); process.exitCode = 1; }
}
