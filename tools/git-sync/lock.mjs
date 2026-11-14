/**
 * Locks for the Git sync service.
 *
 * Pause locks — any agent or human can hold a named pause; the sync service does nothing
 * while at least one is held:
 *     <git-common-dir>/colony-sync/pause.d/<owner>.json
 *
 * Cycle lock — held for the duration of one sync cycle, by the daemon or by `--once`:
 *     <git-common-dir>/colony-sync/cycle.lock
 *
 * Acquiring a pause is a barrier: it publishes the pause, then waits for any cycle that is
 * already running to finish. When it returns, no sync operation is in flight.
 *
 * Everything lives inside the Git directory, so it is never tracked or synced.
 * Used by tools/git-sync/sync.mjs and tools/codex/delegate.mjs.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Resolve the repo root and the untracked state directory, from any directory in the repo. */
export function resolveRepo(start = process.cwd()) {
  const run = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  const top = run(start, ['rev-parse', '--show-toplevel']);
  if (top.status !== 0) throw new Error(`Not inside a Git repository: ${start}`);
  const repo = path.resolve(top.stdout.trim());
  // rev-parse prints these relative to its own working directory, so ask from the root.
  const gitDir = path.resolve(repo, run(repo, ['rev-parse', '--git-dir']).stdout.trim());
  const commonDir = path.resolve(repo, run(repo, ['rev-parse', '--git-common-dir']).stdout.trim());
  const stateDir = path.join(commonDir, 'colony-sync');
  fs.mkdirSync(path.join(stateDir, 'pause.d'), { recursive: true });
  return { repo, gitDir, commonDir, stateDir };
}

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ---------------------------------------------------------------- exclusive file locks

/**
 * Take an exclusive lock file atomically (O_EXCL). A lock whose owning process is gone is
 * stale and is replaced. Returns true when this process now owns the lock.
 */
export function acquireFileLock(file) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      fs.closeSync(fd);
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const holder = readLock(file);
    if (holder.exists && !holder.stale) return false;
    try {
      fs.rmSync(file, { force: true });
    } catch {
      return false;
    }
  }
  return false;
}

/** Describe a lock file: whether it exists, who holds it, and whether the holder is gone. */
export function readLock(file) {
  let text;
  let ageMs = 0;
  try {
    text = fs.readFileSync(file, 'utf8');
    ageMs = Date.now() - fs.statSync(file).mtimeMs;
  } catch (e) {
    return { exists: e.code !== 'ENOENT', stale: false, pid: null };
  }
  try {
    const data = JSON.parse(text);
    return { exists: true, pid: data.pid, at: data.at, stale: !pidAlive(data.pid) };
  } catch {
    // Being written right now, or corrupt. Only call it stale once it is clearly abandoned.
    return { exists: true, pid: null, stale: ageMs > 10_000 };
  }
}

/** Release a lock file, but only if this process owns it. */
export function releaseFileLock(file) {
  const holder = readLock(file);
  if (holder.exists && holder.pid === process.pid) fs.rmSync(file, { force: true });
}

export const cycleLockPath = (stateDir) => path.join(stateDir, 'cycle.lock');

// ---------------------------------------------------------------- pause locks

function ownerFile(stateDir, owner) {
  const safe = String(owner || 'manual').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60) || 'manual';
  return path.join(stateDir, 'pause.d', `${safe}.json`);
}

/**
 * List every pause currently held. Fails closed: if the pause directory cannot be read for
 * any reason other than "it does not exist", that counts as a pause.
 */
export function listPauses(stateDir) {
  const dir = path.join(stateDir, 'pause.d');
  let names;
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    return [{ owner: '(unknown)', reason: `pause directory unreadable (${e.code}); refusing to sync`, at: null }];
  }
  return names.map((name) => {
    const owner = name.replace(/\.json$/, '');
    try {
      return { owner, ...JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) };
    } catch {
      return { owner, reason: '(unreadable lock file)', at: null };
    }
  });
}

/**
 * Hold a pause and wait for any running sync cycle to finish.
 * Returns { owner, reason, at, settled }. `settled` is false if a cycle was still running
 * after waitSeconds — the pause is held, but the caller must not assume the tree is quiet yet.
 */
export function acquirePause(stateDir, { owner = 'manual', reason = '', waitSeconds = 180 } = {}) {
  const file = ownerFile(stateDir, owner);
  const data = { reason: reason || 'no reason given', at: new Date().toISOString(), pid: process.pid };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

  const lock = cycleLockPath(stateDir);
  const deadline = Date.now() + waitSeconds * 1000;
  let settled = false;
  for (;;) {
    const holder = readLock(lock);
    if (!holder.exists || holder.stale || holder.pid === process.pid) {
      settled = true;
      break;
    }
    if (Date.now() >= deadline) break;
    sleepSync(100);
  }
  return { owner: path.basename(file, '.json'), ...data, settled };
}

/** Release one owner's pause, or every pause when `all` is set. Returns owners released. */
export function releasePause(stateDir, { owner = 'manual', all = false } = {}) {
  const released = [];
  if (all) {
    for (const p of listPauses(stateDir)) {
      fs.rmSync(ownerFile(stateDir, p.owner), { force: true });
      released.push(p.owner);
    }
    return released;
  }
  const file = ownerFile(stateDir, owner);
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true });
    released.push(path.basename(file, '.json'));
  }
  return released;
}
