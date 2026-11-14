/**
 * Integration tests for the Git sync service.
 * Each test builds a throwaway bare "remote" plus two clones (alice, bob) in the OS temp
 * directory and drives `sync.mjs --once`. The real GitHub remote is never touched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCommitMessage } from '../sync.mjs';

const SYNC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sync.mjs');

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}:\n${r.stderr}`);
  return r.stdout.trim();
}

function sync(repo, ...extra) {
  const r = spawnSync(process.execPath, [SYNC, '--repo', repo, '--no-desktop', '--debounce', '0', ...extra], {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, COLONY_SYNC_NO_DESKTOP: '1' },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function makeWorld(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'colony-sync-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, 'remote.git');
  git(root, 'init', '--bare', '--initial-branch=main', remote);
  const clone = (name) => {
    const dir = path.join(root, name);
    // autocrlf must be off *at clone time*, otherwise a Windows global setting checks files
    // out with CRLF and every clone starts with phantom modifications.
    git(root, 'clone', '--quiet', '-c', 'core.autocrlf=false', remote, dir);
    git(dir, 'config', 'user.name', name);
    git(dir, 'config', 'user.email', `${name}@example.invalid`);
    git(dir, 'config', 'commit.gpgsign', 'false');
    return dir;
  };
  const alice = clone('alice');
  fs.writeFileSync(path.join(alice, 'README.md'), '# test\n');
  git(alice, 'checkout', '-q', '-B', 'main');
  git(alice, 'add', '-A');
  git(alice, 'commit', '-q', '-m', 'initial');
  git(alice, 'push', '-q', 'origin', 'main');
  const bob = clone('bob');
  return { root, remote, alice, bob };
}

const write = (repo, rel, text) => {
  const file = path.join(repo, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const read = (repo, rel) => fs.readFileSync(path.join(repo, rel), 'utf8');
const exists = (repo, rel) => fs.existsSync(path.join(repo, rel));
const remoteFiles = (w) => git(w.remote, 'ls-tree', '-r', '--name-only', 'main').split('\n');

test('local change is committed and pushed; the other clone receives it', (t) => {
  const w = makeWorld(t);
  write(w.alice, 'src/game.js', 'export const a = 1;\n');

  const a = sync(w.alice, '--once');
  assert.equal(a.code, 0, a.out);
  assert.match(a.out, /COMMIT/);
  assert.match(a.out, /PUSH/);
  assert.ok(remoteFiles(w).includes('src/game.js'));
  assert.equal(git(w.alice, 'status', '--porcelain'), '');

  const b = sync(w.bob, '--once');
  assert.equal(b.code, 0, b.out);
  assert.match(b.out, /PULL/);
  assert.equal(read(w.bob, 'src/game.js'), 'export const a = 1;\n');
});

test('both sides changed different files: rebased, pushed, nothing lost', (t) => {
  const w = makeWorld(t);
  write(w.alice, 'a.txt', 'from alice\n');
  write(w.bob, 'b.txt', 'from bob\n');

  assert.equal(sync(w.alice, '--once').code, 0);
  const b = sync(w.bob, '--once');
  assert.equal(b.code, 0, b.out);
  assert.equal(sync(w.alice, '--once').code, 0);

  for (const repo of [w.alice, w.bob]) {
    assert.equal(read(repo, 'a.txt'), 'from alice\n');
    assert.equal(read(repo, 'b.txt'), 'from bob\n');
  }
  assert.equal(git(w.alice, 'rev-parse', 'HEAD'), git(w.bob, 'rev-parse', 'HEAD'));
  // Linear history: no merge commits were created.
  assert.equal(git(w.bob, 'rev-list', '--merges', '--count', 'HEAD'), '0');
});

test('conflicting edits: nothing is overwritten, local work is backed up, exit code 2', (t) => {
  const w = makeWorld(t);
  write(w.alice, 'README.md', '# alice version\n');
  write(w.bob, 'README.md', '# bob version\n');

  assert.equal(sync(w.alice, '--once').code, 0);
  const b = sync(w.bob, '--once');
  assert.equal(b.code, 2, b.out);
  assert.match(b.out, /CONFLICT/);

  // Bob's work is intact and committed locally; no rebase is left half-finished.
  assert.equal(read(w.bob, 'README.md'), '# bob version\n');
  assert.equal(git(w.bob, 'status', '--porcelain'), '');
  assert.ok(!exists(w.bob, '.git/rebase-merge') && !exists(w.bob, '.git/rebase-apply'));
  // Alice's pushed version is still what the remote main holds.
  assert.equal(git(w.remote, 'show', 'main:README.md'), '# alice version');
  // Bob's commit was backed up to a sync-conflict/* branch on the remote.
  const branches = git(w.remote, 'branch', '--list', 'sync-conflict/*');
  assert.match(branches, /sync-conflict\/bob-/);

  // A second cycle stays in conflict without damaging anything.
  assert.equal(sync(w.bob, '--once').code, 2);
  assert.equal(read(w.bob, 'README.md'), '# bob version\n');
});

test('pause lock stops all syncing until released', (t) => {
  const w = makeWorld(t);
  write(w.alice, 'wip.txt', 'half-finished multi-agent work\n');

  assert.equal(sync(w.alice, 'pause', '--owner', 'codex', '--reason', 'integration').code, 0);
  assert.equal(sync(w.alice, 'pause', '--owner', 'main-agent', '--reason', 'editing').code, 0);
  const paused = sync(w.alice, '--once');
  assert.equal(paused.code, 3, paused.out);
  assert.match(paused.out, /PAUSED/);
  assert.equal(git(w.alice, 'status', '--porcelain'), '?? wip.txt');
  assert.ok(!remoteFiles(w).includes('wip.txt'));

  // Releasing one of two holders keeps the pause.
  sync(w.alice, 'resume', '--owner', 'codex');
  assert.equal(sync(w.alice, '--once').code, 3);

  sync(w.alice, 'resume', '--owner', 'main-agent');
  const resumed = sync(w.alice, '--once');
  assert.equal(resumed.code, 0, resumed.out);
  assert.ok(remoteFiles(w).includes('wip.txt'));
});

test('secret-looking files are never committed, everything else is', (t) => {
  const w = makeWorld(t);
  write(w.alice, '.env', 'TOKEN=abc\n');
  write(w.alice, 'keys/server.pem', '-----BEGIN-----\n');
  write(w.alice, 'docs/notes.md', 'hello\n');

  const a = sync(w.alice, '--once');
  assert.equal(a.code, 0, a.out);
  assert.match(a.out, /SKIP/);
  const files = remoteFiles(w);
  assert.ok(files.includes('docs/notes.md'));
  assert.ok(!files.includes('.env'));
  assert.ok(!files.includes('keys/server.pem'));
  assert.ok(exists(w.alice, '.env'), 'the local secret file must be left in place');
});

test('files still being written are not committed until they settle (debounce)', (t) => {
  const w = makeWorld(t);
  write(w.alice, 'fresh.txt', 'just saved\n');
  const waiting = sync(w.alice, '--once', '--debounce', '3600');
  assert.equal(waiting.code, 0, waiting.out);
  assert.equal(git(w.alice, 'status', '--porcelain'), '?? fresh.txt');
  assert.ok(!remoteFiles(w).includes('fresh.txt'));
});

test('remote commits are not pulled over unsettled local edits to tracked files', (t) => {
  const w = makeWorld(t);
  write(w.alice, 'README.md', '# changed by alice\n');
  assert.equal(sync(w.alice, '--once').code, 0);

  write(w.bob, 'README.md', '# bob is typing\n');
  const b = sync(w.bob, '--once', '--debounce', '3600');
  assert.equal(b.code, 0, b.out);
  assert.match(b.out, /WAIT/);
  assert.equal(read(w.bob, 'README.md'), '# bob is typing\n');
});

test('a manual rebase/merge in progress makes the sync stand back', (t) => {
  const w = makeWorld(t);
  write(w.alice, 'x.txt', 'x\n');
  fs.writeFileSync(path.join(w.alice, '.git', 'MERGE_HEAD'), git(w.alice, 'rev-parse', 'HEAD') + '\n');
  const r = sync(w.alice, '--once');
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /BUSY/);
  assert.equal(git(w.alice, 'status', '--porcelain'), '?? x.txt');
});

test('deletions and renames propagate', (t) => {
  const w = makeWorld(t);
  write(w.alice, 'old.txt', 'content that is long enough to be detected as a rename\n');
  assert.equal(sync(w.alice, '--once').code, 0);
  assert.equal(sync(w.bob, '--once').code, 0);

  fs.renameSync(path.join(w.alice, 'old.txt'), path.join(w.alice, 'new.txt'));
  fs.rmSync(path.join(w.alice, 'README.md'));
  assert.equal(sync(w.alice, '--once').code, 0);
  assert.equal(sync(w.bob, '--once').code, 0);
  assert.ok(exists(w.bob, 'new.txt'));
  assert.ok(!exists(w.bob, 'old.txt'));
  assert.ok(!exists(w.bob, 'README.md'));
});

test('commit messages describe what changed', () => {
  assert.equal(buildCommitMessage('sync', [{ status: 'A', path: 'docs/GIT_SYNC.md' }]).subject, 'sync: add docs/GIT_SYNC.md');
  const many = buildCommitMessage('sync', [
    { status: 'A', path: 'src/sim/radiation.js' },
    { status: 'M', path: 'src/sim/crew.js' },
    { status: 'D', path: 'docs/old.md' },
  ]);
  assert.equal(many.subject, 'sync: add 1, update 1, remove 1 files in src/sim, docs');
  assert.match(many.body, /A {2}src\/sim\/radiation\.js/);
});
