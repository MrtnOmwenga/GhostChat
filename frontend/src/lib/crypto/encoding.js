/**
 * Canonical JSON (RFC 8785) for the values GhostChat signs: objects, arrays, strings, integers,
 * booleans and null. Keys are sorted by UTF-16 code units and strings use JSON.stringify's
 * escaping, which is what RFC 8785 specifies. Floats are rejected rather than serialised, since
 * their canonical form is the part of the RFC this implementation doesn't cover. The backend has
 * an identical copy; shared vectors in both test suites keep them in step.
 */
export function canonical(value) {
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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const utf8 = (text) => encoder.encode(text);
export const fromUtf8 = (bytes) => decoder.decode(bytes);

/** base64url without padding, the encoding used for every binary value on the wire. */
export const toB64 = (sodium, bytes) => sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
export const fromB64 = (sodium, text) => sodium.from_base64(text, sodium.base64_variants.URLSAFE_NO_PADDING);

export const sha256Hex = (sodium, data) => sodium.to_hex(sodium.crypto_hash_sha256(typeof data === 'string' ? utf8(data) : data));

/** The hash every signed object is identified by: SHA-256 of its canonical JSON, without `signature`. */
export function objectHash(sodium, object) {
  const { signature, ...unsigned } = object;
  return sha256Hex(sodium, canonical(unsigned));
}
