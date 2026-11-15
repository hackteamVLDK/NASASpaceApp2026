/**
 * Draws the side-view cutaway of Ares-1 from simulation state (browser only).
 * Reads state, never changes it. The world is 1920 x 3200 units (SCENARIO section 1); the
 * camera is { cy, zoom }: world point (960, cy) is the centre of the 1920 x 1080 screen.
 */
import { WORLD, ROOMS, DRONES } from '../data/base-layout.js';
import { clockAt, sunFactor } from '../sim/index.js';
import { ICON } from './atlas.js';

export const SCREEN = Object.freeze({ w: 1920, h: 1080 });
export const CREW_COLORS = Object.freeze({ cmdr: '#E53935', eng: '#FDD835', bot: '#43A047', sci: '#1E88E5' });
export const DRONE_BUMPERS = Object.freeze({ 'drone-01': '#00E5FF', 'drone-02': '#FFB000', 'drone-03': '#43E060' });
export const SOIL = { x0: -1250, x1: 3450, scale: 0.5 }; // wide enough to fill the screen at the gameplay zoom

/** Surface props live in geometry.js (shared with the movers and the tests). */
import { SURFACE, roomRect, baseBottom } from './geometry.js';
import { LAYOUT } from '../campaign/data.js';
import { paintSoilDetail } from './soil-detail.js';
export { SURFACE };

/** Where a crew member stands for each place of the base graph (world units, feet). */
export function nodeAnchor(node, slot = 0) {
  const r = ROOMS[node]?.rect;
  const floorY = (rect) => rect.y + rect.h - 18;
  if (node === 'outside') return { x: 330 + slot * 90, y: WORLD.groundY + 8 };
  if (node === 'airlock') return { x: 960, y: WORLD.groundY + 8 };
  if (node === 'away') return null;
  if (!r) return { x: 960, y: 2100 };
  if (node.startsWith('shaft')) return { x: 960, y: floorY(r) };
  return { x: r.x + r.w / 2 + (slot - 1.5) * 120, y: floorY(r) };
}

