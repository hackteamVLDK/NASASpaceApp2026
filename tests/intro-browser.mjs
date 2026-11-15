/** Real Edge/Chrome opening review, no packages. Start npm run dev first.
 * Run: node tests/intro-browser.mjs [http://localhost:5187]
 * Screenshots and browser profile are written to the OS temporary directory.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BRIEFING_AT, panelStart, T, CUTSCENE } from '../src/flow/intro.js';

const base = process.argv[2] ?? 'http://localhost:5187';
const output = await mkdtemp(join(tmpdir(), 'ares-intro-'));
const candidates = [process.env.BROWSER, `${process.env['ProgramFiles(x86)']}/Microsoft/Edge/Application/msedge.exe`, `${process.env.ProgramFiles}/Google/Chrome/Application/chrome.exe`].filter(Boolean);
let executable;
for (const path of candidates) { try { await access(path); executable = path; break; } catch {} }
assert.ok(executable, 'Set BROWSER to Edge or Chrome');
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--disable-extensions', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${join(output, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let ws;
const timeout = setTimeout(() => { browser.kill(); throw new Error('Browser review timed out'); }, 90000);
try {
  // Windows Edge may omit the stderr banner; the profile file is the browser's port contract.
  let endpoint;
  browser.stderr.resume();
  for (let i = 0; i < 400; i++) {
    try {
      const [port, path] = (await readFile(join(output, 'profile', 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
      endpoint = `ws://127.0.0.1:${port}${path}`; break;
    } catch { await new Promise((r) => setTimeout(r, 50)); }
  }
  assert.ok(endpoint, 'browser published its debugging endpoint');
  console.log('Connecting to browser');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  console.log('Browser connected');
  const pending = new Map(); let serial = 0;
  const errors = [];
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
  const { targetInfos } = await send('Target.getTargets');
  const targetId = targetInfos.find((t) => t.type === 'page').targetId;
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const cmd = (method, params) => send(method, params, sessionId);
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const { identifier: initScript } = await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.clear(); localStorage.setItem('ares-kids.prefs.v1', JSON.stringify({voice:false}));` });
  const evaluate = async (expression) => {
    const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const settle = () => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
  await cmd('Page.navigate', { url: base });
  console.log(`Loading ${base}`);
  for (let i = 0; i < 400; i++) {
    if (await evaluate('Boolean(window.__ares)')) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(await evaluate('Boolean(window.__ares)'), true, 'game booted');
  const screenshots = [];
  const capture = async (name) => {
    await settle();
    const { data } = await cmd('Page.captureScreenshot', { format: 'png' });
    const path = join(output, `${name}.png`);
    await writeFile(path, Buffer.from(data, 'base64')); screenshots.push(path);
    console.log(`Screenshot: ${path}`);
  };
  await capture('00-title');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#loading')).backgroundColor`), 'rgba(5, 7, 10, 0.18)');
  assert.equal(await evaluate(`document.querySelector('#loadbar').getAttribute('aria-valuenow')`), '100');
  await evaluate(`document.querySelector('#startBtn').click()`);
  await evaluate('window.__ares.story(0.7)'); await capture('01-story-title');
  // Real keyboard/tap inputs advance exactly one panel, while Skip always stops on the goals.
  await cmd('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ' });
  await cmd('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ' });
  assert.ok(await evaluate(`window.__ares.storyT >= ${panelStart(1)} && window.__ares.storyT < ${panelStart(2)}`));
  await evaluate(`window.__ares.story(${panelStart(1) + 1.5})`); await capture('02-story-signal');
  await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: 100, y: 500, button: 'left', clickCount: 1 });
  await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 100, y: 500, button: 'left', clickCount: 1 });
  assert.ok(await evaluate(`window.__ares.storyT >= ${panelStart(2)} && window.__ares.storyT < ${panelStart(3)}`));
  await evaluate(`window.__ares.story(${panelStart(2) + 3.7})`); await capture('03-story-storm');
  await evaluate(`window.__ares.story(${panelStart(3) + 1})`); await capture('04-story-drones');
  await evaluate(`window.__ares.story(${panelStart(3) + 4.8})`); await capture('05-story-buried');
  await evaluate(`document.querySelector('#skipBtn').click()`); await settle();
  assert.ok(await evaluate(`window.__ares.storyT >= ${BRIEFING_AT} && !document.querySelector('#introStart').hidden`));
  await evaluate(`window.__ares.story(${BRIEFING_AT + 1})`);
  await capture('06-briefing');
  await evaluate(`(async () => { window.__flowSounds = []; const { director } = await import('/src/ui/audio.js'); const cue = director.flowCue.bind(director); director.flowCue = c => { window.__flowSounds.push(c.id); cue(c); }; document.querySelector('#introStart').click(); })()`);
  await settle();
  assert.deepEqual(await evaluate(`window.__flowSounds.filter(x => ['wind-hum','parachute-deploy'].includes(x))`), ['wind-hum', 'parachute-deploy']);
  await evaluate(`window.__ares.jump(${T.introEnd + 2})`); await capture('07-descent');
  await evaluate(`window.__ares.jump(${CUTSCENE.lander.touchdownAt + 0.2})`); await capture('08-touchdown');
  await evaluate(`window.__ares.jump(${T.touchdownEnd + 3})`); await capture('09-pan');
  assert.equal(await evaluate(`document.querySelector('#astra').classList.contains('closed')`), true, 'ASTRA waits until the camera is settled');
  await evaluate(`window.__ares.jump(${CUTSCENE.astra.landingAt - 0.05})`);
  await new Promise((r) => setTimeout(r, 150));
  await capture('10-settled-astra');
  assert.equal(await evaluate(`document.querySelector('#astra').classList.contains('closed')`), false);
  await evaluate(`window.__ares.jump(${T.panEnd})`); await capture('11-tutorial');
  assert.equal(await evaluate('window.__ares.mode'), 'tutorial');
  assert.equal(await evaluate('window.__ares.tut.state'), 'TUT_HP');
  await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await cmd('Page.navigate', { url: `${base}/?autostart=0` });
  for (let i = 0; i < 400; i++) {
    if (await evaluate('Boolean(window.__ares) && window.__ares.mode === "intro"')) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(await evaluate('document.documentElement.classList.contains("reduce-motion")'), true);
  await evaluate(`window.__ares.story(${panelStart(1) + 1})`); await capture('12-reduced-motion');
  // drawStory at identical storyboard time must ignore the animation clock when motion is reduced.
  assert.equal(await evaluate(`(async () => {
    const [{drawStory}, {loadAtlas}, {buildSoil}, {storyAt}, {t}] = await Promise.all([
      import('/src/render/intro-story.js'), import('/src/render/atlas.js'), import('/src/render/world.js'), import('/src/flow/intro.js'), import('/src/flow/strings.js')]);
    const atlas = await loadAtlas(), soil = buildSoil(atlas), c = document.createElement('canvas'); c.width=1920; c.height=1080;
    for (const time of [${panelStart(1) + 1}, ${panelStart(2) + 4}, ${panelStart(3) + 4}]) {
      const draw = nowMs => { drawStory(c.getContext('2d'), storyAt(time), {atlas, soil, nowMs, reduceMotion:true, t}); return c.toDataURL(); };
      if (draw(1000) !== draw(9000)) return false;
    } return true;
  })()`), true, 'reduced motion freezes rings, dust and drones');
  await evaluate(`document.querySelector('#skipBtn').click()`); await settle();
  await evaluate(`document.querySelector('#introStart').click(); document.querySelector('#skipBtn').click()`); await settle();
  assert.equal(await evaluate('window.__ares.mode'), 'tutorial', 'landing Skip reaches the tutorial');
  await cmd('Page.removeScriptToEvaluateOnNewDocument', { identifier: initScript });
  await evaluate(`localStorage.setItem('ares-kids-save-v1', JSON.stringify(window.__ares.s))`);
  await cmd('Page.navigate', { url: base });
  for (let i = 0; i < 400; i++) {
    if (await evaluate('Boolean(window.__ares) && Boolean(document.querySelector("#contBtn"))')) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(await evaluate('Boolean(document.querySelector("#contBtn"))'), true, 'Continue is preserved');
  await capture('13-continue-title');
  await evaluate(`document.querySelector('#contBtn').click()`); await settle();
  assert.equal(await evaluate('window.__ares.mode'), 'play');
  await capture('14-game-comparison');
  assert.deepEqual(errors, [], 'no browser exceptions');
  console.log(`PASS: title, input, briefing, landing, cues, tutorial, reduced motion, Skip, Continue; ${screenshots.length} screenshots; 0 browser exceptions.`);
} finally {
  clearTimeout(timeout); ws?.close(); browser.kill();
}
