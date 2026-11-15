import test from 'node:test';
import assert from 'node:assert/strict';
import { livesView, lifeLostText, usedTriesText } from '../src/ui/lives-ui.js';

test('old saves show three tries without mutating the campaign', () => {
  const s = Object.freeze({});
  assert.deepEqual(livesView(s), { max: 3, left: 3, visible: true, label: 'Tries left: 3 of 3' });
});

test('the HUD uses engine counters, including zero remaining tries', () => {
  assert.equal(livesView({ lives: 2, livesMax: 3 }).label, 'Tries left: 2 of 3');
  assert.equal(livesView({ lives: 0, livesMax: 3 }).left, 0);
  assert.equal(livesView({ lives: 1, livesMax: 4 }).label, 'Tries left: 1 of 4');
});

test('Med-Rest mode hides tries while the run-ending rule shows them', () => {
  assert.equal(livesView({ rules: { hpZeroEndsRun: false } }).visible, false);
  assert.equal(livesView({ rules: { hpZeroEndsRun: true } }).visible, true);
});

test('rescue text names the event checkpoint, even after state restoration', () => {
  const event = Object.freeze({ type: 'life-lost', livesLeft: 2,
    checkpoint: Object.freeze({ sol: 3, label: 'The Dust Storm decision' }) });
  assert.equal(lifeLostText(event), 'The Commander is worn out, so the rescue team took over. We go back to Sol 3: The Dust Storm decision. Tries left: 2.');
});

test('checkpoint labels are inserted literally, including replacement characters', () => {
  assert.match(lifeLostText({ livesLeft: 1, checkpoint: { sol: 1, label: '$& <Mission start>' } }), /\$& <Mission start>/);
});

test('only an exhausted lives counter adds the tries-used line', () => {
  assert.equal(usedTriesText({ lives: 0, livesMax: 3 }), 'All 3 tries are used.');
  assert.equal(usedTriesText({ lives: 0 }), 'All 3 tries are used.');
  assert.equal(usedTriesText({ lives: 1 }), '');
  assert.equal(usedTriesText({}), '');
});

test('lives strings accept the merged string-table reader', () => {
  const read = (id) => ({ 'ui.lives.label': '{left}/{max} tries', 'ui.lives.used': '{max} tries used' })[id];
  assert.equal(livesView({ lives: 2 }, read).label, '2/3 tries');
  assert.equal(usedTriesText({ lives: 0 }, read), '3 tries used');
});
