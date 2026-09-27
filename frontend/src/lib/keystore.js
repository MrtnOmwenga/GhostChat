/**
 * Holds the unlocked vault contents for the signed-in user: in memory, plus an IndexedDB copy so
 * a page reload doesn't ask for the password again. The copy is encrypted under a non-extractable
 * AES-GCM key kept in IndexedDB too: page scripts can use that key but can't read its bytes, so
 * the raw private keys never sit on disk in the clear. (It doesn't protect against script running
 * in the page itself; nothing in a web app can. See docs/DESIGN.md §10.)
 */
const DB_NAME = 'ghostchat';
const STORE = 'keys';

let unlocked = null; // { userId, contents }

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idb(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(request?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function wrappingKey() {
  const existing = await idb('readonly', (store) => store.get('wrapping-key'));
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await idb('readwrite', (store) => store.put(key, 'wrapping-key'));
  return key;
}

export async function rememberKeys(userId, contents) {
  unlocked = { userId, contents };
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(contents));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await wrappingKey(), data);
    await idb('readwrite', (store) => store.put({ userId, iv, ciphertext }, 'vault'));
  } catch {
    // Private browsing can refuse IndexedDB; the keys then last until the tab closes.
  }
}

/** The unlocked keys for `userId`, or null if this browser needs the password again. */
export async function loadKeys(userId) {
  if (unlocked?.userId === userId) return unlocked.contents;
  try {
    const cached = await idb('readonly', (store) => store.get('vault'));
    if (!cached || cached.userId !== userId) return null;
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: cached.iv }, await wrappingKey(), cached.ciphertext);
    unlocked = { userId, contents: JSON.parse(new TextDecoder().decode(plaintext)) };
    return unlocked.contents;
  } catch {
    return null;
  }
}

export const currentKeys = () => unlocked?.contents || null;

export async function forgetKeys() {
  unlocked = null;
  try {
    await idb('readwrite', (store) => store.clear());
  } catch {
    // nothing cached
  }
}
