import { canonical, fromB64, fromUtf8, toB64, utf8 } from './encoding';

/**
 * Verified-contact marks are stored on the server so they follow the account to other devices,
 * encrypted so the server can neither read nor invent them. The key comes from the oldest
 * encryption key in the vault: every device that has unlocked the vault can derive it, it survives
 * key rotations (the vault keeps every key), and it needs no password prompt.
 */
export function pinsKey(sodium, vault) {
  const oldest = Math.min(...Object.keys(vault.encryption).map(Number));
  return sodium.crypto_generichash(32, utf8('ghostchat/pins'), fromB64(sodium, vault.encryption[oldest].privateKey));
}

// The account's identity is bound in, so a blob can't be moved between accounts.
const context = (did) => utf8(`ghostchat/pins:${did}`);

export function sealPins(sodium, key, did, pins) {
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(utf8(canonical(pins)), context(did), null, nonce, key);
  return { nonce: toB64(sodium, nonce), ciphertext: toB64(sodium, ciphertext) };
}

/** Throws if the blob wasn't sealed by this account's own keys, or was altered. */
export function openPins(sodium, key, did, sealed) {
  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, fromB64(sodium, sealed.ciphertext), context(did), fromB64(sodium, sealed.nonce), key,
  );
  return JSON.parse(fromUtf8(plaintext));
}
