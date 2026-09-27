import {
  canonical, fromB64, fromUtf8, objectHash, sha256Hex, toB64, utf8,
} from './encoding';

/** The `prev` of a conversation's first message (docs/DESIGN.md §6.2). */
export const genesisHash = (sodium, conversation) => sha256Hex(sodium, `ghostchat/genesis/${conversation}`);

export const dmConversation = (a, b) => `dm:${[a, b].sort().join(':')}`;

/** Encrypts a payload object; the conversation is bound in as associated data. */
export function encryptPayload(sodium, key, payload, conversation) {
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(utf8(canonical(payload)), utf8(conversation), null, nonce, key);
  return { nonce: toB64(sodium, nonce), ciphertext: toB64(sodium, ciphertext) };
}

export function decryptPayload(sodium, key, { nonce, ciphertext, conversation }) {
  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, fromB64(sodium, ciphertext), utf8(conversation), fromB64(sodium, nonce), key,
  );
  return JSON.parse(fromUtf8(plaintext));
}

/** Seals a symmetric key so only the holder of `publicKeyB64`'s private key can open it. */
export const sealKey = (sodium, key, publicKeyB64) => toB64(sodium, sodium.crypto_box_seal(key, fromB64(sodium, publicKeyB64)));

export const openSealed = (sodium, sealedB64, publicKeyB64, privateKeyB64) => sodium.crypto_box_seal_open(
  fromB64(sodium, sealedB64), fromB64(sodium, publicKeyB64), fromB64(sodium, privateKeyB64),
);

/** Adds `hash` (over the canonical envelope) and the sender's Ed25519 signature of that hash. */
export function signEnvelope(sodium, body, signingPrivateKey) {
  const hash = objectHash(sodium, body);
  return { ...body, hash, signature: toB64(sodium, sodium.crypto_sign_detached(utf8(hash), signingPrivateKey)) };
}

/** Whether the envelope's hash matches its content and the signature matches `signingKeyB64`. */
export function verifyEnvelope(sodium, envelope, signingKeyB64) {
  const { hash, signature, ...body } = envelope;
  if (objectHash(sodium, body) !== hash) return { hashOk: false, signatureOk: false };
  let signatureOk = false;
  try {
    signatureOk = sodium.crypto_sign_verify_detached(fromB64(sodium, signature), utf8(hash), fromB64(sodium, signingKeyB64));
  } catch {
    signatureOk = false;
  }
  return { hashOk: true, signatureOk };
}

/** Short, human-comparable fingerprint of a room key, e.g. "7F3A-91C2". */
export const keyFingerprint = (sodium, key) => {
  const hex = sha256Hex(sodium, key).slice(0, 8).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
};

/** Signs any object the way deletions and receipts are signed: Ed25519 over its object hash. */
export function signObject(sodium, body, signingPrivateKey) {
  return { ...body, signature: toB64(sodium, sodium.crypto_sign_detached(utf8(objectHash(sodium, body)), signingPrivateKey)) };
}

export function verifyObject(sodium, object, signingKeyB64) {
  try {
    return sodium.crypto_sign_verify_detached(fromB64(sodium, object.signature), utf8(objectHash(sodium, object)), fromB64(sodium, signingKeyB64));
  } catch {
    return false;
  }
}
