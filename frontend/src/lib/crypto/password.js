import { toB64, fromB64 } from './encoding';

// 64 MiB and 3 passes: slows offline guessing against the vault while staying usable on phones.
export const ARGON2_OPS = 3;
export const ARGON2_MEM = 64 * 1024 * 1024;

export const newSalt = (sodium) => toB64(sodium, sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES));

/**
 * Splits a password into two independent keys. `authKey` is sent to the server, which bcrypts it
 * like a password; `vaultKey` never leaves the browser and encrypts the private keys. The server
 * sees only the first half of the Argon2id output, so it can't derive the second.
 */
export function splitPassword(sodium, password, saltB64) {
  const master = sodium.crypto_pwhash(
    64, password, fromB64(sodium, saltB64), ARGON2_OPS, ARGON2_MEM, sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
  return { authKey: toB64(sodium, master.slice(0, 32)), vaultKey: master.slice(32, 64) };
}

let zxcvbn;

/** zxcvbn score (0-4) and feedback. Loaded on demand: the dictionaries are large. */
export async function passwordStrength(password, userInputs = []) {
  if (!zxcvbn) {
    const [core, common, en] = await Promise.all([
      import('@zxcvbn-ts/core'), import('@zxcvbn-ts/language-common'), import('@zxcvbn-ts/language-en'),
    ]);
    zxcvbn = new core.ZxcvbnFactory({
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary },
      translations: en.translations,
    });
  }
  const result = zxcvbn.check(password, userInputs);
  return { score: result.score, warning: result.feedback.warning, suggestions: result.feedback.suggestions };
}

export const MIN_PASSWORD_SCORE = 3;
