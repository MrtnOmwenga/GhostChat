import { describe, expect, test, beforeAll } from 'vitest';
import { mnemonicToSeedSync } from '@scure/bip39';
import vectors from '../../../../test-vectors/canonical.json';
import keyHistoryFixture from '../../../../test-vectors/key-history.json';
import {
  sodium as loadSodium, canonical, sha256Hex, toB64, fromB64, didFromSigningKey,
  generatePhrase, isValidPhrase, seedFromPhrase, deriveKeys, splitPassword, newSalt,
  sealVault, openVault, vaultContents, createAccountEntry, buildEntry, verifyHistory, passwordStrength, safetyNumber,
  inclusionPath, verifyConsistency, encryptFile, decryptFile, pinsKey, sealPins, openPins,
} from '.';

let sodium;
beforeAll(async () => { sodium = await loadSodium(); });
const hex = (s) => sodium.from_hex(s);

describe('published test vectors', () => {
  test('SHA-256 ("abc", FIPS 180-2)', () => {
    expect(sha256Hex(sodium, 'abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  test('Ed25519 (RFC 8032 §7.1, test 1)', () => {
    const { publicKey, privateKey } = sodium.crypto_sign_seed_keypair(hex('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60'));
    expect(sodium.to_hex(publicKey)).toBe('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
    expect(sodium.to_hex(sodium.crypto_sign_detached(new Uint8Array(0), privateKey))).toBe(
      'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
    );
  });

  test('X25519 (RFC 7748 §6.1)', () => {
    const alice = sodium.crypto_scalarmult_base(hex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a'));
    expect(sodium.to_hex(alice)).toBe('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a');
  });

  test('BIP-39 (reference vector: 24 words, passphrase TREZOR)', () => {
    const phrase = `${'abandon '.repeat(23)}art`;
    expect(isValidPhrase(phrase)).toBe(true);
    expect(Buffer.from(mnemonicToSeedSync(phrase, 'TREZOR')).toString('hex')).toBe(
      'bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd3097170af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8',
    );
  });

  test('canonical JSON (shared vectors, also checked by the backend)', () => {
    vectors.forEach(({ input, canonical: expected }) => expect(canonical(input)).toBe(expected));
    expect(() => canonical({ x: 1.5 })).toThrow();
  });
});

describe('keys', () => {
  test('a phrase always derives the same keys, and versions differ', () => {
    const seed = seedFromPhrase(generatePhrase());
    const v1 = deriveKeys(sodium, seed, 1);
    expect(deriveKeys(sodium, seed, 1).signing.publicKey).toEqual(v1.signing.publicKey);
    expect(deriveKeys(sodium, seed, 2).signing.publicKey).not.toEqual(v1.signing.publicKey);
    expect(didFromSigningKey(v1.signing.publicKey)).toMatch(/^did:key:z6Mk/);
  });

  test('phrases are 24 valid words; a typo is rejected', () => {
    const phrase = generatePhrase();
    expect(phrase.split(' ')).toHaveLength(24);
    expect(isValidPhrase(`  ${phrase.toUpperCase()} `)).toBe(true);
    expect(isValidPhrase(phrase.replace(/\w+$/, 'zzzz'))).toBe(false);
  });

  test('the password split gives independent keys, stable per salt', () => {
    const salt = newSalt(sodium);
    const a = splitPassword(sodium, 'correct horse battery staple', salt);
    const b = splitPassword(sodium, 'correct horse battery staple', salt);
    expect(a.authKey).toBe(b.authKey);
    expect(toB64(sodium, a.vaultKey)).not.toBe(a.authKey);
    expect(splitPassword(sodium, 'correct horse battery staple', newSalt(sodium)).authKey).not.toBe(a.authKey);
  });

  test('weak passwords score low, strong ones pass', async () => {
    expect((await passwordStrength('password123')).score).toBeLessThan(3);
    expect((await passwordStrength('adalovelace1', ['adalovelace'])).score).toBeLessThan(3);
    expect((await passwordStrength('qwertyuiop')).score).toBeLessThan(3);
    expect((await passwordStrength('violet-anchor-tundra-1987-lamp')).score).toBeGreaterThanOrEqual(3);
  });
});

describe('vault', () => {
  test('opens with the right key only, and detects tampering', () => {
    const key = sodium.randombytes_buf(32);
    const keys = deriveKeys(sodium, seedFromPhrase(generatePhrase()), 1);
    const sealed = sealVault(sodium, key, vaultContents(sodium, 'did:key:zX', keys));
    expect(openVault(sodium, key, sealed).signing.version).toBe(1);
    expect(() => openVault(sodium, sodium.randombytes_buf(32), sealed)).toThrow();
    const bytes = fromB64(sodium, sealed.ciphertext);
    bytes[0] ^= 1;
    expect(() => openVault(sodium, key, { ...sealed, ciphertext: toB64(sodium, bytes) })).toThrow();
  });

  test('keeps every encryption key across versions', () => {
    const seed = seedFromPhrase(generatePhrase());
    const v1 = vaultContents(sodium, 'did', deriveKeys(sodium, seed, 1));
    const v2 = vaultContents(sodium, 'did', deriveKeys(sodium, seed, 2), v1);
    expect(Object.keys(v2.encryption)).toEqual(['1', '2']);
    expect(v2.signing.version).toBe(2);
  });
});

describe('key history', () => {
  const setup = () => {
    const seed = seedFromPhrase(generatePhrase());
    const { entry } = createAccountEntry(sodium, seed, 'ada');
    return { seed, first: entry };
  };
  const rotate = (seed, previous, overrides = {}) => {
    const version = previous.version + 1;
    return buildEntry(sodium, {
      type: 'rotate', username: 'ada', did: previous.did, previous, reason: 'routine',
      keys: deriveKeys(sodium, seed, version), nextKeys: deriveKeys(sodium, seed, version + 1),
      signingKey: deriveKeys(sodium, seed, previous.version).signing.privateKey, ...overrides,
    });
  };

  test('a new account and an authorised rotation verify', () => {
    const { seed, first } = setup();
    const second = rotate(seed, first);
    const result = verifyHistory(sodium, [first, second]);
    expect(result.problems).toEqual([]);
    expect(result.current.version).toBe(2);
    expect(result.events[1]).toMatchObject({ type: 'rotate', authorised: true });
    expect(Object.keys(result.encryptionKeys)).toEqual(['1', '2']);
  });

  test('a rotation signed by a stolen current key but to a non-committed key fails', () => {
    const { seed, first } = setup();
    const attacker = deriveKeys(sodium, seedFromPhrase(generatePhrase()), 2);
    const forged = rotate(seed, first, { keys: attacker });
    const result = verifyHistory(sodium, [first, forged]);
    expect(result.ok).toBe(false);
    expect(result.problems.join()).toMatch(/pre-rotation commitment/);
  });

  test('a rotation not signed by the previous key fails', () => {
    const { seed, first } = setup();
    const unsigned = rotate(seed, first, { signingKey: deriveKeys(sodium, seed, 2).signing.privateKey });
    expect(verifyHistory(sodium, [first, unsigned]).problems.join()).toMatch(/not signed by the previous key/);
  });

  test('the shared fixture (also verified by the backend) checks out', () => {
    const result = verifyHistory(sodium, keyHistoryFixture.entries);
    expect(result.problems).toEqual([]);
    expect(result.events.map((e) => e.type)).toEqual(['create', 'rotate', 'reset']);
    const seed = seedFromPhrase(keyHistoryFixture.phrase);
    expect(toB64(sodium, deriveKeys(sodium, seed, 1).signing.publicKey)).toBe(keyHistoryFixture.entries[0].signingKey);
  });

  test('a reset verifies but is flagged; edits and broken links are caught', () => {
    const { seed, first } = setup();
    const fresh = seedFromPhrase(generatePhrase());
    const reset = buildEntry(sodium, {
      type: 'reset', username: 'ada', did: first.did, previous: first, reason: 'lost phrase',
      keys: deriveKeys(sodium, fresh, 2), nextKeys: deriveKeys(sodium, fresh, 3), signingKey: deriveKeys(sodium, fresh, 2).signing.privateKey,
    });
    const result = verifyHistory(sodium, [first, reset]);
    expect(result.ok).toBe(true);
    expect(result.hasReset).toBe(true);

    expect(verifyHistory(sodium, [{ ...first, username: 'mallory' }]).ok).toBe(false);
    const second = rotate(seed, first);
    expect(verifyHistory(sodium, [first, { ...second, prev: 'f'.repeat(64) }]).ok).toBe(false);
  });
});

describe('safety numbers', () => {
  test('both users see the same 60 digits; any key change alters them', () => {
    const a = { did: 'did:key:zA', signingKey: 'keyA' };
    const b = { did: 'did:key:zB', signingKey: 'keyB' };
    const number = safetyNumber(sodium, a, b);
    expect(number).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(safetyNumber(sodium, b, a)).toBe(number);
    expect(safetyNumber(sodium, a, { ...b, signingKey: 'keyB2' })).not.toBe(number);
  });
});

describe('Merkle proofs (shared fixture generated by the backend implementation)', () => {
  test('every inclusion and consistency proof verifies in the browser implementation', async () => {
    const { default: vectors } = await import('../../../../test-vectors/merkle.json');
    const h = (x) => sodium.from_hex(x);
    const root = h(vectors.root);
    vectors.inclusion.forEach(({ index, proof }) => {
      expect(inclusionPath(sodium, h(vectors.leaves[index]), index, vectors.size, proof.map(h), root).ok).toBe(true);
      expect(inclusionPath(sodium, h(vectors.leaves[(index + 1) % vectors.size]), index, vectors.size, proof.map(h), root).ok).toBe(false);
    });
    vectors.consistency.forEach(({ from, fromRoot, proof }) => {
      expect(verifyConsistency(sodium, from, vectors.size, proof.map(h), h(fromRoot), root)).toBe(true);
      expect(verifyConsistency(sodium, from, vectors.size, proof.map(h), h('00'.repeat(32)), root)).toBe(false);
    });
  });
});

describe('file encryption', () => {
  const sizes = [0, 1, 64 * 1024, 64 * 1024 + 1, 200_000];

  test.each(sizes)('round-trips a %i-byte file, named by the hash of its ciphertext', (size) => {
    const bytes = sodium.randombytes_buf(size);
    const { key, ciphertext, id } = encryptFile(sodium, bytes);
    expect(id).toBe(sha256Hex(sodium, ciphertext));
    expect(Array.from(decryptFile(sodium, key, ciphertext, id))).toEqual(Array.from(bytes));
  });

  test('fresh key per file: the same bytes encrypt differently', () => {
    const bytes = sodium.randombytes_buf(1000);
    expect(encryptFile(sodium, bytes).id).not.toBe(encryptFile(sodium, bytes).id);
  });

  test('a changed, truncated or extended file, or the wrong key, is rejected', () => {
    const { key, ciphertext, id } = encryptFile(sodium, sodium.randombytes_buf(150_000));
    const flipped = ciphertext.slice();
    flipped[70_000] ^= 1;
    expect(() => decryptFile(sodium, key, flipped, id)).toThrow('does not match the hash');
    expect(() => decryptFile(sodium, key, flipped)).toThrow('could not be decrypted');
    const chunk = 64 * 1024 + sodium.crypto_secretstream_xchacha20poly1305_ABYTES;
    const header = sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES;
    expect(() => decryptFile(sodium, key, ciphertext.slice(0, header + 2 * chunk))).toThrow('truncated');
    const extended = new Uint8Array(ciphertext.length + 5);
    extended.set(ciphertext);
    expect(() => decryptFile(sodium, key, extended)).toThrow();
    expect(() => decryptFile(sodium, toB64(sodium, sodium.randombytes_buf(32)), ciphertext)).toThrow('could not be decrypted');
  });
});

describe('verified-contact marks', () => {
  const pins = { 'contact-1': { version: 2, signingKey: 'abc' } };
  const account = (phrase = generatePhrase()) => {
    const seed = seedFromPhrase(phrase);
    const v1 = vaultContents(sodium, 'did:key:zMe', deriveKeys(sodium, seed, 1));
    return { seed, v1 };
  };

  test('any device with the unlocked vault opens them, before and after a key rotation', () => {
    const { seed, v1 } = account();
    const sealed = sealPins(sodium, pinsKey(sodium, v1), v1.did, pins);
    expect(openPins(sodium, pinsKey(sodium, v1), v1.did, sealed)).toEqual(pins);
    // After rotating, the vault still holds the first key, so the same marks open.
    const v2 = vaultContents(sodium, v1.did, deriveKeys(sodium, seed, 2), v1);
    expect(openPins(sodium, pinsKey(sodium, v2), v2.did, sealed)).toEqual(pins);
  });

  test('the server can neither read, alter, nor invent them', () => {
    const { v1 } = account();
    const key = pinsKey(sodium, v1);
    const sealed = sealPins(sodium, key, v1.did, pins);
    expect(JSON.stringify(sealed)).not.toContain('contact-1');
    const flipped = fromB64(sodium, sealed.ciphertext);
    flipped[0] ^= 1;
    expect(() => openPins(sodium, key, v1.did, { ...sealed, ciphertext: toB64(sodium, flipped) })).toThrow();
    // Sealed with any other key (all the server could do, knowing only public keys): refused.
    const forged = sealPins(sodium, sodium.randombytes_buf(32), v1.did, { 'contact-1': { version: 9, signingKey: 'evil' } });
    expect(() => openPins(sodium, key, v1.did, forged)).toThrow();
  });

  test("one account's marks can't be given to another, even with the same key", () => {
    const { v1 } = account();
    const key = pinsKey(sodium, v1);
    expect(() => openPins(sodium, key, 'did:key:zSomeoneElse', sealPins(sodium, key, v1.did, pins))).toThrow();
  });
});
