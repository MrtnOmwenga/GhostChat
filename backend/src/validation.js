const Joi = require('joi');

const username = Joi.string().trim().min(3).max(32).pattern(/^[A-Za-z0-9 _-]+$/)
  .messages({ 'string.pattern.base': 'Username may contain letters, numbers, spaces, - and _' });
const roomName = username.messages({ 'string.pattern.base': 'Room name may contain letters, numbers, spaces, - and _' });
const password = Joi.string().min(8).max(128);
const b64 = (bytes) => Joi.string().pattern(/^[A-Za-z0-9_-]+$/).length(Math.ceil((bytes * 4) / 3));
const vault = Joi.object({
  nonce: b64(24).required(),
  ciphertext: Joi.string().pattern(/^[A-Za-z0-9_-]+$/).max(65536).required(),
});
const keyEntry = Joi.object().unknown(true);
const objectId = Joi.string().hex().length(24);

module.exports = {
  usernameQuery: Joi.object({ username: username.required() }),
  register: Joi.object({
    username: username.required(), salt: b64(16).required(), authKey: b64(32).required(), vault: vault.required(), keyEntry: keyEntry.required(),
  }),
  login: Joi.object({ username: username.required(), authKey: b64(32).required() }),
  passwordChange: Joi.object({
    currentAuthKey: b64(32).required(), salt: b64(16).required(), authKey: b64(32).required(), vault: vault.required(),
  }),
  recovery: Joi.object({
    username: username.required(), challenge: Joi.string().hex().length(64).required(), signature: b64(64).required(),
    salt: b64(16).required(), authKey: b64(32).required(), vault: vault.required(),
  }),
  // 48 kB of ciphertext holds several hundred verified contacts.
  pins: Joi.object({
    nonce: b64(24).required(),
    ciphertext: Joi.string().pattern(/^[A-Za-z0-9_-]+$/).max(48 * 1024).required(),
    baseVersion: Joi.number().integer().min(0).required(),
  }),
  room: Joi.object({ name: roomName.required(), password: password.required() }),
  search: Joi.object({ q: Joi.string().trim().min(1).max(32).pattern(/^[A-Za-z0-9 _-]+$/).required() }),
  history: Joi.object({ with: objectId, room: objectId }).xor('with', 'room'),
  objectId: objectId.required(),
  outgoingMessage: Joi.object({
    to: objectId,
    room: objectId,
    text: Joi.string().trim().min(1).max(2000).required(),
  }).xor('to', 'room'),
};
