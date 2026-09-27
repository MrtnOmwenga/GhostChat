import { base58 } from '@scure/base';

// Multicodec prefix for an Ed25519 public key (0xed, varint-encoded as 0xed 0x01).
const ED25519_PREFIX = [0xed, 0x01];

/** The W3C did:key identifier for an Ed25519 public key. */
export function didFromSigningKey(publicKey) {
  return `did:key:z${base58.encode(Uint8Array.from([...ED25519_PREFIX, ...publicKey]))}`;
}
