#!/usr/bin/env node
/**
 * Delegate a task from the main agent to the locally installed OpenAI Codex CLI.
 *
 * Uses only supported CLI commands (`codex exec`) and the existing ChatGPT login.
 * No OpenAI API, no API key: API-key variables are stripped from the child environment
 * and the tool refuses to run if Codex reports API-key authentication.
 *
 *   node tools/codex/delegate.mjs check
 *   node tools/codex/delegate.mjs run --title "Review radiation model" --kind review \
 *        --prompt-file task.md [--files a.js,b.js] [--timeout 900] [--model NAME]
 *   echo "task text" | node tools/codex/delegate.mjs run --title "..."
 *   node tools/codex/delegate.mjs run --write --owns "tests/codex/**" --title "..." --prompt "..."
 *   node tools/codex/delegate.mjs cleanup --slug NAME [--delete-branch]
 *
 * Read-only is the default. `--write` runs Codex in its own Git worktree and branch
 * (codex/<slug>), pauses the Git sync service, and leaves it paused until the main agent
 * has reviewed and integrated (or discarded) the result and run `cleanup`.
 *
 * Every run writes a record to docs/ai-collaboration/records/ and a row to
 * docs/ai-collaboration/LOG.md. Exit code: Codex's own, 124 on timeout, 4 if unusable.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveRepo, acquirePause, releasePause } from '../git-sync/lock.mjs';

const PAUSE_OWNER = 'codex-delegate';
const KINDS = ['review', 'architecture', 'bug', 'verify', 'simulation', 'performance', 'tests', 'proposal', 'smoke'];

// ---------------------------------------------------------------- helpers

function parseArgs(argv) {
  const args = { _: [] };
  const flags = new Set(['write', 'delete-branch', 'no-record', 'help']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) args._.push(a);
    else if (flags.has(a.slice(2))) args[a.slice(2)] = true;
    else args[a.slice(2)] = argv[++i];
  }
  return args;
}

/** Locate Codex without going through a shell (avoids quoting problems on Windows). */
function resolveCodex() {
  if (process.platform !== 'win32') return { cmd: 'codex', pre: [] };
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    const js = path.join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (fs.existsSync(path.join(dir, 'codex.cmd')) && fs.existsSync(js)) return { cmd: process.execPath, pre: [js] };
    if (fs.existsSync(path.join(dir, 'codex.exe'))) return { cmd: path.join(dir, 'codex.exe'), pre: [] };
  }
  return null;
}

/** Environment for Codex: identical to ours, minus anything that would select API billing. */
function childEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(OPENAI_API_KEY|CODEX_API_KEY|OPENAI_ORG(ANIZATION)?(_ID)?|OPENAI_BASE_URL)$/i.test(key)) delete env[key];
  }
  return env;
}

