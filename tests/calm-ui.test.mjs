import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setStrings, addStrings, setShortStrings, setStringVars, short, t } from '../src/flow/strings.js';
import { createGuide, say, dismiss, advanceGuide, rememberLine, isLowValueLine, isUrgentLine,
  firstSentence, canShowToast, PLAY_HOLD_MS, ASTRA_POPUP_INTERVAL_MS, TOAST_INTERVAL_MS } from '../src/flow/astra.js';
import { createAstraPanel } from '../src/ui/astra-panel.js';

const strings = JSON.parse(readFileSync(new URL('../content/data/strings.en.json', import.meta.url), 'utf8'));
setStrings(strings);
const line = (id, mood = 'calm') => ({ id, message: `${id}. More detail.`, mood });

test('short strings merge, interpolate variables and leave scenario text intact', () => {
  addStrings({ 'test.calm.full': 'Full text for {name}. More detail.', 'test.calm.other': 'Original' });
  setShortStrings({ 'test.calm.full': 'Hello {name}', 'test.calm.other': 'Other' });
  setShortStrings({ 'test.calm.third': 'Three' });
  setStringVars({ name: 'Commander' });
  assert.equal(short('test.calm.full'), 'Hello Commander');
  assert.equal(short('test.calm.full', { name: 'crew' }), 'Hello crew');
  assert.equal(short('test.calm.other'), 'Other');
  assert.equal(short('test.calm.third'), 'Three');
  assert.equal(t('test.calm.full'), 'Full text for Commander. More detail.');
  assert.equal(short('astra.intro.landing'), t('astra.intro.landing'));
  assert.equal(short('missing.line'), 'missing.line');
  setStrings(strings);
  assert.equal(short('test.calm.full'), 'Hello Commander');
});

test('play messages remain until dismissed, even with another message waiting', () => {
  const g = createGuide();
  say(g, line('first'));
  say(g, line('second'));
  advanceGuide(g, PLAY_HOLD_MS);
  assert.equal(g.current.id, 'first');
  advanceGuide(g, 120_000);
  assert.equal(g.current.id, 'first');
  dismiss(g);
  assert.equal(g.current.id, 'second');
});

test('normal popups are separated by twenty seconds, including after early dismissal', () => {
  const g = createGuide();
  say(g, line('first'));
  advanceGuide(g, 1000);
  dismiss(g);
  say(g, line('second'));
  assert.equal(g.current, null);
  advanceGuide(g, ASTRA_POPUP_INTERVAL_MS - 1);
  assert.equal(g.current, null);
  advanceGuide(g, ASTRA_POPUP_INTERVAL_MS);
  assert.equal(g.current.id, 'second');
});

test('urgent warnings and tutorial teaching bypass cooldown without replacing unread text', () => {
  const g = createGuide();
  say(g, line('first'));
  say(g, line('ordinary'));
  say(g, { lineId: 'astra.tut.build_prompt' });
  say(g, line('alarm', 'alert'));
  advanceGuide(g, 1000);
  assert.equal(g.current.id, 'first');
  dismiss(g);
  assert.equal(g.current.id, 'astra.tut.build_prompt');
  dismiss(g);
  assert.equal(g.current.id, 'alarm');
  dismiss(g);
  assert.equal(g.current, null);
  for (const id of ['astra.lives.rewind', 'astra.res.low', 'astra.flare.warning', 'astra.hp.low']) {
    assert.equal(isUrgentLine({ lineId: id }), true);
  }
});

test('busy fact and introduction lines are dropped, but retained in the Logbook history', () => {
  const g = createGuide();
  say(g, line('first'));
  for (const id of ['astra.water.fact', 'astra.plants.fact2', 'astra.char.pip', 'astra.act1.title', 'astra.logbook.first', 'astra.badge.first']) {
    assert.equal(isLowValueLine({ lineId: id }), true, id);
    say(g, line(id));
  }
  assert.equal(g.queue.length, 0);
  assert.equal(g.history.length, 7);
  assert.equal(isLowValueLine(line('astra.act1.workshop_start')), false);
  assert.equal(isLowValueLine({ lineId: 'astra.tut.hp_intro' }), false);
  assert.equal(isLowValueLine({ message: 'That fact went into your Science Logbook.' }), true);
  assert.equal(isLowValueLine({ lineId: 'astra.water.fact', mood: 'alert' }), false);
});

test('duplicate events do not build a repeated queue and once-only lines stay once-only', () => {
  const g = createGuide();
  const once = { ...line('once'), once: true };
  say(g, once);
  say(g, once);
  say(g, line('waiting'));
  say(g, line('waiting'));
  assert.equal(g.queue.length, 1);
  advanceGuide(g, ASTRA_POPUP_INTERVAL_MS);
  dismiss(g);
  say(g, once);
  assert.equal(g.queue.length, 0);
});