const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** Pre-render the soil (all tiles under the ground line) once. Scale 0.5 pixel per unit. */
export function buildSoil(atlas) {
  const c = document.createElement('canvas');
  c.width = Math.round((SOIL.x1 - SOIL.x0) * SOIL.scale);
  c.height = Math.round((WORLD.height - WORLD.groundY + 60) * SOIL.scale);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const tile = 80;
  const ice = [];
  const put = (idx, wx, wy, crop = null) => {
    atlas.cell(ctx, 'terrain', idx, (wx - SOIL.x0) * SOIL.scale, (wy - (WORLD.groundY - 40)) * SOIL.scale, tile * SOIL.scale + 1, tile * SOIL.scale + 1, crop);
  };
  for (let wx = SOIL.x0; wx < SOIL.x1; wx += tile) {
    const col = Math.round((wx - SOIL.x0) / tile);
    // surface row: skip the sky part of the picture
    const sr = atlas.has('terrain') ? atlas.cellRect('terrain', Math.floor(hash(col, 1) * 4)) : null;
    if (sr) atlas.cell(ctx, 'terrain', 0, (wx - SOIL.x0) * SOIL.scale, 0, tile * SOIL.scale + 1, 58 * SOIL.scale, [sr.x, sr.y + sr.h * 0.27, sr.w, sr.h * 0.73]);
    for (let wy = WORLD.groundY + 18; wy < WORLD.height; wy += tile) {
      const row = Math.round((wy - WORLD.groundY) / tile);
      let idx;
      if (wy < 1560) idx = 4 + Math.floor(hash(col, row) * 4);        // regolith (indexes 4..7)
      else if (wy < 2700) idx = 8 + Math.floor(hash(col, row) * 4);   // compacted soil, stones (8..11)
      else idx = 12 + Math.floor(hash(col, row) * 2);                 // bedrock (12, 13)
      if (wy > 1800 && hash(col * 7, row * 3) > 0.985) { idx = 14 + Math.floor(hash(row, col) * 2); ice.push({ x: Math.round((wx + tile / 2 - SOIL.x0) * SOIL.scale), y: Math.round((wy + tile / 2 - (WORLD.groundY - 40)) * SOIL.scale) }); } // an ice pocket
      put(idx, wx, wy);
    }
  }
  // procedural detail on top of the tiles (layers, rocks, veins, ice lenses ...), never over the rooms or the shaft
  const toPx = (r, m = 4) => ({ x: (r.x - m - SOIL.x0) * SOIL.scale, y: (r.y - m - (WORLD.groundY - 40)) * SOIL.scale, w: (r.w + 2 * m) * SOIL.scale, h: (r.h + 2 * m) * SOIL.scale });
  const avoid = Object.keys(LAYOUT.rooms).filter((id) => roomRect(id).y > WORLD.groundY - 1).map((id) => toPx(roomRect(id)));
  avoid.push(toPx({ x: LAYOUT.shaftX, y: WORLD.groundY - 40, w: LAYOUT.shaftWidth, h: baseBottom - WORLD.groundY + 40 }));
  paintSoilDetail(ctx, {
    w: c.width, h: c.height, groundPx: Math.round(40 * SOIL.scale), hash, avoid, ice,
    airlockX: (SURFACE.airlock.x - SOIL.x0) * SOIL.scale, garageX: (roomRect('garage').x + LAYOUT.roomWidth / 2 - SOIL.x0) * SOIL.scale,
  });
  // depth gradient: darker with depth, a little stronger at the very bottom
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, 'rgba(24,6,12,0)');
  g.addColorStop(0.8, 'rgba(24,6,12,0.5)');
  g.addColorStop(1, 'rgba(24,6,12,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Which frame of a crew sheet to show, and whether the EVA suit is on. */
function crewLook(c, nowMs, helmetOffOverride = null) {
  const outdoor = c.location === 'outside' || c.location === 'away' || (c.move && (c.move.to === 'outside' || c.move.from === 'outside'));
  const tick = Math.floor(nowMs / 180);
  if (helmetOffOverride !== null) return { sheet: 'crewIndoor', frames: [helmetOffOverride ? 22 : 23] };
  if (outdoor) {
    if (c.activity === 'walk') return { sheet: 'crewEva', frames: [2 + (tick % 6)] };
    if (c.activity === 'work') return { sheet: 'crewEva', frames: [8 + (tick % 4)] };
    return { sheet: 'crewEva', frames: [Math.floor(nowMs / 500) % 2] };
  }
  switch (c.activity) {
    case 'walk': return { sheet: 'crewIndoor', frames: [2 + (tick % 6)] };
    case 'work': return { sheet: 'crewIndoor', frames: [8 + (tick % 4)] };
    case 'meal': return { sheet: 'crewIndoor', frames: [12 + (Math.floor(nowMs / 450) % 2)] };
    case 'sleep': return { sheet: 'crewIndoor', frames: [14 + (Math.floor(nowMs / 900) % 2)] };
    case 'exercise': return { sheet: 'crewIndoor', frames: [16 + (Math.floor(nowMs / 250) % 2)] };
    default: return { sheet: 'crewIndoor', frames: [Math.floor(nowMs / 700) % 2] };
  }
}

/** Position of a crew member (feet) and whether they face left. */
export function crewPosition(c, slot) {
  if (c.move) {
    const a = nodeAnchor(c.move.from, slot);
    const b = nodeAnchor(c.move.to, slot);
    if (!a || !b) return null;
    const u = 1 - c.move.left / Math.max(1, c.move.total);
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, faceLeft: b.x < a.x };
  }
  const p = nodeAnchor(c.location, slot);
  return p ? { ...p, faceLeft: false } : null;
}

/**
 * Draw one frame.
 * @param S { game, cy, zoom, shake, nowMs, cut, dimExcept, marker, highlight, hover, soil }
 *   cut: during the cutscene { lander, dust, astronaut, droneLedOn, showMound, showCrew:false }
 * @returns hit boxes in world units: [{ id, x, y, w, h }]
 */
