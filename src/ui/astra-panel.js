/**
 * The ASTRA 6.7 guide panel (SCENARIO section 1: slide-in panel on the left, avatar, badge,
 * short text, More, Next / Got it). Reads the guide queue from src/flow/astra.js and draws it.
 * `auto` mode (cutscenes) advances by itself: a line stays at least 1.5 s after it finished typing.
 */
import { guideProps, currentMessage, dismiss, advanceGuide, firstSentence, ASTRA } from '../flow/astra.js';
import { short, spoken, t } from '../flow/strings.js';
import { speak, stop as stopVoice, speaking } from './astra-voice.js';
import { play, director } from './audio.js';

const CPS = 70; // typewriter speed, characters per second

export function createAstraPanel(guide, atlas, { onDismiss = () => {} } = {}) {
  const root = document.getElementById('astra');
  const text = document.getElementById('astraText');
  const btn = document.getElementById('astraBtn');
  const more = document.getElementById('astraMore');
  const detail = document.getElementById('astraDetail');
  const face = document.getElementById('astraFace').getContext('2d');
  face.imageSmoothingEnabled = false;
  let shownId = null;
  let startedAt = 0;
  let finishedAt = 0;
  let auto = false;
  let typedCount = 0;
  let expanded = false;

  more.addEventListener('click', () => {
    play('click');
    expanded = !expanded;
    more.setAttribute('aria-expanded', String(expanded));
    more.textContent = expanded ? 'Less' : 'More';
    detail.hidden = !expanded;
  });

  function advance() {
    stopVoice();
    const gone = guide.current;
    dismiss(guide);
    onDismiss(gone);
  }
  btn.addEventListener('click', () => {
    play('click');
    if (!guide.current) return;
    const msg = displayMessage();
    if (text.textContent.length < msg.length) { startedAt = -1e9; return; } // first click: show the full line
    advance();
  });

  function displayMessage() {
    const line = guide.current;
    return line?.lineId ? short(line.lineId) : firstSentence(currentMessage(guide));
  }

  return {
    setAuto(v) { auto = v; guide.auto = v; },
    update(nowMs) {
      advanceGuide(guide, nowMs);
      const props = guideProps(guide);
      root.classList.toggle('closed', !props.isOpen);
      if (!props.isOpen) { if (shownId) stopVoice(); shownId = null; root.dataset.opened = ''; return; }
      if (props.lineId !== shownId) {
        shownId = props.lineId;
        startedAt = nowMs;
        finishedAt = 0;
        director.astraLine(shownId, { slideIn: root.dataset.opened !== '1' }); // chime + lore cues
        root.dataset.opened = '1';
        typedCount = 0;
        expanded = false;
        more.hidden = !guide.current.lineId;
        more.textContent = 'More';
        more.setAttribute('aria-expanded', 'false');
        detail.hidden = true;
        // More: the spoken version (one or two short sentences); the full SCENARIO text stays in the Logbook history
        detail.textContent = guide.current.lineId ? spoken(guide.current.lineId) : '';
        if (guide.current.lineId) speak(guide.current.lineId); else stopVoice();
      }
      const msg = displayMessage();
      const instant = Boolean(guide.current.lineId);
      // B15 (SCENARIO script conventions): in a cutscene, when the next line is already due, the current line
      // finishes typing at once and then holds 1.5 s, instead of making every later line arrive late
      if (auto && guide.queue.length && startedAt > -1e9 && nowMs - startedAt < (msg.length / CPS) * 1000) startedAt = -1e9;
      const shown = instant ? msg.length : Math.min(msg.length, Math.floor(((nowMs - startedAt) / 1000) * CPS));
      if (text.textContent !== msg.slice(0, shown)) text.textContent = msg.slice(0, shown);
      if (!instant && shown > typedCount) { director.typed(msg[shown - 1]); typedCount = shown; } // blips are rate-capped in the engine
      const typing = shown < msg.length;
      if (!typing && !finishedAt) finishedAt = nowMs;
      btn.textContent = typing ? ASTRA.buttons.next : guide.queue.length ? ASTRA.buttons.next : guide.current.button;
      const talking = speaking();
      if (talking) finishedAt = nowMs; // a cutscene waits until ASTRA has finished speaking, then holds as usual
      if (auto && !expanded && !typing && nowMs - finishedAt > (guide.queue.length ? 1500 : 1500 + Math.min(2500, msg.length * 8))) advance();
      // Play waits for the player's button. Reading More also suspends cutscene auto-advance.
      // avatar: calm idle / speaking, or the mood frame
      const mood = props.mood;
      const mouth = typing || talking;
      let frame = mouth ? 2 + (Math.floor(nowMs / 160) % 2) : Math.floor(nowMs / 600) % 2;
      if (mood === 'cheerful') frame = mouth ? 2 + (Math.floor(nowMs / 160) % 2) : 4;
      if (mood === 'curious') frame = 5;
      if (mood === 'alert') frame = 6;
      face.clearRect(0, 0, 96, 96);
      atlas.cell(face, 'astra', frame, 4, 4, 88, 88, null);
    },
    get open() { return guide.current !== null; },
  };
}