function codexSync(codex, args) {
  const r = spawnSync(codex.cmd, [...codex.pre, ...args], { encoding: 'utf8', windowsHide: true, env: childEnv(), timeout: 60_000 });
  return { code: r.status, text: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

/** Verify the CLI exists and is logged in through ChatGPT. Never reads token files. */
function checkCodex() {
  const codex = resolveCodex();
  if (!codex) return { ok: false, problem: 'Codex CLI not found on PATH. Install the official CLI: npm install -g @openai/codex' };
  const version = codexSync(codex, ['--version']);
  if (version.code !== 0) return { ok: false, problem: `"codex --version" failed: ${version.text}` };
  const login = codexSync(codex, ['login', 'status']);
  const status = login.text.split('\n').filter(Boolean).pop() || '';
  if (login.code !== 0 || /not logged in/i.test(status)) {
    return { ok: false, codex, version: version.text, login: status, problem: 'Codex is not logged in. Run "codex login" and choose "Sign in with ChatGPT".' };
  }
  if (/api key/i.test(status)) {
    return { ok: false, codex, version: version.text, login: status, problem: 'Codex is authenticated with an API key. This project forbids API usage: run "codex logout", then "codex login" with ChatGPT.' };
  }
  return { ok: true, codex, version: version.text, login: status };
}

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  return { ok: r.status === 0, out: (r.stdout || '').replace(/[\r\n]+$/, ''), err: (r.stderr || '').trim() };
}

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'task';

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function globToRegExp(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\/?/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(`^${esc}$`);
}

function changedPaths(dir) {
  const out = git(dir, ['status', '--porcelain=v1', '--untracked-files=all']).out;
  return out ? out.split('\n').map((l) => l.slice(3).replace(/^"|"$/g, '')) : [];
}

function killTree(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  else child.kill('SIGKILL');
}

// ---------------------------------------------------------------- prompts

function buildPrompt({ mode, kind, title, task, files, owns, branch }) {
  const lines = [
    'You are the secondary development agent for this repository. The main agent delegated the task below.',
    'Read AGENTS.md at the repository root first and follow it.',
    '',
  ];
  if (mode === 'read-only') {
    lines.push(
      'MODE: READ-ONLY.',
      '- Do not create, modify, move, or delete any file. Do not change Git state (no add/commit/checkout/stash).',
      '- You may read files and run read-only commands, including `node --test`.',
      '- If a fix is needed, describe it; do not apply it.',
      '',
      'Reply in Markdown with exactly these sections:',
      '## Summary — 2 to 4 sentences.',
      '## Findings — numbered. For each: **Severity** (critical / major / minor / note), **Location** (path:line), what is wrong, why it matters, suggested fix.',
      '## Verification — what you actually read or ran, and what you could not check.',
      '## Recommendations — optional follow-ups, most valuable first.',
      'If you find no problems, say so plainly. Do not invent findings to fill the list.',
    );
  } else {
    lines.push(
      `MODE: WRITE, inside an isolated Git worktree on branch ${branch}.`,
      `- You own only these paths: ${owns.join(', ')}. Do not edit, create, or delete anything else.`,
      '- Do not commit, push, switch branches, or touch other worktrees. The main agent integrates your work.',
      '- Run the relevant tests before you finish.',
      '',
      'Reply in Markdown with exactly these sections:',
      '## Summary',
      '## Files changed — one line each with the reason.',
      '## How to verify — exact commands and what they printed for you.',
      '## Open questions',
    );
  }
  lines.push('', `TASK (${kind}): ${title}`, '');
  if (files.length) lines.push(`Focus files: ${files.join(', ')}`, '');
  lines.push(task.trim(), '');
  return lines.join('\n');
}

// ---------------------------------------------------------------- record keeping

function writeRecord(repo, rec) {
  const dir = path.join(repo, 'docs', 'ai-collaboration', 'records');
  fs.mkdirSync(path.join(dir, 'raw'), { recursive: true });
  const file = path.join(dir, `${rec.id}.md`);
  const row = (k, v) => `| ${k} | ${String(v).replace(/\|/g, '\\|')} |`;
  const md = [
    `# ${rec.title}`,
    '',
    '| Field | Value |',
    '|---|---|',
    row('Record', rec.id),
    row('Kind', rec.kind),
    row('Mode', rec.mode === 'read-only' ? 'read-only (sandbox: read-only)' : `write (worktree branch \`${rec.branch}\`, sandbox: workspace-write)`),
    row('Started', rec.started),
    row('Duration', `${rec.seconds} s`),
    row('Exit status', rec.timedOut ? `${rec.exit} (timed out after ${rec.timeout} s)` : rec.exit),
    row('Codex CLI', rec.version),
    row('Model', rec.model || 'CLI default'),
    row('Authentication', `${rec.login} — no API key`),
    row('Codex session', rec.session || 'n/a'),
    row('Tokens used', rec.tokens || 'n/a'),
    row(rec.mode === 'read-only' ? 'Working-tree changes during run' : 'Files changed by Codex', rec.changed.length ? rec.changed.map((f) => `\`${f}\``).join(', ') : 'none'),
    row('Raw transcript', `[raw/${rec.id}.log](raw/${rec.id}.log)`),
    '',
    '## Task sent to Codex',
    '',
    rec.files.length ? `Focus files: ${rec.files.map((f) => `\`${f}\``).join(', ')}\n` : '',
    rec.task.trim(),
    '',
    '## Codex response',
    '',
    rec.response.trim() || '_Codex returned no final message._',
    '',
  ];
  if (rec.warnings.length) md.push('## Warnings', '', ...rec.warnings.map((w) => `- ${w}`), '');
  if (rec.exit !== 0) md.push('## Errors', '', '```text', rec.stderrTail, '```', '');
  md.push(
    '## Main-agent follow-up',
    '',
    '_Pending. The main agent records here which findings were confirmed, what was fixed, what was rejected and why, and which tests were run._',
    '',
  );
  fs.writeFileSync(file, md.join('\n'));
  fs.writeFileSync(path.join(dir, 'raw', `${rec.id}.log`), rec.transcript);

  const log = path.join(repo, 'docs', 'ai-collaboration', 'LOG.md');
  if (!fs.existsSync(log)) {
    fs.writeFileSync(log, '# Codex delegation log\n\nOne row per delegated task, newest last. Written by `tools/codex/delegate.mjs`.\n\n| Started | Record | Kind | Mode | Exit | Files changed |\n|---|---|---|---|---|---|\n');
  }
  fs.appendFileSync(log, `| ${rec.started.slice(0, 16).replace('T', ' ')} | [${rec.title.replace(/\|/g, '/')}](records/${rec.id}.md) | ${rec.kind} | ${rec.mode} | ${rec.exit} | ${rec.changed.length} |\n`);
  return file;
}

// ---------------------------------------------------------------- commands

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function cmdRun(args) {
  const check = checkCodex();
  if (!check.ok) {
    console.error(`codex-delegate: ${check.problem}`);
    return 4;
  }
  const { repo, stateDir } = resolveRepo(args.repo ? path.resolve(args.repo) : process.cwd());
  const title = args.title || 'Untitled task';
  const kind = KINDS.includes(args.kind) ? args.kind : 'review';
  let task = args.prompt || '';
  if (args['prompt-file']) task = fs.readFileSync(path.resolve(args['prompt-file']), 'utf8');
  if (!task) task = await readStdin();
  if (!task.trim()) {
    console.error('codex-delegate: no task text. Use --prompt, --prompt-file, or pipe it on stdin.');
    return 4;
  }
  const files = (args.files || '').split(',').map((s) => s.trim()).filter(Boolean);
  const timeout = Number(args.timeout || 900);
  const started = new Date();
  const slug = slugify(args.slug || title);
  const id = `${stamp(started)}-${slug}`;
  const mode = args.write ? 'write' : 'read-only';
  const warnings = [];

  let cwd = repo;
  let branch = '';
  let owns = [];
  if (mode === 'write') {
    owns = (args.owns || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!owns.length) {
      console.error('codex-delegate: --write needs --owns "glob,glob" naming the files Codex may edit.');
      return 4;
    }
    branch = `codex/${slug}`;
    cwd = path.join(repo, '.codex-worktrees', slug);
    if (fs.existsSync(cwd)) {
      console.error(`codex-delegate: worktree already exists: ${cwd}. Finish it with "cleanup --slug ${slug}" first.`);
      return 4;
    }
    const pause = acquirePause(stateDir, { owner: PAUSE_OWNER, reason: `Codex write task "${title}" on ${branch}` });
    if (!pause.settled) {
      releasePause(stateDir, { owner: PAUSE_OWNER });
      console.error('codex-delegate: a sync cycle is still running; try again in a moment.');
      return 4;
    }
    const wt = git(repo, ['worktree', 'add', '-q', '-b', branch, cwd, 'HEAD']);
    if (!wt.ok) {
      releasePause(stateDir, { owner: PAUSE_OWNER });
      console.error(`codex-delegate: could not create worktree: ${wt.err}`);
      return 4;
    }
  }

  const before = new Set(changedPaths(cwd));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-delegate-'));
  const lastFile = path.join(tmp, 'last-message.md');
  const prompt = buildPrompt({ mode, kind, title, task, files, owns, branch });
  const cliArgs = ['exec', '-s', mode === 'write' ? 'workspace-write' : 'read-only', '--color', 'never', '-C', cwd, '-o', lastFile];
  if (args.model) cliArgs.push('-m', args.model);
  cliArgs.push('-');

  console.log(`codex-delegate: ${mode} task "${title}" (timeout ${timeout} s) ...`);
  const child = spawn(check.codex.cmd, [...check.codex.pre, ...cliArgs], { cwd, env: childEnv(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d));
  child.stderr.on('data', (d) => (stderr += d));
  child.stdin.end(prompt);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killTree(child);
  }, timeout * 1000);
  const exit = await new Promise((resolve) => {
    child.on('error', (e) => {
      stderr += `\nspawn error: ${e.message}`;
      resolve(4);
    });
    child.on('close', (code) => resolve(timedOut ? 124 : code ?? 1));
  });
  clearTimeout(timer);

  let response = '';
  try {
    response = fs.readFileSync(lastFile, 'utf8');
  } catch {
    response = stdout;
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  const changed = changedPaths(cwd).filter((p) => !before.has(p));
  if (mode === 'read-only' && changed.length) {
    // The read-only sandbox stops Codex from writing, so these are normally edits made by the
    // main agent or a person while the review was running. They are reported, not blamed.
    warnings.push(`The working tree changed while Codex was running: ${changed.join(', ')}. The sandbox was read-only, so these are most likely concurrent edits by the main agent or a person — Codex may have reviewed an older version of those files.`);
  }
  if (mode === 'write') {
    const allowed = owns.map(globToRegExp);
    const outside = changed.filter((p) => !allowed.some((re) => re.test(p)));
    if (outside.length) warnings.push(`Codex edited files outside its ownership (${owns.join(', ')}): ${outside.join(', ')}. Do not integrate these without review.`);
    if (changed.length) {
      git(cwd, ['add', '-A']);
      const c = git(cwd, ['commit', '-q', '-m', `codex: ${title}`]);
      if (!c.ok) warnings.push(`Could not commit Codex's work on ${branch}: ${c.err}`);
    }
  }

  const rec = {
    id, title, kind, mode, branch, task, files, changed, warnings, timeout, timedOut, exit,
    started: started.toISOString(),
    seconds: Math.round((Date.now() - started.getTime()) / 1000),
    version: check.version,
    login: check.login,
    model: args.model || (stderr.match(/^model:\s*(.+)$/m) || [])[1],
    session: (stderr.match(/^session id:\s*(.+)$/m) || [])[1],
    tokens: (stderr.match(/tokens used\s*\n\s*([\d,.]+)/) || [])[1],
    response,
    stderrTail: stderr.split('\n').slice(-40).join('\n'),
    transcript: stderr.length > 300_000 ? `${stderr.slice(0, 150_000)}\n\n[... transcript truncated ...]\n\n${stderr.slice(-150_000)}` : stderr,
  };
  let recordFile = '';
  if (!args['no-record']) recordFile = writeRecord(repo, rec);

  console.log(`codex-delegate: exit ${exit} in ${rec.seconds} s; ${mode === 'read-only' ? 'working-tree changes during run' : 'files changed by Codex'}: ${changed.length ? changed.join(', ') : 'none'}`);
  for (const w of warnings) console.log(`codex-delegate: WARNING ${w}`);
  if (recordFile) console.log(`codex-delegate: record ${path.relative(repo, recordFile).replace(/\\/g, '/')}`);
  if (mode === 'write') {
    console.log(`codex-delegate: Git sync stays PAUSED until integration is finished.`);
    console.log(`  review:   git diff HEAD...${branch}`);
    console.log(`  finish:   node tools/codex/delegate.mjs cleanup --slug ${slug}   (after merging or deciding to discard)`);
  }
  console.log('\n----- Codex response -----\n');
  console.log(response.trim());
  return exit;
}

