import { describe, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { bundleDigest, checkBundle } from './code';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const contents = { 'index.html': '<html></html>', 'assets/app.js': 'console.log(1)', 'assets/app.css': 'body{}' };
const files = Object.fromEntries(Object.entries(contents).map(([name, text]) => [name, sha(text)]));
// What `sha256sum` would print for these files, sorted by name: the build script's own format.
const listing = Object.keys(files).sort().map((name) => `${files[name]}  ${name}\n`).join('');

const server = (served, manifest) => async (name) => {
  if (name === 'bundle.json') return { ok: true, json: async () => manifest };
  const text = served[name];
  return text === undefined ? { ok: false } : { ok: true, arrayBuffer: async () => new TextEncoder().encode(text).buffer };
};

describe('which build is this', () => {
  test('the digest is the hash of the sorted file list, whatever order the list arrives in', async () => {
    expect(await bundleDigest(files)).toBe(sha(listing));
    const reversed = Object.fromEntries(Object.entries(files).reverse());
    expect(await bundleDigest(reversed)).toBe(sha(listing));
  });

  test('files as published match', async () => {
    const result = await checkBundle(server(contents, { v: 1, digest: sha(listing), files }));
    expect(result).toEqual({ digest: sha(listing), files: 3, listMatchesDigest: true, changed: [] });
  });

  test('a file the server changed, or stopped serving, is named', async () => {
    const tampered = { ...contents, 'assets/app.js': 'console.log(1);sendKeysSomewhere()' };
    expect((await checkBundle(server(tampered, { v: 1, digest: sha(listing), files }))).changed).toEqual(['assets/app.js']);
    const { 'assets/app.css': _gone, ...partial } = contents;
    expect((await checkBundle(server(partial, { v: 1, digest: sha(listing), files }))).changed).toEqual(['assets/app.css']);
  });

  test('a list edited to match changed files no longer hashes to the published digest', async () => {
    const tampered = { ...contents, 'assets/app.js': 'evil()' };
    const edited = { ...files, 'assets/app.js': sha('evil()') };
    const result = await checkBundle(server(tampered, { v: 1, digest: sha(listing), files: edited }));
    expect(result.changed).toEqual([]); // the files agree with the list...
    expect(result.listMatchesDigest).toBe(false); // ...but the list isn't the one that was published
  });
});