export function drawWorld(ctx, atlas, S) {
  const { game, cy, zoom, nowMs, cut } = S;
  const hits = [];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1b0d12';
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  ctx.translate(SCREEN.w / 2 + (S.shake?.x ?? 0), SCREEN.h / 2 + (S.shake?.y ?? 0));
  ctx.scale(zoom, zoom);
  ctx.translate(-960, -cy);

  const clock = game ? clockAt(game.minute) : { hour: 12, minute: 0 };
  const daylight = sunFactor(clock.hour + clock.minute / 60);

  // ---- sky and soil
  atlas.cell(ctx, 'sky', 0, SOIL.x0, -250, SOIL.x1 - SOIL.x0, WORLD.groundY + 250 + 20);
  ctx.drawImage(S.soil, SOIL.x0, WORLD.groundY - 40, SOIL.x1 - SOIL.x0, S.soil.height / SOIL.scale);

  // ---- surface props
  const ground = WORLD.groundY + 4;
  const clean = game ? game.systems.solarClean : 0.3;
  atlas.sprite(ctx, 'solar', clean < 0.55 ? 0 : clean < 0.85 ? 1 : 2, SURFACE.solar.x, ground, { w: SURFACE.solar.w });
  const antennaFixed = game?.projects?.antenna?.status === 'done';
  atlas.sprite(ctx, 'antenna', antennaFixed ? 1 : 0, SURFACE.antenna.x, ground, { h: SURFACE.antenna.h });
  const someoneAtAirlock = game?.crew.some((c) => c.location === 'airlock' || c.move?.to === 'airlock' || c.move?.from === 'airlock');
  atlas.sprite(ctx, 'airlock', someoneAtAirlock || cut?.astronaut?.visible ? 1 : 0, SURFACE.airlock.x, ground, { w: SURFACE.airlock.w });
  if (!cut || cut.landed) atlas.sprite(ctx, 'lander', 1, SURFACE.lander.x, ground, { w: SURFACE.lander.w });
  if (cut?.showMound) SURFACE.mound.forEach((m) => atlas.sprite(ctx, 'mound', 0, m.x, ground, { w: m.w, flip: m.flip }));

  // ---- the lander in flight (cutscene)
  if (cut?.lander?.visible && !cut.lander.landed) {
    const L = cut.lander;
    const bodyH = 260;
    atlas.sprite(ctx, 'lander', 0, SURFACE.lander.x, L.y, { w: SURFACE.lander.w - 40 });
    if (L.parachute === 'attached') atlas.sprite(ctx, 'parachute', 0, SURFACE.lander.x, L.y - bodyH + 20, { w: 520 });
    if (L.thrusters) for (let i = 0; i < 4; i++) atlas.sprite(ctx, 'parachute', 2 + (Math.floor(nowMs / 90) % 2), SURFACE.lander.x - 150 + i * 100, L.y + 6, { h: 180 });
  }
  if (cut?.lander?.parachute === 'drifting-left') {
    const drift = (cut.parachuteDrift ?? 0);
    atlas.sprite(ctx, 'parachute', 1, SURFACE.lander.x - 220 - drift * 260, 780 + drift * 150, { w: 480, alpha: 1 - drift * 0.6 });
  }
  if (cut?.dust) {
    const f = Math.min(5, Math.floor((cut.dust.age ?? 0) * 6));
    atlas.sprite(ctx, 'dust', f, SURFACE.lander.x - 60, ground + 6, { w: 520 });
    atlas.sprite(ctx, 'dust', f, SURFACE.lander.x + 80, ground + 6, { w: 420, flip: true });
  }

  // ---- night over the surface
  if (daylight < 0.5) {
    ctx.fillStyle = `rgba(6,10,40,${(0.5 - daylight) * 0.9})`;
    ctx.fillRect(SOIL.x0, -250, SOIL.x1 - SOIL.x0, WORLD.groundY + 250 - 4);
  }

  // ---- shaft
  for (let y = 1100; y < 2640; y += WORLD.floorHeight) atlas.cell(ctx, 'shaft', y === 1100 ? 1 : 0, WORLD.shaftX, y, WORLD.shaftWidth, Math.min(WORLD.floorHeight, 2640 - y));

  // ---- rooms
  const roomPic = { bedroom: 'bedroom', dining: 'dining', lifesupport: 'lifesupport' };
  for (const [id, pic] of Object.entries(roomPic)) {
    const r = ROOMS[id].rect;
    atlas.room(ctx, pic, r.x, r.y, r.w, r.h);
    hits.push({ id: `room:${id}`, x: r.x, y: r.y, w: r.w, h: r.h });
  }
  const frameIndex = { workshop: 0, lab: 1, power: 2, garage: 3 };
  for (const [id, i] of Object.entries(frameIndex)) {
    const r = ROOMS[id].rect;
    const m = game?.modules?.[id];
    const done = !m || m.status === 'online';
    const progress = done ? 1 : Math.min(1, (m.hoursDone ?? 0) / (ROOMS[id].buildHours || 1));
    atlas.cell(ctx, 'unfinished', i, r.x, r.y, r.w, r.h);
    if (progress > 0) { ctx.globalAlpha = done ? 1 : 0.15 + progress * 0.75; atlas.cell(ctx, 'finished', i, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
    if (!done) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(r.x + 20, r.y + r.h - 40, r.w - 40, 16);
      ctx.fillStyle = '#FFB000';
      ctx.fillRect(r.x + 20, r.y + r.h - 40, (r.w - 40) * progress, 16);
    }
    hits.push({ id: `module:${id}`, x: r.x, y: r.y, w: r.w, h: r.h });
  }

  // ---- drones
  const nameOf = { 'drone-01': 'Pip', 'drone-02': 'Bumble', 'drone-03': 'Zip' };
  const dronePos = { 'drone-01': { x: 1500, y: 2625 }, 'drone-02': { x: 1330, y: 2625 }, 'drone-03': { x: 1680, y: 2625 } };
  const daytime = daylight > 0.25;
  const building = Boolean(game?.construction);
  for (const [id, pos] of Object.entries(dronePos)) {
    const d = game?.drones?.find((x) => x.id === id);
    const awake = d ? d.status === 'awake' : false;
    let frame;
    if (!awake) frame = (cut ? cut.droneLedOn : Math.floor(nowMs / 500) % 2 === 0) ? 0 : 1;
    else if (!daytime) frame = 18 + (Math.floor(nowMs / 800) % 2);
    else if (building) frame = 12 + (Math.floor(nowMs / 200) % 3);
    else frame = 6 + (Math.floor(nowMs / 500) % 2);
    const dh = 150;
    atlas.sprite(ctx, 'drone', frame, pos.x, pos.y, { h: dh, box: atlas.unionBox('drone', [0, 6, 12, 18]) });
    ctx.fillStyle = DRONE_BUMPERS[id];
    ctx.fillRect(pos.x - 22, pos.y - 16, 44, 7);
    hits.push({ id: `drone:${id}`, x: pos.x - 70, y: pos.y - dh - 10, w: 140, h: dh + 20 });
    if (!cut || (cut && id === 'drone-01')) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      if (!cut) { ctx.fillText(nameOf[id], pos.x + 1, pos.y - dh - 12); ctx.fillStyle = '#fff'; ctx.fillText(nameOf[id], pos.x, pos.y - dh - 13); }
    }
  }

  // ---- crew
  if (game && !cut) {
    const standing = atlas.unionBox('crewIndoor', [0, 1, 2, 3, 4, 5, 6, 7]);
    const evaBox = atlas.unionBox('crewEva', [0, 1, 2, 3, 4, 5, 6, 7]);
    game.crew.forEach((c, slot) => {
      const pos = crewPosition(c, slot);
      if (!pos) return;
      const look = crewLook(c, nowMs);
      const tinted = atlas.tinted(look.sheet, CREW_COLORS[c.id] ?? '#00E5FF');
      atlas.sprite(ctx, look.sheet, look.frames[0], pos.x, pos.y, { h: 185, box: look.sheet === 'crewEva' ? evaBox : standing, flip: pos.faceLeft, sheet: tinted });
      if (c.grounded) { ctx.fillStyle = '#FF6B35'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', pos.x, pos.y - 200); }
      hits.push({ id: `crew:${c.id}`, x: pos.x - 50, y: pos.y - 190, w: 100, h: 190 });
    });
  }
  if (cut?.astronaut?.visible) {
    const p = nodeAnchor('bedroom', 1);
    const tinted = atlas.tinted('crewIndoor', CREW_COLORS.cmdr);
    atlas.sprite(ctx, 'crewIndoor', cut.astronaut.helmetOn ? 22 : 23, p.x, p.y, { h: 185, box: atlas.unionBox('crewIndoor', [0, 1, 2, 3, 4, 5, 6, 7]), sheet: tinted });
  }

  // ---- tutorial dimming, highlight and marker
  if (S.dimExcept) {
    const h = hits.find((x) => x.id === `drone:${S.dimExcept}`);
    if (h) {
      ctx.fillStyle = 'rgba(0,0,0,0.66)';
      ctx.beginPath();
      ctx.rect(SOIL.x0, -250, SOIL.x1 - SOIL.x0, WORLD.height + 300);
      ctx.rect(h.x - 20, h.y - 20, h.w + 40, h.h + 40);
      ctx.fill('evenodd');
    }
  }
  if (S.marker) {
    const h = hits.find((x) => x.id === `drone:${S.marker}`);
    if (h) {
      const bob = Math.sin(nowMs / 220) * 10;
      const s = 90 + Math.sin(nowMs / 220) * 8;
      atlas.cell(ctx, 'icons', ICON.wrench, h.x + h.w / 2 - s / 2, h.y - s - 22 + bob, s, s);
    }
  }
  if (S.highlight) {
    const h = hits.find((x) => x.id === S.highlight);
    if (h) {
      ctx.strokeStyle = `rgba(255,214,0,${0.6 + Math.sin(nowMs / 200) * 0.35})`;
      ctx.lineWidth = 8;
      ctx.strokeRect(h.x + 4, h.y + 4, h.w - 8, h.h - 8);
    }
  }
  if (S.hover) {
    const h = hits.find((x) => x.id === S.hover);
    if (h && (h.id.startsWith('module:') || h.id.startsWith('drone:'))) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 5; ctx.strokeRect(h.x, h.y, h.w, h.h); }
  }
  ctx.restore();
  return hits;
}
