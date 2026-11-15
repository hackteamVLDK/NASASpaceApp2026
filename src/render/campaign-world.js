/**
 * Draws the cutaway of Ares-1 from CAMPAIGN state (browser only). Reads state, never changes it.
 * The camera is { cx, cy, zoom }: world point (cx, cy) is at the screen centre. Room positions come from
 * LAYOUT (src/campaign/data.js) through geometry.js; bodies move by movers.js.
 *
 * Two clocks: `nowMs` is the wall clock (interface pulses: selection outline, warning icons, the tutorial
 * marker). `worldMs` only runs while the game runs, so when the game is paused or a card is open the
 * characters, drones, Rover and weather freeze with the simulation.
 */
import { LAYOUT, MODULES } from '../campaign/data.js';
import { clockAt, isDay, online } from '../campaign/util.js';
import { ICON } from './atlas.js';
import { buildSoil, SCREEN, CREW_COLORS, DRONE_BUMPERS, SOIL } from './world.js';
import { SURFACE, LANDER_FLIGHT_W, PERSON_H, DRONE_H, SHAFT_X, GROUND_Y, LADDER, roomRect, anchor, feetY, bedroomSpots, garageSpots, baseBottom, rightWingWidth } from './geometry.js';
import { onSurface, createMover, setGoal, advance, place as placeAt, arrived, roverPose, ROVER } from './movers.js';
import { CLIMB_FRAMES } from './ladders.js';
import { SURFACE_LIGHTING } from '../data/surface-lighting.js';
import { surfaceEffects, paintSurfaceEffects } from './surface-lighting.js';
import { flames } from './lander.js';
import { prefs, wave } from '../ui/prefs.js'; // C15/C21: Reduce motion

export { SCREEN, buildSoil, roomRect, anchor };

/** Frame of each unfinished room in the shared sheets module.unfinished / module.finished. */
const FRAME = { workshop: 0, lab: 1, battery: 2 };
const LEFT_PIC = { bedroom: 'bedroom', kitchen: 'dining', lifesupport: 'lifesupport' };
const SOIL_X = { x0: SOIL.x0, x1: SOIL.x1 };
const NICK = { 'drone-01': 'Pip', 'drone-02': 'Bumble', 'drone-03': 'Zip' };
const DIG_MS = 1800; // a drone shaking the sand off after its kit was used
/** The part of the sleeping sprites (crew.indoor 14, 15) that is the person, pillow and blanket: the bed is cut away. */
const SLEEPER = { x: 24, y: 0, w: 176, h: 100 };
const ROOMS_WITH_CONSOLE = ['workshop', 'lab', 'garage', 'battery', 'greenhouse', 'recreation'];

/** The Commander's body (see movers.js): it walks the base by the shaft. */
export const createWalker = createMover;

/** The climbing frame whose reaching hands decide where a climber hangs on the ladder, per crew sheet (the painted ladder is cut out, see ladders.js). */
const CLIMB_REF = { crewEva: CLIMB_FRAMES.crewEva[0], crewIndoor: CLIMB_FRAMES.crewIndoor[0] };

/**
 * How far (world units) a climber moves from the middle of the shaft so that his reaching hands are on the shaft's ladder (A36).
 * The frames face right, the hands are the right edge of the sprite; `box` is the shared box that scales the person.
 */
function climbShift(atlas, sheet, box) {
  if (!atlas.has(sheet)) return 0;
  return LADDER.gripX - atlas.spriteWidth(sheet, CLIMB_REF[sheet], { h: PERSON_H, box }) / 2 - SHAFT_X;
}

/**
 * Draw one frame. S: { s (campaign state), cx, cy, zoom, shake, nowMs, worldMs, dtMs (world time that passed),
 * soil, cut, dimExcept, marker, highlight, hover, walker, droneMovers, rover, hazards, radiation }
 * Returns hit boxes in world units: [{ id, x, y, w, h }].
 */
