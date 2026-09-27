// RFC 6962 / RFC 9162 Merkle tree hashing, inclusion proofs and consistency proofs (the Certificate
// Transparency construction). Leaves and interior nodes use different prefixes (0x00 / 0x01), so a
// leaf can never be passed off as a node.
const crypto = require('crypto');

const sha256 = (...parts) => crypto.createHash('sha256').update(Buffer.concat(parts)).digest();
const leafHash = (data) => sha256(Buffer.from([0]), Buffer.from(data));
const nodeHash = (left, right) => sha256(Buffer.from([1]), left, right);
const EMPTY_ROOT = sha256(Buffer.alloc(0));

/** Largest power of two strictly less than n (n > 1). */
const split = (n) => 2 ** Math.floor(Math.log2(n - 1));

function root(leaves) {
  if (leaves.length === 0) return EMPTY_ROOT;
  if (leaves.length === 1) return leaves[0];
  const k = split(leaves.length);
  return nodeHash(root(leaves.slice(0, k)), root(leaves.slice(k)));
}

/** Audit path for leaf `m` in the tree of `leaves` (RFC 6962 §2.1.1 PATH). */
function inclusionProof(m, leaves) {
  if (leaves.length <= 1) return [];
  const k = split(leaves.length);
  return m < k
    ? [...inclusionProof(m, leaves.slice(0, k)), root(leaves.slice(k))]
    : [...inclusionProof(m - k, leaves.slice(k)), root(leaves.slice(0, k))];
}

/** Proof that the tree of the first `m` leaves is a prefix of the tree of `leaves` (RFC 6962 §2.1.2). */
function consistencyProof(m, leaves) {
  const subproof = (mm, d, complete) => {
    if (mm === d.length) return complete ? [] : [root(d)];
    const k = split(d.length);
    return mm <= k
      ? [...subproof(mm, d.slice(0, k), complete), root(d.slice(k))]
      : [...subproof(mm - k, d.slice(k), false), root(d.slice(0, k))];
  };
  if (m === 0 || m === leaves.length) return [];
  return subproof(m, leaves, true);
}

/** RFC 9162 §2.1.3.2: does `proof` show leaf `index` is in the tree of `size` with `rootHash`? */
function verifyInclusion(leaf, index, size, proof, rootHash) {
  if (index >= size) return false;
  let fn = index;
  let sn = size - 1;
  let r = leaf;
  for (const p of proof) {
    if (sn === 0) return false;
    if (fn % 2 === 1 || fn === sn) {
      r = nodeHash(p, r);
      if (fn % 2 === 0) {
        while (fn % 2 === 0 && fn !== 0) { fn >>= 1; sn >>= 1; }
      }
    } else {
      r = nodeHash(r, p);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && r.equals(rootHash);
}

/** RFC 9162 §2.1.4.2: does `proof` show the tree (size1, root1) is a prefix of (size2, root2)? */
function verifyConsistency(size1, size2, proof, root1, root2) {
  if (size1 === size2) return proof.length === 0 && root1.equals(root2);
  if (size1 === 0) return true;
  if (size1 > size2) return false;
  const path = (size1 & (size1 - 1)) === 0 ? [root1, ...proof] : proof; // size1 a power of two
  if (path.length === 0) return false;
  let fn = size1 - 1;
  let sn = size2 - 1;
  while (fn % 2 === 1) { fn >>= 1; sn >>= 1; }
  let [fr, sr] = [path[0], path[0]];
  for (const c of path.slice(1)) {
    if (sn === 0) return false;
    if (fn % 2 === 1 || fn === sn) {
      fr = nodeHash(c, fr);
      sr = nodeHash(c, sr);
      if (fn % 2 === 0) {
        while (fn % 2 === 0 && fn !== 0) { fn >>= 1; sn >>= 1; }
      }
    } else {
      sr = nodeHash(sr, c);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && fr.equals(root1) && sr.equals(root2);
}

module.exports = {
  leafHash, nodeHash, root, inclusionProof, consistencyProof, verifyInclusion, verifyConsistency, EMPTY_ROOT,
};
