import { canonical, fromB64, fromUtf8, toB64, utf8 } from './encoding';

/**
 * The vault is an account's private keys, encrypted with the password-derived vault key and stored
 * on the server. Contents: the identity, the current signing key, and every encryption key the
 * account has had (so history stays readable after rotations).
 */
export function sealVault(sodium, vaultKey, contents) {
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    utf8(canonical(contents)), utf8('ghostchat/vault'), null, nonce, vaultKey,
  );
  return { nonce: toB64(sodium, nonce), ciphertext: toB64(sodium, ciphertext) };
}

/** Throws if the key is wrong or the vault was tampered with. */
export function openVault(sodium, vaultKey, sealed) {
  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, fromB64(sodium, sealed.ciphertext), utf8('ghostchat/vault'), fromB64(sodium, sealed.nonce), vaultKey,
  );
  return JSON.parse(fromUtf8(plaintext));
}

/** Vault contents for a set of derived keys, with binary values base64url-encoded. */
export function vaultContents(sodium, did, keys, previous) {
  return {
    did,
    signing: { version: keys.version, privateKey: toB64(sodium, keys.signing.privateKey) },
    encryption: {
      ...(previous?.encryption || {}),
      [keys.version]: {
        publicKey: toB64(sodium, keys.encryption.publicKey),
        privateKey: toB64(sodium, keys.encryption.privateKey),
      },
    },
  };
}
