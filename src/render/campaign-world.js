/**
 * Draws the cutaway of Ares-1 from CAMPAIGN state (browser only). Reads state, never changes it.
 * World 1920 x 3200 units (SCENARIO section 1); the camera is { cy, zoom } with world point
 * (960, cy) at the screen centre. Room positions come from LAYOUT in src/campaign/data.js.
 */
import { LAYOUT, MODULES } from '../campaign/data.js';
import { clockAt, isDay, online } from '../campaign/util.js';
import { ICON } from './atlas.js';
import { buildSoil, SCREEN, SURFACE, CREW_COLORS, DRONE_BUMPERS, SOIL } from './world.js';
import { GROUND_Y, floorFeetY, onSurface, createMover, setGoal, advance, place as placeAt, arrived, roverPose, ROVER } from './movers.js';

export { SCREEN, buildSoil };

/** Frame of each right-wing room in the shared sheets module.unfinished / module.finished. */
const FRAME = { workshop: 0, lab: 1, battery: 2, garage: 3 };
const LEFT_PIC = { bedroom: 'bedroom', kitchen: 'dining', lifesupport: 'lifesupport' };
const SOIL_X = { x0: SOIL.x0, x1: SOIL.x1 };

/** Rectangle of a room in world units. */
export function roomRect(id) {
  const r = LAYOUT.rooms[id];
  return { x: r.wing === 'left' ? LAYOUT.leftX : LAYOUT.rightX, y: LAYOUT.firstFloorY + (r.floor - 1) * LAYOUT.floorHeight, w: LAYOUT.wingWidth, h: LAYOUT.floorHeight };
}

/** Where the Commander or a drone stands (feet) for a place. */
export function anchor(place, slot = 0) {
  if (place === 'outside') return { x: 330 + slot * 90, y: GROUND_Y };
  if (place === 'away') return null;
  if (place === 'solar') return { x: SURFACE.solar.x + 110 + (slot - 1) * 60, y: GROUND_Y }; // a drone upgrading the panels
  if (place === 'roof') return { x: LAYOUT.rightX + LAYOUT.wingWidth / 2 + (slot - 1) * 150, y: LAYOUT.firstFloorY - 6 }; // piling soil over the right wing
  if (place === 'shaft') return { x: 960, y: LAYOUT.firstFloorY + 100 };
  const r = LAYOUT.rooms[place];
  if (!r) return { x: 960, y: LAYOUT.firstFloorY + 200 };
  const rect = roomRect(place);
  return { x: rect.x + rect.w / 2 + (slot - 1) * 150, y: floorFeetY(r.floor) };
}

/** The Commander's body (see movers.js): it walks the base by the shaft. */
export const createWalker = createMover;

