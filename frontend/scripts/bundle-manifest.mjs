// Writes dist/bundle.json: every file of the built client with its SHA-256, and one digest over
// the whole list. The digest names this exact build. The release signs it into a public log, and
// anyone can recompute it from the source or from what their browser was sent (docs/DESIGN.md §10).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const MANIFEST = 'bundle.json';
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const files = Object.fromEntries(walk(dist)
  .map((path) => [relative(dist, path).split(sep).join('/'), path])
  .filter(([name]) => name !== MANIFEST)
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([name, path]) => [name, sha256(readFileSync(path))]));

// One line per file, "hash  name", the format `sha256sum` prints and checks.
const listing = Object.entries(files).map(([name, hash]) => `${hash}  ${name}\n`).join('');
const digest = sha256(listing);
writeFileSync(join(dist, MANIFEST), `${JSON.stringify({ v: 1, digest, files }, null, 2)}\n`);
console.log(`bundle ${digest} (${Object.keys(files).length} files)`);
