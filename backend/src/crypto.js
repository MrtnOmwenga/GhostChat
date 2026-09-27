// Server-side verification of what clients sign. The server never encrypts or decrypts content; it
// checks signatures and hash links so malformed or forged data is rejected before it's stored.
// Clients verify everything themselves as well.
const crypto = require('crypto');

/** Canonical JSON (RFC 8785) for signed values; identical to frontend/src/lib/crypto/encoding.js. */
function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('canonical(): only safe integers are supported');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  throw new Error(`canonical(): unsupported type ${typeof value}`);
}

const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const fromB64 = (text) => Buffer.from(text, 'base64url');

function objectHash(object) {
  const { signature, ...unsigned } = object;
  return sha256Hex(canonical(unsigned));
}

// DER prefix that turns a raw 32-byte Ed25519 public key into an SPKI structure Node can import.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function verifySignature(publicKeyB64, message, signatureB64) {
  try {
    const raw = fromB64(publicKeyB64);
    if (raw.length !== 32) return false;
    const key = crypto.createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, raw]), format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(message), key, fromB64(signatureB64));
  } catch {
    return false;
  }
}

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58(bytes) {
  let n = BigInt(`0x${Buffer.from(bytes).toString('hex') || '0'}`);
  let out = '';
  while (n > 0n) {
    out = B58_ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}

const didFromSigningKey = (publicKeyB64) => `did:key:z${base58(Buffer.concat([Buffer.from([0xed, 0x01]), fromB64(publicKeyB64)]))}`;
const keyCommitment = (publicKeyB64) => sha256Hex(fromB64(publicKeyB64));

const signedBy = (object, publicKeyB64) => verifySignature(publicKeyB64, objectHash(object), object.signature);

/**
 * Checks that `entry` may be appended after `previous` (null for a new account). Mirrors the
 * client-side verifyHistory; returns a reason string when the entry is not acceptable.
 */
function checkKeyEntry(entry, previous, username) {
  const fields = ['type', 'username', 'did', 'version', 'signingKey', 'encryptionKey', 'nextKeyCommitment', 'prev', 'reason', 'createdAt', 'signature'];
  if (!entry || typeof entry !== 'object') return 'missing key entry';
  if (Object.keys(entry).some((k) => !fields.includes(k))) return 'unexpected fields in key entry';
  if (entry.username !== username) return 'key entry is for a different username';
  if (fromB64(entry.encryptionKey || '').length !== 32) return 'invalid encryption key';
  if (!/^[0-9a-f]{64}$/.test(entry.nextKeyCommitment || '')) return 'invalid next-key commitment';

  if (!previous) {
    if (entry.type !== 'create' || entry.version !== 1 || entry.prev !== null) return 'a new account needs a version 1 create entry';
    if (entry.did !== didFromSigningKey(entry.signingKey)) return 'identity does not match the signing key';
    return signedBy(entry, entry.signingKey) ? null : 'create entry is not self-signed';
  }
  if (entry.version !== previous.version + 1) return 'version out of sequence';
  if (entry.did !== previous.did) return 'identity cannot change';
  if (entry.prev !== objectHash(previous)) return 'entry does not link to the previous one';
  if (entry.type === 'rotate') {
    if (!signedBy(entry, previous.signingKey)) return 'rotation not signed by the previous key';
    if (keyCommitment(entry.signingKey) !== previous.nextKeyCommitment) return 'new key does not match the pre-rotation commitment';
    return null;
  }
  if (entry.type === 'reset') return signedBy(entry, entry.signingKey) ? null : 'reset entry is not self-signed';
  return 'unknown key entry type';
}

module.exports = {
  canonical, sha256Hex, objectHash, verifySignature, didFromSigningKey, keyCommitment, signedBy, checkKeyEntry, fromB64,
};