export function drawCampaign(ctx, atlas, S) {
  const { s, cy, zoom, nowMs, cut } = S;
  const cx = S.cx ?? 960;
  const wm = S.worldMs ?? nowMs; // the world clock
  const dt = S.dtMs ?? 0; // world time that passed this frame; 0 while the game is stopped
  const hits = [];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1b0d12';
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  ctx.translate(SCREEN.w / 2 + (S.shake?.x ?? 0), SCREEN.h / 2 + (S.shake?.y ?? 0));
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);

  const clock = clockAt(s.minute);
  const day = isDay(clock.hourFloat);
  const dusk = Math.max(0, 1 - Math.abs(clock.hourFloat - 18) / 2.5); // golden hour
  const dark = clock.hourFloat >= 22 || clock.hourFloat < 5 ? 1 : clock.hourFloat < 6 ? 6 - clock.hourFloat : clock.hourFloat >= 21 ? clock.hourFloat - 21 : 0;
  const ground = LAYOUT.groundY + 4;
  const effects = surfaceEffects({ dark, dusk, storm: s.storm, flare: s.flags.flare });
  // Apply weather separately so focusing the Garage never lights up the drones in front of it.
  const surfacePaint = (id, bounds, paint, outside = true, cacheKey = id) => {
    if (!outside || !effects.length || (id && (id === S.highlight || id === S.hover))) { paint(ctx); return; }
    paintSurfaceEffects(ctx, cacheKey, bounds, paint, effects);
  };
  const surfaceSprite = (id, sheet, frame, x, y, options) => {
    const own = atlas.bbox(sheet, frame);
    const box = options.box ?? own;
    const scale = options.h ? options.h / box.h : options.w / box.w;
    const w = own.w * scale, h = own.h * scale;
    surfacePaint(id, { x: x - w / 2, y: y - h, w, h }, (g) => atlas.sprite(g, sheet, frame, x, y, options), true, `${id}:${sheet}`);
  };

  // ---- sky, soil
  atlas.cell(ctx, 'sky', 0, SOIL_X.x0, -250, SOIL_X.x1 - SOIL_X.x0, LAYOUT.groundY + 270);
  ctx.drawImage(S.soil, SOIL_X.x0, LAYOUT.groundY - 40, SOIL_X.x1 - SOIL_X.x0, S.soil.height / 0.5);
  if (dark > 0.25 && !s.storm) { // a few twinkling stars (the night overlay below dims them to match)
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) { ctx.globalAlpha = prefs.reduceMotion ? 0.8 : 0.55 + 0.45 * Math.abs(Math.sin(wm / 650 + i * 1.7)); ctx.fillRect(-1100 + ((i * 977) % 4400), 735 + ((i * 619) % 125), 10, 10); }
    ctx.globalAlpha = 1;
  }

  // Weather reaches the feet and blends into the surface soil, rather than ending above the ground.
  for (const effect of effects) {
    const tint = `rgba(${effect.tint},${effect.opacity})`;
    ctx.fillStyle = tint;
    ctx.fillRect(SOIL_X.x0, -250, SOIL_X.x1 - SOIL_X.x0, GROUND_Y + 250);
    const depth = effect.fadeDepth ?? SURFACE_LIGHTING.groundFadeDepth;
    const fade = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + depth);
    fade.addColorStop(0, tint);
    fade.addColorStop(1, `rgba(${effect.tint},0)`);
    ctx.fillStyle = fade;
    ctx.fillRect(SOIL_X.x0, GROUND_Y, SOIL_X.x1 - SOIL_X.x0, depth);
  }

  if (dark > 0) { // night dims the soil of the cutaway as well; the rooms are drawn on top with their own light
    ctx.fillStyle = `rgba(${SURFACE_LIGHTING.night.tint},${SURFACE_LIGHTING.soilNight * dark})`;
    ctx.fillRect(SOIL_X.x0, GROUND_Y, SOIL_X.x1 - SOIL_X.x0, S.soil.height / 0.5);
  }

  // ---- shaft down to the lowest floor
  for (let y = LAYOUT.groundY - 4; y < baseBottom; y += LAYOUT.floorHeight) atlas.cell(ctx, 'shaft', y === LAYOUT.groundY - 4 ? 1 : 0, LAYOUT.shaftX, y, LAYOUT.shaftWidth, Math.min(LAYOUT.floorHeight, baseBottom - y));

  // ---- surface
  const dusty = s.storm || s.tasks.some((t) => t.game === 'solar_wipe') || s.mult.solar < 0.95 || !s.flags.panelsCleaned;
  surfaceSprite('module:solar', 'solar', dusty ? 0 : 2, SURFACE.solar.x, ground, { w: SURFACE.solar.w });
  surfaceSprite('antenna', 'antenna', s.flags.antennaFixed || s.modules.lab.status === 'online' ? 1 : 0, SURFACE.antenna.x, ground, { h: SURFACE.antenna.h });
  // the hatch of the dome is open while someone stands at it (or the cutscene says so)
  const droneMovers = S.droneMovers ?? (S.droneMovers = {});
  const nearHatch = (p) => p && onSurface(p) && Math.abs(p.x - SHAFT_X) < 170;
  const hatchOpen = cut ? Boolean(cut.airlockOpen) : nearHatch(S.walker?.pos) || Object.values(droneMovers).some((m) => nearHatch(m.pos));
  surfaceSprite('airlock', 'airlock', hatchOpen ? 1 : 0, SURFACE.airlock.x, ground, { w: SURFACE.airlock.w });
  if (!cut || cut.landed) surfaceSprite('lander', 'lander', 1, SURFACE.lander.x, ground, { w: SURFACE.lander.w });
  if (cut?.showMound) SURFACE.mound.forEach((m, i) => surfaceSprite(`mound:${i}`, 'mound', 0, m.x, ground, { w: m.w, flip: m.flip })); // the cutscene only: afterwards the drones wait in the Garage
  if (dark > 0 && !cut) { // at night the lit windows of the dome and the lander glow warm against the dark blue
    const { color, alpha } = SURFACE_LIGHTING.windowGlow;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, rad] of [[SURFACE.airlock.x - 250, ground - 60, 90], [SURFACE.airlock.x, ground - 90, 120], [SURFACE.airlock.x + 250, ground - 60, 90], [SURFACE.lander.x, ground - 70, 70]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${color},${alpha * dark})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
  }

  // ---- the lander in flight (cutscene)
  if (cut?.lander?.visible && !cut.lander.landed) {
    const L = cut.lander;
    // one flame under the middle of each nozzle, drawn first so the lander's nozzle rims cover the flat tops of the flames (A13, A41);
    // both flame frames share the scale of the longer one, so the short frame stays short instead of coming out wider
    if (L.thrusters) {
      const box = atlas.bbox('parachute', 2);
      for (const f of flames({ x: SURFACE.lander.x, y: L.y, w: LANDER_FLIGHT_W, tick: Math.floor(wm / 90) })) atlas.sprite(ctx, 'parachute', f.frame, f.x, f.y, { h: box.h * f.k, box, anchor: 'top' });
    }
    atlas.sprite(ctx, 'lander', 0, SURFACE.lander.x, L.y, { w: LANDER_FLIGHT_W });
    if (L.parachute === 'attached') atlas.sprite(ctx, 'parachute', 0, SURFACE.lander.x, L.y - 150, { w: 340 });
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

  hits.push({ id: 'surface', x: 130, y: LAYOUT.groundY - 330, w: 2500, h: 330 });
  // ---- left wing (always built)
  for (const [id, pic] of Object.entries(LEFT_PIC)) {
    const r = roomRect(id);
    atlas.room(ctx, pic, r.x, r.y, r.w, r.h);
    hits.push({ id: `module:${id}`, ...r });
  }
  // ---- the buildable rooms: right wing (two columns) and the surface Garage, frames that fill in as they are built
  for (const id of ['workshop', 'lab', 'battery', 'garage', 'greenhouse', 'recreation']) {
    const r = roomRect(id);
    const m = s.modules[id];
    const built = m.status === 'online';
    const progress = built ? 1 : m.status === 'building' ? m.progress : 0;
    surfacePaint(`module:${id}`, r, (g) => {
      if (id in FRAME) {
        atlas.cell(g, 'unfinished', FRAME[id], r.x, r.y, r.w, r.h);
        if (progress > 0) { g.globalAlpha = built ? 1 : 0.15 + progress * 0.8; atlas.cell(g, 'finished', FRAME[id], r.x, r.y, r.w, r.h); g.globalAlpha = 1; }
      } else {
        // Greenhouse, Recreation and the surface Garage each have unfinished | finished frames.
        atlas.cell(g, id, 0, r.x, r.y, r.w, r.h);
        if (progress > 0) { g.globalAlpha = built ? 1 : 0.15 + progress * 0.8; atlas.cell(g, id, 1, r.x, r.y, r.w, r.h); g.globalAlpha = 1; }
      }
      if (m.status === 'building') {
        // Build progress: a framed bar with its percentage at the TOP of the room. It used to be a thin yellow strip on the
        // floor, which looked like a streak left behind by the drone working there.
        const bw = Math.min(260, r.w - 60), bx = r.x + (r.w - bw) / 2, by = r.y + 34;
        g.fillStyle = 'rgba(11,20,32,0.85)'; g.fillRect(bx - 6, by - 6, bw + 12, 34);
        g.strokeStyle = '#5FE3F0'; g.lineWidth = 3; g.strokeRect(bx - 6, by - 6, bw + 12, 34);
        g.fillStyle = '#2a3442'; g.fillRect(bx, by, bw, 22);
        g.fillStyle = '#FFB000'; g.fillRect(bx, by, bw * Math.min(1, m.progress), 22);
        g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 4; g.strokeStyle = '#1a0c10'; g.strokeText(`${Math.floor(m.progress * 100)}%`, bx + bw / 2, by + 12);
        g.fillStyle = '#fff'; g.fillText(`${Math.floor(m.progress * 100)}%`, bx + bw / 2, by + 12);
        g.textBaseline = 'alphabetic';
      }
      if (m.status === 'unbuilt') {
        // The outdoor garage has a transparent curved outline; keep the sky outside it clear.
        if (id !== 'garage') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(r.x, r.y, r.w, r.h); }
        atlas.cell(g, 'icons', ICON.lock, r.x + r.w - 76, r.y + 14, 56, 56);
      }
      if (m.tier === 2) { g.fillStyle = '#FFB000'; g.font = 'bold 34px sans-serif'; g.textAlign = 'right'; g.fillText('T2', r.x + r.w - 16, r.y + 44); }
    }, LAYOUT.rooms[id].wing === 'surface');
    hits.push({ id: `module:${id}`, ...r });
  }
  // power shortage: rooms go dark
  if (s.res.power <= 0) {
    ctx.fillStyle = 'rgba(0,0,10,0.45)';
    ctx.fillRect(LAYOUT.leftX, LAYOUT.firstFloorY, LAYOUT.rightX + rightWingWidth - LAYOUT.leftX, LAYOUT.floors * LAYOUT.floorHeight);
    const g = roomRect('garage'); ctx.fillRect(g.x, g.y, g.w, g.h);
  }
  // the Regolith Roof Layer: a band of soil over the right wing
  if (s.modules.roof.status === 'online') { ctx.fillStyle = 'rgba(120,60,40,0.55)'; ctx.fillRect(LAYOUT.rightX, LAYOUT.firstFloorY - 36, rightWingWidth, 36); }

  // ---- the Rover: parked in the Garage once it is built, rolls out of the right edge on a trip and back in
  const pace = S.pace ?? 1;
  const garage = garageSpots();
  const rp = roverPose(S.rover?.phase ?? (s.away ? 'gone' : 'parked'), S.rover?.k ?? 0);
  if (online(s, 'garage') && rp.visible && !cut) {
    surfaceSprite('module:garage', 'rover', rp.driving ? 1 + (Math.floor(wm / 130) % 2) : 0, rp.x, GROUND_Y, { w: ROVER.width });
    hits.push({ id: 'module:garage', x: rp.x - ROVER.width / 2, y: GROUND_Y - 90, w: ROVER.width, h: 90 });
  }

  // ---- drones: each one rolls (or hovers up the shaft) to where it works and rests in the Garage when idle
  const union = atlas.unionBox('drone', [0, 6, 12, 18]);
  S.s.drones.forEach((d, i) => {
    const mv = (droneMovers[d.id] ??= createMover());
    if (cut?.buried && i > 0 && d.status !== 'awake') return; // until 31.0 s Drones #02 and #03 lie in the mounds; then they are in the Garage
    if (mv.status === undefined) mv.status = d.status;
    if (mv.status !== d.status) { // a kit just woke it: it shakes the sand off where it lay
      mv.status = d.status;
      if (d.status === 'awake' && i > 0) { placeAt(mv, garage.rest(i)); mv.digUntil = wm + DIG_MS; }
    }
    const digging = mv.digUntil > wm;
    const siteId = d.task?.module;
    const goal = d.status !== 'awake' ? garage.rest(i) : siteId ? { ...anchor(siteId, 0.35) } : garage.rest(i);
    if (!digging) { setGoal(mv, goal); advance(mv, dt, { walk: 430, climb: 300, pace }); }
    const a = mv.pos ?? goal;
    const working = Boolean(siteId) && arrived(mv);
    let frame;
    if (d.status !== 'awake') frame = prefs.reduceMotion || Math.floor(wm / 500) % 2 === 0 ? 0 : 1; // the red LED blinks; steady (lit) with Reduce motion (C21)
    else if (digging) frame = 20 + (Math.floor(wm / 220) % 4);
    else if (mv.climbing) frame = 6 + (Math.floor(wm / 250) % 2); // hovering up or down the shaft
    else if (mv.moving) frame = siteId ? 16 + (Math.floor(wm / 220) % 2) : 8 + (Math.floor(wm / 110) % 4); // carrying a girder to the site, or just rolling
    else if (working) frame = 12 + (Math.floor(wm / 180) % 4); // welding, by day and by night: drones never sleep
    else if (!day) frame = 18 + (prefs.reduceMotion ? 0 : Math.floor(wm / 800) % 2); // idle at night: powered down for the dark
    else frame = 6 + (prefs.reduceMotion ? 0 : Math.floor(wm / 500) % 2); // idle by day: a small bob, none with Reduce motion
    surfacePaint(`drone:${d.id}`, { x: a.x - 50, y: a.y - DRONE_H - 24, w: 100, h: DRONE_H + 34 }, (g) => {
      atlas.sprite(g, 'drone', frame, a.x, a.y, { h: DRONE_H, box: union, flip: mv.moving && !mv.climbing && mv.faceLeft });
      g.fillStyle = DRONE_BUMPERS[d.id]; g.fillRect(a.x - 13, a.y - 9, 26, 4);
      g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 6; g.strokeStyle = '#1a0c10';
      g.strokeText(NICK[d.id], a.x, a.y - DRONE_H - 6); g.fillStyle = '#fff'; g.fillText(NICK[d.id], a.x, a.y - DRONE_H - 6);
    }, onSurface(a));
    hits.push({ id: `drone:${d.id}`, x: a.x - 50, y: a.y - DRONE_H - 24, w: 100, h: DRONE_H + 34 });
  });

  // ---- the Commander: walks the base by the shaft, wears the suit on the surface, boards the Rover for a trip
  if (!cut) {
    const w = S.walker;
    const rv = S.rover?.phase;
    const boarding = rv === 'boarding';
    const hidden = !boarding && (s.where === 'away' || rv === 'out' || rv === 'in' || rv === 'gone'); // inside the Rover, or out on the trip
    const target = boarding ? garage.board : anchor(s.where, 1);
    if (hidden) setGoal(w, null);
    else { setGoal(w, target); advance(w, dt, { walk: 470, climb: 320, pace }); }
    if (w.pos) {
      const eva = onSurface(w.pos);
      const sheet = eva ? 'crewEva' : 'crewIndoor';
      const tick = Math.floor(wm / 160);
      const sleeping = !eva && !w.moving && (s.medRest || (s.where === 'bedroom' && !day));
      const box = atlas.unionBox(sheet, [0, 1, 2, 3, 4, 5, 6, 7]);
      const tinted = atlas.tinted(sheet, CREW_COLORS.cmdr);
      if (sleeping) {
        // he lies in the lower-left bunk of the room: only the person, pillow and blanket are drawn, never a second bed
        const bed = bedroomSpots().lie;
        const k = (PERSON_H * 1.2) / box.h;
        atlas.spriteRegion(ctx, sheet, 14 + (Math.floor(wm / 900) % 2), SLEEPER, bed.x, bed.y, { k, sheet: tinted });
        hits.push({ id: 'crew:cmdr', x: bed.x - 60, y: bed.y - 70, w: 120, h: 80 });
      } else {
        let frame = Math.floor(wm / 700) % 2; // standing about
        let still = false; // frames drawn facing right with their own furniture (console, table)
        if (w.climbing) frame = CLIMB_FRAMES[sheet][tick % CLIMB_FRAMES[sheet].length];
        else if (w.moving) frame = 2 + (tick % 6);
        else if (eva) frame = s.where === 'outside' ? 8 + (tick % 4) : frame;
        else if (s.where === 'kitchen' && [6, 12, 18].includes(clock.hour)) { frame = 12 + (Math.floor(wm / 450) % 2); still = true; }
        else if (ROOMS_WITH_CONSOLE.includes(s.where)) { frame = 8 + (tick % 4); still = true; }
        // on the ladder he hangs on its right rail: he slides there when the climb starts and back when it ends (render only)
        w.grip = Math.min(1, Math.max(0, (w.grip ?? 0) + (w.climbing ? dt : -dt) / LADDER.easeMs));
        const x = w.pos.x + (w.grip > 0 ? climbShift(atlas, sheet, box) * w.grip : 0);
        surfacePaint('crew:cmdr', { x: x - 45, y: w.pos.y - PERSON_H - 25, w: 90, h: PERSON_H + 35 }, (g) => atlas.sprite(g, sheet, frame, x, w.pos.y, { h: PERSON_H, box, flip: !still && !w.climbing && Boolean(w.faceLeft), sheet: tinted }), eva);
        hits.push({ id: 'crew:cmdr', x: w.pos.x - 45, y: w.pos.y - PERSON_H - 25, w: 90, h: PERSON_H + 35 });
      }
    }
  } else if (cut.astronaut?.pose) {
    // the entry scene: the astronaut walks to the dome, goes down the shaft and into the Bedroom (src/flow/intro.js)
    const A = cut.astronaut.pose;
    if (A.visible) {
      const sheet = A.sheet;
      const box = atlas.unionBox(sheet, [0, 1, 2, 3, 4, 5, 6, 7]);
      const x = A.x + (A.grip ? climbShift(atlas, sheet, box) * A.grip : 0); // on the ladder, hands on its right rail (A36)
      atlas.sprite(ctx, sheet, A.frame, x, A.y, { h: PERSON_H, box, flip: A.flip, sheet: atlas.tinted(sheet, CREW_COLORS.cmdr) });
    }
  }

  // Dust streaks pass in front of the Garage and surface bodies too; interface markers stay on top.
  if (s.storm) {
    ctx.fillStyle = 'rgba(235,165,95,0.42)';
    for (let i = 0; i < 70; i++) ctx.fillRect(-1250 + ((i * 313 + wm * (0.55 + (i % 5) * 0.18)) % 4500), 540 + ((i * 131) % 500), 70 + (i % 4) * 40, 5);
  }

  // ---- hazard markers over the places that are in trouble
  if (S.hazards?.length) {
    const pulse = 0.2 + 0.8 * wave(nowMs, 220); // steady with Reduce motion (C21)
    S.hazards.filter((hz) => hz.place && hz.severity !== 'info').forEach((hz, i) => {
      const at = hz.place === 'surface' ? { x: SURFACE.antenna.x - 30 + i * 70, y: LAYOUT.groundY - 260 } : (() => { const r = LAYOUT.rooms[hz.place] ? roomRect(hz.place) : null; return r ? { x: r.x + r.w - 46 - i * 8, y: r.y + 46 } : null; })();
      if (!at) return;
      ctx.globalAlpha = pulse;
      atlas.cell(ctx, 'icons', hz.severity === 'alarm' ? ICON.alert : ICON.warning, at.x - 36, at.y - 36, 72, 72);
      ctx.globalAlpha = 1;
    });
  }
  // ---- radiation view: how much radiation reaches each place (docs/GAMEPLAY_PLAN.md 3.7)
  if (S.radiation) {
    const shade = (id, r) => { const f = S.radiation[id]; if (f === undefined) return; ctx.fillStyle = `rgba(${Math.round(80 + 175 * f)},${Math.round(220 - 170 * f)},60,${0.22 + 0.45 * f})`; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${Math.round(f * 100)}%`, r.x + r.w / 2, r.y + r.h / 2 + 14); };
    for (const id of Object.keys(LAYOUT.rooms)) shade(id, roomRect(id));
    shade('surface', { x: 130, y: LAYOUT.groundY - 330, w: 1780, h: 330 }); // the open ground; the Garage building has its own value
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
      const bob = prefs.reduceMotion ? 0 : Math.sin(nowMs / 220) * 10;
      const k = prefs.reduceMotion ? 90 : 90 + Math.sin(nowMs / 220) * 8;
      atlas.cell(ctx, 'icons', ICON.wrench, h.x + h.w / 2 - k / 2, h.y - k - 22 + bob, k, k);
    }
  }
  // A15: a soft glow instead of a hard white frame. Rooms get a blurred rounded edge; drones and people get a
  // glowing ring at their feet plus a faint halo, like a selection light. Highlight (the "do this" pointer) pulses gold.
  const pulse = wave(nowMs, 200); // steady with Reduce motion (C21)
  for (const [id, rgb, strength] of [[S.highlight, '255,214,0', 0.75 + pulse * 0.25], [S.hover, '160,235,255', 0.6]]) {
    const h = id && hits.find((x) => x.id === id);
    if (h && (h.id.startsWith('module:') || h.id.startsWith('drone:') || h.id.startsWith('crew:'))) drawGlow(ctx, h, rgb, strength);
  }
  ctx.restore();
  void MODULES; void feetY;
  return hits;
}

/** A15: soft selection glow. `rgb` like '160,235,255'; `strength` 0..1. */
function drawGlow(ctx, h, rgb, strength) {
  ctx.save();
  if (h.id.startsWith('module:')) {
    const r = 18;
    ctx.shadowColor = `rgba(${rgb},${0.9 * strength})`;
    ctx.shadowBlur = 28;
    ctx.strokeStyle = `rgba(${rgb},${0.55 * strength})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(h.x + 6, h.y + 6, h.w - 12, h.h - 12, r);
    else ctx.rect(h.x + 6, h.y + 6, h.w - 12, h.h - 12);
    ctx.stroke();
    ctx.stroke(); // a second pass makes the blur fuller without a harder line
  } else {
    const cx = h.x + h.w / 2;
    const feet = h.y + h.h - 6;
    ctx.globalCompositeOperation = 'lighter';
    // halo behind and around the body
    const halo = ctx.createRadialGradient(cx, h.y + h.h * 0.55, 4, cx, h.y + h.h * 0.55, Math.max(h.w, h.h) * 0.7);
    halo.addColorStop(0, `rgba(${rgb},${0.22 * strength})`);
    halo.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(h.x - h.w * 0.4, h.y - 10, h.w * 1.8, h.h + 20);
    // glowing ring on the floor
    ctx.shadowColor = `rgba(${rgb},${strength})`;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = `rgba(${rgb},${0.8 * strength})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, feet, h.w * 0.42, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
