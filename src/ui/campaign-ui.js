/**
 * The campaign interface (DOM, browser only): meters, tabs (Base, Workshop, Drones, Tasks),
 * dilemma and event cards, the expedition map, the radio log, loot, act cards and the ending.
 * It reads campaign state and sends commands through `send`; it never edits state itself.
 * All player-facing text comes from line IDs (strings.js); a few short button labels are literal.
 */
import { MODULES, RECIPES, UPGRADES, LAYOUT, RULES } from '../campaign/data.js';
import { moduleInfo, clockAt, online } from '../campaign/engine.js';
import { EXPEDITIONS, hpCost, durationMinutes, awayProgress, expectedLoot } from '../campaign/expeditions.js';
import { t, hasString } from '../flow/strings.js';
import { ICON } from '../render/atlas.js';
import { play, director } from './audio.js';
import { CARDS, BADGES, buildReport } from '../campaign/logbook.js';
import { LOW_LIMITS } from '../campaign/hazards.js';
import { missingItems, whereText } from '../campaign/sources.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const name = (id) => (hasString(id) ? t(id) : id);
const itemName = (it) => t(`ui.item.${it}.name`);
const costText = (c = {}) => [c.sp ? `${c.sp} SP` : null, c.water ? `${c.water} Water` : null, ...Object.entries(c.items ?? {}).map(([i, n]) => `${n}× ${itemName(i)}`)].filter(Boolean).join(', ');
const MINI_NAME = { solar_wipe: 'ui.mg.solar_wipe.title', heat_pump: 'ui.mg.heat_pump_reroute.title', valve_balance: 'ui.mg.valve_balance.title', water_sort: 'ui.mg.water_sort.title', nutrient_match: 'ui.mg.nutrient_match.title', air_filter: 'ui.mg.air_filter_scrub.title', antenna: 'ui.mg.dish_antenna_alignment.title', wheel_vacuum: 'ui.mg.wheel_pebble_vacuum.title', suit_seal: 'ui.mg.suit_seal_check.title' };
/** A18: one hint row per missing component, saying where to find it. */
const whereRows = (s, cost) => missingItems(s, cost).map(({ item, need, have }) => el('div', 'why where', `${need}× ${itemName(item)} (you have ${have}): ${whereText(s, item, name)}.`));
export const miniTitle = (g) => (hasString(MINI_NAME[g]) ? t(MINI_NAME[g]) : g.replaceAll('_', ' '));

