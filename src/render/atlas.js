/**
 * Image loading and sprite-sheet access (browser only).
 *
 * The generated sheets are raw: soft edges, a faint glow around sprites, frames that do not
 * sit on an exact grid. At load time this module
 *   - removes the glow (alpha below a threshold becomes fully transparent),
 *   - finds the tight bounding box of every frame, so sprites can be placed by their feet,
 *   - recolours the cyan #00FFFF marker stripe of the crew sprites per astronaut.
 * Frames are numbered in READING ORDER of the generated sheet (see assets/prompts/*.md).
 * If an asset file is missing the game still runs: `draw` falls back to a labelled box
 * (SCENARIO section 6, rule 3).
 */

import { patchBakedLadders } from './ladders.js';

const DIR = 'assets/incoming/';

/** id -> asset file name (assets/manifests/asset-manifest.json). */
const FILES = {
  sky: 'bg.sky', terrain: 'terrain.tiles', airlock: 'surface.airlock', solar: 'surface.solar-panels',
  antenna: 'surface.antenna', mound: 'surface.mound', lander: 'lander.craft', parachute: 'lander.parachute',
  dust: 'fx.dust-burst', crewIndoor: 'crew.indoor', crewEva: 'crew.eva', drone: 'drone.builder',
  astra: 'astra.avatar', bedroom: 'module.bedroom', dining: 'module.dining', lifesupport: 'module.lifesupport',
  unfinished: 'module.unfinished', finished: 'module.finished', shaft: 'prop.shaft', rover: 'vehicle.rover',
  icons: 'ui.icons', weather: 'fx.weather', upgrades: 'ext.upgrades', astraPanel: 'ui.astra-panel', solarGame: 'minigame.drone-repair', greenhouse: 'module.greenhouse', recreation: 'module.recreation',
};

/** Sheets with a transparent background: they get the glow removed. */
const SPRITES = new Set(['airlock', 'solar', 'antenna', 'mound', 'lander', 'parachute', 'dust', 'crewIndoor', 'crewEva', 'drone', 'astra', 'rover', 'icons', 'weather', 'upgrades', 'astraPanel']);

/** Cell grid of each sheet as generated (columns x rows, reading order). */
const GRIDS = {
  airlock: [1, 2], solar: [1, 3], antenna: [2, 1], mound: [1, 2], lander: [1, 2], parachute: [2, 2], dust: [2, 3],
  crewIndoor: [4, 6], crewEva: [4, 5], drone: [4, 6], astra: [3, 3], unfinished: [1, 4], finished: [1, 4],
  shaft: [2, 1], rover: [1, 3], solarGame: [2, 2], greenhouse: [1, 2], recreation: [1, 2], icons: [6, 6], weather: [2, 4], upgrades: [1, 3], terrain: [6, 4],
};

/** Sheets whose rows are not equal fractions of the image: measured cell rectangles (source pixels). */
const CELL_RECTS = {
  solar: [[0, 120, 1254, 350], [0, 505, 1254, 350], [0, 885, 1254, 350]],
};

/** Crop of single-room pictures to the room itself (source pixels x, y, w, h). */
const ROOM_CROP = { bedroom: [0, 160, 1536, 712], dining: [0, 205, 1536, 655], lifesupport: [0, 95, 1536, 790] };

/** Icon indexes in ui.icons (reading order). */
export const ICON = { lungs: 0, water: 1, food: 2, power: 3, battery: 4, solar: 5, dust: 6, heat: 7, build: 8, health: 9, clean: 10, explore: 11, research: 12, farm: 13, rest: 14, shelter: 15, sleep: 16, eat: 17, exercise: 18, warning: 19, alert: 20, radiation: 21, storm: 22, droneTop: 23, droneAwake: 24, droneAsleep: 25, wrench: 26, lock: 27, check: 28, star: 29, starEmpty: 30, speaker: 31 };

const ALPHA_CUT = 110;

function toCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
  return c;
}

function cleanAlpha(canvas) {
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 3; i < px.length; i += 4) px[i] = px[i] < ALPHA_CUT ? 0 : 255;
  ctx.putImageData(data, 0, 0);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * The finished-Garage picture (module.finished, 4th cell) has a Rover painted into it. The game draws its own Rover (vehicle.rover)
 * that can park, drive out and come home, so two vehicles overlapped. This paints the Garage bay empty again: wall, floor and the
 * hazard pad. Sheet pixel coordinates (1024 x 1536, four cells 384 tall).
 */
