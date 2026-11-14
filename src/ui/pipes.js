/**
 * The Heat Pump Pipe Reroute puzzle (SCENARIO 4.5) as plain functions, so it can be tested under node.
 * A 4 x 3 grid of pipe tiles. Heat comes from the Heating Core into the tile in row 1, column 0 from the
 * west, and must reach the east edge of rows 0, 1 and 2 (Bedroom, Kitchen, Greenhouse).
 * A tile is a bitmask: N = 1, E = 2, S = 4, W = 8. Tapping a tile turns it a quarter turn clockwise.
 * Provenance of the layouts and the scramble rules: `gameplay` (SCENARIO asks for 10 pre-made solvable
 * puzzles; the grids below are ours and are checked by tests/pipes.test.mjs).
 */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
export const ROWS = 3;
export const COLS = 4;
/** Where the core enters: row 1, column 0, from the west. */
export const INLET = Object.freeze({ row: 1, col: 0, from: W });

/** A quarter turn clockwise: N to E, E to S, S to W, W to N. */
export const rot = (m) => ((m << 1) | (m >> 3)) & 15;
export const rotBy = (m, k) => { let x = m; for (let i = 0; i < k; i++) x = rot(x); return x; };
/** How many different looks a tile has: blank and cross 1, straight 2, corner and tee 4. */
export const looks = (m) => { const seen = new Set(); let x = m; for (let i = 0; i < 4; i++) { seen.add(x); x = rot(x); } return seen.size; };
export const canTurn = (m) => looks(m) > 1;

/** The ten pre-made puzzles, each in its solved orientation (every one reaches all three rooms). */
export const LAYOUTS = Object.freeze([
  [[6, 10, 10, 10], [15, 10, 10, 10], [3, 10, 10, 10]],
  [[6, 10, 10, 10], [11, 14, 10, 10], [0, 3, 10, 10]],
  [[6, 10, 10, 10], [11, 10, 14, 10], [0, 0, 3, 10]],
  [[6, 10, 10, 10], [11, 10, 10, 14], [0, 0, 0, 3]],
  [[0, 6, 10, 10], [14, 11, 10, 10], [3, 10, 10, 10]],
  [[0, 6, 10, 10], [10, 15, 10, 10], [0, 3, 10, 10]],
  [[0, 6, 10, 10], [10, 11, 14, 10], [0, 0, 3, 10]],
  [[0, 6, 10, 10], [10, 11, 10, 14], [0, 0, 0, 3]],
  [[0, 0, 6, 10], [14, 10, 11, 10], [3, 10, 10, 10]],
  [[0, 0, 6, 10], [10, 14, 11, 10], [0, 3, 10, 10]],
]);

export const cloneGrid = (g) => g.map((row) => [...row]);

/**
 * Follow the heat from the core. Returns the tiles it reaches and the rooms (rows) it feeds.
 * A pipe that points at an empty tile, or at a tile that does not point back, carries nothing across.
 */
export function reach(tiles) {
  const seen = new Set();
  const rooms = new Set();
  const stack = [[INLET.row, INLET.col, INLET.from]]; // [row, col, the side the heat comes in from]
  while (stack.length) {
    const [r, c, from] = stack.pop();
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || seen.has(`${r},${c}`) || !(tiles[r][c] & from)) continue;
    seen.add(`${r},${c}`);
    const m = tiles[r][c];
    if (m & N) stack.push([r - 1, c, S]);
    if (m & S) stack.push([r + 1, c, N]);
    if (m & E) { if (c === COLS - 1) rooms.add(r); else stack.push([r, c + 1, W]); }
    if (m & W && c > 0) stack.push([r, c - 1, E]);
  }
  return { seen, rooms };
}

export const isSolved = (tiles) => reach(tiles).rooms.size === ROWS;
export const unconnectedRooms = (tiles) => ROWS - reach(tiles).rooms.size;

/** Tap a tile: it turns a quarter turn if it can turn at all. Returns true when something moved. */
export function tap(tiles, row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS || !canTurn(tiles[row][col])) return false;
  tiles[row][col] = rot(tiles[row][col]);
  return true;
}

/** The fewest taps that solve the puzzle, looking up to `limit` taps deep; `limit + 1` if none does. */
export function minTaps(tiles, limit = 3) {
  const cells = [];
  tiles.forEach((row, r) => row.forEach((m, c) => { if (canTurn(m)) cells.push([r, c]); }));
  const key = (g) => cells.map(([r, c]) => g[r][c]).join(',');
  let frontier = [cloneGrid(tiles)];
  const seen = new Set([key(tiles)]);
  for (let depth = 0; depth <= limit; depth++) {
    if (frontier.some(isSolved)) return depth;
    if (depth === limit) break;
    const next = [];
    for (const g of frontier) {
      for (const [r, c] of cells) {
        const h = cloneGrid(g);
        h[r][c] = rot(h[r][c]);
        const k = key(h);
        if (!seen.has(k)) { seen.add(k); next.push(h); }
      }
    }
    frontier = next;
  }
  return limit + 1;
}

/** How many tiles are not in their solved look. */
export const mismatches = (tiles, solved) => tiles.reduce((n, row, r) => n + row.reduce((m, t, c) => m + (canTurn(t) && t !== solved[r][c] ? 1 : 0), 0), 0);

/**
 * A scrambled copy of `layout` for the player. It is never already solved and never solved in 2 taps or
 * fewer, and at least 3 pipes are out of place. `rand` returns a number in [0, 1).
 * Returns { tiles, solved, hint: [row, col] } where `hint` is the first pipe that has to move (for the
 * "tap here" hand).
 */
export function scramble(layout, rand) {
  const solved = cloneGrid(layout);
  for (let attempt = 0; attempt < 60; attempt++) {
    const tiles = solved.map((row) => row.map((m) => (canTurn(m) ? rotBy(m, Math.floor(rand() * 4)) : m)));
    if (mismatches(tiles, solved) >= 3 && minTaps(tiles, 2) > 2) return { tiles, solved, hint: firstOut(tiles, solved) };
  }
  // a certain fallback: every pipe that can turn is turned once
  const tiles = solved.map((row) => row.map((m) => (canTurn(m) ? rot(m) : m)));
  return { tiles, solved, hint: firstOut(tiles, solved) };
}

function firstOut(tiles, solved) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (canTurn(tiles[r][c]) && tiles[r][c] !== solved[r][c]) return [r, c];
  return [INLET.row, INLET.col];
}
