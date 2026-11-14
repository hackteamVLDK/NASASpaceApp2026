// The Heat Pump pipe puzzle (SCENARIO 4.5). The old search started at the wrong tile, so it could never be won.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { N, E, S, W, ROWS, COLS, LAYOUTS, rot, rotBy, looks, canTurn, reach, isSolved, tap, minTaps, mismatches, scramble, cloneGrid } from '../src/ui/pipes.js';

const rngOf = (seed) => { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

test('a quarter turn goes N to E to S to W; tiles have the right number of looks', () => {
  assert.equal(rot(N), E); assert.equal(rot(E), S); assert.equal(rot(S), W); assert.equal(rot(W), N);
  assert.equal(rotBy(N | S, 1), E | W);
  assert.equal(looks(0), 1); assert.equal(looks(N | E | S | W), 1);
  assert.equal(looks(E | W), 2); assert.equal(looks(N | S), 2);
  assert.equal(looks(S | E), 4); assert.equal(looks(N | E | W), 4);
  assert.equal(canTurn(0), false); assert.equal(canTurn(15), false); assert.equal(canTurn(10), true);
});

test('the old bug: the flow starts at the Core (row 1, column 0), so the old solved board is now solved', () => {
  // the first version: a corner at row 0 column 1, a cross at row 1 column 1, a corner at row 2 column 1
  const old = [[0, S | E, W | E, W | E], [W | E, N | E | S | W, W | E, W | E], [0, N | E, W | E, W | E]];
  assert.equal(isSolved(old), true);
  assert.deepEqual([...reach(old).rooms].sort(), [0, 1, 2]);
  // the old search started at row 0, column 1 entering from the west, but that corner has no west arm in the solved board:
  // it died at once, so the puzzle could not be won
  assert.equal(Boolean(old[0][1] & W), false);
});

test('there are ten layouts; each is 4 x 3, uses valid tiles, and reaches Bedroom, Kitchen and Greenhouse', () => {
  assert.equal(LAYOUTS.length, 10);
  for (const [i, g] of LAYOUTS.entries()) {
    assert.equal(g.length, ROWS, `layout ${i} rows`);
    for (const row of g) { assert.equal(row.length, COLS); for (const m of row) assert.ok(Number.isInteger(m) && m >= 0 && m <= 15); }
    assert.deepEqual([...reach(g).rooms].sort(), [0, 1, 2], `layout ${i} feeds all three rooms`);
  }
  assert.equal(new Set(LAYOUTS.map((g) => JSON.stringify(g))).size, 10, 'the ten are different');
});

test('heat does not cross into an empty tile, nor into a tile that does not point back', () => {
  const g = [[0, 0, 0, 0], [E | W, 0, E | W, E | W], [0, 0, 0, 0]];
  assert.equal(reach(g).rooms.size, 0, 'a gap in the line stops the heat');
  const h = [[0, 0, 0, 0], [E | W, N | S, E | W, E | W], [0, 0, 0, 0]]; // the second tile is turned the wrong way
  assert.equal(reach(h).rooms.size, 0);
  assert.equal(reach([[0, 0, 0, 0], [N | S, E | W, E | W, E | W], [0, 0, 0, 0]]).seen.size, 0, 'the first tile must take heat from the west');
});

test('tapping turns a pipe a quarter turn; blanks and the cross do not turn', () => {
  const g = cloneGrid(LAYOUTS[1]);
  assert.equal(tap(g, 0, 0), true);
  assert.equal(g[0][0], rot(LAYOUTS[1][0][0]));
  assert.equal(tap(g, 2, 0), false, 'a blank');
  const c = cloneGrid(LAYOUTS[0]);
  assert.equal(tap(c, 1, 0), false, 'the cross');
  assert.equal(tap(c, -1, 0), false); assert.equal(tap(c, 0, 9), false);
});

test('a scramble is never solved, never solvable in 2 taps, has at least 3 pipes out of place, and is solvable', () => {
  for (let li = 0; li < LAYOUTS.length; li++) {
    for (let seed = 1; seed <= 60; seed++) {
      const { tiles, solved, hint } = scramble(LAYOUTS[li], rngOf(seed * 31 + li));
      assert.equal(isSolved(tiles), false, `layout ${li} seed ${seed} starts solved`);
      assert.ok(mismatches(tiles, solved) >= 3, `layout ${li} seed ${seed}: too easy (${mismatches(tiles, solved)} out of place)`);
      assert.ok(minTaps(tiles, 2) > 2, `layout ${li} seed ${seed}: solvable in 2 taps`);
      // solvable: turn every pipe back to its solved look
      const play = cloneGrid(tiles);
      let taps = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) while (play[r][c] !== solved[r][c]) { assert.equal(tap(play, r, c), true); taps++; assert.ok(taps < 40); }
      assert.equal(isSolved(play), true);
      // the hint points at a pipe that really has to move
      assert.ok(canTurn(tiles[hint[0]][hint[1]]) && tiles[hint[0]][hint[1]] !== solved[hint[0]][hint[1]]);
    }
  }
});

test('every layout can be won, and exhaustive search over all looks finds the solved one', () => {
  for (const [li, solved] of LAYOUTS.entries()) {
    const cells = [];
    solved.forEach((row, r) => row.forEach((m, c) => { if (canTurn(m)) cells.push([r, c, looks(m)]); }));
    const total = cells.reduce((n, [, , k]) => n * k, 1);
    assert.ok(total <= 70000, `layout ${li}: ${total} states`);
    let wins = 0;
    for (let n = 0; n < total; n++) {
      const g = cloneGrid(solved);
      let k = n;
      for (const [r, c, l] of cells) { g[r][c] = rotBy(g[r][c], k % l); k = Math.floor(k / l); }
      if (isSolved(g)) wins++;
    }
    assert.ok(wins >= 1, `layout ${li}: a winning orientation exists`);
  }
});