function patchBakedRover(canvas) {
  if (canvas.width !== 1024 || canvas.height !== 1536) return; // some other picture: leave it alone
  const g = canvas.getContext('2d');
  const X0 = 366, X1 = 748, Y0 = 1270, FLOOR = 1500, END = 1536;
  const rect = (x, y, w, h, color, alpha = 1) => { g.globalAlpha = alpha; g.fillStyle = color; g.fillRect(x, y, w, h); g.globalAlpha = 1; };
  // the wall: tan bricks, drawn with a feathered edge so the patch does not show as a box
  const wall = (inset, alpha) => { rect(X0 + inset, Y0 + inset, X1 - X0 - 2 * inset, FLOOR - Y0 - inset, '#fcbb76', alpha); };
  for (let i = 0; i < 10; i++) wall(9 - i, (i + 1) / 10);
  g.globalAlpha = 0.55;
  for (let k = 0, y = Y0 + 16; y < FLOOR - 4; k++, y += 30) {
    rect(X0 + 10, y, X1 - X0 - 20, 2, '#ec9f60', 0.55);
    for (let x = X0 + 14 + (k % 2) * 32; x < X1 - 10; x += 64) rect(x, y, 2, 30, '#ec9f60', 0.4);
  }
  g.globalAlpha = 1;
  rect(X0, FLOOR, X1 - X0, END - FLOOR, '#f79c5b'); // the floor
  rect(X0, FLOOR, X1 - X0, 3, '#e08a4c'); // its edge
  for (let x = 435; x < 725; x += 36) { rect(x, 1506, 18, 22, '#e6af32'); rect(x + 18, 1506, 18, 22, '#3c322d'); } // the hazard pad the Rover parks on
}

