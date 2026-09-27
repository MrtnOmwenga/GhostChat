const Joi = require('joi');

const username = Joi.string().trim().min(3).max(32).pattern(/^[A-Za-z0-9 _-]+$/)
  .messages({ 'string.pattern.base': 'Username may contain letters, numbers, spaces, - and _' });
const roomName = username.messages({ 'string.pattern.base': 'Room name may contain letters, numbers, spaces, - and _' });
const password = Joi.string().min(8).max(128);
const objectId = Joi.string().hex().length(24);

module.exports = {
  credentials: Joi.object({ username: username.required(), password: password.required() }),
  profileUpdate: Joi.object({ username, password }).min(1),
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
