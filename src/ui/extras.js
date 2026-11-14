/**
 * Missions tracker and list, the Resources screen, the Threats strip and the radiation view
 * (docs/GAMEPLAY_PLAN.md steps 1-3). Reads campaign state through the pure functions in
 * src/campaign, never changes it. All text here is English UI; the mission and hazard texts are
 * written in ASTRA's voice and are not yet in strings.en.json.
 */
import { MODULES } from '../campaign/data.js';
import { contributions, rates } from '../campaign/engine.js';
import { missions, tracker } from '../campaign/missions.js';
import { hazards, meterReport, METER_HELP } from '../campaign/hazards.js';
import { t, hasString } from '../flow/strings.js';
import { play } from './audio.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (n) => `${n > 0 ? '+' : ''}${Math.abs(n) < 10 ? n.toFixed(1) : Math.round(n)}`;
const METER_NAME = { power: 'Power', heat: 'Heat', water: 'Water', oxygen: 'Oxygen', food: 'Food', morale: 'Morale', sp: 'Spare Parts', hp: 'HP' };
const ICONS = { alarm: '\u{1F6A8}', warn: '⚠️', info: 'ℹ️' };

export function createExtras({ s, ui, openMap }) {
  // ---------------------------------------------------------------- tracker
  const tr = el('div'); tr.id = 'tracker'; tr.hidden = true;
  $('stage').append(tr);
  const bar = el('div'); bar.id = 'threats'; bar.hidden = true;
  $('stage').append(bar);
  let trSig = '';
  let thSig = '';
  let radiation = false;

  const focusOn = (focus) => {
    if (!focus) return;
    ui.closeModal();
    if (focus === 'map') { openMap(); return; }
    if (['base', 'tasks', 'workshop', 'drones'].includes(focus)) { ui.setTab(focus); return; }
    ui.setTab('base');
    ui.select(focus);
  };

  function renderTracker() {
    const list = tracker(s);
    const sig = JSON.stringify(list.map((m) => [m.id, m.progress]));
    if (sig === trSig) return;
    trSig = sig;
    tr.innerHTML = '<div class="trhead">MISSIONS</div>';
    for (const m of list) {
      const row = el('div', `tr ${m.state}`);
      row.innerHTML = `<b>${m.title}</b>${m.progress ? `<i style="width:${(m.progress[0] / m.progress[1]) * 100}%"></i>` : ''}${m.state === 'current' ? `<small>${m.why}</small>` : ''}`;
      row.addEventListener('click', () => { play('click'); focusOn(m.focus); });
      tr.append(row);
    }
    if (!list.length) tr.append(el('div', 'tr done', '<b>All story missions done!</b><small>Free-Play: keep the base thriving.</small>'));
    const more = el('button', '', 'All missions');
    more.id = 'allMissions';
    more.addEventListener('click', () => { play('click'); showMissions(); });
    tr.append(more);
  }

  function showMissions() {
    const m = missions(s);
    const names = { 1: 'ACT I: WAKE UP', 2: 'ACT II: REACH OUT', 3: 'ACT III: THE SIGNAL' };
    const cur = Math.min(3, m.currentAct); // currentAct is 4 when every story mission is done: stay on the last Act
    const chip = (a) => `<span class="actchip ${a < m.currentAct ? 'done' : a === cur ? 'now' : 'later'}">${a < m.currentAct ? '✔ ' : a > cur ? '\u{1F512} ' : ''}${names[a].split(':')[0]}</span>`;
    const mine = m.main.filter((y) => y.act === cur);
    const doneCount = mine.filter((y) => y.done).length;
    let html = `<div class="card missions"><div class="hd">MISSIONS</div><div class="acts">${[1, 2, 3].map(chip).join('')}</div>`;
    html += `<h3>${names[cur]} <small>${doneCount} of ${mine.length} done</small></h3><div class="cols"><div>`;
    for (const x of mine) {
      html += `<div class="ms ${x.state}"><span class="chk">${x.done ? '✔' : x.state === 'current' ? '▶' : '○'}</span><div><b>${x.title}</b><br><small>${x.why}</small>${x.progress ? ` <small>(${x.progress[0]}/${x.progress[1]})</small>` : ''}<br><small class="rw">Reward: ${x.reward}</small></div>${x.focus && !x.done ? `<button data-focus="${x.focus}">Show me</button>` : ''}</div>`;
    }
    if (m.finished) html += '<div class="ms done"><span class="chk">★</span><div><b>All story missions done!</b><br><small>Free-Play: keep the base thriving.</small></div></div>';
    // optional goals of this Act; once the story is finished, every goal that is still open
    const goals = m.side.filter((x) => (m.finished ? !x.done : x.act === cur));
    html += `</div><div><h3>OPTIONAL GOALS</h3>${goals.length ? '' : '<div class="ms done"><small>None for this Act.</small></div>'}`;
    for (const x of goals) html += `<div class="ms ${x.state}"><span class="chk">${x.done ? '✔' : '○'}</span><div><b>${x.title}</b>${x.progress ? ` <small>(${x.progress[0]}/${x.progress[1]})</small>` : ''}<br><small class="rw">${x.reward}</small></div></div>`;
    html += '</div></div><button class="choice" id="msClose">Close</button></div>';
    ui.openModal(html, 'missions');
    for (const b of document.querySelectorAll('#modal [data-focus]')) b.addEventListener('click', () => focusOn(b.dataset.focus));
    $('msClose').addEventListener('click', ui.closeModal);
  }
  const mBtn = el('button', '', 'Missions');
  mBtn.id = 'missionsBtn';
  mBtn.addEventListener('click', () => { play('click'); showMissions(); });

  // ---------------------------------------------------------------- resources screen
  function showResources(key) {
    const lines = contributions(s);
    const r = rates(s);
    const net = key === 'hp' ? 0 : r[key];
    const rep = meterReport(s, key, lines, net);
    const name = (l) => l.label ?? (l.nameId && hasString(l.nameId) ? t(l.nameId) : l.nameId);
    const row = (l) => `<tr><td>${name(l)}</td><td class="${l.amount > 0 ? 'up' : 'down'}">${fmt(l.amount)}</td></tr>`;
    const hpNote = key === 'hp' ? '<p>Sleep gives +1.5 an hour, fresh crops and good morale add HP. Radiation, trips and solar flares take it away.</p>' : '';
    const help = (METER_HELP[key] ?? ['Sleep in the Bedroom.', 'Eat fresh food from the Greenhouse.', 'Stay under thick soil and shelter in a flare.']).map((x) => `<li>${x}</li>`).join('');
    ui.openModal(`<div class="card"><div class="hd">${METER_NAME[key].toUpperCase()}</div><h2>${Math.round(rep.value)} now · ${key === 'hp' ? '' : `${fmt(net)} per Sol`}</h2><p>${key === 'hp' ? '' : rep.outlook}</p>${hpNote}
      <div class="cols"><div><h3>Where it comes from</h3><table>${rep.sources.map(row).join('') || '<tr><td>Nothing yet</td><td></td></tr>'}</table></div>
      <div><h3>Where it goes</h3><table>${rep.sinks.map(row).join('') || '<tr><td>Nothing</td><td></td></tr>'}</table></div></div>
      <h3>What you can do</h3><ul>${help}</ul><button class="choice" id="resClose">Close</button></div>`, `res:${key}`);
    $('resClose').addEventListener('click', ui.closeModal);
  }
  for (const [k, g] of Object.entries(ui.gauges)) { g.g.style.cursor = 'pointer'; g.g.addEventListener('click', () => { play('click'); showResources(k); }); }

  // ---------------------------------------------------------------- threats strip
  function showHazard(h) {
    ui.openModal(`<div class="card ${h.severity === 'alarm' ? 'urgent' : ''}"><div class="hd">${ICONS[h.severity]} ${h.title.toUpperCase()}</div><p>${h.detail}</p><p><b>What to do:</b> ${h.counter}</p><button class="choice" id="hzClose">Got it</button></div>`, `hz:${h.id}`);
    $('hzClose').addEventListener('click', ui.closeModal);
  }
  function renderThreats() {
    const list = hazards(s);
    const sig = JSON.stringify(list.map((h) => [h.id, h.detail]));
    bar.hidden = list.length === 0;
    if (sig === thSig) return;
    thSig = sig;
    bar.innerHTML = '';
    for (const h of list) {
      const chip = el('button', `chip ${h.severity}`, `${ICONS[h.severity]} ${h.title}`);
      chip.title = h.detail;
      chip.addEventListener('click', () => { play('click'); showHazard(h); });
      bar.append(chip);
    }
  }

  // ---------------------------------------------------------------- radiation view
  const rBtn = el('button', '', 'Radiation view');
  rBtn.id = 'radBtn';
  rBtn.addEventListener('click', () => { radiation = !radiation; rBtn.classList.toggle('on', radiation); play('click'); });

  const api = {
    mount() { const box = document.querySelector('#side section:last-child'); if (box && !$('missionsBtn')) { box.append(mBtn); box.append(rBtn); } },
    update(visible) {
      tr.hidden = !visible;
      if (!visible) { bar.hidden = true; return; }
      api.mount();
      renderTracker();
      renderThreats();
    },
    get radiation() { return radiation; },
    hazards: () => hazards(s),
  };
  void MODULES;
  return api;
}
