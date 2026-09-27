import sodiumModule from 'libsodium-wrappers-sumo';

let ready;

/** libsodium, initialised once. The sumo build is needed for Argon2id. */
export function sodium() {
  if (!ready) ready = sodiumModule.ready.then(() => sodiumModule);
  return ready;
}
