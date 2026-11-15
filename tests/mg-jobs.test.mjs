import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOB_RULES, JOB_LAYOUT, STRINGS, hasJobMini, createJobPuzzle,
  jobPointer, jobProgress, jobPuzzleDone, sampleIsSharp,
} from '../src/ui/mg-jobs.js';

test('job registry rejects inherited/unknown names and new puzzles are independent', () => {
  for (const id of ['bolt_sprint', 'scrap_hunt', 'sample_scan']) {
    assert.equal(hasJobMini(id), true);
    assert.equal(jobPuzzleDone(createJobPuzzle(id)), false);
    assert.ok(STRINGS[`ui.mg.${id}.hint`]);
  }
  for (const id of ['toString', '__proto__', '', null]) assert.equal(hasJobMini(id), false);
  assert.throws(() => createJobPuzzle('unknown'), RangeError);
  const a = createJobPuzzle('scrap_hunt'), b = createJobPuzzle('scrap_hunt');
  jobPointer(a, 'down', JOB_LAYOUT.scrap[0]);
  assert.deepEqual(b.picked, []);
});

test('bolt sprint needs eight glowing bolts in order; wrong/repeated taps preserve progress', () => {
  const g = createJobPuzzle('bolt_sprint');
  jobPointer(g, 'down', JOB_LAYOUT.bolts[1]);
  assert.equal(g.bolts, 0);
  JOB_LAYOUT.bolts.forEach((bolt, i) => {
    jobPointer(g, 'move', bolt);
    assert.equal(g.bolts, i);
    assert.equal(jobPointer(g, 'down', bolt), 'bolt');
    jobPointer(g, 'down', bolt);
    assert.equal(g.bolts, i + 1);
  });
  assert.equal(jobPuzzleDone(g), true);
  assert.equal(jobPointer(g, 'down', JOB_LAYOUT.bolts[0]), null);
});

test('scrap hunt needs four distinct pieces; rocks and empty ground do not punish', () => {
  const g = createJobPuzzle('scrap_hunt');
  jobPointer(g, 'down', JOB_LAYOUT.rocks[0]);
  assert.equal(g.message, 'ui.mg.jobs.rock');
  jobPointer(g, 'down', { x: 0, y: 0 });
  assert.equal(g.message, 'ui.mg.jobs.scrap_miss');
  JOB_LAYOUT.scrap.slice(1).forEach((piece) => {
    jobPointer(g, 'move', piece);
    const before = g.picked.length;
    assert.equal(jobPointer(g, 'down', piece), 'scrap');
    jobPointer(g, 'down', piece);
    assert.equal(g.picked.length, before + 1);
  });
  assert.deepEqual(jobProgress(g), { count: 4, goal: 4 });
  assert.equal(jobPuzzleDone(g), true);
});

test('microscope requires focus before three distinct matching grains; wrong shapes are gentle', () => {
  const g = createJobPuzzle('sample_scan'), slider = JOB_LAYOUT.slider;
  const matches = JOB_LAYOUT.grains.filter((grain) => grain.match);
  jobPointer(g, 'down', matches[0]);
  assert.equal(g.message, 'ui.mg.jobs.focus_first');
  assert.deepEqual(g.grains, []);
  jobPointer(g, 'down', { x: slider.x + slider.w * JOB_RULES.focusTarget, y: slider.y + slider.h / 2 });
  jobPointer(g, 'up', { x: 0, y: 0 });
  assert.equal(sampleIsSharp(g), true);
  jobPointer(g, 'down', JOB_LAYOUT.grains.find((grain) => !grain.match));
  assert.equal(g.message, 'ui.mg.jobs.grain_miss');
  matches.forEach((grain, i) => {
    assert.equal(jobPointer(g, 'down', grain), 'grain');
    jobPointer(g, 'down', grain);
    assert.equal(g.grains.length, i + 1);
  });
  assert.equal(jobPuzzleDone(g), true);
});

test('focus clamps to slider ends and pointer cancellation releases the slider', () => {
  const g = createJobPuzzle('sample_scan'), slider = JOB_LAYOUT.slider;
  jobPointer(g, 'move', { x: slider.x + slider.w, y: slider.y });
  assert.equal(g.focus, 0);
  jobPointer(g, 'down', { x: slider.x, y: slider.y });
  jobPointer(g, 'move', { x: slider.x + slider.w * 2, y: slider.y });
  assert.equal(g.focus, 1);
  jobPointer(g, 'move', { x: slider.x - slider.w, y: slider.y });
  assert.equal(g.focus, 0);
  jobPointer(g, 'cancel', { x: 0, y: 0 });
  jobPointer(g, 'move', { x: slider.x + slider.w, y: slider.y });
  assert.equal(g.focus, 0);
  assert.equal(g.dragging, false);
});

test('focus can be lost between picks without losing matched grains', () => {
  const g = createJobPuzzle('sample_scan'), slider = JOB_LAYOUT.slider;
  const matches = JOB_LAYOUT.grains.filter((grain) => grain.match);
  const focus = (value) => {
    jobPointer(g, 'down', { x: slider.x + slider.w * value, y: slider.y });
    jobPointer(g, 'up', { x: 0, y: 0 });
  };
  focus(JOB_RULES.focusTarget);
  jobPointer(g, 'down', matches[0]);
  focus(0);
  jobPointer(g, 'down', matches[1]);
  assert.deepEqual(g.grains, [matches[0].id]);
  assert.equal(jobPuzzleDone(g), false);
});

test('job timing includes the Commander bonus and touch regions are at least 64 pixels', () => {
  assert.ok(JOB_RULES.seconds + JOB_RULES.soloBonus >= 10);
  assert.ok(JOB_RULES.seconds + JOB_RULES.soloBonus <= 15);
  assert.ok(JOB_RULES.tapRadius * 2 >= 64);
  assert.ok(JOB_LAYOUT.slider.h >= 64);
  assert.equal(JOB_LAYOUT.scrap.length, 5);
  assert.equal(JOB_LAYOUT.rocks.length, 2);
});
