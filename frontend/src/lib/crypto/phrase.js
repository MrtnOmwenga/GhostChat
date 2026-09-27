import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { utf8 } from './encoding';

/** A new 24-word recovery phrase (256 bits of entropy). */
export const generatePhrase = () => generateMnemonic(wordlist, 256);

export const isValidPhrase = (phrase) => validateMnemonic(normalizePhrase(phrase), wordlist);

export const normalizePhrase = (phrase) => phrase.trim().toLowerCase().split(/\s+/).join(' ');

export const seedFromPhrase = (phrase) => mnemonicToSeedSync(normalizePhrase(phrase));

/**
 * Key version `version` of the account whose phrase produced `seed`. Every key an account will
 * ever use comes from here, which is what lets the phrase alone recover an account and lets each
 * key entry commit in advance to the next signing key (pre-rotation).
 */
export function deriveKeys(sodium, seed, version) {
  const subkey = (purpose) => sodium.crypto_generichash(32, utf8(`ghostchat/${purpose}/${version}`), seed);
  const signing = sodium.crypto_sign_seed_keypair(subkey('signing'));
  const encryption = sodium.crypto_box_seed_keypair(subkey('encryption'));
  return {
    version,
    signing: { publicKey: signing.publicKey, privateKey: signing.privateKey },
    encryption: { publicKey: encryption.publicKey, privateKey: encryption.privateKey },
  };
}
