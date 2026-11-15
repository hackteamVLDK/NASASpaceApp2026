/**
 * The game version in the bottom-right corner of the stage ("v0.1.0", from package.json),
 * and the team name in the bottom-left corner in the same small, faint style.
 * Above the game canvas, below cards and the ASTRA panel (z-index 9). If the version cannot be
 * read, nothing is shown and nothing is thrown.
 */
const BADGE_STYLE = { position: 'absolute', bottom: '8px', fontSize: '14px', opacity: '0.55', color: '#9fb5c8', pointerEvents: 'none', zIndex: '9' };

function showTeam() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const el = document.createElement('div');
  el.id = 'team';
  el.textContent = 'VLDK hackteam';
  Object.assign(el.style, BADGE_STYLE, { left: '12px' });
  stage.appendChild(el);
}

async function showVersion() {
  try {
    const res = await fetch('package.json', { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = await res.json();
    const stage = document.getElementById('stage');
    if (typeof version !== 'string' || !version || !stage) return;
    const el = document.createElement('div');
    el.id = 'version';
    el.textContent = `v${version}`;
    Object.assign(el.style, BADGE_STYLE, { right: '12px' });
    stage.appendChild(el);
  } catch {
    // no version badge: the game works without it
  }
}

showTeam();
showVersion();
