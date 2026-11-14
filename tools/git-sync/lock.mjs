/**
 * Pause locks for the Git sync service.
 *
 * Any agent or human can hold a named pause. The sync daemon does nothing while at
 * least one pause is held. Locks live inside the Git directory (never tracked):
 *
 *   <git-common-dir>/colony-sync/pause.d/<owner>.json
 *
 * Used by: tools/git-sync/sync.mjs (CLI) and tools/codex/delegate.mjs (write tasks).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Resolve repo root and the untracked state directory for a path inside a repo. */
export function resolveRepo(start = process.cwd()) {
  const run = (args) =>
    spawnSync('git', args, { cwd: start, encoding: 'utf8', windowsHide: true });
  const top = run(['rev-parse', '--show-toplevel']);
  if (top.status !== 0) {
    throw new Error(`Not inside a Git repository: ${start}`);
  }
  const repo = path.resolve(top.stdout.trim());
  const gitDir = path.resolve(repo, run(['rev-parse', '--git-dir']).stdout.trim());
  const commonDir = path.resolve(repo, run(['rev-parse', '--git-common-dir']).stdout.trim());
  const stateDir = path.join(commonDir, 'colony-sync');
  fs.mkdirSync(path.join(stateDir, 'pause.d'), { recursive: true });
  return { repo, gitDir, commonDir, stateDir };
}

function ownerFile(stateDir, owner) {
  const safe = String(owner || 'manual').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60) || 'manual';
  return path.join(stateDir, 'pause.d', `${safe}.json`);
}

/** List every pause currently held. */
export function listPauses(stateDir) {
  const dir = path.join(stateDir, 'pause.d');
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      out.push({ owner: name.replace(/\.json$/, ''), ...data });
    } catch {
      // A half-written or corrupt lock still counts as a pause: fail safe.
      out.push({ owner: name.replace(/\.json$/, ''), reason: '(unreadable lock file)', at: null });
    }
  }
  return out;
}

/** Hold a pause. Re-acquiring with the same owner just refreshes it. */
export function acquirePause(stateDir, { owner = 'manual', reason = '' } = {}) {
  const file = ownerFile(stateDir, owner);
  const data = { reason: reason || 'no reason given', at: new Date().toISOString(), pid: process.pid };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return { owner: path.basename(file, '.json'), ...data };
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
