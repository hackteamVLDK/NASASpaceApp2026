/** Read-only job board. The campaign owns eligibility, rewards, and all state changes. */
import { short } from '../flow/strings.js';

export const STRINGS = Object.freeze({
  'ui.jobs.title': 'Jobs',
  'ui.jobs.empty': 'No jobs right now. Check again soon!',
  'ui.jobs.start': 'Start',
});
const text = (id) => short(id) !== id ? short(id) : STRINGS[id];
const jobText = (job, field) => short(`job.${job.id}.${field}`) !== `job.${job.id}.${field}` ? short(`job.${job.id}.${field}`) : job[field];

export function createJobsPanel({ s, send, openMini, jobBoard }) {
  const el = document.createElement('div');
  el.className = 'jobs-panel';
  let signature = null;
  const expanded = new Set();

  function update() {
    const board = jobBoard(s);
    const next = JSON.stringify(board);
    if (next === signature) return;
    signature = next;
    const content = document.createDocumentFragment();
    const heading = document.createElement('h3');
    heading.textContent = text('ui.jobs.title');
    content.append(heading);
    if (!board.length) {
      const empty = document.createElement('p');
      empty.className = 'jobs-empty';
      empty.textContent = text('ui.jobs.empty');
      content.append(empty);
    }
    for (const job of board) {
      const card = document.createElement('article');
      card.className = 'job-card';
      card.dataset.job = job.id;
      const title = document.createElement('h4');
      title.textContent = jobText(job, 'title');
      const description = document.createElement('p');
      description.textContent = job.text;
      const science = document.createElement('p');
      science.className = 'job-science';
      science.textContent = job.science;
      const reward = document.createElement('span');
      reward.className = 'job-reward';
      reward.textContent = jobText(job, 'reward');
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'job-start';
      start.disabled = Boolean(job.block);
      start.textContent = job.block ? (job.block.split(/\s+/).length <= 4 ? job.block : 'Not ready') : text('ui.jobs.start');
      if (job.block) start.title = job.block;
      start.setAttribute('aria-label', `${job.title}: ${start.textContent}`);
      start.addEventListener('click', () => {
        // Eligibility can change between UI refreshes. Never start from a stale card.
        const current = jobBoard(s).find((item) => item.id === job.id);
        if (!current || current.block) { update(); return; }
        const result = send({ type: 'startJob', job: current.id });
        update();
        if (result?.ok) openMini(current.game, { job: current.id });
      });
      const more = document.createElement('details');
      more.open = expanded.has(job.id);
      more.addEventListener('toggle', () => { if (more.open) expanded.add(job.id); else expanded.delete(job.id); });
      const summary = document.createElement('summary');
      summary.textContent = 'More';
      more.append(summary, description, science);
      if (job.block) {
        const why = document.createElement('p');
        why.textContent = job.block;
        more.append(why);
      }
      card.append(title, reward, more, start);
      content.append(card);
    }
    el.replaceChildren(content);
  }

  update();
  return { el, update, count: () => jobBoard(s).filter((job) => !job.block).length };
}
