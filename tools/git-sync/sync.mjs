#!/usr/bin/env node
/**
 * Two-way Git synchronisation service (zero dependencies, plain Git underneath).
 *
 *   node tools/git-sync/sync.mjs              run forever, one cycle every intervalSeconds
 *   node tools/git-sync/sync.mjs --once       run a single cycle and exit
 *   node tools/git-sync/sync.mjs pause  [--owner NAME] [--reason TEXT]
 *   node tools/git-sync/sync.mjs resume [--owner NAME | --all]
 *   node tools/git-sync/sync.mjs status
 *
 * Options: --repo DIR  --interval SEC  --debounce SEC  --branch NAME  --remote NAME
 *          --no-desktop  --quiet
 *
 * One cycle:
 *   1. Skip if paused, or if a manual Git operation (rebase/merge/...) is in progress.
 *   2. Fetch the remote branch.
 *   3. Commit local changes once they have been quiet for debounceSeconds.
 *   4. Integrate remote commits: fast-forward, or rebase local commits on top.
 *      On conflict the rebase is aborted, local work is backed up to a
 *      sync-conflict/* branch on the remote, and the user is told how to resolve it.
 *   5. Push. Never force-pushes, never discards local work.
 *
 * Exit codes for --once: 0 ok, 1 error, 2 conflict, 3 paused or busy.
 * See docs/GIT_SYNC.md.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRepo, listPauses, acquirePause, releasePause } from './lock.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const DEFAULTS = {
  remote: 'origin',
  branch: '',
  intervalSeconds: 15,
  debounceSeconds: 4,
  maxDebounceWaitSeconds: 60,
  maxFileSizeMB: 50,
  commitPrefix: 'sync',
  blockedPatterns: ['.env', '.env.*', '*.pem', '*.key', '*.pfx', '*.p12', 'id_rsa*', 'id_ed25519*', 'auth.json', '*.token'],
  skipBranchPrefixes: ['codex/', 'sync-conflict/'],
  notify: { bell: true, desktop: true },
};

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const key = a.slice(2);
    const flags = new Set(['once', 'quiet', 'no-desktop', 'all', 'help']);
    if (flags.has(key)) args[key] = true;
    else args[key] = argv[++i];
  }
  return args;
}

function loadConfig(args) {
  let fileCfg = {};
  const cfgPath = args.config || path.join(HERE, 'sync.config.json');
  try {
    fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (e) {
    if (args.config) throw new Error(`Cannot read config ${cfgPath}: ${e.message}`);
  }
  const cfg = { ...DEFAULTS, ...fileCfg, notify: { ...DEFAULTS.notify, ...(fileCfg.notify || {}) } };
  if (args.interval !== undefined) cfg.intervalSeconds = Number(args.interval);
  if (args.debounce !== undefined) cfg.debounceSeconds = Number(args.debounce);
  if (args.branch !== undefined) cfg.branch = args.branch;
  if (args.remote !== undefined) cfg.remote = args.remote;
  if (args['no-desktop'] || process.env.COLONY_SYNC_NO_DESKTOP) cfg.notify.desktop = false;
  if (!(cfg.intervalSeconds >= 2)) throw new Error('intervalSeconds must be at least 2');
  if (!(cfg.debounceSeconds >= 0)) throw new Error('debounceSeconds must be 0 or more');
  cfg.quiet = Boolean(args.quiet);
  return cfg;
}

// ---------------------------------------------------------------- git helpers

function git(repo, args, { timeout = 120_000, input } = {}) {
  const res = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    input,
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0', // never hang waiting for a password
      GCM_INTERACTIVE: 'never',
      GIT_EDITOR: 'true',
      LC_ALL: 'C',
    },
  });
  return {
    ok: res.status === 0,
    code: res.status,
    out: (res.stdout || '').replace(/[\r\n]+$/, ''),
    err: (res.stderr || '').replace(/[\r\n]+$/, ''),
    timedOut: res.error?.code === 'ETIMEDOUT',
  };
}

const BUSY_MARKERS = ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG', 'index.lock'];

function gitBusy(gitDir) {
  return BUSY_MARKERS.find((m) => fs.existsSync(path.join(gitDir, m))) || null;
}

/** Parse `git status --porcelain=v1 -z`. */
function readStatus(repo) {
  const res = git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  if (!res.ok) throw new Error(`git status failed: ${res.err}`);
  const parts = res.out.split('\0');
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i];
    if (!rec || rec.length < 4) continue;
    const x = rec[0];
    const y = rec[1];
    if (x === 'R' || x === 'C') i++; // next field is the original path
    entries.push({ x, y, path: rec.slice(3), untracked: x === '?' && y === '?' });
  }
  return entries;
}

