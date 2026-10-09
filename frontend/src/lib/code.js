/*
 * Which build of the client is this? (docs/DESIGN.md §10.) The build lists every file with its
 * SHA-256 in bundle.json, and one digest over that list names the build. The release signs that
 * digest into a public log, so "the code GhostChat published" is something anyone can look up.
 *
 * This module checks what the server sent *this browser* against that list. It can't be the last
 * word: it is itself part of what the server sent. It makes a careless or partial change visible,
 * and gives the digest to compare with the public record from outside the page.
 */

const hex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (bytes) => hex(await crypto.subtle.digest('SHA-256', bytes));

/** The digest over a file list, as the build computes it: "hash  name" per line, sorted by name. */
export async function bundleDigest(files) {
  const names = Object.keys(files).sort((a, b) => (a < b ? -1 : 1));
  return sha256(new TextEncoder().encode(names.map((name) => `${files[name]}  ${name}\n`).join('')));
}

/**
 * Fetches every file the manifest lists, fresh from the server, and compares. Returns the digest
 * the manifest claims, whether the list really hashes to it, and the files that differ.
 */
export async function checkBundle(fetchFile = (name) => fetch(`/${name}`, { cache: 'no-store' })) {
  const manifest = await (await fetchFile('bundle.json')).json();
  const names = Object.keys(manifest.files);
  const changed = (await Promise.all(names.map(async (name) => {
    const res = await fetchFile(name);
    return res.ok && (await sha256(await res.arrayBuffer())) === manifest.files[name] ? null : name;
  }))).filter(Boolean);
  return {
    digest: manifest.digest,
    files: names.length,
    listMatchesDigest: (await bundleDigest(manifest.files)) === manifest.digest,
    changed,
  };
}
