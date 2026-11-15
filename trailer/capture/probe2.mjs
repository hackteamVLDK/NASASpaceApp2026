// Probe the Tasks tab and the crater map: list buttons and their text.
import fs from 'node:fs';
import { openGame, continueSave, hitCenter, wait } from './browser.mjs';

const load = (n) => JSON.parse(fs.readFileSync(`capture/saves/${n}.json`, 'utf8'));
const dump = (page) => page.evaluate(() => [...document.querySelectorAll('button, [role=button], .task, .marker')].filter((b) => b.offsetParent).map((b) => `${b.tagName}.${b.className}#${b.id} "${b.textContent.trim().slice(0, 40)}"`));

{
  const { browser, page } = await openGame({ save: load('wipe') });
  await continueSave(page);
  await page.click('#speed [data-speed="0"]');
  await page.click('#side button:has-text("Tasks")');
  await wait(800);
  console.log('TASKS:', (await dump(page)).filter((x) => !/speed|uisize/.test(x)).join('\n'));
  await page.screenshot({ path: 'capture/probe/tasks.png' });
  await browser.close();
}
{
  const { browser, page } = await openGame({ save: load('rover') });
  await continueSave(page);
  await page.click('#speed [data-speed="0"]');
  const g = await hitCenter(page, 'module:garage');
  await page.mouse.click(g.x, g.y);
  await wait(1000);
  console.log('MAP:', (await dump(page)).join('\n'));
  await page.screenshot({ path: 'capture/probe/map.png' });
  await browser.close();
}
