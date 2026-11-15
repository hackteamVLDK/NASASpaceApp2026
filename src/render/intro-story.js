/**
 * Draws the intro picture storyboard (SCENARIO "Intro: picture storyboard") on the 1920 x 1080 canvas with the game's
 * own sprites. Reads the storyboard state from src/flow/intro.js (storyAt), never changes anything.
 * Reduce motion: fades only; rings, weather and drones are drawn still.
 */
import { STORYBOARD, GAMEPLAY_VIEW } from '../flow/intro.js';
import { ICON } from './atlas.js';
import { createCampaign } from '../campaign/engine.js';
import { drawCampaign } from './campaign-world.js';
import { GROUND_Y } from './geometry.js';
import { ROVER } from './movers.js';
import { surfaceEffects, paintSurfaceEffects } from './surface-lighting.js';

const W = 1920, H = 1080;
const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

/** One big line, centred, with its key word in Martian Orange. */
function bigLine(ctx, text, key, y, px = 72) {
  ctx.font = `900 ${px}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const words = text.split(' ');
  const space = ctx.measureText(' ').width;
  const width = words.reduce((a, w) => a + ctx.measureText(w).width, 0) + space * (words.length - 1);
  let x = (W - width) / 2;
  ctx.lineJoin = 'round';
  for (const w of words) {
    const isKey = key && w.replace(/[^A-Za-z]/g, '') === key;
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(5,7,10,0.85)'; ctx.strokeText(w, x, y);
    ctx.fillStyle = isKey ? STORYBOARD.keyColor : '#ffffff';
    ctx.fillText(w, x, y);
    x += ctx.measureText(w).width + space;
  }
}

/** Real campaign frames, with independent state and render-only mover caches. The live game is untouched. */
const startState = createCampaign({ seed: 1 });
const stormState = { ...startState, storm: true };
const droneMovers = {};
// Gameplay art framing, not scientific measurements. The left surface has no base props.
export const STORY_VIEWS = Object.freeze({
  surface: Object.freeze({ cx: -650, cy: 940, zoom: 2.5 }),
  base: Object.freeze({ cx: GAMEPLAY_VIEW.centerX, cy: GAMEPLAY_VIEW.centerY, zoom: GAMEPLAY_VIEW.zoom }),
});

function campaignFrame(ctx, atlas, soil, view, storm = false, worldMs = 0) {
  drawCampaign(ctx, atlas, {
    s: storm ? stormState : startState, ...view, soil,
    nowMs: worldMs, worldMs, dtMs: 0, droneMovers,
    // The crew has not landed. Show the dormant robots, without pouring sand over the base.
    cut: { showCrew: false, showMound: false, buried: false },
  });
}

/** Title and briefing use the same fresh base frame as panel 3. */
export function drawIntroSurface(ctx, { atlas, soil }) {
  campaignFrame(ctx, atlas, soil, STORY_VIEWS.base);
}

function panelRover(ctx, atlas, st, still, soil, storm = false) {
  const view = STORY_VIEWS.surface;
  const worldMs = still ? 0 : st.local * 1000;
  campaignFrame(ctx, atlas, soil, view, storm, worldMs);
  const floor = H / 2 + (GROUND_Y - view.cy) * view.zoom;
  const x = W / 2;
  if (!storm) {
    ctx.lineWidth = 6;
    for (const [k, r0] of st.panel.rings.entries()) {
      const age = still ? 0.9 + k * 0.5 : st.local - r0;
      if (age < 0 || age > 2.4) continue;
      const rad = 60 + age * 260;
      ctx.strokeStyle = `rgba(255,176,0,${Math.max(0, 0.75 - age * 0.3)})`;
      ctx.beginPath(); ctx.ellipse(x, floor, rad, rad * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(view.zoom, view.zoom); ctx.translate(-view.cx, -view.cy);
  const paint = (g) => atlas.sprite(g, 'rover', 0, view.cx, GROUND_Y, { w: ROVER.width });
  if (storm) {
    // The same object tint as the Rover during a campaign storm, including its transparent corners.
    const box = atlas.bbox('rover', 0), h = box.h * ROVER.width / box.w;
    paintSurfaceEffects(ctx, 'intro-rover', { x: view.cx - ROVER.width / 2, y: GROUND_Y - h, w: ROVER.width, h }, paint,
      surfaceEffects({ dark: 0, dusk: 0, storm: true, flare: false }));
  } else paint(ctx);
  ctx.restore();
  if (storm) {
    const left = st.panel.barsDropAt.filter((at) => st.local < at).length;
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = b < left ? '#00E5FF' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 230 + b * 30, floor - 330 - b * 22, 20, 30 + b * 22);
    }
  }
}

function panelTitle(ctx, atlas, t, st, soil) {
  drawIntroSurface(ctx, { atlas, soil });
  ctx.font = `800 40px ${FONT}`;
  const label = t(st.panel.badge);
  const bw = ctx.measureText(label).width + 80;
  ctx.fillStyle = 'rgba(8,12,24,0.88)'; ctx.strokeStyle = 'rgba(0,229,255,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect((W - bw) / 2, 300, bw, 84, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#00E5FF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, W / 2, 342);
}

function wrap(ctx, text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(' ')) { const tryL = line ? `${line} ${w}` : w; if (ctx.measureText(tryL).width > maxW && line) { out.push(line); line = w; } else line = tryL; }
  if (line) out.push(line);
  return out;
}

function panelBriefing(ctx, atlas, t, st, soil) {
  drawIntroSurface(ctx, { atlas, soil });
  ctx.fillStyle = 'rgba(5,7,10,0.6)'; ctx.fillRect(0, 0, W, H);
  const p = st.panel;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 84px ${FONT}`; ctx.fillStyle = STORYBOARD.keyColor; ctx.fillText(t(p.title), W / 2, 150);
  const icons = { drone: ICON.droneAwake, crew: ICON.shelter, rover: ICON.explore };
  p.tiles.forEach((tile, i) => {
    const x = W / 2 + (i - 1) * 580 - 260, y = 240, w = 520, h = 450;
    ctx.fillStyle = 'rgba(8,12,24,0.88)'; ctx.strokeStyle = 'rgba(0,229,255,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
    if (atlas.has('icons')) atlas.cell(ctx, 'icons', icons[tile.icon], x + w / 2 - 80, y + 30, 160, 160);
    ctx.fillStyle = '#ffffff'; ctx.font = `900 48px ${FONT}`;
    const goals = wrap(ctx, t(tile.goal), w - 60);
    goals.forEach((line, k) => ctx.fillText(line, x + w / 2, y + 240 + (k - (goals.length - 1) / 2) * 58));
    ctx.fillStyle = '#00E5FF'; ctx.font = `700 34px ${FONT}`;
    wrap(ctx, t(tile.learn), w - 60).forEach((l, k) => ctx.fillText(l, x + w / 2, y + 330 + k * 46));
  });
  ctx.fillStyle = '#e8f4ff'; ctx.font = `600 34px ${FONT}`;
  ctx.fillText(t(p.facts), W / 2, 770);
}

