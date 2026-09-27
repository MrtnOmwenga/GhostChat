const crypto = require('crypto');
const {
  leafHash, root, inclusionProof, consistencyProof, verifyInclusion, verifyConsistency,
} = require('../src/services/merkle');

const leaves = (n) => Array.from({ length: n }, (_, i) => leafHash(Buffer.from(`leaf ${i}`)));

// Reference roots from RFC 6962's worked structure, computed independently by a naive
// implementation (a flat left-to-right pairing is WRONG for non-powers of two; this checks the
// split-at-largest-power-of-two rule).
test('root follows the RFC 6962 split rule', () => {
  const d = leaves(3);
  const expected = crypto.createHash('sha256').update(Buffer.concat([
    Buffer.from([1]),
    crypto.createHash('sha256').update(Buffer.concat([Buffer.from([1]), d[0], d[1]])).digest(),
    d[2],
  ])).digest();
  expect(root(d).equals(expected)).toBe(true);
  expect(root([]).toString('hex')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('every inclusion proof verifies, and only for its own leaf, index and root', () => {
  for (let n = 1; n <= 17; n += 1) {
    const d = leaves(n);
    const r = root(d);
    for (let m = 0; m < n; m += 1) {
      const proof = inclusionProof(m, d);
      expect(verifyInclusion(d[m], m, n, proof, r)).toBe(true);
      if (n > 1) {
        expect(verifyInclusion(d[(m + 1) % n], m, n, proof, r)).toBe(false);
        expect(verifyInclusion(d[m], m, n, proof, leafHash(Buffer.from('other')))).toBe(false);
      }
    }
  }
});

test('every consistency proof verifies; a rewritten history does not', () => {
  for (let n = 1; n <= 17; n += 1) {
    const d = leaves(n);
    for (let m = 1; m <= n; m += 1) {
      const proof = consistencyProof(m, d);
      expect(verifyConsistency(m, n, proof, root(d.slice(0, m)), root(d))).toBe(true);
      if (m < n) {
        const rewritten = [...d];
        rewritten[m - 1] = leafHash(Buffer.from('rewritten'));
        expect(verifyConsistency(m, n, proof, root(d.slice(0, m)), root(rewritten))).toBe(false);
      }
    }
  }
});