test('cutscene mode may advance on its own timeline', () => {
  const g = createGuide();
  g.auto = true;
  say(g, line('first'));
  say(g, line('second'));
  advanceGuide(g, 2000);
  dismiss(g);
  assert.equal(g.current.id, 'second');
});

test('decision and radio details can enter the Logbook without a popup or duplicate', () => {
  const g = createGuide();
  rememberLine(g, 'astra.d1.alert');
  rememberLine(g, 'ui.d1.a.label');
  rememberLine(g, 'astra.d1.alert');
  assert.equal(g.current, null);
  assert.equal(g.queue.length, 0);
  assert.equal(g.history.length, 2);
  assert.equal(g.history[0].message, t('astra.d1.alert'));
});

test('raw messages stop at the first sentence without cutting decimal numbers', () => {
  assert.equal(firstSentence('Room ready! More here.'), 'Room ready!');
  assert.equal(firstSentence('Rest restores 1.5 HP. More here!'), 'Rest restores 1.5 HP.');
  assert.equal(firstSentence('No punctuation'), 'No punctuation');
});

test('toasts have a six-second boundary; a burst cannot schedule more', () => {
  assert.equal(canShowToast(0, -Infinity), true);
  assert.equal(canShowToast(TOAST_INTERVAL_MS - 1, 0), false);
  assert.equal(canShowToast(TOAST_INTERVAL_MS, 0), true);
  assert.equal(canShowToast(TOAST_INTERVAL_MS + 1, TOAST_INTERVAL_MS), false);
});

// A small DOM fixture exercises the real panel controller without a browser dependency.
function panelFixture(run) {
  const previous = globalThis.document;
  const nodes = new Map();
  for (const id of ['astra', 'astraText', 'astraBtn', 'astraMore', 'astraDetail', 'astraFace']) {
    const classes = new Set();
    nodes.set(id, {
      textContent: '', hidden: false, dataset: {}, attrs: {}, handlers: {},
      classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains: (name) => classes.has(name) },
      addEventListener(name, handler) { this.handlers[name] = handler; },
      setAttribute(name, value) { this.attrs[name] = value; },
      getContext: () => ({ clearRect() {} }),
      click() { this.handlers.click?.(); },
    });
  }
  globalThis.document = { getElementById: (id) => nodes.get(id) };
  try { run((id) => nodes.get(id)); }
  finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
}

test('the real ASTRA panel shows short text instantly, reveals full text, and waits for the button', () => {
  setShortStrings({ 'astra.act1.workshop_start': 'Build the Workshop', 'astra.act1.first_sleep': 'Rest restores energy' });
  panelFixture(($) => {
    const g = createGuide();
    const panel = createAstraPanel(g, { cell() {} });
    say(g, { lineId: 'astra.act1.workshop_start' });
    say(g, { lineId: 'astra.act1.first_sleep' });
    panel.update(0);
    assert.equal($('astraText').textContent, 'Build the Workshop');
    assert.equal($('astraDetail').hidden, true);
    $('astraMore').click();
    assert.equal($('astraDetail').textContent, t('astra.act1.workshop_start'));
    assert.equal($('astraDetail').hidden, false);
    assert.equal($('astraMore').attrs['aria-expanded'], 'true');
    panel.update(120_000);
    assert.equal(g.current.id, 'astra.act1.workshop_start');
    $('astraBtn').click();
    panel.update(120_001);
    assert.equal(g.current.id, 'astra.act1.first_sleep');
    assert.equal($('astraText').textContent, 'Rest restores energy');
    assert.equal($('astraDetail').hidden, true);
  });
});

test('the real panel closes for cooldown and renders raw messages as one sentence', () => {
  panelFixture(($) => {
    const g = createGuide();
    const panel = createAstraPanel(g, { cell() {} });
    say(g, line('Room ready! More details'));
    panel.update(0);
    panel.update(1000);
    assert.equal($('astraText').textContent, 'Room ready!');
    assert.equal($('astraMore').hidden, true);
    say(g, line('Next'));
    $('astraBtn').click();
    panel.update(1001);
    assert.equal($('astra').classList.contains('closed'), true);
    panel.update(ASTRA_POPUP_INTERVAL_MS);
    assert.equal($('astra').classList.contains('closed'), false);
    panel.update(ASTRA_POPUP_INTERVAL_MS + 1000);
    assert.equal($('astraText').textContent, 'Next.');
  });
});

test('opening More suspends cutscene turnover until the player closes it', () => {
  panelFixture(($) => {
    const g = createGuide();
    const panel = createAstraPanel(g, { cell() {} });
    panel.setAuto(true);
    say(g, { lineId: 'astra.intro.landing' });
    say(g, { lineId: 'astra.intro.why_underground' });
    panel.update(1000);
    $('astraMore').click();
    panel.update(10_000);
    assert.equal(g.current.id, 'astra.intro.landing');
    $('astraMore').click();
    panel.update(10_001);
    assert.equal(g.current.id, 'astra.intro.why_underground');
  });
});
