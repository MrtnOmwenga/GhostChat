/*
 * Account key changes and contact verification (docs/DESIGN.md §5.2, §5.4).
 */
import api from './api';
import { currentKeys, rememberKeys } from './keystore';
import { expectOwnKeyVersion } from './messaging';
import {
  sodium as loadSodium, splitPassword, seedFromPhrase, deriveKeys, buildEntry, sealVault, vaultContents, toB64, pinsKey, sealPins, openPins,
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
// A pin records which key of a contact I compared safety numbers against. Pins are kept in this
// browser for instant reads, and on the server, encrypted with a key from my vault, so a contact
// verified on one device is verified on the others.

const pinsStorageKey = (me) => `ghostchat:verified:${me}`;
let serverVersion = null; // the version of the server's copy this browser last saw
let synced = Promise.resolve();

function readPins(me) {
  try {
    return JSON.parse(localStorage.getItem(pinsStorageKey(me)) || '{}');
  } catch {
    return {};
  }
}

function writePins(me, pins) {
  try {
    localStorage.setItem(pinsStorageKey(me), JSON.stringify(pins));
  } catch {
    // storage unavailable: verification lasts for this page only
  }
}

async function fetchPins() {
  const sodium = await loadSodium();
  const vault = currentKeys();
  const { data } = await api.get('/users/me/pins');
  // A copy this account's keys can't open (keys reset, or the server altered it) counts as none.
  let pins = null;
  if (data.ciphertext) {
    try {
      pins = openPins(sodium, pinsKey(sodium, vault), vault.did, data);
    } catch {
      pins = null;
    }
  }
  return { pins, version: data.version };
}

async function storePins(pins, baseVersion) {
  const sodium = await loadSodium();
  const vault = currentKeys();
  const { data } = await api.put('/users/me/pins', { ...sealPins(sodium, pinsKey(sodium, vault), vault.did, pins), baseVersion });
  return data.version;
}

/**
 * Brings this browser in line with the account, once the keys are unlocked. The server's copy
 * wins, so a mark removed on another device is removed here too. An account with no copy yet
 * (verified before marks were synced) starts from what this browser has.
 */
export function syncPins(me) {
  synced = fetchAndApply(me);
  return synced;
}

/** Resolves once this browser has the account's marks (at once if they were never asked for). */
export const pinsSynced = () => synced;

async function fetchAndApply(me) {
  serverVersion = null;
  try {
    const { pins, version } = await fetchPins();
    if (pins) {
      writePins(me, pins);
      serverVersion = version;
    } else {
      const local = readPins(me);
      serverVersion = Object.keys(local).length ? await storePins(local, version) : version;
    }
  } catch {
    // offline, or changed elsewhere this instant: this browser's copy is used, and the next change retries
  }
}

/** Applies one change here at once, then to the account's copy, redoing it on top of another device's change if there was one. */
async function changePins(me, change) {
  writePins(me, change(readPins(me)));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (serverVersion === null) {
        // eslint-disable-next-line no-await-in-loop
        const { pins, version } = await fetchPins();
        serverVersion = version;
        if (pins) writePins(me, change(pins));
      }
      // eslint-disable-next-line no-await-in-loop
      serverVersion = await storePins(readPins(me), serverVersion);
      return;
    } catch (error) {
      if (error.status !== 409) return; // offline: kept in this browser
      serverVersion = null;
    }
  }
}

export function markVerified(me, contactId, history) {
  const pin = { version: history.current.version, signingKey: history.current.signingKey };
  return changePins(me, (pins) => ({ ...pins, [contactId]: pin }));
}

export function unmarkVerified(me, contactId) {
  return changePins(me, (pins) => {
    const { [contactId]: _removed, ...rest } = pins;
    return rest;
  });
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
