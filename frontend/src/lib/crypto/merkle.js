// RFC 6962 / RFC 9162 verification in the browser; mirrors backend/src/services/merkle.js.
import { canonical, utf8 } from './encoding';

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  parts.forEach((p) => { out.set(p, offset); offset += p.length; });
  return out;
};
const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

export const logLeafHash = (sodium, username, entry) => sodium.crypto_hash_sha256(concat(new Uint8Array([0]), utf8(canonical({ username, entry }))));
const nodeHash = (sodium, left, right) => sodium.crypto_hash_sha256(concat(new Uint8Array([1]), left, right));

/**
 * Checks an inclusion proof and returns the path it took (which side each sibling was on), so the
 * UI can draw it. `ok` is false if the proof doesn't lead to `root`.
 */
export function inclusionPath(sodium, leaf, index, size, proof, root) {
  const steps = [];
  if (index >= size) return { ok: false, steps };
  let fn = index;
  let sn = size - 1;
  let r = leaf;
  for (const p of proof) {
    if (sn === 0) return { ok: false, steps };
    if (fn % 2 === 1 || fn === sn) {
      r = nodeHash(sodium, p, r);
      steps.push({ side: 'left', sibling: p });
      if (fn % 2 === 0) {
        while (fn % 2 === 0 && fn !== 0) { fn >>= 1; sn >>= 1; }
      }
    } else {
      r = nodeHash(sodium, r, p);
      steps.push({ side: 'right', sibling: p });
    }
    fn >>= 1;
    sn >>= 1;
  }
  return { ok: sn === 0 && equal(r, root), steps };
}

export function verifyConsistency(sodium, size1, size2, proof, root1, root2) {
  if (size1 === size2) return proof.length === 0 && equal(root1, root2);
  if (size1 === 0) return true;
  if (size1 > size2) return false;
  const path = (size1 & (size1 - 1)) === 0 ? [root1, ...proof] : proof;
  if (path.length === 0) return false;
  let fn = size1 - 1;
  let sn = size2 - 1;
  while (fn % 2 === 1) { fn >>= 1; sn >>= 1; }
  let fr = path[0];
  let sr = path[0];
  for (const c of path.slice(1)) {
    if (sn === 0) return false;
    if (fn % 2 === 1 || fn === sn) {
      fr = nodeHash(sodium, c, fr);
      sr = nodeHash(sodium, c, sr);
      if (fn % 2 === 0) {
        while (fn % 2 === 0 && fn !== 0) { fn >>= 1; sn >>= 1; }
      }
    } else {
      sr = nodeHash(sodium, sr, c);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && equal(fr, root1) && equal(sr, root2);
}
