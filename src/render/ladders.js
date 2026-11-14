/**
 * The climbing frames of both crew sheets were painted together with a ladder (crew.eva 16-17: an orange one, crew.indoor 18-21: a grey one)
 * that stands beside the climber. The shaft already has its own ladder, so the player saw two ladders and a climber hanging off the wrong
 * one (docs/ERRORS.md A31). This takes the painted ladder out and keeps the person, so the climber can be placed on the shaft's ladder.
 *
 * Pure pixel code (no DOM), so it runs under node --test. Provenance: `gameplay` (art clean-up, not a claim about Mars).
 */

/**
 * Which frames hold a painted ladder and what colour it is. `from` lists [x, y] corners in cell pixels: everything right of x and below y
 * may be ladder (the second corner catches the lower end of the left rail, which hangs below the climber's feet).
 */
export const BAKED_LADDERS = Object.freeze({
  crewEva: { kind: 'orange', frames: { 16: { from: [[156, 0], [138, 258]] }, 17: { from: [[156, 0], [134, 196]] } } },
  crewIndoor: { kind: 'grey', frames: { 18: { from: [[104, 0]] }, 19: { from: [[104, 0]] }, 20: { from: [[104, 0]] }, 21: { from: [[104, 0]] } } },
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

/** Is this pixel the ladder's own colour (rails and rungs, not the dark outline)? */
function isLadderColour(r, g, b, kind) {
  const [h, s, v] = hsv(r, g, b);
  if (kind === 'orange') return h >= 12 && h <= 50 && s >= 0.8 && v >= 0.3; // bright and dark orange of the rails and rungs
  return s <= 0.2 && v >= 0.3 && v <= 0.92; // the grey of the rails and rungs
}

/** Is this pixel certainly part of the person (skin, hair, cream suit, boots, the cyan stripe, bright highlights)? */
function isPersonColour(r, g, b, kind) {
  const [h, s, v] = hsv(r, g, b);
  if (kind === 'orange' && h >= 12 && h <= 50 && s >= 0.8) return false; // saturated orange is the ladder
  return (s >= 0.18 && v >= 0.42) || v > 0.92;
}

/** Clear every group of touching set cells (8 neighbours) of `mask` that has fewer than `min` cells. */
function dropSmallGroups(mask, w, h, min) {
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    const group = [start];
    seen[start] = 1;
    for (let n = 0; n < group.length; n++) {
      const cx = group[n] % w;
      const cy = Math.floor(group[n] / w);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (mask[k] && !seen[k]) { seen[k] = 1; group.push(k); }
        }
      }
    }
    if (group.length < min) for (const k of group) mask[k] = 0;
  }
}

/**
 * Erase the painted ladder from one cell. `data` is the cell's RGBA array (w x h), changed in place.
 * In the ladder area, ladder-coloured pixels go first; then everything that is not within `reach` pixels of a person-coloured pixel goes
 * too (the ladder's dark outline and its blurred edges), so the climber keeps his own outline and nothing else. Person-coloured groups
 * smaller than `personMin` pixels (a bright speck on a rail) do not count as the person; specks left alone in the ladder area are removed
 * last. Returns the number of pixels erased.
 */
export function eraseLadder(data, w, h, { kind, from, reach = 8, speck = 90, personMin = 150 }) {
  const inArea = (x, y) => from.some(([fx, fy]) => x >= fx && y >= fy);
  const idx = (x, y) => y * w + x;
  const opaque = (x, y) => data[idx(x, y) * 4 + 3] !== 0;
  const person = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!opaque(x, y)) continue;
      const i = idx(x, y) * 4;
      if (!(inArea(x, y) && isLadderColour(data[i], data[i + 1], data[i + 2], kind)) && isPersonColour(data[i], data[i + 1], data[i + 2], kind)) person[idx(x, y)] = 1;
    }
  }
  dropSmallGroups(person, w, h, personMin); // a bright speck on a rail is not a person
  // the climber's own outline and blur: everything within `reach` of a person pixel
  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!person[idx(x, y)]) continue;
      for (let dy = -reach; dy <= reach; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -reach; dx <= reach; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) near[idx(xx, yy)] = 1; }
      }
    }
  }
  let erased = 0;
  const erase = (x, y) => { data[idx(x, y) * 4 + 3] = 0; erased++; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!opaque(x, y) || !inArea(x, y)) continue;
      const i = idx(x, y) * 4;
      if (isLadderColour(data[i], data[i + 1], data[i + 2], kind) || !near[idx(x, y)]) erase(x, y);
    }
  }
  // specks: small groups of pixels that are left alone inside the ladder area
  const seen = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[idx(x, y)] || !opaque(x, y) || !inArea(x, y)) continue;
      const group = [[x, y]];
      seen[idx(x, y)] = 1;
      let touchesOutside = false;
      for (let n = 0; n < group.length; n++) {
        const [cx, cy] = group[n];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || !opaque(nx, ny)) continue;
            if (!inArea(nx, ny)) { touchesOutside = true; continue; }
            if (!seen[idx(nx, ny)]) { seen[idx(nx, ny)] = 1; group.push([nx, ny]); }
          }
        }
      }
      if (!touchesOutside && group.length < speck) for (const [gx, gy] of group) erase(gx, gy);
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
    for (const [frame, { from }] of Object.entries(spec.frames)) {
      const ox = (frame % cols) * cw;
      const oy = Math.floor(frame / cols) * ch;
      const img = g.getImageData(ox, oy, cw, ch);
      eraseLadder(img.data, cw, ch, { kind: spec.kind, from });
      g.putImageData(img, ox, oy);
    }
  }
}
