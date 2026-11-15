// Probe: open the game in play mode, take a screenshot, list the clickable world objects and HUD element boxes.
import fs from 'node:fs';
import { openGame, wait } from './browser.mjs';

const out = process.argv[2] || 'capture/probe';
fs.mkdirSync(out, { recursive: true });
const { browser, page } = await openGame({ query: '?play' });
await wait(2500);
await page.screenshot({ path: `${out}/play.png` });
const info = await page.evaluate(() => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), hidden: e.hidden }; };
  return {
    hits: window.__ares.hits.map((h) => h.id),
    view: window.__ares.view(),
    canvas: box('#game'), hud: box('#hud'), gauges: box('#gauges'), side: box('#side'), speed: box('#speed'), goals: box('#goals'), astra: box('#astra'),
    gaugeItems: [...document.querySelectorAll('#gauges > *')].map((g) => ({ text: g.textContent.trim().slice(0, 20), ...(() => { const r = g.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() })),
    tabs: [...document.querySelectorAll('#side button, #side [data-tab]')].slice(0, 20).map((b) => b.textContent.trim().slice(0, 24)),
    speedBtns: [...document.querySelectorAll('#speed button')].map((b) => b.dataset.speed),
  };
});
fs.writeFileSync(`${out}/info.json`, JSON.stringify(info, null, 1));
console.log(JSON.stringify(info, null, 1).slice(0, 3000));
await browser.close();
