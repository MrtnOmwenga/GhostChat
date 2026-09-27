import { describe, expect, test, beforeAll } from 'vitest';
import { mnemonicToSeedSync } from '@scure/bip39';
import vectors from '../../../../test-vectors/canonical.json';
import keyHistoryFixture from '../../../../test-vectors/key-history.json';
import {
  sodium as loadSodium, canonical, sha256Hex, toB64, fromB64, didFromSigningKey,
  generatePhrase, isValidPhrase, seedFromPhrase, deriveKeys, splitPassword, newSalt,
  sealVault, openVault, vaultContents, createAccountEntry, buildEntry, verifyHistory, passwordStrength,
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
