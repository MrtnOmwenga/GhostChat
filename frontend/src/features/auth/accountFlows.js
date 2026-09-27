import api from '../../lib/api';
import { rememberKeys, currentKeys } from '../../lib/keystore';
import {
  sodium as loadSodium, newSalt, splitPassword, seedFromPhrase, createAccountEntry, deriveKeys,
  sealVault, openVault, vaultContents, verifyHistory, toB64, utf8,
} from '../../lib/crypto';

// Every flow keeps the password in the browser: only the authKey half of the Argon2id output is
// sent, and the vault is sealed or opened locally (docs/DESIGN.md §4).

export async function signUp({ username, password, phrase }) {
  const sodium = await loadSodium();
  const salt = newSalt(sodium);
  const { authKey, vaultKey } = splitPassword(sodium, password, salt);
  const { keys, did, entry } = createAccountEntry(sodium, seedFromPhrase(phrase), username);
  const contents = vaultContents(sodium, did, keys);
  const { data: user } = await api.post('/auth/register', {
    username, salt, authKey, vault: sealVault(sodium, vaultKey, contents), keyEntry: entry,
  });
  await rememberKeys(user.id, contents);
  return user;
}

export async function signIn({ username, password }) {
  const sodium = await loadSodium();
  const { data: { salt } } = await api.get('/auth/salt', { params: { username } });
  const { authKey, vaultKey } = splitPassword(sodium, password, salt);
  const { data: { user, vault } } = await api.post('/auth/login', { username, authKey });
  await rememberKeys(user.id, openVault(sodium, vaultKey, vault));
  return user;
}

/** For a signed-in browser without cached keys (storage cleared, or a new tab after that). */
export async function unlock(user, password) {
  const sodium = await loadSodium();
  const { data: { salt, vault } } = await api.get('/auth/vault');
  const { vaultKey } = splitPassword(sodium, password, salt);
  let contents;
  try {
    contents = openVault(sodium, vaultKey, vault);
  } catch {
    throw new Error('Incorrect password');
  }
  await rememberKeys(user.id, contents);
}

export async function changePassword(user, currentPassword, newPassword) {
  const sodium = await loadSodium();
  const { data: { salt } } = await api.get('/auth/vault');
  const { authKey: currentAuthKey } = splitPassword(sodium, currentPassword, salt);
  const newSaltValue = newSalt(sodium);
  const { authKey, vaultKey } = splitPassword(sodium, newPassword, newSaltValue);
  await api.post('/auth/password', {
    currentAuthKey, salt: newSaltValue, authKey, vault: sealVault(sodium, vaultKey, currentKeys()),
  });
}

/**
 * Forgotten password. The phrase regenerates the current keys; signing the server's challenge with
 * the current signing key proves it. Encryption keys from every version this phrase produced go
 * back into the new vault, so history stays readable. (Versions from before a reset came from a
 * different phrase and can't be recovered, by design.)
 */
export async function recover({ username, phrase, newPassword }) {
  const sodium = await loadSodium();
  const { data: { challenge, keyHistory } } = await api.get('/auth/recovery/challenge', { params: { username } });
  const history = verifyHistory(sodium, keyHistory);
  if (!history.ok) throw new Error(`This account's key history doesn't verify: ${history.problems[0]}`);

  const seed = seedFromPhrase(phrase);
  const current = deriveKeys(sodium, seed, history.current.version);
  if (toB64(sodium, current.signing.publicKey) !== history.current.signingKey) {
    throw new Error('That recovery phrase does not match this account');
  }
  let contents = null;
  keyHistory.forEach((entry) => {
    const keys = deriveKeys(sodium, seed, entry.version);
    if (toB64(sodium, keys.encryption.publicKey) === entry.encryptionKey) {
      contents = vaultContents(sodium, history.did, keys, contents);
    }
  });
  contents.signing = { version: current.version, privateKey: toB64(sodium, current.signing.privateKey) };

  const signature = toB64(sodium, sodium.crypto_sign_detached(utf8(`ghostchat-recovery:${challenge}`), current.signing.privateKey));
  const salt = newSalt(sodium);
  const { authKey, vaultKey } = splitPassword(sodium, newPassword, salt);
  const { data: { user } } = await api.post('/auth/recovery', {
    username, challenge, signature, salt, authKey, vault: sealVault(sodium, vaultKey, contents),
  });
  await rememberKeys(user.id, contents);
  return user;
}