function globToRegExp(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${esc}$`, 'i');
}

function slug(text, fallback = 'user') {
  const s = String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  return s || fallback;
}

// ---------------------------------------------------------------- commit message

function areaOf(p) {
  const seg = p.split('/');
  if (seg.length <= 2) return seg.length === 1 ? '(root)' : seg[0];
  return `${seg[0]}/${seg[1]}`;
}

function readStaged(repo) {
  const res = git(repo, ['diff', '--cached', '--name-status', '-z']);
  if (!res.ok) throw new Error(`git diff --cached failed: ${res.err}`);
  const parts = res.out.split('\0').filter((s) => s !== '');
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i][0];
    if (status === 'R' || status === 'C') {
      i += 2;
      files.push({ status: 'R', path: parts[i] });
    } else {
      i += 1;
      files.push({ status, path: parts[i] });
    }
  }
  return files;
}

export function buildCommitMessage(prefix, files) {
  const verbs = { A: 'add', M: 'update', D: 'remove', R: 'rename', T: 'update' };
  if (files.length === 1) {
    const f = files[0];
    return { subject: `${prefix}: ${verbs[f.status] || 'update'} ${f.path}`.slice(0, 100), body: '' };
  }
  const counts = {};
  const areas = new Map();
  for (const f of files) {
    const v = verbs[f.status] || 'update';
    counts[v] = (counts[v] || 0) + 1;
    const a = areaOf(f.path);
    areas.set(a, (areas.get(a) || 0) + 1);
  }
  const what = ['add', 'update', 'remove', 'rename'].filter((v) => counts[v]).map((v) => `${v} ${counts[v]}`).join(', ');
  const ranked = [...areas.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  const shown = ranked.slice(0, 3).join(', ') + (ranked.length > 3 ? ` (+${ranked.length - 3} more)` : '');
  let subject = `${prefix}: ${what} files in ${shown}`;
  if (subject.length > 100) subject = `${subject.slice(0, 97)}...`;
  const lines = files.slice(0, 40).map((f) => `${f.status}  ${f.path}`);
  if (files.length > 40) lines.push(`... and ${files.length - 40} more`);
  return { subject, body: lines.join('\n') };
}

// ---------------------------------------------------------------- notifications

function makeLogger(ctx) {
  const logFile = path.join(ctx.stateDir, 'sync.log');
  return (tag, message, { important = false } = {}) => {
    const stamp = new Date().toTimeString().slice(0, 8);
    const line = `[${stamp}] ${tag.padEnd(8)} ${message}`;
    try {
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1_000_000) fs.renameSync(logFile, `${logFile}.1`);
      fs.appendFileSync(logFile, `${new Date().toISOString()} ${tag} ${message}\n`);
    } catch {
      /* logging must never break a sync */
    }
    if (!ctx.cfg.quiet || important) console.log(line);
  };
}

function alertUser(ctx, title, text) {
  if (ctx.cfg.notify.bell && process.stdout.isTTY) process.stdout.write('\x07');
  if (!ctx.cfg.notify.desktop || process.platform !== 'win32') return;
  // Windows toast through the built-in Windows PowerShell. Text travels via environment
  // variables, never through the command line, so file names cannot inject commands.
  const script = [
    "$ErrorActionPreference='Stop'",
    '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null',
    '$t=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)',
    "$n=$t.GetElementsByTagName('text')",
    '$n.Item(0).AppendChild($t.CreateTextNode($env:COLONY_SYNC_TITLE)) > $null',
    '$n.Item(1).AppendChild($t.CreateTextNode($env:COLONY_SYNC_TEXT)) > $null',
    "$id='{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'",
    '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show([Windows.UI.Notifications.ToastNotification]::new($t))',
  ].join(';');
  try {
    spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      timeout: 8000,
      env: { ...process.env, COLONY_SYNC_TITLE: title.slice(0, 80), COLONY_SYNC_TEXT: text.slice(0, 200) },
    });
  } catch {
    /* a missing toast is not an error */
  }
}

function writeStatus(ctx, result) {
  try {
    fs.writeFileSync(path.join(ctx.stateDir, 'status.json'), JSON.stringify({ ...result, at: new Date().toISOString() }, null, 2));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- one cycle

function commitLocalChanges(ctx, entries) {
  const { repo, cfg, log } = ctx;
  const blockedRe = cfg.blockedPatterns.map(globToRegExp);
  const maxBytes = cfg.maxFileSizeMB * 1024 * 1024;
  const blocked = [];
  for (const e of entries) {
    const base = path.posix.basename(e.path);
    const secret = blockedRe.some((re) => re.test(base));
    if (e.untracked) {
      let size = 0;
      try {
        size = fs.statSync(path.join(repo, e.path)).size;
      } catch {
        /* vanished */
      }
      if (secret) blocked.push({ path: e.path, why: 'matches a secret-file pattern' });
      else if (size > maxBytes) blocked.push({ path: e.path, why: `larger than ${cfg.maxFileSizeMB} MB` });
    } else if (secret) {
      log('WARN', `tracked file looks like a secret and is being synced: ${e.path}`, { important: true });
    }
  }
  const blockedKey = blocked.map((b) => b.path).sort().join('|');
  if (blocked.length && blockedKey !== ctx.lastBlockedKey) {
    for (const b of blocked) log('SKIP', `not syncing ${b.path} (${b.why})`, { important: true });
  }
  ctx.lastBlockedKey = blockedKey;

  const pathspec = ['.', ...blocked.map((b) => `:(exclude,literal)${b.path}`)];
  const add = git(repo, ['add', '-A', '--', ...pathspec]);
  if (!add.ok) throw new Error(`git add failed: ${add.err}`);

  const staged = readStaged(repo);
  if (staged.length === 0) return null;
  const { subject, body } = buildCommitMessage(cfg.commitPrefix, staged);
  const commitArgs = ['commit', '-q', '-m', subject];
  if (body) commitArgs.push('-m', body);
  const commit = git(repo, commitArgs);
  if (!commit.ok) throw new Error(`git commit failed: ${commit.err || commit.out}`);
  log('COMMIT', `${subject} (${staged.length} file${staged.length === 1 ? '' : 's'})`);
  return { subject, files: staged.length };
}

function newestChangeAgeMs(repo, entries) {
  let newest = 0;
  for (const e of entries) {
    try {
      newest = Math.max(newest, fs.statSync(path.join(repo, e.path)).mtimeMs);
    } catch {
      /* deleted file: nothing to wait for */
    }
  }
  return newest ? Date.now() - newest : Infinity;
}

export function runCycle(ctx) {
  const { repo, gitDir, stateDir, cfg, log } = ctx;
  const result = { state: 'ok', committed: null, pulled: 0, pushed: 0, detail: '' };

  // 1. Preconditions -------------------------------------------------------
  const pauses = listPauses(stateDir);
  if (pauses.length) {
    result.state = 'paused';
    result.detail = pauses.map((p) => `${p.owner}: ${p.reason}`).join('; ');
    if (ctx.lastState !== 'paused') log('PAUSED', `sync is paused (${result.detail})`, { important: true });
    return result;
  }
  const busy = gitBusy(gitDir);
  if (busy) {
    result.state = 'busy';
    result.detail = `git operation in progress (${busy})`;
    if (ctx.lastState !== 'busy') log('BUSY', `${result.detail}; waiting for it to finish`, { important: true });
    return result;
  }
  const head = git(repo, ['symbolic-ref', '--short', '-q', 'HEAD']);
  if (!head.ok || !head.out) {
    result.state = 'busy';
    result.detail = 'detached HEAD; sync only runs on a branch';
    if (ctx.lastState !== 'busy') log('BUSY', result.detail, { important: true });
    return result;
  }
  const current = head.out;
  if ((cfg.branch && current !== cfg.branch) || cfg.skipBranchPrefixes.some((p) => current.startsWith(p))) {
    result.state = 'busy';
    result.detail = `on branch "${current}", which is not synced`;
    if (ctx.lastState !== 'busy') log('BUSY', result.detail, { important: true });
    return result;
  }
  const upstream = `${cfg.remote}/${current}`;

  // 2. Fetch ---------------------------------------------------------------
  const fetch = git(repo, ['fetch', '--quiet', cfg.remote, `+refs/heads/${current}:refs/remotes/${upstream}`], { timeout: 60_000 });
  let online = fetch.ok;
  let remoteExists = git(repo, ['rev-parse', '--verify', '-q', `refs/remotes/${upstream}`]).ok;
  if (!fetch.ok) {
    if (/couldn't find remote ref|could not find remote ref/i.test(fetch.err)) {
      online = true; // remote is reachable, the branch just does not exist there yet
      remoteExists = false;
    } else if (ctx.lastState !== 'offline') {
      log('OFFLINE', `cannot reach ${cfg.remote}: ${fetch.err.split('\n').pop()}`, { important: true });
    }
  }

  // 3. Commit local changes ------------------------------------------------
  let entries = readStatus(repo);
  if (entries.length) {
    ctx.dirtySince ??= Date.now();
    const age = newestChangeAgeMs(repo, entries);
    const waited = Date.now() - ctx.dirtySince;
    const settled = age >= cfg.debounceSeconds * 1000 || waited >= cfg.maxDebounceWaitSeconds * 1000;
    if (settled) {
      result.committed = commitLocalChanges(ctx, entries);
      entries = readStatus(repo);
      ctx.dirtySince = undefined;
    } else {
      result.detail = 'local edits still in progress';
    }
  } else {
    ctx.dirtySince = undefined;
  }
  const trackedDirty = entries.some((e) => !e.untracked);

  if (!online) {
    result.state = 'offline';
    return result;
  }

  // 4. Integrate remote commits ---------------------------------------------
  let ahead = 0;
  let behind = 0;
  if (remoteExists) {
    const counts = git(repo, ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]);
    if (!counts.ok) throw new Error(`git rev-list failed: ${counts.err}`);
    [ahead, behind] = counts.out.split(/\s+/).map(Number);
  } else {
    ahead = Number(git(repo, ['rev-list', '--count', 'HEAD']).out) || 0;
  }

  if (behind > 0) {
    if (trackedDirty) {
      result.detail = `${behind} remote commit(s) waiting until local edits settle`;
      log('WAIT', result.detail);
      return result;
    }
    const before = git(repo, ['rev-parse', 'HEAD']).out;
    const base = git(repo, ['merge-base', 'HEAD', upstream]).out;
    const incoming = git(repo, ['log', '--format=%h %an: %s', `${base}..${upstream}`]).out.split('\n').filter(Boolean);
    const incomingFiles = git(repo, ['diff', '--name-only', `${base}..${upstream}`]).out.split('\n').filter(Boolean);

    const integrate = ahead === 0 ? git(repo, ['merge', '--ff-only', '--quiet', upstream]) : git(repo, ['rebase', '--quiet', upstream]);

    if (!integrate.ok) {
      const conflicted = git(repo, ['diff', '--name-only', '--diff-filter=U']).out.split('\n').filter(Boolean);
      if (gitBusy(gitDir)) git(repo, ['rebase', '--abort']);
      const after = git(repo, ['rev-parse', 'HEAD']).out;
      if (after !== before) throw new Error(`could not restore HEAD after a failed integration (expected ${before}, got ${after})`);

      result.state = 'conflict';
      const who = slug(git(repo, ['config', 'user.name']).out);
      const backup = `sync-conflict/${who}-${base.slice(0, 8)}`;
      const signature = `${before}:${git(repo, ['rev-parse', upstream]).out}`;
      const reason = conflicted.length ? `both sides changed: ${conflicted.join(', ')}` : integrate.err.split('\n').slice(0, 3).join(' ');
      result.detail = reason;
      if (ctx.lastConflict !== signature) {
        ctx.lastConflict = signature;
        let backupNote = 'Your commits are safe in your local branch.';
        if (ahead > 0) {
          const push = git(repo, ['push', '--quiet', cfg.remote, `HEAD:refs/heads/${backup}`], { timeout: 60_000 });
          backupNote = push.ok
            ? `Your commits are safe locally and backed up on the remote as "${backup}".`
            : `Your commits are safe in your local branch (remote backup failed: ${push.err.split('\n').pop()}).`;
        }
        log('CONFLICT', `cannot combine local and remote changes automatically — ${reason}`, { important: true });
        log('CONFLICT', backupNote, { important: true });
        log('CONFLICT', `To fix: npm run sync:pause, then "git pull --rebase ${cfg.remote} ${current}", resolve, "git rebase --continue", npm run sync:resume.`, { important: true });
        alertUser(ctx, 'Git sync conflict', `${reason}. Sync is waiting for you to resolve it.`);
      }
      return result;
    }

    ctx.lastConflict = undefined;
    result.pulled = incoming.length;
    log('PULL', `${incoming.length} new commit(s) from ${upstream}, ${incomingFiles.length} file(s) changed`, { important: true });
    for (const line of incoming.slice(0, 8)) log('PULL', `  ${line}`, { important: true });
    if (incoming.length > 8) log('PULL', `  ... and ${incoming.length - 8} more`, { important: true });
    alertUser(ctx, `Git sync: ${incoming.length} new commit(s)`, incoming.slice(0, 3).join(' | '));
  }

  // 5. Push ------------------------------------------------------------------
  const toPush = remoteExists ? Number(git(repo, ['rev-list', '--count', `${upstream}..HEAD`]).out) || 0 : ahead;
  if (toPush > 0) {
    const push = git(repo, ['push', '--quiet', cfg.remote, `HEAD:refs/heads/${current}`], { timeout: 120_000 });
    if (push.ok) {
      result.pushed = toPush;
      git(repo, ['update-ref', `refs/remotes/${upstream}`, 'HEAD']);
      log('PUSH', `${toPush} commit(s) to ${upstream}`);
    } else if (/non-fast-forward|fetch first|rejected/i.test(push.err)) {
      result.detail = 'remote moved during push; retrying next cycle';
      log('WAIT', result.detail);
    } else {
      throw new Error(`git push failed: ${push.err.split('\n').slice(-3).join(' ')}`);
    }
  }
  return result;
}

function safeCycle(ctx) {
  let result;
  try {
    result = runCycle(ctx);
  } catch (e) {
    result = { state: 'error', detail: e.message };
    if (ctx.lastError !== e.message) ctx.log('ERROR', e.message, { important: true });
    ctx.lastError = e.message;
  }
  if (result.state !== 'error') ctx.lastError = undefined;
  if (ctx.lastState && ctx.lastState !== result.state && result.state === 'ok') {
    ctx.log('OK', `sync resumed (was ${ctx.lastState})`, { important: true });
  }
  ctx.lastState = result.state;
  writeStatus(ctx, result);
  return result;
}

// ---------------------------------------------------------------- daemon

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function acquireDaemonLock(stateDir) {
  const file = path.join(stateDir, 'daemon.lock');
  try {
    const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (prev.pid && prev.pid !== process.pid && pidAlive(prev.pid)) return null;
  } catch {
    /* no lock, or stale/corrupt lock */
  }
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  return file;
}

async function runLoop(ctx) {
  const lock = acquireDaemonLock(ctx.stateDir);
  if (!lock) {
    console.error('Another sync daemon is already running for this repository. Use "npm run sync:status".');
    process.exit(1);
  }
  let stopping = false;
  let wake = () => {};
  const stop = () => {
    stopping = true;
    wake();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  ctx.log('START', `syncing ${ctx.repo} with ${ctx.cfg.remote} every ${ctx.cfg.intervalSeconds}s (debounce ${ctx.cfg.debounceSeconds}s). Ctrl+C to stop.`, { important: true });
  try {
    while (!stopping) {
      safeCycle(ctx);
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, ctx.cfg.intervalSeconds * 1000);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
  } finally {
    fs.rmSync(lock, { force: true });
    ctx.log('STOP', 'sync daemon stopped', { important: true });
  }
}

// ---------------------------------------------------------------- CLI

function printStatus(ctx) {
  const { repo, stateDir, cfg } = ctx;
  const branch = git(repo, ['symbolic-ref', '--short', '-q', 'HEAD']).out || '(detached)';
  const upstream = `${cfg.remote}/${branch}`;
  const counts = git(repo, ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]);
  const [ahead, behind] = counts.ok ? counts.out.split(/\s+/) : ['?', '?'];
  const dirty = readStatus(repo).length;
  console.log(`repository : ${repo}`);
  console.log(`branch     : ${branch} -> ${upstream} (ahead ${ahead}, behind ${behind} as of last fetch)`);
  console.log(`local edits: ${dirty} uncommitted path(s)`);
  let daemon = 'not running';
  try {
    const d = JSON.parse(fs.readFileSync(path.join(stateDir, 'daemon.lock'), 'utf8'));
    if (pidAlive(d.pid)) daemon = `running (pid ${d.pid}, since ${d.at})`;
  } catch {
    /* none */
  }
  console.log(`daemon     : ${daemon}`);
  const pauses = listPauses(stateDir);
  if (pauses.length === 0) console.log('pauses     : none');
  for (const p of pauses) {
    const mins = p.at ? Math.round((Date.now() - Date.parse(p.at)) / 60000) : '?';
    console.log(`pause      : held by "${p.owner}" for ${mins} min — ${p.reason}`);
  }
  try {
    const last = JSON.parse(fs.readFileSync(path.join(stateDir, 'status.json'), 'utf8'));
    console.log(`last cycle : ${last.state}${last.detail ? ` — ${last.detail}` : ''} (${last.at})`);
  } catch {
    console.log('last cycle : none recorded');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*\n?/, '').replace(/^ \* ?/gm, ''));
    return;
  }
  const cfg = loadConfig(args);
  const info = resolveRepo(args.repo ? path.resolve(args.repo) : process.cwd());
  const ctx = { ...info, cfg };
  ctx.log = makeLogger(ctx);
  const command = args._[0] || 'run';

  if (command === 'pause') {
    const p = acquirePause(ctx.stateDir, { owner: args.owner, reason: args.reason || args._.slice(1).join(' ') });
    console.log(`Sync paused by "${p.owner}": ${p.reason}`);
  } else if (command === 'resume') {
    const released = releasePause(ctx.stateDir, { owner: args.owner, all: Boolean(args.all) });
    const left = listPauses(ctx.stateDir);
    console.log(released.length ? `Released pause: ${released.join(', ')}` : 'No matching pause was held.');
    if (left.length) console.log(`Still paused by: ${left.map((p) => p.owner).join(', ')} (use --all to release everything)`);
  } else if (command === 'status') {
    printStatus(ctx);
  } else if (command === 'run') {
    if (args.once) {
      const r = safeCycle(ctx);
      const code = { ok: 0, offline: 1, error: 1, conflict: 2, paused: 3, busy: 3 }[r.state] ?? 1;
      if (r.state === 'ok' && !r.committed && !r.pulled && !r.pushed) ctx.log('OK', r.detail || 'already in sync');
      process.exitCode = code;
    } else {
      await runLoop(ctx);
    }
  } else {
    console.error(`Unknown command "${command}". Try --help.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`sync: ${e.message}`);
    process.exit(1);
  });
}
