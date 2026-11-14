/**
 * Draws the cutaway of Ares-1 from CAMPAIGN state (browser only). Reads state, never changes it.
 * World 1920 x 3200 units (SCENARIO section 1); the camera is { cy, zoom } with world point
 * (960, cy) at the screen centre. Room positions come from LAYOUT in src/campaign/data.js.
 */
import { LAYOUT, MODULES } from '../campaign/data.js';
import { clockAt, isDay } from '../campaign/util.js';
import { ICON } from './atlas.js';
import { buildSoil, SCREEN, SURFACE, CREW_COLORS, DRONE_BUMPERS } from './world.js';

export { SCREEN, buildSoil };

/** Frame of each right-wing room in the shared sheets module.unfinished / module.finished. */
const FRAME = { workshop: 0, lab: 1, battery: 2, garage: 3 };
const LEFT_PIC = { bedroom: 'bedroom', kitchen: 'dining', lifesupport: 'lifesupport' };
const SOIL_X = { x0: -800, x1: 2720 };

/** Rectangle of a room in world units. */
export function roomRect(id) {
  const r = LAYOUT.rooms[id];
  return { x: r.wing === 'left' ? LAYOUT.leftX : LAYOUT.rightX, y: LAYOUT.firstFloorY + (r.floor - 1) * LAYOUT.floorHeight, w: LAYOUT.wingWidth, h: LAYOUT.floorHeight };
}

/** Where the Commander or a drone stands (feet) for a place. */
export function anchor(place, slot = 0) {
  if (place === 'outside') return { x: 330 + slot * 90, y: LAYOUT.groundY + 8 };
  if (place === 'away') return null;
  if (place === 'shaft') return { x: 960, y: LAYOUT.firstFloorY + 100 };
  const r = LAYOUT.rooms[place];
  if (!r) return { x: 960, y: LAYOUT.firstFloorY + 200 };
  const rect = roomRect(place);
  return { x: rect.x + rect.w / 2 + (slot - 1) * 150, y: rect.y + rect.h - 16 };
}

/** Smooths the Commander's walk between places (screen-side animation only). */
export function createWalker() {
  return { pos: null, to: null, moving: false };
}
function walk(w, target, dtMs) {
  if (!target) { w.pos = null; w.moving = false; return w; }
  if (!w.pos) { w.pos = { ...target }; w.moving = false; return w; }
  const dx = target.x - w.pos.x, dy = target.y - w.pos.y;
  const dist = Math.hypot(dx, dy);
  const speed = 520 * (dtMs / 1000);
  if (dist <= speed) { w.pos = { ...target }; w.moving = false; } else { w.pos = { x: w.pos.x + (dx / dist) * speed, y: w.pos.y + (dy / dist) * speed }; w.moving = true; w.faceLeft = dx < 0; }
  return w;
}

const dronePlace = (s, d) => {
  if (d.task?.module) return d.task.module;
  return 'garage';
};

/**
 * Draw one frame. S: { s (campaign state), cy, zoom, shake, nowMs, soil, cut, dimExcept, marker, highlight, hover, walker, dtMs }
 * Returns hit boxes in world units: [{ id, x, y, w, h }].
 */
