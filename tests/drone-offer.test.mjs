// B2: the drone's offer panel (src/ui/drone-offer.js): its buttons are big enough, inside the panel and the canvas, and apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFER, offerButtonAt } from '../src/ui/drone-offer.js';

const W = 1100;
const H = 620;
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

test('both buttons are at least 64 x 64 canvas units (SCENARIO section 4: touch targets) and sit inside the panel and the canvas', () => {
  const P = OFFER.panel;
  for (const [name, b] of [['help', OFFER.help], ['retry', OFFER.retry]]) {
    assert.ok(b.w >= 64 && b.h >= 64, `${name}: ${b.w} x ${b.h}`);
    assert.ok(b.x >= P.x && b.y >= P.y && b.x + b.w <= P.x + P.w && b.y + b.h <= P.y + P.h, `${name} is inside the panel`);
  }
  assert.ok(P.x >= 0 && P.y >= 0 && P.x + P.w <= W && P.y + P.h <= H, 'the panel is inside the canvas');
  const gap = OFFER.retry.x - (OFFER.help.x + OFFER.help.w);
  assert.ok(gap >= 16, `the buttons are ${gap} units apart: a thumb must not hit both`);
});

test('a tap finds the right button, or nothing', () => {
  assert.equal(offerButtonAt(centre(OFFER.help)), 'help');
  assert.equal(offerButtonAt(centre(OFFER.retry)), 'retry');
  assert.equal(offerButtonAt({ x: 5, y: 5 }), null);
  assert.equal(offerButtonAt({ x: OFFER.help.x + OFFER.help.w + 5, y: centre(OFFER.help).y }), null, 'between the buttons');
  assert.equal(offerButtonAt({ x: centre(OFFER.help).x, y: OFFER.help.y - 5 }), null, 'above a button');
});
