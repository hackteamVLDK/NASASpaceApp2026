/** Lives presentation only. The campaign owns checkpoints, counters and restoration. */
export const STRINGS = Object.freeze({
  'ui.lives.label': 'Tries left: {left} of {max}',
  'ui.lives.title': 'Back to the last decision',
  'ui.lives.rewind': 'The Commander is worn out, so the rescue team took over. We go back to Sol {sol}: {label}. Tries left: {livesLeft}.',
  'ui.lives.again': 'Try again',
  'ui.lives.used': 'All {max} tries are used.',
  'ui.lives.mission_start': 'Mission start',
  'ui.lives.trip_warning': 'At 0 HP, we use a try and go back to the last decision.',
  'ui.lives.last_warning': 'At 0 HP, our last try is used.',
  'ui.jobs.tab': 'Jobs',
  'ui.jobs.ready': 'Jobs ready: {count}',
});

// gameplay: compatibility display fallback for saves made before the three-try contract.
const DEFAULT_TRIES = 3;
const format = (read, id, values) => read(id).replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
const fallbackText = (id) => STRINGS[id];

export function livesView(s, read = fallbackText) {
  const max = s.livesMax ?? DEFAULT_TRIES;
  const left = s.lives ?? DEFAULT_TRIES;
  return { max, left, visible: s.rules?.hpZeroEndsRun !== false,
    label: format(read, 'ui.lives.label', { left, max }) };
}

export function lifeLostText(event, read = fallbackText) {
  return format(read, 'ui.lives.rewind', {
    sol: event.checkpoint.sol,
    label: event.checkpoint.label,
    livesLeft: event.livesLeft,
  });
}

export function usedTriesText(s, read = fallbackText) {
  return s.lives === 0 ? format(read, 'ui.lives.used', { max: s.livesMax ?? DEFAULT_TRIES }) : '';
}

export function createLivesUi({ s, read = fallbackText, onTryAgain }) {
  const el = document.createElement('div');
  el.className = 'lives';
  el.setAttribute('role', 'img');
  let signature = '';

  function update() {
    const view = livesView(s, read);
    el.hidden = !view.visible;
    el.title = view.label;
    el.setAttribute('aria-label', view.label);
    const next = `${view.left}/${view.max}`;
    if (signature === next) return;
    signature = next;
    el.replaceChildren();
    for (let i = 0; i < view.max; i++) {
      const heart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      heart.setAttribute('viewBox', '0 0 12 12');
      heart.setAttribute('aria-hidden', 'true');
      heart.setAttribute('class', `life-heart ${i < view.left ? 'full' : 'empty'}`);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M1 2H5V3H7V2H11V6H10V7H9V8H8V9H7V10H5V9H4V8H3V7H2V6H1Z');
      heart.append(path);
      el.append(heart);
    }
  }

  function showLoss(event) {
    update();
    for (const heart of el.children) heart.classList.remove('lost');
    const reduceMotion = document.documentElement.classList.contains('reduce-motion')
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const heart = el.children[event.livesLeft];
    if (heart && !el.hidden && !reduceMotion) {
      heart.classList.add('lost');
      heart.addEventListener('animationend', () => heart.classList.remove('lost'), { once: true });
    }
    const card = document.createElement('div');
    card.className = 'card life-lost';
    const title = document.createElement('h2');
    title.id = 'lifeLostTitle';
    title.textContent = read('ui.lives.title');
    const text = document.createElement('p');
    text.id = 'lifeLostText';
    text.textContent = lifeLostText(event, read);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.textContent = read('ui.lives.again');
    button.addEventListener('click', onTryAgain);
    // This card has one action. Keep keyboard focus there until the player continues.
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); button.focus(); }
    });
    card.append(title, text, button);
    return card;
  }

  update();
  return { el, update, showLoss };
}
