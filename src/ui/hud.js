/**
 * HUD: gauges, crew job panel, selected-module card, goals (DOM, browser only).
 * Reads simulation state, sends commands through the `command` callback; never edits state.
 */
import { LEVELS, TUNING, JOBS, ROOMS, batteryCapacity, evaluateObjectives, clockAt } from '../sim/index.js';
import { ICON } from '../render/atlas.js';
import { CREW_COLORS } from '../render/world.js';
import { t } from '../flow/strings.js';

const PUBLIC_NAME = { dining: 'Kitchen', bedroom: 'Bedroom', lifesupport: 'Water & Air Life Support', workshop: 'Workshop', lab: 'Research & Comms Lab', power: 'Battery & Heating', garage: 'Garage & Airlock' };

function iconCanvas(atlas, index) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  atlas.cell(c.getContext('2d'), 'icons', index, 0, 0, 32, 32);
  return c;
}

export function createHud(game, atlas, command) {
  const level = LEVELS.find((l) => l.id === game.levelId);
  const gauges = document.getElementById('gauges');
  const defs = [
    { id: 'o2', icon: ICON.lungs, get: () => [game.resources.o2Kg, TUNING.o2TankKg, 'kg'] },
    { id: 'water', icon: ICON.water, get: () => [game.resources.waterL, TUNING.waterTankL, 'L'] },
    { id: 'food', icon: ICON.food, get: () => [game.resources.foodKg, TUNING.foodStoreKg, 'kg'] },
    { id: 'power', icon: ICON.battery, get: () => [game.resources.batteryKwh, batteryCapacity(game), 'kWh'] },
    { id: 'hp-bar', icon: ICON.health, get: () => [game.crew.reduce((s, c) => s + c.stats.health, 0) / game.crew.length, 100, 'HP'] },
    { id: 'dose', icon: ICON.radiation, get: () => [Math.max(...game.crew.map((c) => c.doseMsv)), level.doseBudgetMsv, 'mSv'], invert: true },
  ];
  const els = {};
  gauges.innerHTML = '';
  for (const d of defs) {
    const g = document.createElement('div');
    g.className = 'gauge';
    g.id = `g-${d.id}`;
    g.append(iconCanvas(atlas, d.icon));
    g.insertAdjacentHTML('beforeend', '<div class="bar"><i></i></div><div class="val"></div>');
    gauges.append(g);
    els[d.id] = { root: g, bar: g.querySelector('i'), val: g.querySelector('.val'), def: d };
  }

  const crewList = document.getElementById('crewList');
  const cards = game.crew.map((c) => {
    const el = document.createElement('div');
    el.className = 'crew';
    el.innerHTML = `<div class="sw" style="background:${CREW_COLORS[c.id] ?? '#0ef'}"></div><div class="nm">${c.name} <small>${c.role}</small></div><select></select><div class="st"><span>HP <b class="hp"></b></span><div class="mini"><i></i></div><span><b class="act"></b></span></div>`;
    const sel = el.querySelector('select');
    sel.addEventListener('change', () => command({ type: 'assign', crew: c.id, job: sel.value }));
    crewList.append(el);
    return { c, el, sel };
  });

  const selectedBox = document.getElementById('selected');
  const goalList = document.getElementById('goalList');
  const shelter = document.getElementById('shelterBtn');
  shelter.addEventListener('click', () => command({ type: 'shelter', on: !game.shelterOrder }));
  let selected = null;
  let lastGoals = '';

  function renderSelected() {
    selectedBox.innerHTML = '';
    if (!selected) { selectedBox.textContent = 'Tap a room or a drone.'; return; }
    const [kind, id] = selected.split(':');
    if (kind === 'module') {
      const m = game.modules[id];
      const name = PUBLIC_NAME[id] ?? ROOMS[id]?.name ?? id;
      if (!m) { selectedBox.textContent = name; return; }
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('span');
      const busy = game.construction && game.construction.id === id;
      label.innerHTML = `<b>${name}</b><br><small>${m.status === 'online' ? 'Online' : busy ? 'Building…' : `Unfinished · ${ROOMS[id].buildHours} work-hours`}</small>`;
      row.append(label);
      if (m.status !== 'online') {
        const b = document.createElement('button');
        b.textContent = busy ? 'Building' : 'Build';
        b.disabled = Boolean(busy);
        b.dataset.build = id;
        b.addEventListener('click', () => command({ type: 'buildModule', module: id }));
        row.append(b);
      }
      selectedBox.append(row);
    } else if (kind === 'drone') {
      const d = game.drones.find((x) => x.id === id);
      const name = t(`ui.drone.${id.slice(-2)}.name`);
      selectedBox.innerHTML = `<b>${name}</b> <small>(${id.replace('drone-', 'Drone #')})</small><br><small>${d?.status === 'awake' ? 'Awake. Helps build in daylight.' : 'Asleep. Wakes later in the story.'}</small>`;
    } else if (kind === 'crew') {
      const c = game.crew.find((x) => x.id === id);
      selectedBox.innerHTML = `<b>${c.name}</b><br><small>Dose ${c.doseMsv.toFixed(2)} mSv · ${c.activity}</small>`;
    } else selectedBox.textContent = PUBLIC_NAME[id] ?? ROOMS[id]?.name ?? id;
  }

  return {
    select(id) { selected = id; renderSelected(); },
    get selected() { return selected; },
    highlightGauge(id) { for (const e of Object.values(els)) e.root.classList.toggle('pulse', e.def.id === id); },
    update() {
      const clock = clockAt(game.minute);
      document.getElementById('clock').textContent = `Sol ${clock.sol} · ${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
      for (const e of Object.values(els)) {
        const [v, max, unit] = e.def.get();
        const f = Math.max(0, Math.min(1, v / max));
        e.bar.style.width = `${f * 100}%`;
        e.val.textContent = `${v < 10 ? v.toFixed(1) : Math.round(v)} ${unit}`;
        e.root.classList.toggle('low', e.def.invert ? f > 0.7 : f < 0.2);
      }
      for (const { c, el, sel } of cards) {
        const live = game.crew.find((x) => x.id === c.id);
        const wanted = Object.entries(JOBS).filter(([, j]) => !j.needs || game.modules[j.needs]?.status === 'online').filter(([k]) => level.jobs.includes(k));
        const sig = wanted.map(([k]) => k).join();
        if (sel.dataset.sig !== sig) { sel.innerHTML = wanted.map(([k, j]) => `<option value="${k}">${j.label}</option>`).join(''); sel.dataset.sig = sig; }
        if (document.activeElement !== sel) sel.value = live.job;
        el.querySelector('.hp').textContent = Math.round(live.stats.health);
        el.querySelector('.mini i').style.width = `${live.stats.health}%`;
        el.querySelector('.act').textContent = live.grounded ? 'grounded' : live.activity;
      }
      shelter.textContent = `Shelter order: ${game.shelterOrder ? 'ON' : 'off'}`;
      shelter.classList.toggle('on', game.shelterOrder);
      renderSelectedIfChanged();
      const goals = evaluateObjectives(game);
      const sig = goals.map((g) => g.status).join();
      if (sig !== lastGoals) {
        lastGoals = sig;
        goalList.innerHTML = goals.map((g) => `<li class="${g.status === 'done' ? 'done' : ''} ${g.primary ? '' : 'bonus'}">${g.text}</li>`).join('');
      }
    },
  };

  function renderSelectedIfChanged() {
    const sig = `${selected}|${selected?.startsWith('module:') ? game.modules[selected.slice(7)]?.status : ''}|${game.construction?.id ?? ''}`;
    if (renderSelectedIfChanged.sig !== sig) { renderSelectedIfChanged.sig = sig; renderSelected(); }
  }
}
