/** Read-only job board. The campaign owns eligibility, rewards, and all state changes. */
import { hasString, t } from '../flow/strings.js';

export const STRINGS = Object.freeze({
  'ui.jobs.title': 'Jobs',
  'ui.jobs.empty': 'No jobs right now. Check again soon!',
  'ui.jobs.start': 'Start',
});
const text = (id) => hasString(id) ? t(id) : STRINGS[id];

export function createJobsPanel({ s, send, openMini, jobBoard }) {
  const el = document.createElement('div');
  el.className = 'jobs-panel';
  let signature = null;

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
      title.textContent = job.title;
      const description = document.createElement('p');
      description.textContent = job.text;
      const science = document.createElement('p');
      science.className = 'job-science';
      science.textContent = job.science;
      const reward = document.createElement('span');
      reward.className = 'job-reward';
      reward.textContent = job.reward;
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'job-start';
      start.disabled = Boolean(job.block);
      start.textContent = job.block || text('ui.jobs.start');
      start.setAttribute('aria-label', `${job.title}: ${start.textContent}`);
      start.addEventListener('click', () => {
        // Eligibility can change between UI refreshes. Never start from a stale card.
        const current = jobBoard(s).find((item) => item.id === job.id);
        if (!current || current.block) { update(); return; }
        const result = send({ type: 'startJob', job: current.id });
        update();
        if (result?.ok) openMini(current.game, { job: current.id });
      });
      card.append(title, description, science, reward, start);
      content.append(card);
    }
    el.replaceChildren(content);
  }

  update();
  return { el, update, count: () => jobBoard(s).filter((job) => !job.block).length };
}