export function drawCampaign(ctx, atlas, S) {
  const { s, cy, zoom, nowMs, cut } = S;
  const hits = [];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1b0d12';
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  ctx.translate(SCREEN.w / 2 + (S.shake?.x ?? 0), SCREEN.h / 2 + (S.shake?.y ?? 0));
  ctx.scale(zoom, zoom);
  ctx.translate(-960, -cy);

  const clock = clockAt(s.minute);
  const day = isDay(clock.hourFloat);
  const dusk = Math.max(0, 1 - Math.abs(clock.hourFloat - 18) / 2.5); // golden hour
  const dark = clock.hourFloat >= 22 || clock.hourFloat < 5 ? 1 : clock.hourFloat < 6 ? 6 - clock.hourFloat : clock.hourFloat >= 21 ? clock.hourFloat - 21 : 0;
  const ground = LAYOUT.groundY + 4;

  // ---- sky, soil
  atlas.cell(ctx, 'sky', 0, SOIL_X.x0, -250, SOIL_X.x1 - SOIL_X.x0, LAYOUT.groundY + 270);
  ctx.drawImage(S.soil, SOIL_X.x0, LAYOUT.groundY - 40, SOIL_X.x1 - SOIL_X.x0, S.soil.height / 0.5);

  // ---- shaft down to the lowest floor
  const bottom = LAYOUT.firstFloorY + LAYOUT.floors * LAYOUT.floorHeight;
  for (let y = LAYOUT.groundY - 4; y < bottom; y += LAYOUT.floorHeight) atlas.cell(ctx, 'shaft', y === LAYOUT.groundY - 4 ? 1 : 0, LAYOUT.shaftX, y, LAYOUT.shaftWidth, Math.min(LAYOUT.floorHeight, bottom - y));

  // ---- surface
  const dusty = s.storm || s.tasks.some((t) => t.game === 'solar_wipe') || s.mult.solar < 0.95 || !s.flags.panelsCleaned;
  atlas.sprite(ctx, 'solar', dusty ? 0 : 2, SURFACE.solar.x, ground, { w: SURFACE.solar.w });
  atlas.sprite(ctx, 'antenna', s.flags.antennaFixed || s.modules.lab.status === 'online' ? 1 : 0, SURFACE.antenna.x, ground, { h: SURFACE.antenna.h });
  const atAirlock = s.where === 'outside' || (s.away && s.away.start + 30 > s.minute);
  atlas.sprite(ctx, 'airlock', atAirlock || cut?.astronaut?.visible ? 1 : 0, SURFACE.airlock.x, ground, { w: SURFACE.airlock.w });
  if (!s.away && (!cut || cut.landed)) atlas.sprite(ctx, 'lander', 1, SURFACE.lander.x, ground, { w: SURFACE.lander.w });
  if (cut?.showMound) SURFACE.mound.forEach((m) => atlas.sprite(ctx, 'mound', 0, m.x, ground, { w: m.w, flip: m.flip }));

  // ---- the lander in flight (cutscene)
  if (cut?.lander?.visible && !cut.lander.landed) {
    const L = cut.lander;
    atlas.sprite(ctx, 'lander', 0, SURFACE.lander.x, L.y, { w: SURFACE.lander.w - 20 });
    if (L.parachute === 'attached') atlas.sprite(ctx, 'parachute', 0, SURFACE.lander.x, L.y - 150, { w: 340 });
    if (L.thrusters) for (let i = 0; i < 4; i++) atlas.sprite(ctx, 'parachute', 2 + (Math.floor(nowMs / 90) % 2), SURFACE.lander.x - 78 + i * 52, L.y + 4, { h: 110 });
  }
  if (cut?.lander?.parachute === 'drifting-left') {
    const d = cut.parachuteDrift ?? 0;
    atlas.sprite(ctx, 'parachute', 1, SURFACE.lander.x - 220 - d * 260, 800 + d * 150, { w: 320, alpha: 1 - d * 0.6 });
  }
  if (cut?.dust) {
    const f = Math.min(5, Math.floor((cut.dust.age ?? 0) * 6));
    atlas.sprite(ctx, 'dust', f, SURFACE.lander.x - 40, ground + 6, { w: 340 });
    atlas.sprite(ctx, 'dust', f, SURFACE.lander.x + 60, ground + 6, { w: 280, flip: true });
  }

  // ---- weather and night over the surface
  const sky = { x: SOIL_X.x0, y: -250, w: SOIL_X.x1 - SOIL_X.x0, h: LAYOUT.groundY + 250 - 4 };
  if (s.storm) { ctx.fillStyle = 'rgba(200,110,40,0.38)'; ctx.fillRect(sky.x, sky.y, sky.w, sky.h); }
  if (dusk > 0 && !s.storm) { ctx.fillStyle = `rgba(80,110,200,${dusk * 0.22})`; ctx.fillRect(sky.x, sky.y, sky.w, sky.h); } // the blue Martian sunset
  if (dark > 0) { ctx.fillStyle = `rgba(6,10,40,${dark * 0.62})`; ctx.fillRect(sky.x, sky.y, sky.w, sky.h); }
  if (s.flags.flare) { ctx.fillStyle = 'rgba(140,255,120,0.18)'; ctx.fillRect(sky.x, sky.y, sky.w, sky.h); }

  hits.push({ id: 'surface', x: 130, y: LAYOUT.groundY - 330, w: 1700, h: 330 });
  // ---- left wing (always built)
  for (const [id, pic] of Object.entries(LEFT_PIC)) {
    const r = roomRect(id);
    atlas.room(ctx, pic, r.x, r.y, r.w, r.h);
    hits.push({ id: `module:${id}`, ...r });
  }
  // ---- right wing: frames that fill in as they are built
  for (const id of ['workshop', 'lab', 'battery', 'garage', 'greenhouse', 'recreation']) {
    const r = roomRect(id);
    const m = s.modules[id];
    const online = m.status === 'online';
    const progress = online ? 1 : m.status === 'building' ? m.progress : 0;
    if (id in FRAME) {
      atlas.cell(ctx, 'unfinished', FRAME[id], r.x, r.y, r.w, r.h);
      if (progress > 0) { ctx.globalAlpha = online ? 1 : 0.15 + progress * 0.8; atlas.cell(ctx, 'finished', FRAME[id], r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
    } else {
      // Greenhouse and Recreation have their own two-frame sheets (unfinished | finished)
      atlas.cell(ctx, id, 0, r.x, r.y, r.w, r.h);
      if (progress > 0) { ctx.globalAlpha = online ? 1 : 0.15 + progress * 0.8; atlas.cell(ctx, id, 1, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
    }
    if (m.status === 'building') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(r.x + 20, r.y + r.h - 40, r.w - 40, 16);
      ctx.fillStyle = '#FFB000'; ctx.fillRect(r.x + 20, r.y + r.h - 40, (r.w - 40) * m.progress, 16);
    }
    if (m.status === 'unbuilt') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      atlas.cell(ctx, 'icons', ICON.lock, r.x + r.w - 76, r.y + 14, 56, 56);
    }
    if (m.tier === 2) { ctx.fillStyle = '#FFB000'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('T2', r.x + r.w - 16, r.y + 44); }
    hits.push({ id: `module:${id}`, ...r });
  }
  // power shortage: rooms go dark
  if (s.res.power <= 0) { ctx.fillStyle = 'rgba(0,0,10,0.45)'; ctx.fillRect(LAYOUT.leftX, LAYOUT.firstFloorY, LAYOUT.rightX + LAYOUT.wingWidth - LAYOUT.leftX, LAYOUT.floors * LAYOUT.floorHeight); }
  // the Regolith Roof Layer: a band of soil over the right wing
  if (s.modules.roof.status === 'online') { ctx.fillStyle = 'rgba(120,60,40,0.55)'; ctx.fillRect(LAYOUT.rightX, LAYOUT.firstFloorY - 36, LAYOUT.wingWidth, 36); }

  // ---- drones: idle ones rest in the Garage frame, builders stand in the room they build
  const dh = 118;
  const union = atlas.unionBox('drone', [0, 6, 12, 18]);
  const slots = {};
  S.s.drones.forEach((d) => {
    const place = dronePlace(s, d);
    slots[place] = (slots[place] ?? -1) + 1;
    const a = anchor(place, place === 'garage' ? slots[place] + 0.5 : 1);
    let frame;
    if (d.status !== 'awake') frame = Math.floor(nowMs / 500) % 2 === 0 ? 0 : 1;
    else if (!day) frame = 18 + (Math.floor(nowMs / 800) % 2);
    else if (d.task) frame = 12 + (Math.floor(nowMs / 200) % 3);
    else frame = 6 + (Math.floor(nowMs / 500) % 2);
    atlas.sprite(ctx, 'drone', frame, a.x, a.y, { h: dh, box: union });
    ctx.fillStyle = DRONE_BUMPERS[d.id]; ctx.fillRect(a.x - 22, a.y - 16, 44, 7);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText({ 'drone-01': 'Pip', 'drone-02': 'Bumble', 'drone-03': 'Zip' }[d.id], a.x, a.y - dh - 8);
    hits.push({ id: `drone:${d.id}`, x: a.x - 70, y: a.y - dh - 10, w: 140, h: dh + 20 });
  });

  // ---- the Commander
  if (!cut) {
    const target = anchor(s.where, 1);
    const w = walk(S.walker, target, S.dtMs ?? 16);
    if (w.pos) {
      const eva = s.where === 'outside';
      const sheet = eva ? 'crewEva' : 'crewIndoor';
      const tick = Math.floor(nowMs / 180);
      let frame = Math.floor(nowMs / 700) % 2;
      if (w.moving) frame = 2 + (tick % 6);
      else if (!eva) {
        if (s.medRest || (s.where === 'bedroom' && !day)) frame = 14 + (Math.floor(nowMs / 900) % 2);
        else if (s.where === 'kitchen' && [6, 12, 18].includes(clock.hour)) frame = 12 + (Math.floor(nowMs / 450) % 2);
        else if (['workshop', 'lab', 'garage', 'battery', 'greenhouse', 'recreation'].includes(s.where)) frame = 8 + (tick % 4);
      } else frame = 8 + (tick % 4);
      const tinted = atlas.tinted(sheet, CREW_COLORS.cmdr);
      const box = atlas.unionBox(sheet, [0, 1, 2, 3, 4, 5, 6, 7]);
      // the generated sheet draws the sleeping figure smaller than the standing one: bring it to the same body size
      const norm = !eva && (frame === 14 || frame === 15) ? 1.2 : 1;
      atlas.sprite(ctx, sheet, frame, w.pos.x, w.pos.y, { h: 185 * norm, box, flip: Boolean(w.faceLeft), sheet: tinted });
      hits.push({ id: 'crew:cmdr', x: w.pos.x - 50, y: w.pos.y - 190, w: 100, h: 190 });
    }
  } else if (cut.astronaut?.visible) {
    const p = anchor('bedroom', 1);
    atlas.sprite(ctx, 'crewIndoor', cut.astronaut.helmetOn ? 22 : 23, p.x, p.y, { h: 185, box: atlas.unionBox('crewIndoor', [0, 1, 2, 3, 4, 5, 6, 7]), sheet: atlas.tinted('crewIndoor', CREW_COLORS.cmdr) });
  }

  // ---- hazard markers over the places that are in trouble
  if (S.hazards?.length) {
    const pulse = 0.6 + Math.sin(nowMs / 220) * 0.4;
    S.hazards.filter((hz) => hz.place && hz.severity !== 'info').forEach((hz, i) => {
      const at = hz.place === 'surface' ? { x: 960 + 480 + i * 70, y: LAYOUT.groundY - 260 } : (() => { const r = roomRect(hz.place); return r ? { x: r.x + r.w - 46 - i * 8, y: r.y + 46 } : null; })();
      if (!at) return;
      ctx.globalAlpha = pulse;
      atlas.cell(ctx, 'icons', hz.severity === 'alarm' ? ICON.alert : ICON.warning, at.x - 36, at.y - 36, 72, 72);
      ctx.globalAlpha = 1;
    });
  }
  // ---- radiation view: how much radiation reaches each place (docs/GAMEPLAY_PLAN.md 3.7)
  if (S.radiation) {
    const place = (id, r) => { const f = S.radiation[id]; if (f === undefined) return; ctx.fillStyle = `rgba(${Math.round(80 + 175 * f)},${Math.round(220 - 170 * f)},60,${0.22 + 0.45 * f})`; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${Math.round(f * 100)}%`, r.x + r.w / 2, r.y + r.h / 2 + 14); };
    for (const id of Object.keys(LAYOUT.rooms)) place(id, roomRect(id));
    place('surface', { x: 130, y: LAYOUT.groundY - 330, w: 1700, h: 330 });
  }

  // ---- tutorial dimming, highlight and marker
  if (S.dimExcept) {
    const h = hits.find((x) => x.id === `drone:${S.dimExcept}`);
    if (h) {
      ctx.fillStyle = 'rgba(0,0,0,0.66)';
      ctx.beginPath();
      ctx.rect(SOIL_X.x0, -250, SOIL_X.x1 - SOIL_X.x0, 3500);
      ctx.rect(h.x - 20, h.y - 20, h.w + 40, h.h + 40);
      ctx.fill('evenodd');
    }
  }
  if (S.marker) {
    const h = hits.find((x) => x.id === `drone:${S.marker}`);
    if (h) {
      const bob = Math.sin(nowMs / 220) * 10;
      const k = 90 + Math.sin(nowMs / 220) * 8;
      atlas.cell(ctx, 'icons', ICON.wrench, h.x + h.w / 2 - k / 2, h.y - k - 22 + bob, k, k);
    }
  }
  for (const [id, color, w] of [[S.highlight, `rgba(255,214,0,${0.6 + Math.sin(nowMs / 200) * 0.35})`, 8], [S.hover, 'rgba(255,255,255,0.7)', 5]]) {
    const h = id && hits.find((x) => x.id === id);
    if (h && (h.id.startsWith('module:') || h.id.startsWith('drone:') || h.id.startsWith('crew:'))) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.strokeRect(h.x + 3, h.y + 3, h.w - 6, h.h - 6); }
  }
  ctx.restore();
  void MODULES;
  return hits;
}