function cmdCleanup(args) {
  const { repo, stateDir } = resolveRepo(process.cwd());
  if (!args.slug) {
    console.error('codex-delegate: cleanup needs --slug NAME');
    return 4;
  }
  const slug = slugify(args.slug);
  const dir = path.join(repo, '.codex-worktrees', slug);
  if (fs.existsSync(dir)) {
    const rm = git(repo, ['worktree', 'remove', '--force', dir]);
    console.log(rm.ok ? `removed worktree ${dir}` : `could not remove worktree: ${rm.err}`);
  }
  git(repo, ['worktree', 'prune']);
  if (args['delete-branch']) {
    const del = git(repo, ['branch', '-D', `codex/${slug}`]);
    console.log(del.ok ? `deleted branch codex/${slug}` : `could not delete branch: ${del.err}`);
  }
  const released = releasePause(stateDir, { owner: PAUSE_OWNER });
  console.log(released.length ? 'Git sync pause released.' : 'No Codex sync pause was held.');
  return 0;
}

function cmdCheck() {
  const c = checkCodex();
  console.log(`codex cli : ${c.version || 'not found'}`);
  console.log(`login     : ${c.login || 'unknown'}`);
  console.log(`api key   : ${['OPENAI_API_KEY', 'CODEX_API_KEY'].some((k) => process.env[k]) ? 'present in environment, but stripped before Codex runs' : 'none in environment'}`);
  console.log(c.ok ? 'result    : OK — delegation will use the ChatGPT login' : `result    : NOT USABLE — ${c.problem}`);
  return c.ok ? 0 : 4;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || (args.help ? 'help' : 'run');
let code;
if (command === 'check') code = cmdCheck();
else if (command === 'cleanup') code = cmdCleanup(args);
else if (command === 'run') code = await cmdRun(args);
else {
  console.log('Usage: node tools/codex/delegate.mjs <check | run | cleanup> [options]   (see the header of this file)');
  code = command === 'help' ? 0 : 4;
}
process.exitCode = code;
