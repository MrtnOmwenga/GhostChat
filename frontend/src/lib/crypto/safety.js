import { utf8 } from './encoding';

/** A short fingerprint of a signing key, e.g. "A1B2 C3D4 E5F6 0718". */
export function signingFingerprint(sodium, signingKeyB64) {
  const hex = sodium.to_hex(sodium.crypto_hash_sha256(utf8(signingKeyB64))).slice(0, 16).toUpperCase();
  return hex.match(/.{4}/g).join(' ');
}

/**
 * A 60-digit safety number for two identities, the same on both sides (docs/DESIGN.md §5.4).
 * Each half is 30 digits derived from one user's identity and current signing key; the halves are
 * ordered by identity so both users see the same number. (Simplified from Signal's construction,
 * which iterates the hash 5200 times to slow down attacks on the displayed digits.)
 */
export function safetyNumber(sodium, a, b) {
  const half = ({ did, signingKey }) => {
    const bytes = sodium.crypto_hash_sha256(utf8(`ghostchat/safety/${did}/${signingKey}`));
    let digits = '';
    for (let i = 0; i < 6; i += 1) {
      const chunk = bytes.slice(i * 5, i * 5 + 5).reduce((n, byte) => n * 256 + byte, 0);
      digits += String(chunk % 100000).padStart(5, '0');
    }
    return digits;
  };
  const [first, second] = [a, b].sort((x, y) => (x.did < y.did ? -1 : 1));
  return `${half(first)}${half(second)}`.match(/.{5}/g).join(' ');
}
