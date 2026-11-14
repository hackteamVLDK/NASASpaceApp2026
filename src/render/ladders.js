/**
 * The climbing frames of both crew sheets were painted together with a ladder (crew.eva 16-17: an orange one, crew.indoor 18-21: a grey one)
 * that stands beside the climber. The shaft already has its own ladder, so the player saw two ladders and a climber hanging off the wrong
 * one (docs/ERRORS.md A31). This takes the painted ladder out and keeps the person, so the climber can be placed on the shaft's ladder.
 *
 * Pure pixel code (no DOM), so it runs under node --test. Provenance: `gameplay` (art clean-up, not a claim about Mars).
 */

/** Which frames hold a painted ladder, where it starts (cell pixels from the left) and what colour it is. Cell grids as in atlas.js. */
export const BAKED_LADDERS = Object.freeze({
  crewEva: { kind: 'orange', frames: { 16: { x0: 156 }, 17: { x0: 156 } } },
  crewIndoor: { kind: 'grey', frames: { 18: { x0: 104 }, 19: { x0: 104 }, 20: { x0: 104 }, 21: { x0: 104 } } },
});

/** [hue 0-360, saturation 0-1, value 0-1] of one pixel. */
export function hsv(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx === 0 ? 0 : d / mx, mx / 255];
}

/** Is this pixel the ladder itself (rails and rungs, not its outline)? */
function isLadderColour(r, g, b, kind) {
  const [h, s, v] = hsv(r, g, b);
  if (kind === 'orange') return h >= 15 && h <= 48 && s >= 0.55 && v >= 0.35 && !(s < 0.85 && v < 0.6); // bright and dark orange of the rails and rungs
  return s <= 0.2 && v >= 0.3 && v <= 0.92; // the grey of the rails and rungs
}

const isOutline = (r, g, b) => Math.max(r, g, b) < 92;

/**
 * Erase the painted ladder from one cell. `data` is the cell's RGBA array (w x h), changed in place.
 * Ladder-coloured pixels right of `x0` go; dark outline pixels right of `x0` go too, unless they touch the person (within `reach` pixels
 * of a person-coloured pixel), so the climber keeps his own outline. Returns the number of pixels erased.
 */
export function eraseLadder(data, w, h, { kind, x0, reach = 6 }) {
  const at = (x, y) => (y * w + x) * 4;
  const ladder = new Uint8Array(w * h);
  const outline = new Uint8Array(w * h);
  const person = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      if (data[i + 3] === 0) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (x >= x0 && isLadderColour(r, g, b, kind)) ladder[y * w + x] = 1;
      else if (isOutline(r, g, b)) outline[y * w + x] = 1;
      else person[y * w + x] = 1;
    }
  }
  // person pixels, spread by `reach`: the dark pixels inside this area belong to the climber's own outline
  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!person[y * w + x]) continue;
      for (let dy = -reach; dy <= reach; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -reach; dx <= reach; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) near[yy * w + xx] = 1; }
      }
    }
  }
  let erased = 0;
  for (let y = 0; y < h; y++) {
    for (let x = x0; x < w; x++) {
      const k = y * w + x;
      if (ladder[k] || (outline[k] && !near[k])) { data[at(x, y) + 3] = 0; erased++; }
    }
  }
  return erased;
}

/** Apply `eraseLadder` to every painted-ladder frame of the sheets that are loaded. `sheets`: id -> canvas; `grids`: id -> [columns, rows]. */
export function patchBakedLadders(sheets, grids) {
  for (const [id, spec] of Object.entries(BAKED_LADDERS)) {
    const sheet = sheets[id];
    if (!sheet) continue;
    const [cols, rows] = grids[id];
    const cw = Math.floor(sheet.width / cols);
    const ch = Math.floor(sheet.height / rows);
    const g = sheet.getContext('2d');
    for (const [frame, { x0 }] of Object.entries(spec.frames)) {
      const ox = (frame % cols) * cw;
      const oy = Math.floor(frame / cols) * ch;
      const img = g.getImageData(ox, oy, cw, ch);
      eraseLadder(img.data, cw, ch, { kind: spec.kind, x0 });
      g.putImageData(img, ox, oy);
    }
  }
}
