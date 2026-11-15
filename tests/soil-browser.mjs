/** Browser soil review (no packages). Run with npm run dev on the supplied URL. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const base = process.argv[2] ?? 'http://localhost:5187';
const label = process.argv[3] ?? 'after';
const output = await mkdtemp(join(tmpdir(), `ares-soil-${label}-`));
const candidates = [process.env.BROWSER, `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1234/chrome-win64/chrome.exe`, `${process.env['ProgramFiles(x86)']}/Microsoft/Edge/Application/msedge.exe`].filter(Boolean);
let executable;
for (const path of candidates) { try { await access(path); executable = path; break; } catch {} }
assert.ok(executable, 'Set BROWSER to Edge or Chrome');
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${join(output, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
browser.stderr.resume();
let ws;
const timeout = setTimeout(() => { browser.kill(); throw new Error('Browser review timed out'); }, 90000);
try {
  let endpoint;
  for (let i = 0; i < 400; i++) {
    try { const [port, path] = (await readFile(join(output, 'profile', 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); endpoint = `ws://127.0.0.1:${port}${path}`; break; }
    catch { await new Promise(r => setTimeout(r, 50)); }
  }
  assert.ok(endpoint, 'browser endpoint');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const pending = new Map(); let serial = 0;
  const errors = [];
  ws.onmessage = ({ data }) => { const m = JSON.parse(data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
  const { targetInfos } = await send('Target.getTargets');
  const { sessionId } = await send('Target.attachToTarget', { targetId: targetInfos.find(t => t.type === 'page').targetId, flatten: true });
  const cmd = (method, params) => send(method, params, sessionId);
  await cmd('Runtime.enable'); await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression => { const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  // A blank same-origin page lets the real renderer run without the app's animation loop or overlays.
  await cmd('Page.navigate', { url: `${base}/soil-review-blank` });
  await new Promise(r => setTimeout(r, 200));
  const result = await evaluate(`(async () => {
    const [{loadAtlas}, {buildSoil}, {drawCampaign}, {createCampaign}] = await Promise.all([import('/src/render/atlas.js'), import('/src/render/world.js'), import('/src/render/campaign-world.js'), import('/src/campaign/engine.js')]);
    const atlas = await loadAtlas(), s = createCampaign();
    const times = []; let soil;
    for (let i=0;i<5;i++) { const t=performance.now(); soil=buildSoil(atlas); times.push(performance.now()-t); }
    const again = buildSoil(atlas); if(soil.toDataURL() !== again.toDataURL()) throw Error('Non-deterministic soil');
    document.body.replaceChildren(); document.body.style.cssText='margin:0;overflow:hidden';
    const c=document.createElement('canvas'); c.width=1920;c.height=1080;document.body.append(c);
    window.soilReview=(cx,cy,zoom=1)=>drawCampaign(c.getContext('2d'),atlas,{s,cx,cy,zoom,nowMs:0,worldMs:0,dtMs:0,soil,cut:{showCrew:false}});
    return {size:[soil.width,soil.height],times,terrain:atlas.has('terrain')};
  })()`);
  assert.equal(result.terrain, true, 'real terrain asset loaded');
  console.log(JSON.stringify(result));
  for (const [name,cx,cy,zoom] of [['left-wing',470,1770,1.5],['right-wing',1460,1770,1.5],['deep',960,2760,1],['far-left',-600,2100,1],['far-right',2800,2100,1],['overview',960,1900,0.72]]) {
    await evaluate(`soilReview(${cx},${cy},${zoom})`);
    const {data}=await cmd('Page.captureScreenshot',{format:'png'});
    const path=join(output,`${label}-${name}.png`);await writeFile(path,Buffer.from(data,'base64'));console.log(path);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: real terrain, deterministic buildSoil, 6 screenshots, 0 browser exceptions');
} finally { clearTimeout(timeout);ws?.close();browser.kill(); }