/** Where a drone rests when it has nothing to do: the left half of the Garage (the Rover parks on the right). */
const restSpot = (i) => ({ x: LAYOUT.rightX + 105 + i * 92, y: floorFeetY(LAYOUT.rooms.garage.floor) });
/** Where a dormant drone waits: Pip in the right wing, the other two buried in the mounds on the surface. */
const dormantSpot = (i) => (i === 0 ? restSpot(0) : { x: SURFACE.mound[i - 1].x, y: GROUND_Y });
const NICK = { 'drone-01': 'Pip', 'drone-02': 'Bumble', 'drone-03': 'Zip' };
const DIG_MS = 1800; // a drone shaking the sand off after its kit was used

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
  if (dark > 0.25 && !s.storm) { // a few twinkling stars (the night overlay below dims them to match)
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) { ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(nowMs / 650 + i * 1.7)); ctx.fillRect(-1100 + ((i * 977) % 4150), 735 + ((i * 619) % 125), 10, 10); }
    ctx.globalAlpha = 1;
  }

  // ---- shaft down to the lowest floor
  const bottom = LAYOUT.firstFloorY + LAYOUT.floors * LAYOUT.floorHeight;
  for (let y = LAYOUT.groundY - 4; y < bottom; y += LAYOUT.floorHeight) atlas.cell(ctx, 'shaft', y === LAYOUT.groundY - 4 ? 1 : 0, LAYOUT.shaftX, y, LAYOUT.shaftWidth, Math.min(LAYOUT.floorHeight, bottom - y));

  // ---- surface
  const dusty = s.storm || s.tasks.some((t) => t.game === 'solar_wipe') || s.mult.solar < 0.95 || !s.flags.panelsCleaned;
  atlas.sprite(ctx, 'solar', dusty ? 0 : 2, SURFACE.solar.x, ground, { w: SURFACE.solar.w });
  atlas.sprite(ctx, 'antenna', s.flags.antennaFixed || s.modules.lab.status === 'online' ? 1 : 0, SURFACE.antenna.x, ground, { h: SURFACE.antenna.h });
  const atAirlock = s.where === 'outside' || (s.away && s.away.start + 30 > s.minute);
  atlas.sprite(ctx, 'airlock', atAirlock || cut?.astronaut?.visible ? 1 : 0, SURFACE.airlock.x, ground, { w: SURFACE.airlock.w });
  if (!cut || cut.landed) atlas.sprite(ctx, 'lander', 1, SURFACE.lander.x, ground, { w: SURFACE.lander.w });
  // the mounds hide Drones #02 and #03 until their kits wake them (the cutscene shows both mounds)
  SURFACE.mound.forEach((m, i) => { if (cut?.showMound || s.drones[i + 1]?.status !== 'awake') atlas.sprite(ctx, 'mound', 0, m.x, ground, { w: m.w, flip: m.flip }); });

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
  if (s.storm) {
    ctx.fillStyle = 'rgba(200,110,40,0.38)'; ctx.fillRect(sky.x, sky.y, sky.w, sky.h);
    ctx.fillStyle = 'rgba(235,165,95,0.42)';
    for (let i = 0; i < 70; i++) ctx.fillRect(-800 + ((i * 313 + nowMs * (0.55 + (i % 5) * 0.18)) % 3700), 540 + ((i * 131) % 500), 70 + (i % 4) * 40, 5);
  }
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
    const built = m.status === 'online';
    const progress = built ? 1 : m.status === 'building' ? m.progress : 0;
    if (id in FRAME) {
      atlas.cell(ctx, 'unfinished', FRAME[id], r.x, r.y, r.w, r.h);
      if (progress > 0) { ctx.globalAlpha = built ? 1 : 0.15 + progress * 0.8; atlas.cell(ctx, 'finished', FRAME[id], r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
    } else {
      // Greenhouse and Recreation have their own two-frame sheets (unfinished | finished)
      atlas.cell(ctx, id, 0, r.x, r.y, r.w, r.h);
      if (progress > 0) { ctx.globalAlpha = built ? 1 : 0.15 + progress * 0.8; atlas.cell(ctx, id, 1, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
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

  // ---- the Rover: parked in the Garage once it is built, rolls out of the right edge on a trip and back in
  const pace = S.pace ?? 1;
  const dtMs = S.dtMs ?? 16;
  const garageY = floorFeetY(LAYOUT.rooms.garage.floor);
  const rp = roverPose(S.rover?.phase ?? (s.away ? 'gone' : 'parked'), S.rover?.k ?? 0);
  if (online(s, 'garage') && rp.visible && !cut) {
    atlas.sprite(ctx, 'rover', rp.driving ? 1 + (Math.floor(nowMs / 130) % 2) : 0, rp.x, garageY, { w: ROVER.width, alpha: rp.alpha });
    hits.push({ id: 'module:garage', x: rp.x - ROVER.width / 2, y: garageY - 170, w: ROVER.width, h: 170 });
  }

  // ---- drones: each one rolls (or hovers up the shaft) to where it works and rests in the Garage when idle
  const dh = 118;
  const union = atlas.unionBox('drone', [0, 6, 12, 18]);
  const movers = S.droneMovers ?? (S.droneMovers = {});
  S.s.drones.forEach((d, i) => {
    const mv = (movers[d.id] ??= createMover());
    if (mv.status === undefined) mv.status = d.status;
    if (mv.status !== d.status) { // a kit just woke it: Drones #02 and #03 shake the sand off in their mound first
      mv.status = d.status;
      if (d.status === 'awake' && i > 0) { placeAt(mv, dormantSpot(i)); mv.digUntil = nowMs + DIG_MS; }
    }
    const digging = mv.digUntil > nowMs;
    const siteId = d.task?.module;
    const goal = d.status !== 'awake' ? dormantSpot(i) : siteId ? { ...anchor(siteId, 0.35) } : restSpot(i);
    if (!digging) { setGoal(mv, goal); advance(mv, dtMs, { walk: 430, climb: 300, pace }); }
    const a = mv.pos ?? goal;
    const working = Boolean(siteId) && arrived(mv);
    let frame;
    if (d.status !== 'awake') frame = Math.floor(nowMs / 500) % 2 === 0 ? 0 : 1;
    else if (digging) frame = 20 + (Math.floor(nowMs / 220) % 4);
    else if (mv.climbing) frame = 6 + (Math.floor(nowMs / 250) % 2); // hovering up or down the shaft
    else if (mv.moving) frame = siteId ? 16 + (Math.floor(nowMs / 220) % 2) : 8 + (Math.floor(nowMs / 110) % 4); // carrying a girder to the site, or just rolling
    else if (working) frame = 12 + (Math.floor(nowMs / 180) % 4); // welding, by day and by night: drones never sleep
    else if (!day) frame = 18 + (Math.floor(nowMs / 800) % 2); // idle at night: powered down for the dark
    else frame = 6 + (Math.floor(nowMs / 500) % 2);
    const buried = d.status !== 'awake' && i > 0; // the mound is drawn on the surface instead of the sleeping sprite
    if (!buried) atlas.sprite(ctx, 'drone', frame, a.x, a.y, { h: dh, box: union, flip: mv.moving && !mv.climbing && mv.faceLeft });
    if (!buried) { ctx.fillStyle = DRONE_BUMPERS[d.id]; ctx.fillRect(a.x - 22, a.y - 16, 44, 7); }
    if (buried) { if (Math.floor(nowMs / 500) % 2 === 0) { ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(a.x + (i === 1 ? -12 : 14), a.y - 62, 7, 0, Math.PI * 2); ctx.fill(); } } else {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(NICK[d.id], a.x, a.y - dh - 8);
    }
    hits.push({ id: `drone:${d.id}`, x: a.x - 70, y: a.y - (buried ? 130 : dh) - 10, w: 140, h: (buried ? 130 : dh) + 20 });
  });

  // ---- the Commander: walks the base by the shaft, wears the suit on the surface, boards the Rover for a trip
  if (!cut) {
    const w = S.walker;
    const rv = S.rover?.phase;
    const boarding = rv === 'boarding';
    const hidden = !boarding && (s.where === 'away' || rv === 'out' || rv === 'in' || rv === 'gone'); // inside the Rover, or out on the trip
    const target = boarding ? { x: ROVER.parkX - 200, y: garageY } : anchor(s.where, 1);
    if (hidden) setGoal(w, null);
    else {
      setGoal(w, target);
      advance(w, dtMs, { walk: 470, climb: 320, pace });
    }
    if (w.pos) {
      const eva = onSurface(w.pos);
      const sheet = eva ? 'crewEva' : 'crewIndoor';
      const tick = Math.floor(nowMs / 160);
      let frame = Math.floor(nowMs / 700) % 2; // standing about
      let still = false; // frames drawn facing right with their own furniture (console, table, bed)
      if (w.climbing) frame = eva ? 16 + (tick % 2) : 18 + (tick % 4);
      else if (w.moving) frame = 2 + (tick % 6);
      else if (eva) frame = s.where === 'outside' ? 8 + (tick % 4) : frame;
      else if (s.medRest || (s.where === 'bedroom' && !day)) { frame = 14 + (Math.floor(nowMs / 900) % 2); still = true; }
      else if (s.where === 'kitchen' && [6, 12, 18].includes(clock.hour)) { frame = 12 + (Math.floor(nowMs / 450) % 2); still = true; }
      else if (['workshop', 'lab', 'garage', 'battery', 'greenhouse', 'recreation'].includes(s.where)) { frame = 8 + (tick % 4); still = true; }
      const tinted = atlas.tinted(sheet, CREW_COLORS.cmdr);
      const box = atlas.unionBox(sheet, [0, 1, 2, 3, 4, 5, 6, 7]);
      // the generated sheet draws the sleeping figure smaller than the standing one: bring it to the same body size
      const norm = !eva && (frame === 14 || frame === 15) ? 1.2 : 1;
      atlas.sprite(ctx, sheet, frame, w.pos.x, w.pos.y, { h: 185 * norm, box, flip: !still && Boolean(w.faceLeft), sheet: tinted });
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