/**
 * @param {object} st  storyAt(storyTime)
 * @param {object} o   { atlas, nowMs, reduceMotion, t (strings), soil }
 */
export function drawStory(ctx, st, { atlas, nowMs, reduceMotion = false, t, soil = null }) {
  const still = Boolean(reduceMotion);
  ctx.save();
  ctx.fillStyle = STORYBOARD.background; ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  const id = st.panel.id;
  if (id === 'title') panelTitle(ctx, atlas, t, st, soil);
  else if (id === 'signal') panelRover(ctx, atlas, st, still, soil);
  else if (id === 'storm') panelRover(ctx, atlas, st, still, soil, true);
  else if (id === 'drones') campaignFrame(ctx, atlas, soil, STORY_VIEWS.base, false, still ? 0 : st.local * 1000);
  else panelBriefing(ctx, atlas, t, st, soil);
  if (st.lines.length) {
    // A calm shadow band and outlined type keep both short lines readable over real frames.
    const title = id === 'title', y = title ? 520 : 135;
    ctx.fillStyle = 'rgba(5,7,10,0.65)';
    ctx.fillRect(0, y - 55, W, st.lines.length * 96 + 14);
    st.lines.forEach((line, i) => bigLine(ctx, t(line.id), line.key, y + i * 96, 76));
  }
  // progress dots
  const n = STORYBOARD.panels.length;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i === st.index ? STORYBOARD.keyColor : 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(W / 2 + (i - (n - 1) / 2) * 40, 1040, i === st.index ? 10 : 7, 0, Math.PI * 2); ctx.fill();
  }
  // gentle fade in from the dark
  if (st.fade < 1) { ctx.fillStyle = `rgba(5,7,10,${1 - st.fade})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
