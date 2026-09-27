/*
 * Account key changes and contact verification (docs/DESIGN.md §5.2, §5.4).
 */
import api from './api';
import { currentKeys, rememberKeys } from './keystore';
import { expectOwnKeyVersion } from './messaging';
import {
  sodium as loadSodium, splitPassword, seedFromPhrase, deriveKeys, buildEntry, sealVault, vaultContents, toB64,
} from './crypto';

async function passwordKeys(password) {
  const sodium = await loadSodium();
  const { data: { salt } } = await api.get('/auth/vault');
  return splitPassword(sodium, password, salt);
}

async function myHistory(userId) {
  const { data } = await api.get(`/users/${userId}/keys`);
  return data;
}

/**
 * Rotation: the recovery phrase regenerates the current key (proving it's the owner) and the next
 * one, which must match the commitment in the current entry; the password re-seals the vault.
 */
export async function rotateKeys(user, { password, phrase, reason }) {
  const sodium = await loadSodium();
  const entries = await myHistory(user.id);
  const previous = entries[entries.length - 1];
  const seed = seedFromPhrase(phrase);
  const current = deriveKeys(sodium, seed, previous.version);
  if (toB64(sodium, current.signing.publicKey) !== previous.signingKey) {
    throw new Error("That recovery phrase doesn't match your current keys");
  }
  const keys = deriveKeys(sodium, seed, previous.version + 1);
  const entry = buildEntry(sodium, {
    type: 'rotate', username: user.username, did: previous.did, previous, reason, keys,
    nextKeys: deriveKeys(sodium, seed, previous.version + 2), signingKey: current.signing.privateKey,
  });
  await submit(user, '/keys/rotate', password, entry, keys, previous.did);
}

/**
 * Reset, for a lost recovery phrase: keys from a new phrase, self-signed. Contacts are warned,
 * because nothing links the new key to the old one except the server's word.
 */
export async function resetKeys(user, { password, newPhrase, reason }) {
  const sodium = await loadSodium();
  const entries = await myHistory(user.id);
  const previous = entries[entries.length - 1];
  const seed = seedFromPhrase(newPhrase);
  const version = previous.version + 1;
  const keys = deriveKeys(sodium, seed, version);
  const entry = buildEntry(sodium, {
    type: 'reset', username: user.username, did: previous.did, previous, reason, keys,
    nextKeys: deriveKeys(sodium, seed, version + 1), signingKey: keys.signing.privateKey,
  });
  await submit(user, '/keys/reset', password, entry, keys, previous.did);
}

async function submit(user, path, password, entry, keys, did) {
  const sodium = await loadSodium();
  const { authKey, vaultKey } = await passwordKeys(password);
  const contents = vaultContents(sodium, did, keys, currentKeys());
  expectOwnKeyVersion(entry.version);
  try {
    await api.post(path, { currentAuthKey: authKey, entry, vault: sealVault(sodium, vaultKey, contents) });
  } catch (error) {
    if (error.status === 401) throw new Error('Incorrect password');
    throw error;
  }
  await rememberKeys(user.id, contents);
}

// ---- verified contacts ------------------------------------------------------------------------
// Pins are local to this browser: which key of a contact I compared safety numbers against.

const pinsKey = (me) => `ghostchat:verified:${me}`;

function readPins(me) {
  try {
    return JSON.parse(localStorage.getItem(pinsKey(me)) || '{}');
  } catch {
    return {};
  }
}

function writePins(me, pins) {
  try {
    localStorage.setItem(pinsKey(me), JSON.stringify(pins));
  } catch {
    // storage unavailable: verification lasts for this page only
  }
}

export function markVerified(me, contactId, history) {
  writePins(me, { ...readPins(me), [contactId]: { version: history.current.version, signingKey: history.current.signingKey } });
}

export function unmarkVerified(me, contactId) {
  const pins = readPins(me);
  delete pins[contactId];
  writePins(me, pins);
}

/**
 * 'verified' if the pinned key is still current, or every change since was a rotation authorised
 * by the key before it (so by the verified key, transitively); 'changed' if a reset or broken
 * history came after the pin; null if the contact was never verified.
 */
export function verificationStatus(me, contactId, history) {
  const pin = readPins(me)[contactId];
  if (!pin) return null;
  if (!history.ok) return 'changed';
  const pinned = history.entries[pin.version - 1];
  if (!pinned || pinned.signingKey !== pin.signingKey) return 'changed';
  const since = history.events.filter((e) => e.version > pin.version);
  return since.every((e) => e.type === 'rotate' && e.authorised) ? 'verified' : 'changed';
}
