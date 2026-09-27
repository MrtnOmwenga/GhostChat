import { objectHash, toB64, fromB64, utf8 } from './encoding';
import { deriveKeys } from './phrase';
import { didFromSigningKey } from './did';

const sign = (sodium, hash, privateKey) => toB64(sodium, sodium.crypto_sign_detached(utf8(hash), privateKey));

/**
 * A key-history entry, signed. `create` and `reset` are signed by their own new key; `rotate` is
 * signed by the previous signing key, and its key must match the previous entry's commitment.
 */
export function buildEntry(sodium, {
  type, username, did, keys, nextKeys, previous, reason = '', signingKey, createdAt = new Date().toISOString(),
}) {
  const entry = {
    type,
    username,
    did,
    version: keys.version,
    signingKey: toB64(sodium, keys.signing.publicKey),
    encryptionKey: toB64(sodium, keys.encryption.publicKey),
    nextKeyCommitment: keyCommitment(sodium, nextKeys.signing.publicKey),
    prev: previous ? objectHash(sodium, previous) : null,
    reason,
    createdAt,
  };
  return { ...entry, signature: sign(sodium, objectHash(sodium, entry), signingKey) };
}

export const keyCommitment = (sodium, publicKey) => sodium.to_hex(sodium.crypto_hash_sha256(publicKey));

/** The first entry of a new account, from its recovery phrase seed. */
export function createAccountEntry(sodium, seed, username) {
  const keys = deriveKeys(sodium, seed, 1);
  const did = didFromSigningKey(keys.signing.publicKey);
  const entry = buildEntry(sodium, {
    type: 'create', username, did, keys, nextKeys: deriveKeys(sodium, seed, 2), signingKey: keys.signing.privateKey,
  });
  return { keys, did, entry };
}

const verifySignature = (sodium, entry, publicKeyB64) => {
  try {
    return sodium.crypto_sign_verify_detached(
      fromB64(sodium, entry.signature), utf8(objectHash(sodium, entry)), fromB64(sodium, publicKeyB64),
    );
  } catch {
    return false;
  }
};

/**
 * Checks a user's whole key history and returns the current keys plus what a contact should be
 * told: every rotation authorised by the previous key, or where a reset (or a break) happened.
 */
export function verifyHistory(sodium, entries) {
  const problems = [];
  const events = [];
  if (entries.length === 0) return { ok: false, problems: ['no key history'], events };

  entries.forEach((entry, i) => {
    const previous = entries[i - 1];
    if (entry.version !== i + 1) problems.push(`entry ${i + 1}: version ${entry.version} out of sequence`);
    if (i === 0) {
      if (entry.type !== 'create') problems.push('history does not start with a create entry');
      if (entry.did !== didFromSigningKey(fromB64(sodium, entry.signingKey))) problems.push('identity does not match the first key');
      if (!verifySignature(sodium, entry, entry.signingKey)) problems.push('first entry is not self-signed');
      events.push({ version: 1, type: 'create', createdAt: entry.createdAt });
      return;
    }
    if (entry.did !== entries[0].did) problems.push(`entry ${entry.version}: identity changed`);
    if (entry.prev !== objectHash(sodium, previous)) problems.push(`entry ${entry.version}: does not link to the previous entry`);
    if (entry.type === 'rotate') {
      const signedByPrevious = verifySignature(sodium, entry, previous.signingKey);
      const committed = keyCommitment(sodium, fromB64(sodium, entry.signingKey)) === previous.nextKeyCommitment;
      if (!signedByPrevious) problems.push(`entry ${entry.version}: rotation not signed by the previous key`);
      if (!committed) problems.push(`entry ${entry.version}: new key does not match the pre-rotation commitment`);
      events.push({
        version: entry.version, type: 'rotate', reason: entry.reason, createdAt: entry.createdAt, authorised: signedByPrevious && committed,
      });
    } else if (entry.type === 'reset') {
      if (!verifySignature(sodium, entry, entry.signingKey)) problems.push(`entry ${entry.version}: reset is not self-signed`);
      events.push({ version: entry.version, type: 'reset', reason: entry.reason, createdAt: entry.createdAt, authorised: false });
    } else {
      problems.push(`entry ${entry.version}: unknown type ${entry.type}`);
    }
  });

  const current = entries[entries.length - 1];
  return {
    ok: problems.length === 0,
    problems,
    events,
    did: entries[0].did,
    current: { version: current.version, signingKey: current.signingKey, encryptionKey: current.encryptionKey },
    encryptionKeys: Object.fromEntries(entries.map((e) => [e.version, e.encryptionKey])),
    hasReset: entries.some((e) => e.type === 'reset'),
  };
}
