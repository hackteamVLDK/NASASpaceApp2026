#!/usr/bin/env node
/**
 * Static file server for local play: npm run dev, then open http://localhost:5173
 * No dependencies. Serves the repository root; assets/incoming is served as is.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 5173;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname));
    while (path.startsWith('/') || path.startsWith(sep)) path = path.slice(1);
    if (path === '' || path.endsWith('/') || path.endsWith(sep)) path += 'index.html';
    const file = join(root, path);
    if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
    if ((await stat(file)).isDirectory()) { res.writeHead(302, { Location: `/${path}/` }).end(); return; }
    res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  }
}).listen(port, () => console.log(`Ares-1 running at http://localhost:${port}`));
