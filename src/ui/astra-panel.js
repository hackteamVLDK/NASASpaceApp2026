/**
 * The ASTRA 6.7 guide panel (SCENARIO section 1: slide-in panel on the left, avatar, badge,
 * typewriter text, Next / Got it). Reads the guide queue from src/flow/astra.js and draws it.
 * `auto` mode (cutscenes) advances by itself: a line stays at least 1.5 s after it finished typing.
 */
import { guideProps, currentMessage, dismiss, ASTRA } from '../flow/astra.js';
import { play, director } from './audio.js';

const CPS = 70; // typewriter speed, characters per second

export function createAstraPanel(guide, atlas, { onDismiss = () => {} } = {}) {
  const root = document.getElementById('astra');
  const text = document.getElementById('astraText');
  const btn = document.getElementById('astraBtn');
  const face = document.getElementById('astraFace').getContext('2d');
  face.imageSmoothingEnabled = false;
  let shownId = null;
  let startedAt = 0;
  let finishedAt = 0;
  let auto = false;
  let typedCount = 0;

  function advance() {
    const gone = guide.current;
    dismiss(guide);
    onDismiss(gone);
  }
  btn.addEventListener('click', () => {
    play('click');
    if (!guide.current) return;
    const msg = currentMessage(guide);
    if (text.textContent.length < msg.length) { startedAt = -1e9; return; } // first click: show the full line
    advance();
  });

  return {
    setAuto(v) { auto = v; },
    update(nowMs) {
      const props = guideProps(guide);
      root.classList.toggle('closed', !props.isOpen);
      if (!props.isOpen) { shownId = null; root.dataset.opened = ''; return; }
      if (props.lineId !== shownId) {
        shownId = props.lineId;
        startedAt = nowMs;
        finishedAt = 0;
        director.astraLine(shownId, { slideIn: root.dataset.opened !== '1' }); // chime + lore cues
        root.dataset.opened = '1';
        typedCount = 0;
      }
      const msg = currentMessage(guide);
      const shown = Math.min(msg.length, Math.floor(((nowMs - startedAt) / 1000) * CPS));
      if (text.textContent !== msg.slice(0, shown)) text.textContent = msg.slice(0, shown);
      if (shown > typedCount) { director.typed(msg[shown - 1]); typedCount = shown; } // blips are rate-capped in the engine
      const typing = shown < msg.length;
      if (!typing && !finishedAt) finishedAt = nowMs;
      btn.textContent = typing ? ASTRA.buttons.next : guide.queue.length ? ASTRA.buttons.next : guide.current.button;
      if (auto && !typing && nowMs - finishedAt > 1500 + Math.min(2500, msg.length * 8)) advance();
      // avatar: calm idle / speaking, or the mood frame
      const mood = props.mood;
      let frame = typing ? 2 + (Math.floor(nowMs / 160) % 2) : Math.floor(nowMs / 600) % 2;
      if (mood === 'cheerful') frame = typing ? 2 + (Math.floor(nowMs / 160) % 2) : 4;
      if (mood === 'curious') frame = 5;
      if (mood === 'alert') frame = 6;
      face.clearRect(0, 0, 96, 96);
      atlas.cell(face, 'astra', frame, 4, 4, 88, 88, null);
    },
    get open() { return guide.current !== null; },
  };
}
