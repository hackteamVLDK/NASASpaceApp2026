/**
 * The campaign interface (DOM, browser only): meters, tabs (Base, Workshop, Drones, Tasks),
 * dilemma and event cards, the expedition map, the radio log, loot, act cards and the ending.
 * It reads campaign state and sends commands through `send`; it never edits state itself.
 * All player-facing text comes from line IDs (strings.js); a few short button labels are literal.
 */
import { MODULES, RECIPES, UPGRADES, LAYOUT, RULES } from '../campaign/data.js';
import { moduleInfo, clockAt, online, recipeCost, soilWashBlock } from '../campaign/engine.js';
import { EXPEDITIONS, hpCost, durationMinutes, awayProgress, expectedLoot } from '../campaign/expeditions.js';
import { t, short, hasString } from '../flow/strings.js';
import { ICON } from '../render/atlas.js';
import { play, director } from './audio.js';
import { CARDS, STORY_CARDS, BADGES, buildReport, cardParagraphs } from '../campaign/logbook.js';
import { LOW_LIMITS } from '../campaign/hazards.js';
import { missingItems, whereText } from '../campaign/sources.js';
import { choiceBlock } from '../campaign/story.js';
import { createLivesUi, usedTriesText, STRINGS } from './lives-ui.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const name = (id) => short(id);
const itemName = (it) => (hasString(`ui.item.${it}.name`) ? t(`ui.item.${it}.name`) : it.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '));
const costText = (c = {}) => [c.sp ? `${c.sp} SP` : null, c.water ? `${c.water} Water` : null, ...Object.entries(c.items ?? {}).map(([i, n]) => `${n}× ${itemName(i)}`)].filter(Boolean).join(', ');
const MINI_NAME = { solar_wipe: 'ui.mg.solar_wipe.title', heat_pump: 'ui.mg.heat_pump_reroute.title', valve_balance: 'ui.mg.valve_balance.title', water_sort: 'ui.mg.water_sort.title', nutrient_match: 'ui.mg.nutrient_match.title', air_filter: 'ui.mg.air_filter_scrub.title', antenna: 'ui.mg.dish_antenna_alignment.title', wheel_vacuum: 'ui.mg.wheel_pebble_vacuum.title', suit_seal: 'ui.mg.suit_seal_check.title' };
/** A18: one hint row per missing component, saying where to find it. */
const whereRows = (s, cost) => missingItems(s, cost).map(({ item, need, have }) => el('div', 'why where', `${need}× ${itemName(item)} (you have ${have}): ${whereText(s, item, name)}.`));
/**
 * B16: a picture for every Logbook card until the card art exists: the closest icon by topic
 * (handoff LOGBOOK_IMAGE_PROMPTS has the real art; when it lands, swap this for the image).
 */
const CARD_TOPICS = [
  [/storm|devil|hitchhik|dust/, 'storm'], [/flare|particle|xray|dose|radiation|shield|badge|blanket|wet_soil|hydrogen|forecast|under_the/, 'radiation'],
  [/plant|garden|salad|farm|flower|green|soak|perchlorate|soil/, 'farm'], [/water|ice|brine|loop|shower|lake/, 'water'],
  [/air|co2|moxie|oxygen|thin/, 'lungs'], [/rover|rock|ingenuity|sharp|wind|marathon|look/, 'explore'], [/sleep|rested/, 'sleep'],
  [/cold|heat/, 'heat'], [/sun|solar|panel|sweeper/, 'solar'], [/grav|strong|body|stay|chapea/, 'exercise'], [/wrench/, 'wrench'],
  [/message|contact|weather|tea/, 'alert'], [/quake|methane|leopard|bio|sample|scientist|pages/, 'research'],
];
const cardIcon = (id) => ICON[CARD_TOPICS.find(([re]) => re.test(id))?.[1] ?? 'star'];
export const miniTitle = (g) => (hasString(MINI_NAME[g]) ? short(MINI_NAME[g]) : g.replaceAll('_', ' '));

export function createUi({ atlas, s, send, openMini, closeModalHook = () => {}, choicePreview = () => [], mountJobs = null, astraLog = () => [], rememberLine = () => {} }) {
  const uiText = (id) => hasString(id) ? t(id) : STRINGS[id];
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
  const lives = createLivesUi({ s, read: uiText, onTryAgain: () => {
    closeModal();
    if (s.pending) showChoice(s.pending.kind, s.pending.id);
    modalRoot.querySelector('button')?.focus();
  } });
  G.hp.g.append(lives.el);

  // ---------------------------------------------------------------- tabs
  const tabs = ['base', 'workshop', 'drones', 'tasks', 'logbook'];
  if (mountJobs) tabs.splice(tabs.indexOf('tasks') + 1, 0, 'jobs');
  // Keep the same mounted DOM across tab switches and rewind; its update reads the same state object.
  const jobsHost = mountJobs ? el('div', 'jobs-host') : null;
  let jobsMounted = false;
  let jobsPanel = null;
  let jobsCount = null;
  const side = $('side');
  side.innerHTML = `<section id="tabsBox"><div id="tabBar"></div><div id="tabBody"></div></section><section id="radioBox" hidden><h3>Rover radio</h3><div id="radioBar"><i></i></div><div id="radioLines"></div></section><section><button id="mapBtn" disabled>Crater map</button> <button id="reportBtn">Mission report</button></section>`;
  let tab = 'base';
  let unreadLogbook = 0;
  const logbookSeen = () => {
    unreadLogbook = 0;
    tabBar.querySelector('[data-tab="logbook"]')?.querySelector('.logbook-badge')?.remove();
  };
  const tabBar = $('tabBar');
  for (const id of tabs) {
    const b = el('button', '', { base: 'Base', workshop: 'Workshop', drones: 'Drones', tasks: 'Tasks', logbook: 'Logbook', jobs: uiText('ui.jobs.tab') }[id]);
    b.dataset.tab = id;
    b.addEventListener('click', () => { tab = id; if (id === 'logbook') logbookSeen(); sig = ''; play('uiTabSwitch'); });
    tabBar.append(b);
  }
  let sig = '';
  let selected = null;
  let revealPending = false;
  let shownTab = null; // the tab the side list was last drawn for: its scroll position is kept only inside the same tab
  const selectedDrone = () => (selected?.startsWith('drone:') ? selected.slice(6) : undefined);

  function renderJobs(body) {
    body.append(jobsHost);
    if (!jobsMounted) {
      jobsPanel = mountJobs(jobsHost);
      jobsMounted = true;
    }
  }

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
      if (id === 'lab' && s.flags.washUnlocked && !s.flags.soilBeds) { // B11: wash the Martian soil (Dilemma 3 choice B, later)
        const washing = Boolean(s.flags.soilWashing);
        const why = washing ? null : soilWashBlock(s);
        const b = el('button', '', washing ? 'Washing soil...' : 'Wash the soil (20 Water)');
        b.disabled = washing || Boolean(why);
        b.title = why ?? 'Rinse the perchlorates out of Martian soil. Soil Beds: +3 Food per Sol for good.';
        b.addEventListener('click', () => send({ type: 'washSoil' }));
        row.append(el('div', 'why', washing ? 'Rinsing out the perchlorates: Soil Beds are ready in 2 Sols.' : (why ?? 'Perchlorates dissolve in water: wash them out to grow food in Martian soil.')));
        row.append(b);
      }
      row.prepend(actions);
      const notes = [...row.children].filter((child) => child.classList.contains('why'));
      if (notes.length) {
        const more = el('details', 'module-more');
        more.append(el('summary', '', 'More'), ...notes);
        row.append(more);
      }
      row.addEventListener('click', (e) => { if (!e.target.closest('button, details')) { selected = `module:${id}`; sig = ''; } });
      body.append(row);
    }
  }

  function renderWorkshop(body) {
    if (!online(s, 'workshop')) { body.append(el('p', 'why', 'Build the Workshop')); return; }
    if (s.crafting) body.append(el('div', 'craft', `Crafting: <b>${name(RECIPES[s.crafting.recipe].nameId)}</b> ${Math.round(s.crafting.progress * 100)}%`));
    for (const [id, r] of Object.entries(RECIPES)) {
      if (r.kind !== 'kit' && s.upgrades[id]) { body.append(el('div', 'mod done', `<div><b>${name(r.nameId)}</b><br><small>Crafted</small></div>`)); continue; }
      const row = el('div', 'mod');
      const cost = recipeCost(s, id); // C9: a re-craft can be cheaper than the first craft
      row.innerHTML = `<div><b>${name(r.nameId)}</b><br><small>${costText(cost)}</small></div>`;
      const b = el('button', '', 'Craft');
      b.dataset.craft = id;
      b.disabled = Boolean(s.crafting);
      b.addEventListener('click', () => send({ type: 'craft', recipe: id }));
      row.prepend(b);
      row.append(...whereRows(s, cost));
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
    body.append(el('p', 'why', 'Drone, then room'));
    for (const d of s.drones) {
      const row = el('div', `mod ${selected === `drone:${d.id}` ? 'sel' : ''}`);
      const CHORES = { wash: 'Wash the soil', trays: 'Move the trays to the Kitchen', leak: 'Fix the airlock leak' };
      const jobText = (j) => (j.type === 'chore' ? (j.fix ? `Fix: ${t(MINI_NAME[j.fix])}` : CHORES[j.id] ?? 'A job for the crew') : `${j.type === 'upgrade' ? 'Upgrade' : 'Build'} ${name(MODULES[j.module].nameId)}`);
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
    if (!s.tasks.length) body.append(el('p', 'why', 'All clear'));
    for (const task of s.tasks) {
      const row = el('div', 'mod');
      row.innerHTML = `<div><b>${miniTitle(task.game)}</b><details><summary>More</summary><small>${task.why}</small></details></div>`;
      const b = el('button', '', 'Play');
      b.dataset.task = task.game;
      b.addEventListener('click', () => openMini(task.game));
      row.prepend(b);
      body.append(row);
    }
  }

  function renderLogbook(body) {
    logbookSeen();
    body.append(el('h4', '', t('ui.logbook.title')));
    body.append(el('div', 'why', t('ui.logbook.count').replace('{unlocked}', s.logbook.length).replace('{total}', CARDS.length)));
    const grid = el('div', 'cards');
    for (const c of STORY_CARDS) { // the Mission file: open from the start
      const b = el('button', 'cardbtn story', t(`card.${c.id}.title`));
      b.prepend(icon(ICON.explore, 20));
      b.dataset.card = c.id;
      b.addEventListener('click', () => showCard(c));
      grid.append(b);
    }
    for (const c of CARDS) {
      const got = s.logbook.includes(c.id);
      const b = el('button', `cardbtn ${c.tier} ${got ? '' : 'locked'}`, got ? t(`card.${c.id}.title`) : t('ui.logbook.locked'));
      if (got) b.prepend(icon(cardIcon(c.id), 20)); // B16: the card's picture in the list too
      b.dataset.card = c.id;
      b.disabled = !got;
      b.addEventListener('click', () => showCard(c));
      grid.append(b);
    }
    body.append(grid);
    body.append(el('h4', '', 'Badges'));
    const earned = BADGES.filter((x) => s.badges.includes(x.id));
    body.append(el('div', 'inv', earned.length ? earned.map((x) => `<span title="${t(`badge.${x.id}.text`)}">\u{1F3C5} ${t(`badge.${x.id}.name`)}</span>`).join('') : '<small>Earn badges by doing real-world good practice.</small>'));
    const history = el('details', 'astra-log');
    history.append(el('summary', '', 'ASTRA notes'));
    for (const line of astraLog()) {
      const entry = el('details');
      const label = el('summary');
      label.textContent = line.lineId ? short(line.lineId) : 'ASTRA';
      const full = el('p');
      full.textContent = line.lineId ? t(line.lineId) : line.message;
      entry.append(label, full);
      history.append(entry);
    }
    body.append(history);
  }

  function showCard(c) {
    modalKey = `card:${c.id}`;
    modalRoot.hidden = false;
    modalRoot.innerHTML = `<div class="card logcard"><div class="hd">${c.tier === 'story' ? 'MISSION FILE' : c.tier === 'core' ? 'CORE CARD' : 'BONUS CARD'} \u00b7 ${c.org}</div><canvas class="cardpic" width="96" height="96"></canvas><h2>${t(`card.${c.id}.title`)}</h2>${cardParagraphs(c, t(`card.${c.id}.text`)).map((p) => `<p>${p}</p>`).join('')}${c.url ? `<p><a href="${c.url}" target="_blank" rel="noopener">${t('ui.logbook.how_we_know')}</a> <small>(${c.org})</small></p>` : ''}<button class="choice" id="cardOk">Close</button></div>`;
    $('cardOk').addEventListener('click', closeModal);
    const pic = modalRoot.querySelector('.cardpic').getContext('2d');
    pic.imageSmoothingEnabled = false;
    atlas.cell(pic, 'icons', cardIcon(c.id), 8, 8, 80, 80); // B16: a picture on every card
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
        <h3>${t('report.base')}</h3><p>O\u2082 ${Math.round(r.meters.oxygen)} \u00b7 Water ${Math.round(r.meters.water)} \u00b7 Food ${Math.round(r.meters.food)} \u00b7 Power ${Math.round(r.meters.power)} \u00b7 Heat ${Math.round(r.meters.heat)} \u00b7 Morale ${Math.round(r.meters.morale)} \u00b7 Emergencies ${r.emergencies}</p><p class="zeroSols">Sols with empty supplies: ${r.zeroSols}${r.starsLost ? ` (\u2212${r.starsLost} \u2605). Next time, fix an Emergency quickly.` : ''}</p>
        <h3>${t('report.space_weather')}</h3><p>${r.flares ? `Solar flares faced: ${r.flares} \u00b7 most HP lost in one: ${Math.round(r.flareMaxLoss)}${r.flareMaxLoss <= 1 ? ' (sheltered in time!)' : ''}` : (s.flags.finaleDone ? 'No solar flares this mission.' : 'No solar flares yet.')}</p>
        <h3>${t('report.modules')}</h3><p>${r.modulesBuilt} of 6 modules \u00b7 ${r.tier2} Tier 2 \u00b7 roof ${r.roof ? 'yes' : 'no'} \u00b7 drones awake ${r.dronesAwake} of 3</p></div>
        <div><h3>${t('report.expeditions')}</h3><p>Trips: ${r.expeditions} \u00b7 Ice Cores melted: ${r.melted}</p><p>Story finds: ${r.storyFinds.length ? r.storyFinds.map(itemName).join(', ') : 'none yet'}</p>
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
  modalRoot.setAttribute('role', 'dialog'); modalRoot.setAttribute('aria-modal', 'true'); // C15
  modalRoot.id = 'modal';
  modalRoot.hidden = true;
  $('stage').append(modalRoot);
  let modalKey = null;
  const closeModal = () => { modalRoot.hidden = true; modalRoot.innerHTML = ''; modalKey = null; modalRoot.removeAttribute('aria-labelledby'); modalRoot.removeAttribute('aria-describedby'); closeModalHook(); };
  // A24: every window gets a close button (top right) and Esc closes it, except the ones that need an answer:
  // a decision (dilemma, event, radio) must be chosen, and Game Over has its own two buttons.
  const mustAnswer = () => !modalKey || modalKey.startsWith('choice:') || modalKey === 'gameover' || modalKey === 'life-lost';
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
    const head = radio ? 'Radio decision' : short(`ui.${id}.header`);
    const bodyId = radio ? `radio.${id}` : `astra.${id}.alert`;
    rememberLine(bodyId);
    const choices = radio ? ['a', 'b'] : ['a', 'b', 'c'];
    const card = el('div', `card ${urgent ? 'urgent' : 'warn'}`);
    card.innerHTML = `<div class="hd">${head}</div>${radio ? '' : `<h2>${short(`ui.${id}.title`)}</h2>`}<p>${short(bodyId)}</p><details class="decision-more"><summary>More</summary><p>${t(bodyId)}</p></details><div class="choices"></div>`;
    const detail = card.querySelector('.decision-more');
    const box = card.querySelector('.choices');
    for (const c of choices) {
      if (id === 'e1' && c === 'c' && !s.flags.flareWarned) continue;
      const labelId = radio ? `${prefix}.${c}.label` : `ui.${id}.${c}.label`;
      rememberLine(labelId);
      // D-T1 / A22: a choice the engine would refuse (not enough Spare Parts or Water, no Garage yet) is greyed out and says why.
      // The sim is stopped while the card is open, so what is true now stays true until the player answers.
      const why = !radio && s.pending?.id === id ? choiceBlock(s, s.pending, c) : null;
      const b = el('button', `choice${why ? ' blocked' : ''}`, `<span class="k">${c.toUpperCase()}</span><span class="lbl">${short(labelId)}</span>${why ? '<small class="why">Not ready</small>' : ''}`);
      const fullLabel = el('p');
      fullLabel.textContent = `${c.toUpperCase()}: ${t(labelId)}${why ? ` — ${why}` : ''}`;
      detail.append(fullLabel);
      if (why) { b.title = why; b.addEventListener('click', () => { detail.open = true; }); }
      b.dataset.choice = c;
      if (why) b.setAttribute('aria-disabled', 'true'); // not `disabled`: it stays focusable and a tap still explains itself
      b.addEventListener('click', () => {
        if (why) { play('actionDenied'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; } // the card stays open
        play('dilemmaChoice');
        const res = send(radio ? { type: 'radio', choice: c } : { type: 'choose', choice: c });
        // A choice can trigger a rescue synchronously. Keep that new card open.
        if (res?.ok !== false && modalKey === key) closeModal();
      });
      const option = el('div', 'choice-option');
      option.append(b);
      const preview = choicePreview(id, c).slice(0, 3);
      if (preview.length) {
        const list = el('ul', 'choice-preview');
        list.id = `preview-${id}-${c}`;
        for (const line of preview) {
          const li = el('li');
          li.textContent = line;
          list.append(li);
        }
        b.setAttribute('aria-describedby', list.id);
        option.append(list);
      }
      box.append(option);
    }
    void warm;
    modalRoot.innerHTML = '';
    modalRoot.append(card);
    director.decisionShown(id); // urgent (e1, d5) -> emergency alert
  }

  function showActCard(lineId) {
    // Act titles are available in the Logbook; avoid a second transient popup.
    send({ type: 'say', lineId });
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
    const used = usedTriesText(s, uiText);
    if (used) modalRoot.querySelector('h1').after(el('p', 'tries-used', used));
    $('goAgain').addEventListener('click', () => { play('click'); onRestart(); });
    $('goReport').addEventListener('click', () => { play('click'); showReport(); });
  }

  function showLifeLost(event) {
    // The final try belongs to the existing Game Over flow, which opens on the next frame.
    if (event.livesLeft === 0) { lives.update(); closeModal(); return; }
    modalKey = 'life-lost';
    modalRoot.hidden = false;
    modalRoot.replaceChildren(lives.showLoss(event));
    modalRoot.setAttribute('aria-labelledby', 'lifeLostTitle');
    modalRoot.setAttribute('aria-describedby', 'lifeLostText');
    modalRoot.querySelector('button').focus();
  }

  function refreshAfterRewind() {
    sig = '';
    shownTab = null;
    selected = null;
    revealPending = false;
    lastRes = {};
    for (const e of Object.values(G)) delete e.g.dataset.trend;
    radioLines.length = 0;
    radioSignature = '';
    $('radioLines').replaceChildren();
    $('radioBar').firstElementChild.style.width = '0%';
    $('stage').querySelectorAll('.actcard').forEach((card) => card.remove());
    // The rescue acknowledgement stays above the restored decision until Try again.
    if (modalKey !== 'life-lost') {
      closeModal();
      if (s.pending) showChoice(s.pending.kind, s.pending.id);
    }
    ui.update();
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
    const hpWarning = ends ? uiText(s.lives === 1 ? 'ui.lives.last_warning' : 'ui.lives.trip_warning') : 'At 0 HP a rescue drone brings the Commander home.';
    const show = (k) => {
      const ex = EXPEDITIONS[k];
      const why = ex.requires(s);
      const days = durationMinutes(s, ex) / 1440;
      const cost = hpCost(s, ex);
      const margin = ex.id === 4 ? 20 : 6; // a Rough trip adds 5 HP; the space-weather choice on Expedition 4 costs up to 14
      const sure = !why && !s.away && s.hp <= cost; // the Commander would not come back
      const risky = !why && !s.away && !sure && s.hp <= cost + margin;
      info.innerHTML = `<h2>${RUN[k]?.title ?? name(ex.nameId)}</h2><p>Time: ${days} Sol · HP cost about ${Math.round(cost)} · Risk: ${ex.scripted ? 'scripted' : ex.risk}</p><p>Brings home: ${lootText(expectedLoot(s, ex))}${k === 'ice' ? '. Each Ice Core melts into 25 Water.' : ''}</p>${why ? `<p class="why">Locked: ${why}</p>` : s.away ? '<p class="why">The Rover is already out.</p>' : ''}${sure ? `<p class="why danger">Too dangerous: the trip costs about ${Math.round(cost)} HP and the Commander has ${Math.round(s.hp)}. Rest first.</p>` : ''}${risky ? `<p class="why warn">Risky: the Commander has ${Math.round(s.hp)} HP and the trip costs about ${Math.round(cost)}. ${hpWarning}</p>` : ''}`;
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
  let radioSignature = '';
  const ui = {
    launch: () => {},
    gauges: G,
    /** Select something from code (a tap in the world, a mission's "Show me"): its row in the side list is scrolled into view. */
    select(id) { selected = id; sig = ''; revealPending = true; },
    /** A21: after the next redraw, scroll the side list so the selected row is visible (no scrollIntoView: it would move the stage). */
    revealSelected() { revealPending = true; },
    get selected() { return selected; },
    highlight(id) { for (const e of Object.values(G)) e.g.classList.toggle('pulse', e.d.id === id); },
    pushRadio(id) { rememberLine(id); radioLines.push(id); if (radioLines.length > 6) radioLines.shift(); sig = ''; },
    notifyLogbook(count = 1) {
      if (tab === 'logbook') { sig = ''; return; }
      unreadLogbook += count;
      const button = tabBar.querySelector('[data-tab="logbook"]');
      button.querySelector('.logbook-badge')?.remove();
      const badge = el('span', 'logbook-badge');
      badge.textContent = unreadLogbook;
      button.append(badge);
    },
    // main.js routes both new engine events here from its existing handleEvents dispatcher.
    handleEvent(event) {
      if (event.type === 'life-lost') showLifeLost(event);
      else if (event.type === 'rewind') refreshAfterRewind();
    },
    showChoice, showActCard, showLoot, showFinale, showGameOver, showLifeLost, refreshAfterRewind, closeModal, openModal, showReport,
    setTab(id) { if (tabs.includes(id)) { tab = id; sig = ''; } },
    showMap: (launch) => showMap(launch ?? ui.launch),
    get modalOpen() { return !modalRoot.hidden; },
    get modalKey() { return modalKey; },
    update() {
      lives.update();
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
        const html = radioLines.map((id) => `<details><summary>${short(id)}</summary><p>${t(id)}</p></details>`).join('');
        if (radioSignature !== html) { $('radioLines').innerHTML = html; radioSignature = html; }
      } else { radioLines.length = 0; radioSignature = ''; }
      $('mapBtn').disabled = !online(s, 'garage');
      const next = tab === 'jobs' ? tab : `${tab}|${selected}|${JSON.stringify([astraLog().length, s.drones.map((d) => (d.queue ?? []).length), s.logbook.length, s.badges.length, s.res.sp | 0, s.items, s.kits, s.upgrades, s.tasks.length, s.crafting?.recipe, s.away?.id, s.drones.map((d) => d.status + (d.task?.module ?? '')), Object.values(s.modules).map((m) => m.status + m.tier + (m.upgrading ? `u${Math.floor(m.upgrading.progress * 20)}` : '') + (m.status === 'building' ? Math.floor(m.progress * 50) : Math.floor(m.progress * 10))), s.crafting ? Math.floor(s.crafting.progress * 20) : -1])}`;
      if (next !== sig) {
        sig = next;
        const body = $('tabBody');
        const keepScroll = tab === shownTab ? body.scrollTop : 0; // a redraw (a build ticking on) must not throw the list back to the top
        const openDetails = tab === shownTab ? [...body.querySelectorAll('details')].map((detail) => detail.open) : [];
        body.innerHTML = '';
        ({ base: renderBase, workshop: renderWorkshop, drones: renderDrones, tasks: renderTasks, logbook: renderLogbook, jobs: renderJobs })[tab](body);
        [...body.querySelectorAll('details')].forEach((detail, i) => { detail.open = Boolean(openDetails[i]); });
        shownTab = tab;
        body.scrollTop = keepScroll;
        for (const b of tabBar.children) b.classList.toggle('on', b.dataset.tab === tab);
        if (revealPending) {
          revealPending = false;
          const row = body.querySelector('.mod.sel');
          if (row) body.scrollTop = Math.max(0, row.offsetTop - body.offsetTop - 12);
        }
        tabBar.querySelector('[data-tab="tasks"]').textContent = s.tasks.length ? `Tasks (${s.tasks.length})` : 'Tasks';
      }
      if (jobsMounted) jobsPanel?.update?.();
      if (mountJobs?.count) {
        const count = mountJobs.count();
        if (count !== jobsCount) {
          jobsCount = count;
          const b = tabBar.querySelector('[data-tab="jobs"]');
          b.textContent = uiText('ui.jobs.tab');
          if (count > 0) {
            const badge = el('span', 'jobs-badge');
            badge.textContent = count;
            b.append(badge);
          }
          b.setAttribute('aria-label', uiText('ui.jobs.ready').replace('{count}', count));
        }
      }
    },
  };
  void LAYOUT; void UPGRADES;
  return ui;
}
