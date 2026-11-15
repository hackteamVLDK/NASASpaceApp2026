/**
 * Procedural pixel-art detail on top of the pre-rendered soil tiles (browser only, drawn ONCE by buildSoil).
 * Everything is written into the canvas pixels directly: whole pixels at the 0.5 soil scale, no blur, no per-frame cost.
 * Deterministic: every random choice comes from the `hash` passed in (the one in world.js), so the picture never
 * changes between frames or reloads. Colours are sampled from the terrain tiles already drawn on the canvas.
 *
 * Science behind each element (citations in src/campaign/sources.js, SOIL_SOURCES):
 *   layers       approximation   RIMFAX radar under Jezero: flat lake sediments, an erosion surface, a buried tilted delta
 *   colour       nasa_measurement rust/ochre from iron oxides (ferrihydrite with basalt), greyer with depth
 *   bedrock      nasa_measurement volcanic (basaltic) rock on the Jezero crater floor (Perseverance)
 *   boulders     nasa_measurement flood-carried boulders in the Jezero delta (Mangold et al., Science 2021)
 *   veins        nasa_measurement calcium-sulfate veins filling cracks (Curiosity ChemCam)
 *   meteorite    nasa_measurement iron-nickel meteorite "Cacao" (Curiosity, ~30 cm)
 *   ice lenses   gameplay         see the comment at drawIce
 *   cracks, pebbles, wheel tracks  gameplay (decoration)
 * Sizes and depths are scaled to the game world (approximation); they are not survey depths.
 */

// Zone depths in canvas pixels below the ground line (1 canvas px = 2 world units). Provenance: approximation
// (RIMFAX saw lake layers on top, an erosion surface, the delta below; the real delta lies more than 35 m down).
export const SOIL_ZONES = Object.freeze({ surfaceBand: 60, erosion: 335, basalt: 615 });

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * @param {CanvasRenderingContext2D} ctx  the soil canvas (already holds the tiles)
 * @param {object} o  { w, h, groundPx, hash, avoid: [{x,y,w,h}] in canvas px, ice: [{x,y}] tile centres in canvas px, airlockX, garageX }
 */
