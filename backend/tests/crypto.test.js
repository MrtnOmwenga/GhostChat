const vectors = require('../../test-vectors/canonical.json');
const { entries } = require('../../test-vectors/key-history.json');
const { canonical, checkKeyEntry, sha256Hex, didFromSigningKey } = require('../src/crypto');

test('canonical JSON matches the shared vectors (same file the frontend checks)', () => {
  vectors.forEach(({ input, canonical: expected }) => expect(canonical(input)).toBe(expected));
});

test('SHA-256 and did:key agree with the frontend', () => {
  expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  expect(didFromSigningKey(entries[0].signingKey)).toBe(entries[0].did);
});

test('accepts the key history the frontend produced: create, rotate, reset', () => {
  const [create, rotate, reset] = entries;
  expect(checkKeyEntry(create, null, 'ada')).toBeNull();
  expect(checkKeyEntry(rotate, create, 'ada')).toBeNull();
  expect(checkKeyEntry(reset, rotate, 'ada')).toBeNull();
});

test('rejects tampered, misordered or misattributed entries', () => {
  const [create, rotate] = entries;
  expect(checkKeyEntry({ ...create, reason: 'edited' }, null, 'ada')).toMatch(/self-signed/);
  expect(checkKeyEntry(create, null, 'mallory')).toMatch(/different username/);
  expect(checkKeyEntry(rotate, null, 'ada')).toMatch(/version 1 create/);
  expect(checkKeyEntry({ ...rotate, version: 5 }, create, 'ada')).toMatch(/sequence/);
  expect(checkKeyEntry({ ...rotate, prev: 'a'.repeat(64) }, create, 'ada')).toMatch(/link/);
  expect(checkKeyEntry({ ...rotate, signingKey: create.signingKey }, create, 'ada')).toMatch(/not signed by the previous key|commitment/);
  expect(checkKeyEntry({ ...create, extra: 1 }, null, 'ada')).toMatch(/unexpected fields/);
});
