#!/usr/bin/env node
/**
 * Two-way Git synchronisation service (zero dependencies, plain Git underneath).
 *
 *   node tools/git-sync/sync.mjs              run forever, one cycle every intervalSeconds
 *   node tools/git-sync/sync.mjs --once       run a single cycle and exit
 *   node tools/git-sync/sync.mjs pause  [--owner NAME] [--reason TEXT] [--wait SEC]
 *   node tools/git-sync/sync.mjs resume [--owner NAME | --all]
 *   node tools/git-sync/sync.mjs status
 *
 * Options: --repo DIR  --interval SEC  --debounce SEC  --branch NAME  --remote NAME
 *          --no-desktop  --quiet
 *
 * One cycle (holding the cycle lock, so the daemon and --once never overlap):
 *   1. Stand back if paused, or if manual Git work is in progress (rebase, merge,
 *      conflict resolution, partially staged files).
 *   2. Fetch the remote branch.
 *   3. Commit local changes once they have been quiet for debounceSeconds.
 *      Secret-looking files are never staged.
 *   4. Integrate remote commits WITHOUT rebasing and without ever resetting the working tree:
 *        - only remote changed: fast-forward;
 *        - both changed: the merge is computed off to the side with `git merge-tree`.
 *          Clean  -> a merge commit is created and the working tree is fast-forwarded to it.
 *          Conflict -> nothing is touched; local commits are backed up to a
 *                      sync-conflict/* branch on the remote and the user is told what to do.
 *      A fast-forward refuses up front if it would overwrite a file with unsaved-to-Git
 *      local edits or an ignored/untracked local file, so local work is never overwritten.
 *   5. Push (never forced), after checking outgoing commits for secret-looking files.
 *
 * Exit codes for --once: 0 ok, 1 error/offline, 2 conflict or blocked, 3 paused or busy.
 * Requires Git 2.38 or newer. See docs/GIT_SYNC.md.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRepo, listPauses, acquirePause, releasePause, acquireFileLock, releaseFileLock, readLock, cycleLockPath } from './lock.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const DEFAULTS = {
  remote: 'origin',
  branch: '',
  intervalSeconds: 15,
  debounceSeconds: 4,
  maxDebounceWaitSeconds: 60,
  maxFileSizeMB: 50,
  commitPrefix: 'sync',
  // Matched against the file NAME only (not the directory), case-insensitively.
  blockedPatterns: ['.env', '.env.*', '*.pem', '*.key', '*.pfx', '*.p12', 'id_rsa*', 'id_ed25519*', 'auth.json', '*.token'],
  skipBranchPrefixes: ['codex/', 'sync-conflict/'],
  notify: { bell: true, desktop: true },
};

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const args = { _: [] };
  const flags = new Set(['once', 'quiet', 'no-desktop', 'all', 'help']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) args._.push(a);
    else if (flags.has(a.slice(2))) args[a.slice(2)] = true;
    else args[a.slice(2)] = argv[++i];
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
  const res = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
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
  };
}

const lastLine = (text) => text.split('\n').filter(Boolean).pop() || '';
const splitZ = (text) => text.split('\0').filter((s) => s !== '');

function gitVersionOk(repo) {
  const m = git(repo, ['version']).out.match(/(\d+)\.(\d+)/);
  return m ? Number(m[1]) > 2 || (Number(m[1]) === 2 && Number(m[2]) >= 38) : false;
}

const BUSY_MARKERS = ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG', 'index.lock'];

function gitBusy(gitDir) {
  return BUSY_MARKERS.find((m) => fs.existsSync(path.join(gitDir, m))) || null;
}

/** Parse `git status --porcelain=v1 -z`. Rename/copy records carry a second path field. */
export function parseStatus(z) {
  const parts = z.split('\0');
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i];
    if (!rec || rec.length < 4) continue;
    const x = rec[0];
    const y = rec[1];
    const entry = { x, y, path: rec.slice(3), untracked: x === '?' && y === '?' };
    if ('RC'.includes(x) || 'RC'.includes(y)) entry.orig = parts[++i];
    entries.push(entry);
  }
  return entries;
}