export function paintSoilDetail(ctx, o) {
  const { w: W, h: H, groundPx: G, hash } = o;
  let img;
  try { img = ctx.getImageData(0, 0, W, H); } catch { return; } // a tainted canvas: keep the plain tiles
  const D = img.data;
  const blocked = new Uint8Array(W * H);
  for (const r of o.avoid) {
    for (let y = Math.max(0, r.y | 0); y < Math.min(H, Math.ceil(r.y + r.h)); y++) blocked.fill(1, y * W + Math.max(0, r.x | 0), y * W + Math.min(W, Math.ceil(r.x + r.w)));
  }
  const free = (x, y) => x >= 0 && y >= G + 1 && x < W && y < H && !blocked[y * W + x];

  // ---- palette, sampled from the tiles (light / mid / dark by brightness, per zone)
  const sample = (d0, d1) => {
    const px = [];
    for (let i = 0; i < 4000; i++) {
      const x = Math.floor(hash(i, 901) * W), y = G + d0 + Math.floor(hash(i, 902) * (d1 - d0));
      if (y >= H) continue;
      const k = (y * W + x) * 4;
      if (D[k + 3] > 200) px.push([D[k], D[k + 1], D[k + 2]]);
    }
    if (!px.length) return null;
    px.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
    const avg = (from, to) => { const s = [0, 0, 0]; const part = px.slice(Math.floor(px.length * from), Math.max(Math.floor(px.length * from) + 1, Math.floor(px.length * to))); for (const p of part) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } return s.map((v) => Math.round(v / part.length)); };
    return { dark: avg(0, 0.2), mid: avg(0.4, 0.6), light: avg(0.8, 1) };
  };
  const top = sample(SOIL_ZONES.surfaceBand, SOIL_ZONES.erosion) ?? { dark: [92, 38, 28], mid: [150, 70, 44], light: [196, 112, 66] };
  const low = sample(SOIL_ZONES.erosion, SOIL_ZONES.basalt) ?? top;
  const deep = sample(SOIL_ZONES.basalt + 220, H - G - 2) ?? { dark: [56, 52, 56], mid: [92, 88, 92], light: [128, 124, 126] };
  const grey = (c, k) => { const l = (c[0] + c[1] + c[2]) / 3; return c.map((v) => Math.round(v + (l - v) * k)); };
  const shade = (c, f) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  const P = {
    ochre: shade(top.light, 1.05), rust: shade(top.dark, 1.0), line: shade(top.dark, 0.7),
    deltaLight: grey(low.light, 0.15), deltaDark: grey(low.dark, 0.15), deltaLine: shade(low.dark, 0.7),
    dust: shade(top.light, 1.18),
    basalt: grey(deep.mid, 0.7), basaltDark: grey(shade(deep.dark, 0.85), 0.7), basaltLight: grey(deep.light, 0.6),
    vein: [242, 236, 214], veinYellow: [232, 220, 162], crack: shade(top.dark, 0.45),
    iron: [168, 172, 178], ironLight: [214, 217, 221], ironDark: [92, 95, 101],
    ice: [206, 232, 246], white: [255, 255, 255],
  };
  const mix = (x, y, c, a) => {
    if (!free(x, y) || a <= 0) return;
    const k = (y * W + x) * 4;
    D[k] = Math.round(D[k] + (c[0] - D[k]) * a); D[k + 1] = Math.round(D[k + 1] + (c[1] - D[k + 1]) * a); D[k + 2] = Math.round(D[k + 2] + (c[2] - D[k + 2]) * a);
  };
  const put = (x, y, c) => mix(x, y, c, 1);

  // ---- 1) layers, the erosion surface and the bedrock contact (approximation, RIMFAX)
  const erosionAt = (x) => SOIL_ZONES.erosion + Math.round(10 * Math.sin(x / 97 + 1.3) + 6 * Math.sin(x / 41 + 0.4) + 3 * Math.sin(x / 13));
  const basaltAt = (x) => SOIL_ZONES.basalt + Math.round(8 * Math.sin(x / 130) + 5 * Math.sin(x / 53 + 2));
  const lakeLayer = new Int16Array(1400); // depth -> layer number (thin, regular: 4-8 px each)
  for (let d = 0, n = 0; d < lakeLayer.length; n++) { const t = 4 + Math.floor(hash(n, 11) * 5); for (let i = 0; i < t && d < lakeLayer.length; i++, d++) lakeLayer[d] = i === 0 ? -(n + 1) : n; }
  const deltaLayer = new Int16Array(4096); // tilted coordinate -> layer number (thicker: 6-12 px)
  for (let u = 0, n = 0; u < deltaLayer.length; n++) { const t = 6 + Math.floor(hash(n, 23) * 7); for (let i = 0; i < t && u < deltaLayer.length; i++, u++) deltaLayer[u] = i === 0 ? -(n + 1) : n; }
  const TILT = 0.27; // tan(15 deg): delta foresets dip 10-20 deg (approximation)
  for (let x = 0; x < W; x++) {
    const ero = erosionAt(x), bas = basaltAt(x);
    const wob = Math.round(2 * Math.sin(x / 211) + Math.sin(x / 67 + 0.7));
    for (let d = 2; G + d < H; d++) {
      const y = G + d;
      if (!free(x, y)) continue;
      if (d < SOIL_ZONES.surfaceBand) { // 8) fine, light dust near the surface
        mix(x, y, P.dust, 0.3 * (1 - d / SOIL_ZONES.surfaceBand) + (hash(x, y) > 0.8 ? 0.08 : 0));
        continue;
      }
      if (d < ero) { // lake sediments: nearly horizontal, alternating ochre / rust with thin darker lines
        const L = lakeLayer[Math.min(lakeLayer.length - 1, d + wob + 4)];
        if (L < 0) mix(x, y, P.line, 0.55); else mix(x, y, L % 2 ? P.rust : P.ochre, 0.42);
      } else if (d <= ero + 2) { // the erosion surface cuts across the layers: a dark wavy line with a light lag on top
        mix(x, y, d === ero ? P.ochre : P.line, d === ero ? 0.6 : 0.75);
      } else if (d < bas) { // the buried delta: tilted layers, truncated at the top by the erosion surface
        const u = Math.min(deltaLayer.length - 1, Math.max(0, Math.floor(d - x * TILT + 1000)));
        const L = deltaLayer[u];
        if (L < 0) mix(x, y, P.deltaLine, 0.5); else mix(x, y, L % 2 ? P.deltaDark : P.deltaLight, 0.4);
      } else { // basalt bedrock: grey, blocky joints
        const k = d - bas;
        mix(x, y, P.basalt, 0.55 + 0.3 * clamp01(k / 250));
        if (k === 0) mix(x, y, P.basaltDark, 0.6);
        else if (k % 14 === 0 || (x + Math.floor(k / 14) * 9) % 23 === 0) mix(x, y, P.basaltDark, 0.35);
      }
      // 2) greyer with depth (iron-oxide rust fades into grey basalt below)
      if (d > SOIL_ZONES.surfaceBand) {
        const k = (y * W + x) * 4, g = Math.min(0.4, (d - SOIL_ZONES.surfaceBand) / 1100 * 0.5), l = (D[k] + D[k + 1] + D[k + 2]) / 3;
        D[k] = Math.round(D[k] + (l - D[k]) * g); D[k + 1] = Math.round(D[k + 1] + (l - D[k + 1]) * g); D[k + 2] = Math.round(D[k + 2] + (l - D[k + 2]) * g);
      }
    }
  }

  // ---- 3) rocks and boulders: a light top edge, a dark shadow, a crack or two
  const rock = (cx, cy, R, body, seed) => {
    const inside = (x, y) => {
      const dx = x - cx, dy = (y - cy) * 1.25, dist = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx), j = 0.82 + 0.18 * hash(seed, Math.floor((a + Math.PI) * 2.2));
      return dist <= R * j;
    };
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      if (!inside(x, y)) { if (inside(x - 1, y - 1) && !inside(x, y - 1)) mix(x, y, P.crack, 0.55); continue; } // shadow lower right
      const edgeTop = !inside(x, y - 1) || !inside(x - 1, y);
      const edgeLow = !inside(x, y + 1) || !inside(x + 1, y);
      put(x, y, edgeTop ? shade(body, 1.35) : edgeLow ? shade(body, 0.62) : (hash(x * 3 + seed, y) > 0.86 ? shade(body, 0.85) : body));
    }
    if (R >= 3) for (let c = 0; c < 1 + (hash(seed, 7) > 0.5 ? 1 : 0); c++) { // 1-2 pixel cracks
      let x = Math.round(cx - R / 2 + hash(seed, 8 + c) * R), y = Math.round(cy - R / 3);
      for (let i = 0; i < Math.max(2, R * 0.8); i++) { if (inside(x, y)) put(x, y, shade(body, 0.5)); y++; x += hash(seed, 20 + i) > 0.5 ? 1 : 0; }
    }
  };
  // a few large flood boulders in the upper layers (nasa_measurement: delta boulders carried by floods)
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(hash(i, 301) * W), d = SOIL_ZONES.surfaceBand + 30 + Math.floor(hash(i, 302) * 200);
    rock(x, G + d, 13 + Math.floor(hash(i, 303) * 9), grey(shade(top.light, 0.9), 0.45), 300 + i);
  }
  // 160-180 rocks of mixed sizes; small pebbles near the surface
  const nRocks = 180 + Math.floor(hash(5, 5) * 20); // 180-199
  for (let i = 0; i < nRocks; i++) {
    const near = hash(i, 401) < 0.35;
    const d = near ? 4 + Math.floor(hash(i, 402) * 70) : SOIL_ZONES.surfaceBand + Math.floor(hash(i, 402) * (H - G - SOIL_ZONES.surfaceBand - 10));
    const R = near ? 1 + Math.floor(hash(i, 403) * 2) : 2 + Math.floor(hash(i, 403) ** 1.5 * 7);
    const base = d > basaltAt(0) ? P.basaltLight : hash(i, 404) > 0.5 ? grey(shade(top.light, 1.08), 0.35) : grey(shade(low.light, 0.95), 0.5);
    rock(Math.floor(hash(i, 400) * W), G + d, R, base, 1000 + i);
  }

  // ---- 4) calcium-sulfate veins: thin white / pale-yellow lines that branch and cross the layers (nasa_measurement)
  const veinEnds = [];
  const vein = (x, y, len, seed, depth = 0) => {
    const col = hash(seed, 1) > 0.5 ? P.vein : P.veinYellow;
    let dx = hash(seed, 2) > 0.5 ? 1 : -1;
    for (let i = 0; i < len; i++) {
      put(x, y, col);
      if (hash(seed, 100 + i) > 0.6) x += dx; else y += 1;
      if (hash(seed, 300 + i) > 0.93) dx = -dx;
      if (depth === 0 && hash(seed, 500 + i) > 0.965) vein(x, y, 8 + Math.floor(hash(seed, 600 + i) * 16), seed * 7 + i, 1);
    }
    veinEnds.push([x, y]);
  };
  const nVeins = 10 + Math.floor(hash(9, 9) * 6);
  for (let i = 0; i < nVeins; i++) vein(Math.floor(hash(i, 501) * W), G + SOIL_ZONES.surfaceBand + Math.floor(hash(i, 502) * (H - G - 200)), 30 + Math.floor(hash(i, 503) * 60), 700 + i);

  // ---- 5) cracks: thin dark zig-zag fractures; some end in a vein
  for (let i = 0; i < 28; i++) {
    let x, y;
    const toVein = i < veinEnds.length && hash(i, 801) > 0.55;
    if (toVein) [x, y] = veinEnds[i]; else { x = Math.floor(hash(i, 802) * W); y = G + SOIL_ZONES.surfaceBand + Math.floor(hash(i, 803) * (H - G - 120)); }
    let dx = hash(i, 804) > 0.5 ? 1 : -1, run = 0;
    const len = 14 + Math.floor(hash(i, 805) * 28);
    for (let k = 0; k < len; k++) {
      if (!(toVein && k === 0)) put(x, y, P.crack);
      y -= toVein ? 1 : -1; x += dx;
      if (++run > 2 + Math.floor(hash(i, 900 + k) * 3)) { dx = -dx; run = 0; }
    }
  }

  // ---- 6) iron-nickel meteorites like "Cacao": small silver-grey pitted rocks in a rust layer (nasa_measurement)
  for (let i = 0; i < 2; i++) {
    let x = Math.floor(hash(i, 1101) * W), d = SOIL_ZONES.surfaceBand + 40 + Math.floor(hash(i, 1102) * 180);
    for (let t = 0; t < 12 && (lakeLayer[d] < 0 || lakeLayer[d] % 2 === 0); t++) d++; // sit in a rust (dark) layer
    rock(x, G + d, 3, P.iron, 1100 + i);
    for (let p = 0; p < 3; p++) put(x - 1 + Math.floor(hash(i, 1110 + p) * 3), G + d - 1 + Math.floor(hash(i, 1120 + p) * 3), P.ironDark); // pits
    put(x - 1, G + d - 2, P.ironLight);
  }

  drawIce(o.ice, put);

  // ---- 8) faint wheel tracks on the surface, leading to the airlock
  if (o.airlockX != null && o.garageX != null) {
    const [a, b] = [Math.min(o.airlockX, o.garageX), Math.max(o.airlockX, o.garageX)];
    for (let x = Math.floor(a); x < b; x++) if (x % 5 < 2) { mix(x, G + 3, P.line, 0.3); mix(x + 2, G + 6, P.line, 0.22); }
  }

  ctx.putImageData(img, 0, 0);
}

/**
 * 7) Ice lenses (gameplay). Drawn only where the game already places ice pockets (rare, deep: buildSoil's tiles).
 * Real buried ice is mapped mostly poleward of ~40 deg latitude (SWIM map, PIA26045); Jezero is at ~18 deg N,
 * so ice under this base is a game simplification.
 */
function drawIce(ice, put) {
  for (const { x: cx, y: cy } of ice) {
    const rx = 14, ry = 5;
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const v = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (v > 1) continue;
      const rim = (x * x) / ((rx - 1) * (rx - 1)) + (y * y) / ((ry - 1) * (ry - 1)) > 1;
      put(cx + x, cy + y, rim ? [255, 255, 255] : [206, 232, 246]);
    }
  }
}
