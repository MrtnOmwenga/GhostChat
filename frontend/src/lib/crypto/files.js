import { sha256Hex, toB64, fromB64 } from './encoding';

/*
 * Attachments (docs/DESIGN.md §8) are encrypted with libsodium's secretstream under a fresh key per
 * file, in 64 KiB chunks. Each chunk is authenticated and the last one is tagged as final, so a
 * reordered, altered or truncated file fails to decrypt. The stored file is the stream header
 * followed by the chunks, and is named by the SHA-256 of those bytes.
 */
const CHUNK = 64 * 1024;

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Returns { key (base64url), ciphertext, id (hex SHA-256 of the ciphertext) }. */
export function encryptFile(sodium, bytes) {
  const key = sodium.crypto_secretstream_xchacha20poly1305_keygen();
  const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
  const parts = [header];
  for (let start = 0; ; start += CHUNK) {
    const end = Math.min(start + CHUNK, bytes.length);
    const last = end === bytes.length;
    const tag = last ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
    parts.push(sodium.crypto_secretstream_xchacha20poly1305_push(state, bytes.subarray(start, end), null, tag));
    if (last) break;
  }
  const ciphertext = concat(parts);
  return { key: toB64(sodium, key), ciphertext, id: sha256Hex(sodium, ciphertext) };
}

/** Decrypts a downloaded file after checking it is the exact file the signed message names. */
export function decryptFile(sodium, keyB64, ciphertext, expectedId) {
  if (expectedId && sha256Hex(sodium, ciphertext) !== expectedId) throw new Error('the file does not match the hash in the signed message');
  const headerBytes = sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES;
  if (ciphertext.length < headerBytes) throw new Error('the file is truncated');
  const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(ciphertext.subarray(0, headerBytes), fromB64(sodium, keyB64));
  const chunkBytes = CHUNK + sodium.crypto_secretstream_xchacha20poly1305_ABYTES;
  const parts = [];
  let offset = headerBytes;
  while (offset < ciphertext.length) {
    const chunk = ciphertext.subarray(offset, offset + chunkBytes);
    const result = sodium.crypto_secretstream_xchacha20poly1305_pull(state, chunk, null);
    if (!result) throw new Error('the file could not be decrypted');
    parts.push(result.message);
    offset += chunk.length;
    if (result.tag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL) {
      if (offset !== ciphertext.length) throw new Error('the file has data after its end');
      return concat(parts);
    }
  }
  throw new Error('the file is truncated');
}