export async function loadAtlas(onProgress = () => {}) {
  const sheets = {};
  const ids = Object.keys(FILES);
  let done = 0;
  await Promise.all(ids.map(async (id) => {
    const img = await loadImage(`${DIR}${FILES[id]}.png`);
    if (img) {
      const canvas = toCanvas(img);
      if (SPRITES.has(id)) cleanAlpha(canvas);
      sheets[id] = canvas;
    }
    onProgress(++done / ids.length, id);
  }));
  if (sheets.finished) patchBakedRover(sheets.finished);
  patchBakedLadders(sheets, GRIDS); // the climbing frames were painted with their own ladder; the shaft has one (A31)
  const missing = ids.filter((id) => !sheets[id]);
  if (missing.length) console.warn('missing art, using placeholders:', missing.join(', '));

  const boxCache = new Map();
  const tintCache = new Map();

  /** Source rectangle of grid cell `index` of sheet `id`. */
  function cellRect(id, index) {
    if (CELL_RECTS[id]) { const [x, y, w, h] = CELL_RECTS[id][index]; return { x, y, w, h }; }
    const sheet = sheets[id];
    const [cols, rows] = GRIDS[id] ?? [1, 1];
    const cw = sheet.width / cols;
    const ch = sheet.height / rows;
    return { x: (index % cols) * cw, y: Math.floor(index / cols) * ch, w: cw, h: ch };
  }

  /** Tight bounding box of the visible pixels in a cell (source pixels). */
  function bbox(id, index) {
    const key = `${id}:${index}`;
    if (boxCache.has(key)) return boxCache.get(key);
    const r = cellRect(id, index);
    const data = sheets[id].getContext('2d').getImageData(r.x, r.y, r.w, r.h).data;
    let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        if (data[(y * Math.floor(r.w) + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    const box = x1 < 0 ? { x: r.x, y: r.y, w: r.w, h: r.h } : { x: r.x + x0, y: r.y + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    boxCache.set(key, box);
    return box;
  }

  /**
   * The largest width and height among several frames, so an animation is scaled by one common
   * size and does not jitter. Only the size is meaningful (frames come from different cells).
   */
  function unionBox(id, indices) {
    const boxes = indices.map((i) => bbox(id, i));
    return { x: 0, y: 0, w: Math.max(...boxes.map((b) => b.w)), h: Math.max(...boxes.map((b) => b.h)) };
  }

  /** How wide (world units) a frame is drawn by `sprite` when its shared box is `box` and the person is `h` units tall. */
  function spriteWidth(id, index, { h, box = null }) {
    return bbox(id, index).w * (h / (box ?? bbox(id, index)).h);
  }

  /** The sheet with the cyan marker recoloured (cached per colour). */
  function tinted(id, color) {
    if (!sheets[id]) return null;
    const key = `${id}:${color}`;
    if (tintCache.has(key)) return tintCache.get(key);
    const src = sheets[id];
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    const rgb = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] && px[i] < 110 && px[i + 1] > 160 && px[i + 2] > 160) {
        const shade = (px[i + 1] + px[i + 2]) / 2 / 255;
        px[i] = Math.min(255, rgb[0] * shade);
        px[i + 1] = Math.min(255, rgb[1] * shade);
        px[i + 2] = Math.min(255, rgb[2] * shade);
      }
    }
    ctx.putImageData(data, 0, 0);
    tintCache.set(key, c);
    return c;
  }

  function placeholder(ctx, label, dx, dy, dw, dh) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,107,53,0.25)';
    ctx.strokeStyle = '#FF6B35';
    ctx.lineWidth = 3;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.strokeRect(dx, dy, dw, dh);
    ctx.fillStyle = '#FF6B35';
    ctx.font = '28px sans-serif';
    ctx.fillText(label, dx + 8, dy + 34);
    ctx.restore();
  }

  const atlas = {
    has: (id) => Boolean(sheets[id]),
    cellRect,
    bbox,
    unionBox,
    spriteWidth,
    tinted,

    /** Draw a whole grid cell (or a source rectangle) into a destination box, no cropping to the sprite. */
    cell(ctx, id, index, dx, dy, dw, dh, source = null) {
      if (!sheets[id]) return placeholder(ctx, id.toUpperCase(), dx, dy, dw, dh);
      const r = source ? { x: source[0], y: source[1], w: source[2], h: source[3] } : cellRect(id, index);
      ctx.drawImage(sheets[id], r.x, r.y, r.w, r.h, dx, dy, dw, dh);
    },

    /** A room picture, cropped to the room, into a destination box. */
    room(ctx, id, dx, dy, dw, dh) {
      atlas.cell(ctx, id, 0, dx, dy, dw, dh, ROOM_CROP[id]);
    },

    /**
     * Draw one sprite frame by its visible pixels. `box` is a source box (default: the frame's
     * own bounding box; pass unionBox for animations). The sprite is scaled so its box is `h`
     * (or `w`) units tall (wide) and placed with its bottom centre at (x, y).
     */
    sprite(ctx, id, index, x, y, { h = null, w = null, flip = false, alpha = 1, box = null, sheet = null, anchor = 'bottom' } = {}) {
      const src = sheet ?? sheets[id];
      if (!src) return placeholder(ctx, id.toUpperCase(), x - 40, y - (h ?? 80), 80, h ?? 80);
      const own = bbox(id, index);
      const b = box ?? own;
      const k = h ? h / b.h : w / b.w;
      // the frame's own box is drawn inside the shared box, aligned to its bottom centre
      const dw = own.w * k;
      const dh = own.h * k;
      ctx.save();
      ctx.globalAlpha = alpha;
      const cx = x;
      const dy = anchor === 'center' ? y - dh / 2 : anchor === 'top' ? y : y - dh; // feet (frame bottom) on the baseline; 'top' hangs the frame below y
      if (flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
      ctx.drawImage(src, own.x, own.y, own.w, own.h, cx - dw / 2, dy, dw, dh);
      ctx.restore();
    },

    /**
     * Draw only part of one sprite frame. `region` is a rectangle inside the frame's own visible box (source
     * pixels from its top-left), `k` is world units per source pixel, and the bottom centre of the region
     * stands at (x, y). Used to cut a prop out of a sprite (the sleeper without the sprite's own bed).
     */
    spriteRegion(ctx, id, index, region, x, y, { k = 1, flip = false, sheet = null, alpha = 1 } = {}) {
      const src = sheet ?? sheets[id];
      if (!src) return;
      const own = bbox(id, index);
      const dw = region.w * k;
      const dh = region.h * k;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (flip) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
      ctx.drawImage(src, own.x + region.x, own.y + region.y, region.w, region.h, x - dw / 2, y - dh, dw, dh);
      ctx.restore();
    },
  };
  return atlas;
}