export function createUi({ atlas, s, send, openMini, closeModalHook = () => {} }) {
  const icon = (i, px = 28) => { const c = el('canvas'); c.width = c.height = 32; c.style.width = c.style.height = `${px}px`; atlas.cell(c.getContext('2d'), 'icons', i, 0, 0, 32, 32); return c; };

  // ---------------------------------------------------------------- gauges
  const gaugeDefs = [
    { id: 'power', icon: ICON.battery, max: () => (online(s, 'battery') ? (s.modules.battery.tier === 2 ? 400 : 250) : 100), unit: '' },
    { id: 'heat', icon: ICON.heat, max: () => 100 }, { id: 'water', icon: ICON.water, max: () => 100 },
    { id: 'oxygen', icon: ICON.lungs, max: () => 100 }, { id: 'food', icon: ICON.food, max: () => 100 },
    { id: 'morale', icon: ICON.star, max: () => 100 }, { id: 'sp', icon: ICON.build, max: () => 100, nobar: true },
    { id: 'hp', icon: ICON.health, max: () => s.hpMax },
  ];
  const gauges = $('gauges');
  gauges.innerHTML = '';
  const G = {};
  for (const d of gaugeDefs) {
    const g = el('div', 'gauge');
    g.id = `g-${d.id}`;
    g.title = d.id === 'hp' ? t('ui.res.astronaut_hp.name') : d.id === 'sp' ? t('ui.res.spare_parts.name') : t(`ui.res.${d.id}.name`);
    g.append(icon(d.icon, 30));
    g.insertAdjacentHTML('beforeend', `<div class="bar"${d.nobar ? ' style="display:none"' : ''}><i></i></div><div class="val"></div>`);
    gauges.append(g);
    G[d.id] = { g, bar: g.querySelector('i'), val: g.querySelector('.val'), d };
  }
  let lastRes = {};

  // ---------------------------------------------------------------- tabs
  const tabs = ['base', 'workshop', 'drones', 'tasks', 'logbook'];
  const side = $('side');
  side.innerHTML = `<section id="tabsBox"><div id="tabBar"></div><div id="tabBody"></div></section><section id="radioBox" hidden><h3>Rover radio</h3><div id="radioBar"><i></i></div><div id="radioLines"></div></section><section><button id="mapBtn" disabled>Crater map</button> <button id="reportBtn">Mission report</button></section>`;
  let tab = 'base';
  const tabBar = $('tabBar');
  for (const id of tabs) {
    const b = el('button', '', { base: 'Base', workshop: 'Workshop', drones: 'Drones', tasks: 'Tasks', logbook: 'Logbook' }[id]);
    b.dataset.tab = id;
    b.addEventListener('click', () => { tab = id; sig = ''; play('uiTabSwitch'); });
    tabBar.append(b);
  }
  let sig = '';
  let selected = null;
  const selectedDrone = () => (selected?.startsWith('drone:') ? selected.slice(6) : undefined);

  function renderBase(body) {
    for (const id of ['solar', 'bedroom', 'kitchen', 'lifesupport', 'battery', 'workshop', 'greenhouse', 'garage', 'lab', 'recreation', 'roof']) {
      const info = moduleInfo(s, id);
      const row = el('div', `mod ${selected === `module:${id}` ? 'sel' : ''}`);
      const status = info.status === 'online' ? (info.tier === 2 ? 'Tier 2' : 'Online') : info.status === 'building' ? `Building ${Math.round(info.progress * 100)}%` : 'Not built';
      row.innerHTML = `<div><b>${name(MODULES[id].nameId)}</b><br><small>${status}${info.upgrading ? ` · upgrading ${Math.round(info.upgrading.progress * 100)}%` : ''}</small></div>`;
      const actions = el('div', 'act');
      if (info.status === 'unbuilt') {
        const b = el('button', '', 'Build');
        b.title = info.reason ?? costText(info.cost);
        b.disabled = Boolean(info.reason);
        b.dataset.build = id;
        b.addEventListener('click', () => send({ type: 'build', module: id, drone: selectedDrone() }));
        actions.append(b);
        if (info.reason) row.append(el('div', 'why', info.reason)); else row.append(el('div', 'why', `Cost: ${costText(info.cost)}`));
        row.append(...whereRows(s, info.cost));
      } else if (info.status === 'online' && info.upgrade && info.tier === 1 && !info.upgrading) {
        const b = el('button', '', 'Upgrade');
        b.title = `${name(info.upgrade.nameId)}: ${costText(info.upgrade)}`;
        b.dataset.upgrade = id;
        b.addEventListener('click', () => send({ type: 'upgrade', module: id, drone: selectedDrone() }));
        actions.append(b);
        row.append(el('div', 'why', `${name(info.upgrade.nameId)}: ${costText(info.upgrade)}`));
        row.append(...whereRows(s, info.upgrade));
      }
      row.prepend(actions);
      row.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') { selected = `module:${id}`; sig = ''; } });
      body.append(row);
    }
  }

  function renderWorkshop(body) {
    if (!online(s, 'workshop')) { body.append(el('p', 'why', 'Build the Workshop to craft parts.')); return; }
    if (s.crafting) body.append(el('div', 'craft', `Crafting: <b>${name(RECIPES[s.crafting.recipe].nameId)}</b> ${Math.round(s.crafting.progress * 100)}%`));
    for (const [id, r] of Object.entries(RECIPES)) {
      if (r.kind !== 'kit' && s.upgrades[id]) { body.append(el('div', 'mod done', `<div><b>${name(r.nameId)}</b><br><small>Crafted</small></div>`)); continue; }
      const row = el('div', 'mod');
      row.innerHTML = `<div><b>${name(r.nameId)}</b><br><small>${costText(r)}</small></div>`;
      const b = el('button', '', 'Craft');
      b.dataset.craft = id;
      b.disabled = Boolean(s.crafting);
      b.addEventListener('click', () => send({ type: 'craft', recipe: id }));
      row.prepend(b);
      row.append(...whereRows(s, r));
      body.append(row);
    }
    const inv = Object.entries(s.items).filter(([, n]) => n > 0);
    body.append(el('h4', '', 'Inventory'));
    body.append(el('div', 'inv', inv.length ? inv.map(([i, n]) => `<span>${n}× ${itemName(i)}</span>`).join('') : '<small>Nothing yet.</small>'));
    if ((s.items.ice_core ?? 0) > 0) {
      const b = el('button', '', 'Melt an Ice Core (+25 Water)');
      b.addEventListener('click', () => send({ type: 'melt' }));
      body.append(b);
    }
  }

  function renderDrones(body) {
    const nick = { 'drone-01': 'Pip', 'drone-02': 'Bumble', 'drone-03': 'Zip' };
    body.append(el('p', 'why', 'Tap a drone, then tap a room frame in the base to send it there. Each drone can keep 2 jobs waiting.'));
    for (const d of s.drones) {
      const row = el('div', `mod ${selected === `drone:${d.id}` ? 'sel' : ''}`);
      const jobText = (j) => `${j.type === 'upgrade' ? 'Upgrade' : 'Build'} ${name(MODULES[j.module].nameId)}`;
      const what = d.status !== 'awake' ? 'Asleep' : d.task ? `Now: ${jobText(d.task)}` : 'Idle: salvaging parts';
      row.innerHTML = `<div><b>${nick[d.id]}</b> <small>(${d.id.replace('drone-', 'Drone #')})</small><br><small>${what}</small>${(d.queue ?? []).map((j, i) => `<br><small>Next ${i + 1}: ${jobText(j)} <a href="#" data-unq="${d.id}:${i}">remove</a></small>`).join('')}</div>`;
      const kit = { 'drone-02': 'repair_kit', 'drone-03': 'reboot_kit' }[d.id];
      if (d.status !== 'awake' && kit && (s.kits[kit] ?? 0) > 0) {
        const b = el('button', '', 'Use kit');
        b.dataset.kit = d.id;
        b.addEventListener('click', (e) => { e.stopPropagation(); send({ type: 'useKit', kit, drone: d.id }); });
        row.prepend(b);
      } else if (d.status !== 'awake' && kit) row.append(el('div', 'why', `Craft a ${name(RECIPES[kit].nameId)} in the Workshop.`));
      row.addEventListener('click', (e) => {
        if (e.target.dataset?.unq) { e.preventDefault(); const [id, i] = e.target.dataset.unq.split(':'); send({ type: 'unqueue', drone: id, index: Number(i) }); return; }
        if (d.status === 'awake') { selected = `drone:${d.id}`; sig = ''; }
      });
      body.append(row);
    }
  }

  function renderTasks(body) {
    if (!s.tasks.length) body.append(el('p', 'why', 'No jobs right now. Nice!'));
    for (const task of s.tasks) {
      const row = el('div', 'mod');
      row.innerHTML = `<div><b>${miniTitle(task.game)}</b><br><small>${task.why}</small></div>`;
      const b = el('button', '', 'Play');
      b.dataset.task = task.game;
      b.addEventListener('click', () => openMini(task.game));
      row.prepend(b);
      body.append(row);
    }
  }

  function renderLogbook(body) {
    body.append(el('h4', '', t('ui.logbook.title')));
    body.append(el('div', 'why', t('ui.logbook.count').replace('{unlocked}', s.logbook.length).replace('{total}', CARDS.length)));
    const grid = el('div', 'cards');
    for (const c of CARDS) {
      const got = s.logbook.includes(c.id);
      const b = el('button', `cardbtn ${c.tier} ${got ? '' : 'locked'}`, got ? t(`card.${c.id}.title`) : t('ui.logbook.locked'));
      b.dataset.card = c.id;
      b.disabled = !got;
      b.addEventListener('click', () => showCard(c));
      grid.append(b);
    }
    body.append(grid);
    body.append(el('h4', '', 'Badges'));
    const earned = BADGES.filter((x) => s.badges.includes(x.id));
    body.append(el('div', 'inv', earned.length ? earned.map((x) => `<span title="${t(`badge.${x.id}.text`)}">\u{1F3C5} ${t(`badge.${x.id}.name`)}</span>`).join('') : '<small>Earn badges by doing real-world good practice.</small>'));
  }

  function showCard(c) {
    modalKey = `card:${c.id}`;
    modalRoot.hidden = false;
    modalRoot.innerHTML = `<div class="card"><div class="hd">${c.tier === 'core' ? 'CORE CARD' : 'BONUS CARD'} \u00b7 ${c.org}</div><h2>${t(`card.${c.id}.title`)}</h2><p>${t(`card.${c.id}.text`)}</p><p><a href="${c.url}" target="_blank" rel="noopener">${t('ui.logbook.how_we_know')}</a> <small>(${c.org})</small></p><button class="choice" id="cardOk">Close</button></div>`;
    $('cardOk').addEventListener('click', closeModal);
  }

  function showReport() {
    const r = buildReport(s);
    modalKey = 'report';
    modalRoot.hidden = false;
    const star = (n) => '\u2605'.repeat(n) + '\u2606'.repeat(3 - n);
    const title = (c) => { const d = c.slice(0, -1); return hasString(`ui.${d}.title`) ? t(`ui.${d}.title`) : d; };
    const label = (c) => { const d = c.slice(0, -1); const k = c.slice(-1); return hasString(`ui.${d}.${k}.label`) ? t(`ui.${d}.${k}.label`) : k.toUpperCase(); };
    const choiceLines = r.choices.map((c) => `<li>${title(c)}: ${label(c)}</li>`).join('');
    modalRoot.innerHTML = `<div class="card report"><div class="hd">${t('report.title')}</div>
      <div class="grid2">
        <div><h3>${t('report.crew')}</h3><p>HP ${Math.round(r.hp)} \u00b7 lowest ${Math.round(r.lowestHp)} \u00b7 Med-Rest ${r.medRests}\u00d7 \u00b7 ${t('report.outside_hours')}: ${r.outsideHours}</p>
        <h3>${t('report.base')}</h3><p>O\u2082 ${Math.round(r.meters.oxygen)} \u00b7 Water ${Math.round(r.meters.water)} \u00b7 Food ${Math.round(r.meters.food)} \u00b7 Power ${Math.round(r.meters.power)} \u00b7 Heat ${Math.round(r.meters.heat)} \u00b7 Morale ${Math.round(r.meters.morale)} \u00b7 Emergencies ${r.emergencies}</p>
        <h3>${t('report.space_weather')}</h3><p>${r.flares ? `Solar flares faced: ${r.flares}` : 'No solar flares yet.'}</p>
        <h3>${t('report.modules')}</h3><p>${r.modulesBuilt} of 6 modules \u00b7 ${r.tier2} Tier 2 \u00b7 roof ${r.roof ? 'yes' : 'no'} \u00b7 drones awake ${r.dronesAwake} of 3</p></div>
        <div><h3>${t('report.expeditions')}</h3><p>Trips: ${r.expeditions} \u00b7 Ice Cores melted: ${r.melted}</p>
        <h3>${t('report.choices')}</h3><ul>${choiceLines || '<li>No big choices yet.</li>'}</ul>
        <h3>${t('report.science')}</h3><p>${t('report.cards').replace('{unlocked}', r.cards).replace('{total}', r.totalCards)}</p>
        <h3>${t('report.badges')}</h3><p>${r.badges.length ? r.badges.map((b) => t(`badge.${b}.name`)).join(', ') : 'None yet.'}</p></div>
      </div>
      <h2>${t('report.rating.title')}</h2>
      <div class="rating">${['crew', 'base', 'science'].map((k) => `<div><b>${t(`report.rating.${k}`)}</b><br><span class="stars">${star(r.rating[k])}</span><br><small>${t(`report.rating.${k}.${r.rating[k]}`)}</small></div>`).join('')}</div>
      <p><b>${t('report.rating.total').replace('{stars}', r.total)}</b></p>
      <button class="choice" id="repOk">Close</button></div>`;
    $('repOk').addEventListener('click', closeModal);
  }
  $('reportBtn').addEventListener('click', () => { play('click'); showReport(); });

  // ---------------------------------------------------------------- modals
  const modalRoot = el('div', 'modal');
  modalRoot.id = 'modal';
  modalRoot.hidden = true;
  $('stage').append(modalRoot);
  let modalKey = null;
  const closeModal = () => { modalRoot.hidden = true; modalRoot.innerHTML = ''; modalKey = null; closeModalHook(); };
  // A24: every window gets a close button (top right) and Esc closes it, except the ones that need an answer:
  // a decision (dilemma, event, radio) must be chosen, and Game Over has its own two buttons.
  const mustAnswer = () => !modalKey || modalKey.startsWith('choice:') || modalKey === 'gameover';
  const addCloseButton = () => {
    if (modalRoot.hidden || mustAnswer()) return;
    const card = modalRoot.querySelector('.card');
    if (!card || card.querySelector(':scope > .xClose')) return;
    const x = el('button', 'xClose', '\u00D7');
    x.type = 'button';
    x.title = 'Close (Esc)';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', () => { play('click'); closeModal(); });
    card.prepend(x);
  };
  new MutationObserver(addCloseButton).observe(modalRoot, { childList: true });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || modalRoot.hidden || mustAnswer()) return;
    if (!document.getElementById('mgWrap')?.hidden) return; // a mini-game on top handles its own Esc
    e.preventDefault();
    closeModal();
  });
  const openModal = (html, key) => { modalKey = key; modalRoot.hidden = false; modalRoot.innerHTML = html; };

  function showChoice(kind, id) {
    const key = `choice:${id}`;
    if (modalKey === key) return;
    modalKey = key;
    modalRoot.hidden = false;
    const radio = kind === 'radio';
    const prefix = radio ? `ui.${id}` : `ui.${id}`;
    const warm = id.startsWith('e') && id !== 'e4';
    const urgent = id === 'd5' || id === 'e1';
    const head = radio ? 'ASTRA 6.7 // RADIO DECISION' : t(`ui.${id}.header`);
    const body = radio ? t(`radio.${id}`) : t(`astra.${id}.alert`);
    const choices = radio ? ['a', 'b'] : ['a', 'b', 'c'];
    const card = el('div', `card ${urgent ? 'urgent' : 'warn'}`);
    card.innerHTML = `<div class="hd">${head}</div>${radio ? '' : `<h2>${t(`ui.${id}.title`)}</h2>`}<p>${body}</p><div class="choices"></div>`;
    const box = card.querySelector('.choices');
    for (const c of choices) {
      if (id === 'e1' && c === 'c' && !s.flags.flareWarned) continue;
      const labelId = radio ? `${prefix}.${c}.label` : `ui.${id}.${c}.label`;
      const b = el('button', 'choice', `<span class="k">${c.toUpperCase()}</span>${t(labelId)}`);
      b.dataset.choice = c;
      b.addEventListener('click', () => { play('dilemmaChoice'); send(radio ? { type: 'radio', choice: c } : { type: 'choose', choice: c }); closeModal(); });
      box.append(b);
    }
    void warm;
    modalRoot.innerHTML = '';
    modalRoot.append(card);
    director.decisionShown(id); // urgent (e1, d5) -> emergency alert
  }

  function showActCard(lineId) {
    const card = el('div', 'actcard', `<div>${t(lineId)}</div>`);
    $('stage').append(card);
    setTimeout(() => card.remove(), 3600);
  }

  function showLoot(ev) {
    const items = Object.entries(ev.loot.items).map(([i, n]) => `<li>${n}× <b>${itemName(i)}</b></li>`).join('');
    const label = { smooth: 'A smooth trip!', bumpy: 'A bumpy ride. The wheels need a check.', rough: 'A rough trip: half the loot, a little late.' }[ev.result];
    modalKey = 'loot';
    modalRoot.hidden = false;
    modalRoot.innerHTML = `<div class="card"><div class="hd">ROVER HOME</div><h2>${name(EXPEDITIONS[ev.expedition].nameId)}</h2><p>${label}</p><ul>${ev.loot.sp ? `<li>+${ev.loot.sp} <b>Spare Parts</b></li>` : ''}${items}</ul><button class="choice" id="lootOk">Continue</button></div>`;
    $('lootOk').addEventListener('click', closeModal);
  }

  /** HP ran out (docs/ERRORS.md A28): the mission stops and the screen offers a new start. Reopens until the player chooses. */
  function showGameOver(onRestart) {
    const o = s.over ?? { reason: 'hp', sol: clockAt(s.minute).sol };
    const why = o.reason === 'trip'
      ? 'The Commander ran out of HP on the Rover trip. Radiation adds up out there, so a long trip needs the shielding, the suit liner and a rested Commander.'
      : 'The Commander ran out of HP. Radiation and hard work wear an astronaut out: sleep in the Bedroom, eat fresh food and keep trips outside short.';
    modalKey = 'gameover';
    modalRoot.hidden = false;
    modalRoot.innerHTML = `<div class="card gameover"><div class="hd">MISSION OVER</div><h1>GAME OVER</h1><p>${why}</p><p class="stats">You reached Sol ${o.sol} \u00B7 ${s.stats.builds} rooms built \u00B7 ${s.stats.expeditions} trips \u00B7 ${s.logbook.length} Logbook cards</p><p>Real astronaut teams learn from every hard day. Do you want to try again from the beginning?</p><div class="choices"><button class="choice" id="goAgain">Start over</button><button class="choice" id="goReport">See the report</button></div></div>`;
    $('goAgain').addEventListener('click', () => { play('click'); onRestart(); });
    $('goReport').addEventListener('click', () => { play('click'); showReport(); });
  }

  function showFinale() {
    modalKey = 'finale';
    modalRoot.hidden = false;
    const c = clockAt(s.minute);
    modalRoot.innerHTML = `<div class="card finale"><h1>${t('ui.finale.card')}</h1><p>Sol ${c.sol} · ${s.stats.builds} rooms built · ${s.stats.expeditions} expeditions · ${s.stats.miniWins} jobs done</p><p>${t('astra.finale.closing')}</p><button class="choice" id="finOk">Keep playing: Free-Play</button></div>`;
    $('finOk').addEventListener('click', closeModal);
  }

  // ---------------------------------------------------------------- the crater map
  function showMap(launch) {
    modalKey = 'map';
    modalRoot.hidden = false;
    const card = el('div', 'card map');
    card.innerHTML = '<div class="hd">HOLOGRAM // JEZERO CRATER</div><div class="mapGrid"></div><div id="mapCard"></div><button class="choice" id="mapClose">Close</button>';
    modalRoot.innerHTML = '';
    modalRoot.append(card);
    const grid = card.querySelector('.mapGrid');
    const info = card.querySelector('#mapCard');
    const keys = [1, 2, 3, 4, 5, 'run', 'ice'];
    // the repeatable run has two modes with their own marker: Scrap (Spare Parts) and Ice (Ice Cores, needs the Deep Ice Drill)
    const RUN = { run: { label: 'Scrap', title: 'Scrap Run' }, ice: { label: 'Ice', title: 'Ice Run' } };
    const lootText = (loot) => [loot.sp ? `${loot.sp} Spare Parts` : null, ...Object.entries(loot.items).map(([i, n]) => `${n}\u00D7 ${itemName(i)}`)].filter(Boolean).join(', ');
    const ends = s.rules?.hpZeroEndsRun ?? RULES.hpZeroEndsRun;
    const show = (k) => {
      const ex = EXPEDITIONS[k];
      const why = ex.requires(s);
      const days = durationMinutes(s, ex) / 1440;
      const cost = hpCost(s, ex);
      const margin = ex.id === 4 ? 20 : 6; // a Rough trip adds 5 HP; the space-weather choice on Expedition 4 costs up to 14
      const sure = !why && !s.away && s.hp <= cost; // the Commander would not come back
      const risky = !why && !s.away && !sure && s.hp <= cost + margin;
      info.innerHTML = `<h2>${RUN[k]?.title ?? name(ex.nameId)}</h2><p>Time: ${days} Sol · HP cost about ${Math.round(cost)} · Risk: ${ex.scripted ? 'scripted' : ex.risk}</p><p>Brings home: ${lootText(expectedLoot(s, ex))}${k === 'ice' ? '. Each Ice Core melts into 25 Water.' : ''}</p>${why ? `<p class="why">Locked: ${why}</p>` : s.away ? '<p class="why">The Rover is already out.</p>' : ''}${sure ? `<p class="why danger">Too dangerous: the trip costs about ${Math.round(cost)} HP and the Commander has ${Math.round(s.hp)}. Rest first.</p>` : ''}${risky ? `<p class="why warn">Risky: the Commander has ${Math.round(s.hp)} HP and the trip costs about ${Math.round(cost)}. ${ends ? 'If HP reaches 0 the mission is over.' : 'At 0 HP a rescue drone brings the Commander home.'}</p>` : ''}`;
      if (!why && !s.away && !sure) {
        const b = el('button', 'choice', 'Prepare and launch');
        b.dataset.launch = String(k);
        b.addEventListener('click', () => { closeModal(); launch(k); });
        info.append(b);
      }
    };
    for (const k of keys) {
      const ex = EXPEDITIONS[k];
      const m = el('button', `marker ${ex.requires(s) ? 'locked' : ''}`, `${ex.requires(s) ? '\u{1F512} ' : ''}${RUN[k]?.label ?? `#${k}`}`);
      m.style.left = `${ex.mapPos[0] * 100}%`;
      m.style.top = `${ex.mapPos[1] * 100}%`;
      m.addEventListener('click', () => show(k));
      grid.append(m);
    }
    show(keys.find((k) => !EXPEDITIONS[k].requires(s)) ?? 1); // open on the first trip that can go now
    card.querySelector('#mapClose').addEventListener('click', closeModal);
    if (!s.flags._mapIntroSaid) { s.flags._mapIntroSaid = true; send({ type: 'say', lineId: 'astra.act2.map_intro' }); }
  }
  $('mapBtn').addEventListener('click', () => { play('click'); showMap(ui.launch); });

  // ---------------------------------------------------------------- radio log
  const radioLines = [];
  const ui = {
    launch: () => {},
    gauges: G,
    select(id) { selected = id; sig = ''; },
    get selected() { return selected; },
    highlight(id) { for (const e of Object.values(G)) e.g.classList.toggle('pulse', e.d.id === id); },
    pushRadio(id) { radioLines.push(hasString(id) ? t(id) : id); if (radioLines.length > 6) radioLines.shift(); sig = ''; },
    showChoice, showActCard, showLoot, showFinale, showGameOver, closeModal, openModal, showReport,
    setTab(id) { tab = id; sig = ''; },
    showMap: (launch) => showMap(launch ?? ui.launch),
    get modalOpen() { return !modalRoot.hidden; },
    get modalKey() { return modalKey; },
    update() {
      const c = clockAt(s.minute);
      $('clock').textContent = `Sol ${c.sol} · ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}${s.storm ? ' · DUST STORM' : ''}`;
      for (const [k, e] of Object.entries(G)) {
        const v = k === 'hp' ? s.hp : s.res[k];
        const cap = e.d.max();
        const f = Math.max(0, Math.min(1, v / cap));
        e.bar.style.width = `${f * 100}%`;
        // Power holds more than 100 once there is a battery: show "88 / 250" so the bar and the number agree
        e.val.textContent = cap !== 100 && k !== 'sp' ? `${Math.round(v)}/${cap}` : Math.round(v);
        const limit = LOW_LIMITS[k];
        const empty = k !== 'sp' && (v <= 0 || (k !== 'hp' && Boolean(s.emergency[k]))); // a boolean: classList.toggle(name, undefined) would TOGGLE
        e.g.classList.toggle('low', empty); // red and pulsing: empty or in an emergency
        e.g.classList.toggle('warn', Boolean(!empty && limit != null && v < limit && !(k === 'hp' && s.medRest))); // amber: running low
        const name = k === 'hp' ? t('ui.res.astronaut_hp.name') : k === 'sp' ? t('ui.res.spare_parts.name') : t(`ui.res.${k}.name`);
        e.g.title = k === 'sp' ? `${name}: ${Math.round(v)}` : k === 'power' ? `${Math.round(v)} power stored out of ${cap}. A bigger battery holds more. Below ${limit} is low.` : `${name}: ${Math.round(v)} of ${cap}.${limit != null ? ` Below ${limit} is low.` : ''}`;
        const prev = lastRes[k];
        if (prev !== undefined && Math.abs(prev - v) > 0.001) e.g.dataset.trend = v > prev ? 'up' : 'down';
        lastRes[k] = v;
      }
      const a = s.away;
      $('radioBox').hidden = !a;
      if (a) {
        $('radioBar').firstElementChild.style.width = `${awayProgress(a, s.minute) * 100}%`;
        const html = radioLines.map((l) => `<p>${l}</p>`).join('');
        if ($('radioLines').innerHTML !== html) $('radioLines').innerHTML = html;
      } else radioLines.length = 0;
      $('mapBtn').disabled = !online(s, 'garage');
      const next = `${tab}|${selected}|${JSON.stringify([s.drones.map((d) => (d.queue ?? []).length), s.logbook.length, s.badges.length, s.res.sp | 0, s.items, s.kits, s.upgrades, s.tasks.length, s.crafting?.recipe, s.away?.id, s.drones.map((d) => d.status + (d.task?.module ?? '')), Object.values(s.modules).map((m) => m.status + m.tier + (m.upgrading ? `u${Math.floor(m.upgrading.progress * 20)}` : '') + (m.status === 'building' ? Math.floor(m.progress * 50) : Math.floor(m.progress * 10))), s.crafting ? Math.floor(s.crafting.progress * 20) : -1])}`;
      if (next !== sig) {
        sig = next;
        const body = $('tabBody');
        body.innerHTML = '';
        ({ base: renderBase, workshop: renderWorkshop, drones: renderDrones, tasks: renderTasks, logbook: renderLogbook })[tab](body);
        for (const b of tabBar.children) b.classList.toggle('on', b.dataset.tab === tab);
        tabBar.querySelector('[data-tab="tasks"]').textContent = s.tasks.length ? `Tasks (${s.tasks.length})` : 'Tasks';
      }
    },
  };
  void LAYOUT; void UPGRADES;
  return ui;
}