function readStatus(repo) {
  const res = git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  if (!res.ok) throw new Error(`git status failed: ${res.err}`);
  return parseStatus(res.out);
}

function globToRegExp(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${esc}$`, 'i');
}

function slug(text, fallback = 'user') {
  const s = String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  return s || fallback;
}

/** Random id for this clone, so backup branches from two devices never collide. */
function deviceId(stateDir) {
  const file = path.join(stateDir, 'device-id');
  try {
    const id = fs.readFileSync(file, 'utf8').trim();
    if (/^[0-9a-f]{6}$/.test(id)) return id;
  } catch {
    /* first run */
  }
  const id = crypto.randomBytes(3).toString('hex');
  fs.writeFileSync(file, id);
  return id;
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
  const parts = splitZ(res.out);
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i][0];
    if (status === 'R' || status === 'C') {
      i += 2;
      files.push({ status, path: parts[i] });
    } else {
      i += 1;
      files.push({ status, path: parts[i] });
    }
  }
  return files;
}

export function buildCommitMessage(prefix, files) {
  const verbs = { A: 'add', M: 'update', D: 'remove', R: 'rename', C: 'copy', T: 'update' };
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
  const what = ['add', 'update', 'remove', 'rename', 'copy'].filter((v) => counts[v]).map((v) => `${v} ${counts[v]}`).join(', ');
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

/** Log a message only when it differs from the last one logged under the same key. */
function logOnce(ctx, key, tag, message) {
  ctx.said ??= {};
  if (ctx.said[key] === message) return;
  ctx.said[key] = message;
  ctx.log(tag, message, { important: true });
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

// ---------------------------------------------------------------- committing

function commitLocalChanges(ctx, entries) {
  const { repo, cfg, log, isSecret } = ctx;
  const maxBytes = cfg.maxFileSizeMB * 1024 * 1024;
  const blocked = [];
  const stage = [];
  for (const e of entries) {
    if (isSecret(e.path)) {
      blocked.push({ path: e.path, why: e.untracked ? 'matches a secret-file pattern' : 'tracked file matches a secret-file pattern; its changes are not synced' });
      continue;
    }
    if (e.untracked) {
      let size;
      try {
        size = fs.statSync(path.join(repo, e.path)).size;
      } catch {
        continue; // vanished since the status scan
      }
      if (size > maxBytes) {
        blocked.push({ path: e.path, why: `larger than ${cfg.maxFileSizeMB} MB` });
        continue;
      }
    }
    stage.push(e.path);
    if (e.orig) stage.push(e.orig);
  }
  logOnce(ctx, 'blocked', 'SKIP', blocked.length ? `not syncing: ${blocked.map((b) => `${b.path} (${b.why})`).join('; ')}` : '');
  if (stage.length === 0) return null;

  // Stage exactly the paths that were scanned — nothing that appeared afterwards.
  const add = git(repo, ['--literal-pathspecs', 'add', '-A', '--pathspec-from-file=-', '--pathspec-file-nul'], { input: stage.join('\0') });
  if (!add.ok) throw new Error(`git add failed: ${lastLine(add.err)}`);

  // Safety net: a secret that someone staged by hand must not ride along.
  let staged = readStaged(repo);
  const stagedSecrets = staged.filter((f) => isSecret(f.path)).map((f) => f.path);
  if (stagedSecrets.length) {
    git(repo, ['--literal-pathspecs', 'reset', '-q', '--', ...stagedSecrets]);
    log('SKIP', `unstaged secret-looking file(s): ${stagedSecrets.join(', ')}`, { important: true });
    staged = readStaged(repo);
  }
  if (staged.length === 0) return null;

  const { subject, body } = buildCommitMessage(cfg.commitPrefix, staged);
  const commitArgs = ['commit', '-q', '-m', subject];
  if (body) commitArgs.push('-m', body);
  const commit = git(repo, commitArgs);
  if (!commit.ok) {
    git(repo, ['reset', '-q']); // put the index back; the working tree is untouched
    throw new Error(`git commit failed: ${lastLine(commit.err || commit.out)}`);
  }
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

/** Secret-looking files touched by commits that are about to be pushed. */
function outgoingSecrets(ctx, upstream, remoteExists) {
  const res = remoteExists
    ? git(ctx.repo, ['log', '--format=', '--name-only', '-z', '--diff-filter=AMR', `${upstream}..HEAD`])
    : git(ctx.repo, ['ls-tree', '-r', '--name-only', '-z', 'HEAD']);
  return [...new Set(splitZ(res.out).map((s) => s.replace(/^\n+/, '')).filter(Boolean).filter(ctx.isSecret))];
}

// ---------------------------------------------------------------- integrating

/**
 * Bring remote commits into the working tree. Never rebases, never resets.
 * Returns { state: 'ok' | 'wait' | 'blocked' | 'conflict', ... }.
 */
function integrateRemote(ctx, { upstream, ahead, behind, current }) {
  const { repo, cfg, log } = ctx;
  const headOid = git(repo, ['rev-parse', 'HEAD']).out;
  const upstreamOid = git(repo, ['rev-parse', upstream]).out;
  const base = git(repo, ['merge-base', headOid, upstreamOid]).out;
  if (!base) throw new Error(`local branch and ${upstream} share no history; refusing to combine them`);
  const incoming = git(repo, ['log', '--format=%h %an: %s', `${base}..${upstreamOid}`]).out.split('\n').filter(Boolean);
  const incomingFiles = splitZ(git(repo, ['diff', '--name-only', '-z', base, upstreamOid]).out);

  let target = upstreamOid;
  if (ahead > 0) {
    // Compute the merge off to the side. The working tree and index are not touched.
    const mt = git(repo, ['merge-tree', '--write-tree', '--name-only', headOid, upstreamOid]);
    if (mt.code === 1) {
      const lines = mt.out.split('\n');
      const end = lines.indexOf('', 1);
      const files = [...new Set(lines.slice(1, end === -1 ? undefined : end))];
      return { state: 'conflict', files, headOid, upstreamOid, base, ahead };
    }
    if (mt.code !== 0) throw new Error(`git merge-tree failed: ${lastLine(mt.err || mt.out)}`);
    const tree = mt.out.split('\n')[0];
    const message = `${cfg.commitPrefix}: merge ${behind} remote commit${behind === 1 ? '' : 's'} from ${upstream}`;
    const made = git(repo, ['commit-tree', tree, '-p', headOid, '-p', upstreamOid, '-m', message]);
    if (!made.ok) throw new Error(`git commit-tree failed: ${lastLine(made.err)}`);
    target = made.out;
  }

  // Fast-forward only. Git checks first and changes nothing if any local file — edited,
  // untracked or ignored — would be overwritten.
  const ff = git(repo, ['merge', '--ff-only', '--no-overwrite-ignore', '--quiet', target]);
  if (!ff.ok) {
    const text = `${ff.err}\n${ff.out}`;
    if (/local changes to the following files would be overwritten/i.test(text)) {
      return { state: 'wait', detail: `${behind} remote commit(s) touch files you are still editing; will retry once your edits are committed` };
    }
    if (/would be overwritten|would be removed/i.test(text)) {
      const names = text.split('\n').filter((l) => /^\t/.test(l)).map((l) => l.trim());
      return { state: 'blocked', detail: `incoming files already exist here as untracked or ignored files: ${names.join(', ') || '(see git output)'}. Move or delete your local copies.` };
    }
    throw new Error(`could not fast-forward: ${lastLine(ff.err || ff.out)}`);
  }

  log('PULL', `${incoming.length} new commit(s) from ${upstream}, ${incomingFiles.length} file(s) changed`, { important: true });
  for (const line of incoming.slice(0, 8)) log('PULL', `  ${line}`, { important: true });
  if (incoming.length > 8) log('PULL', `  ... and ${incoming.length - 8} more`, { important: true });
  // Team convention: each device's agent reports its work in a root file git_status_<Name>.
  for (const f of incomingFiles.filter((p) => /^git_status_[^/]+$/.test(p))) {
    log('TEAM', `${f} was updated — read it to see what that agent is working on`, { important: true });
  }
  alertUser(ctx, `Git sync: ${incoming.length} new commit(s)`, incoming.slice(0, 3).join(' | '));
  return { state: 'ok', pulled: incoming.length, current };
}

function handleConflict(ctx, c, { upstream, current, remoteExists }) {
  const { repo, cfg, stateDir, log } = ctx;
  const signature = `${c.headOid}:${c.upstreamOid}`;
  const reason = `both sides changed: ${c.files.join(', ') || '(unknown files)'}`;

  // Back up local commits so they are not stranded on this device. Retried until it works.
  let backupNote = 'Your commits are safe in your local branch.';
  if (c.ahead > 0 && ctx.backedUp !== signature) {
    const secrets = outgoingSecrets(ctx, upstream, remoteExists);
    if (secrets.length) {
      backupNote = `Remote backup skipped: outgoing commits contain secret-looking files (${secrets.join(', ')}).`;
    } else {
      const who = `${slug(git(repo, ['config', 'user.name']).out)}-${deviceId(stateDir)}`;
      const names = [`sync-conflict/${who}-${c.base.slice(0, 8)}`, `sync-conflict/${who}-${c.base.slice(0, 8)}-${c.headOid.slice(0, 8)}`];
      for (const name of names) {
        const push = git(repo, ['push', '--quiet', cfg.remote, `${c.headOid}:refs/heads/${name}`], { timeout: 60_000 });
        if (push.ok) {
          ctx.backedUp = signature;
          backupNote = `Your commits are safe locally and backed up on the remote as "${name}".`;
          break;
        }
        backupNote = `Your commits are safe in your local branch (remote backup failed: ${lastLine(push.err)}; will retry).`;
      }
    }
  }
  if (ctx.lastConflict !== signature) {
    ctx.lastConflict = signature;
    log('CONFLICT', `cannot combine local and remote changes automatically — ${reason}`, { important: true });
    log('CONFLICT', backupNote, { important: true });
    log('CONFLICT', `To fix: "npm run sync:pause", then "git pull ${cfg.remote} ${current}", resolve the files, "git commit", "npm run sync:resume".`, { important: true });
    alertUser(ctx, 'Git sync conflict', `${reason}. Sync is waiting for you to resolve it.`);
  }
  return reason;
}

// ---------------------------------------------------------------- one cycle

function pausedResult(ctx) {
  const pauses = listPauses(ctx.stateDir);
  if (pauses.length === 0) return null;
  const detail = pauses.map((p) => `${p.owner}: ${p.reason}`).join('; ');
  logOnce(ctx, 'state', 'PAUSED', `sync is paused (${detail})`);
  return { state: 'paused', detail };
}

function busyResult(ctx, detail) {
  logOnce(ctx, 'state', 'BUSY', detail);
  return { state: 'busy', detail };
}

export function runCycle(ctx) {
  const { repo, gitDir, cfg, log } = ctx;
  const result = { state: 'ok', committed: null, pulled: 0, pushed: 0, detail: '' };

  // 1. Preconditions -------------------------------------------------------
  let stop = pausedResult(ctx);
  if (stop) return stop;
  const marker = gitBusy(gitDir);
  if (marker) return busyResult(ctx, `manual Git operation in progress (${marker}); waiting for it to finish`);
  const head = git(repo, ['symbolic-ref', '--short', '-q', 'HEAD']);
  if (!head.ok || !head.out) return busyResult(ctx, 'detached HEAD; sync only runs on a branch');
  const current = head.out;
  if ((cfg.branch && current !== cfg.branch) || cfg.skipBranchPrefixes.some((p) => current.startsWith(p))) {
    return busyResult(ctx, `on branch "${current}", which is not synced`);
  }
  if (fs.existsSync(path.join(repo, '.gitmodules'))) logOnce(ctx, 'submodules', 'WARN', 'this repository has submodules; the sync service does not manage them');
  const upstream = `${cfg.remote}/${current}`;

  // 2. Fetch ---------------------------------------------------------------
  const fetch = git(repo, ['fetch', '--quiet', cfg.remote, `+refs/heads/${current}:refs/remotes/${upstream}`], { timeout: 60_000 });
  let online = fetch.ok;
  let remoteExists = git(repo, ['rev-parse', '--verify', '-q', `refs/remotes/${upstream}`]).ok;
  if (!fetch.ok) {
    if (/couldn't find remote ref|could not find remote ref/i.test(fetch.err)) {
      online = true; // the remote is reachable; the branch just does not exist there yet
      remoteExists = false;
    } else {
      logOnce(ctx, 'state', 'OFFLINE', `cannot reach ${cfg.remote}: ${lastLine(fetch.err)}`);
    }
  }

  // 3. Commit local changes ------------------------------------------------
  stop = pausedResult(ctx);
  if (stop) return stop;
  const entries = readStatus(repo);
  const handStaged = entries.filter((e) => !e.untracked && e.x !== ' ' && e.y !== ' ');
  if (handStaged.length) {
    return busyResult(ctx, `partially staged or unmerged files (${handStaged.map((e) => e.path).slice(0, 5).join(', ')}): finish your manual commit, or run "git add -A", and sync continues`);
  }
  if (entries.length) {
    ctx.dirtySince ??= Date.now();
    const age = newestChangeAgeMs(repo, entries);
    const waited = Date.now() - ctx.dirtySince;
    if (age >= cfg.debounceSeconds * 1000 || waited >= cfg.maxDebounceWaitSeconds * 1000) {
      result.committed = commitLocalChanges(ctx, entries);
      ctx.dirtySince = undefined;
    } else {
      result.detail = 'local edits still in progress';
    }
  } else {
    ctx.dirtySince = undefined;
  }

  if (!online) {
    result.state = 'offline';
    return result;
  }

  // 4. Integrate remote commits ---------------------------------------------
  let ahead = 0;
  let behind = 0;
  if (remoteExists) {
    const counts = git(repo, ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]);
    if (!counts.ok) throw new Error(`git rev-list failed: ${lastLine(counts.err)}`);
    [ahead, behind] = counts.out.split(/\s+/).map(Number);
  }
  if (behind > 0) {
    stop = pausedResult(ctx);
    if (stop) return stop;
    const merged = integrateRemote(ctx, { upstream, ahead, behind, current });
    if (merged.state === 'conflict') {
      result.state = 'conflict';
      result.detail = handleConflict(ctx, merged, { upstream, current, remoteExists });
      return result;
    }
    if (merged.state === 'wait') {
      result.detail = merged.detail;
      logOnce(ctx, 'wait', 'WAIT', merged.detail);
      return result;
    }
    if (merged.state === 'blocked') {
      result.state = 'blocked';
      result.detail = merged.detail;
      logOnce(ctx, 'state', 'BLOCKED', merged.detail);
      return result;
    }
    result.pulled = merged.pulled;
    ctx.lastConflict = undefined;
    ctx.backedUp = undefined;
  }

  // 5. Push ------------------------------------------------------------------
  const oid = git(repo, ['rev-parse', 'HEAD']).out;
  const toPush = remoteExists ? Number(git(repo, ['rev-list', '--count', `${upstream}..${oid}`]).out) || 0 : Number(git(repo, ['rev-list', '--count', oid]).out) || 0;
  if (toPush > 0) {
    stop = pausedResult(ctx);
    if (stop) return stop;
    const secrets = outgoingSecrets(ctx, upstream, remoteExists);
    if (secrets.length) {
      result.state = 'blocked';
      result.detail = `not pushing: local commits contain secret-looking files (${secrets.join(', ')}). Remove them from those commits, then sync continues.`;
      logOnce(ctx, 'state', 'BLOCKED', result.detail);
      return result;
    }
    const push = git(repo, ['push', '--quiet', cfg.remote, `${oid}:refs/heads/${current}`], { timeout: 120_000 });
    if (push.ok) {
      result.pushed = toPush;
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

/** Run one cycle under the cycle lock, turning exceptions into an 'error' result. */
function safeCycle(ctx) {
  const lock = cycleLockPath(ctx.stateDir);
  let result;
  if (!acquireFileLock(lock)) {
    result = busyResult(ctx, 'another sync cycle is running for this repository');
  } else {
    try {
      result = runCycle(ctx);
    } catch (e) {
      result = { state: 'error', detail: e.message };
      logOnce(ctx, 'state', 'ERROR', e.message);
    } finally {
      releaseFileLock(lock);
    }
  }
  if (result.state === 'ok') {
    if (ctx.lastState && ctx.lastState !== 'ok') ctx.log('OK', `sync resumed (was ${ctx.lastState})`, { important: true });
    if (ctx.said) ctx.said.state = undefined;
  }
  ctx.lastState = result.state;
  writeStatus(ctx, result);
  return result;
}

// ---------------------------------------------------------------- daemon

async function runLoop(ctx) {
  const lock = path.join(ctx.stateDir, 'daemon.lock');
  if (!acquireFileLock(lock)) {
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
    releaseFileLock(lock);
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
  console.log(`repository : ${repo}`);
  console.log(`branch     : ${branch} -> ${upstream} (ahead ${ahead}, behind ${behind} as of last fetch)`);
  console.log(`local edits: ${readStatus(repo).length} uncommitted path(s)`);
  const daemon = readLock(path.join(stateDir, 'daemon.lock'));
  console.log(`daemon     : ${daemon.exists && !daemon.stale ? `running (pid ${daemon.pid}, since ${daemon.at})` : 'not running'}`);
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
  const blockedRe = cfg.blockedPatterns.map(globToRegExp);
  ctx.isSecret = (p) => blockedRe.some((re) => re.test(path.posix.basename(p)));
  const command = args._[0] || 'run';

  if (command === 'pause') {
    const p = acquirePause(ctx.stateDir, { owner: args.owner, reason: args.reason || args._.slice(1).join(' '), waitSeconds: args.wait !== undefined ? Number(args.wait) : 180 });
    console.log(`Sync paused by "${p.owner}": ${p.reason}`);
    if (!p.settled) {
      console.log('WARNING: a sync cycle is still running. The pause is held, but wait for that cycle to end before editing.');
      process.exitCode = 3;
    }
  } else if (command === 'resume') {
    const released = releasePause(ctx.stateDir, { owner: args.owner, all: Boolean(args.all) });
    const left = listPauses(ctx.stateDir);
    console.log(released.length ? `Released pause: ${released.join(', ')}` : 'No matching pause was held.');
    if (left.length) console.log(`Still paused by: ${left.map((p) => p.owner).join(', ')} (use --all to release everything)`);
  } else if (command === 'status') {
    printStatus(ctx);
  } else if (command === 'run') {
    if (!gitVersionOk(ctx.repo)) throw new Error('Git 2.38 or newer is required (for "git merge-tree --write-tree"). Please update Git.');
    if (args.once) {
      const r = safeCycle(ctx);
      if (r.state === 'ok' && !r.committed && !r.pulled && !r.pushed) ctx.log('OK', r.detail || 'already in sync');
      process.exitCode = { ok: 0, offline: 1, error: 1, conflict: 2, blocked: 2, paused: 3, busy: 3 }[r.state] ?? 1;
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
