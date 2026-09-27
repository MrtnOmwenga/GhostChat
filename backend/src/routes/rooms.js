const express = require('express');
const Joi = require('joi');
const Room = require('../models/room');
const RoomKey = require('../models/roomKey');
const Invite = require('../models/invite');
const Message = require('../models/message');
const KeyEntry = require('../models/keyEntry');
const { validate, HttpError } = require('../errors');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const b64 = Joi.string().pattern(/^[A-Za-z0-9_-]+$/);
const roomId = Joi.string().hex().length(32).required();
const sealedKey = Joi.object({ keyVersion: Joi.number().integer().min(1).required(), sealed: b64.length(107).required() });
const roomName = Joi.string().trim().min(1).max(48).required();

const memberRoom = async (id, userId) => {
  const room = await Room.findOne({ _id: id, members: userId });
  if (!room) throw new HttpError(404, 'Room not found');
  return room;
};

/** The user's copy of each epoch key of a room, so its whole history can be decrypted. */
const myKeys = (room, userId) => RoomKey.find({ room, user: userId }).sort({ epoch: 1 });

async function describe(room, userId) {
  await room.populate('members', 'username');
  return { ...room.toJSON(), keys: (await myKeys(room.id, userId)).map((k) => k.toJSON()) };
}

router.get('/mine', async (req, res) => {
  const rooms = await Room.find({ members: req.user.id }).sort({ name: 1 });
  res.json(await Promise.all(rooms.map((room) => describe(room, req.user.id))));
});

router.get('/:id', async (req, res) => {
  res.json(await describe(await memberRoom(validate(roomId, req.params.id), req.user.id), req.user.id));
});

// The creator generates the first room key in the browser and uploads it sealed to themselves.
router.post('/', async (req, res) => {
  const { name, key } = validate(Joi.object({ name: roomName, key: sealedKey.required() }), req.body);
  const room = await Room.create({ name, creator: req.user.id, members: [req.user.id] });
  await RoomKey.create({ room: room.id, epoch: 1, user: req.user.id, ...key });
  req.app.get('realtime')?.subscribeUserToRoom(req.user.id, room.id);
  res.status(201).json(await describe(room, req.user.id));
});

// Invites carry every epoch key encrypted under the link's secret; the server can't read them.
router.post('/:id/invites', async (req, res) => {
  const room = await memberRoom(validate(roomId, req.params.id), req.user.id);
  const body = validate(Joi.object({
    keys: Joi.array().items(Joi.object({ epoch: Joi.number().integer().min(1).required(), nonce: b64.length(32).required(), ciphertext: b64.max(200).required() })).required(),
    expiresInHours: Joi.number().integer().min(1).max(24 * 30).default(24 * 7),
    singleUse: Joi.boolean().default(false),
  }), req.body);
  if (room.rotationPending) throw new HttpError(409, 'Replace the room key before inviting anyone');
  const epochs = body.keys.map((k) => k.epoch).sort((a, b) => a - b);
  if (epochs.join() !== Array.from({ length: room.epoch }, (_, i) => i + 1).join()) {
    throw new HttpError(400, `An invite must carry the keys for epochs 1 to ${room.epoch}`);
  }
  const invite = await Invite.create({
    room: room.id,
    keys: body.keys,
    createdBy: req.user.id,
    usesLeft: body.singleUse ? 1 : null,
    expiresAt: new Date(Date.now() + body.expiresInHours * 3600 * 1000),
  });
  res.status(201).json({ id: invite.id, expiresAt: invite.expiresAt });
});

// Rotation: a member replaces the room key, sealing the new one to every current member.
router.post('/:id/rotate', async (req, res) => {
  const room = await memberRoom(validate(roomId, req.params.id), req.user.id);
  const { epoch, keys } = validate(Joi.object({
    epoch: Joi.number().integer().min(2).required(),
    keys: Joi.object().pattern(Joi.string().hex().length(24), sealedKey).required(),
  }), req.body);
  if (epoch !== room.epoch + 1) throw new HttpError(409, `The room key is already at epoch ${room.epoch}`);
  const members = room.members.map(String).sort();
  if (Object.keys(keys).sort().join() !== members.join()) throw new HttpError(400, 'The new key must be sealed to every current member');
  for (const [user, key] of Object.entries(keys)) {
    // eslint-disable-next-line no-await-in-loop
    const current = await KeyEntry.findOne({ user }).sort({ version: -1 });
    if (current?.version !== key.keyVersion) throw new HttpError(400, "Seal the key to each member's current encryption key");
  }
  const updated = await Room.findOneAndUpdate(
    { _id: room.id, epoch: room.epoch },
    { $set: { epoch, rotationPending: false } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(409, 'Someone else replaced the room key first');
  await RoomKey.insertMany(Object.entries(keys).map(([user, key]) => ({ room: room.id, epoch, user, ...key })));
  await Invite.deleteMany({ room: room.id });
  req.app.get('realtime')?.roomChanged(room.id, { type: 'rotated', epoch });
  res.json(await describe(updated, req.user.id));
});

// Leaving drops the member's keys and cancels invites; the next message sent to the room first
// replaces the key, so the leaver can't read anything new.
router.post('/:id/leave', async (req, res) => {
  const room = await memberRoom(validate(roomId, req.params.id), req.user.id);
  await leaveRoom(room, req.user.id, req.app.get('realtime'));
  res.status(204).end();
});

async function leaveRoom(room, userId, realtime) {
  await RoomKey.deleteMany({ room: room.id, user: userId });
  const remaining = room.members.filter((m) => m.toString() !== userId);
  if (remaining.length === 0) {
    await Promise.all([Room.deleteOne({ _id: room.id }), RoomKey.deleteMany({ room: room.id }), Invite.deleteMany({ room: room.id }), Message.deleteMany({ conversation: `room:${room.id}` })]);
    return;
  }
  await Room.updateOne({ _id: room.id }, {
    $pull: { members: userId },
    $set: { rotationPending: true, ...(room.creator.toString() === userId ? { creator: remaining[0] } : {}) },
  });
  await Invite.deleteMany({ room: room.id });
  realtime?.unsubscribeUserFromRoom(userId, room.id);
  realtime?.roomChanged(room.id, { type: 'member-left', user: userId });
}

router.delete('/:id', async (req, res) => {
  const room = await memberRoom(validate(roomId, req.params.id), req.user.id);
  if (room.creator.toString() !== req.user.id) throw new HttpError(403, 'Only the creator can delete a room');
  await Promise.all([RoomKey.deleteMany({ room: room.id }), Invite.deleteMany({ room: room.id }), Message.deleteMany({ conversation: `room:${room.id}` })]);
  await room.deleteOne();
  req.app.get('realtime')?.roomChanged(room.id, { type: 'deleted' });
  res.status(204).end();
});

const invites = express.Router();
invites.use(requireAuth);

const usableInvite = async (id) => {
  const invite = await Invite.findById(validate(Joi.string().hex().length(24).required(), id));
  if (!invite || invite.expiresAt < new Date() || invite.usesLeft === 0) throw new HttpError(404, 'This invite has expired or been used');
  return invite;
};

invites.get('/:id', async (req, res) => {
  const invite = await usableInvite(req.params.id);
  const room = await Room.findById(invite.room);
  res.json({ room: { id: room.id, name: room.name, epoch: room.epoch }, keys: invite.keys });
});

// Accepting: the joiner decrypted the epoch keys with the link's secret and uploads them sealed
// to their own encryption key.
invites.post('/:id/accept', async (req, res) => {
  const invite = await usableInvite(req.params.id);
  const room = await Room.findById(invite.room);
  const { keys } = validate(Joi.object({
    keys: Joi.array().items(Joi.object({ epoch: Joi.number().integer().min(1).required() }).concat(sealedKey)).required(),
  }), req.body);
  if (room.members.some((m) => m.toString() === req.user.id)) return res.json(await describe(room, req.user.id));
  if (keys.map((k) => k.epoch).sort((a, b) => a - b).join() !== Array.from({ length: room.epoch }, (_, i) => i + 1).join()) {
    throw new HttpError(400, 'Upload your copy of every epoch key');
  }
  if (invite.usesLeft !== null) {
    const claimed = await Invite.findOneAndUpdate({ _id: invite.id, usesLeft: { $gt: 0 } }, { $inc: { usesLeft: -1 } });
    if (!claimed) throw new HttpError(404, 'This invite has expired or been used');
  }
  await Room.updateOne({ _id: room.id }, { $addToSet: { members: req.user.id } });
  await RoomKey.insertMany(keys.map((k) => ({ room: room.id, user: req.user.id, ...k })));
  const realtime = req.app.get('realtime');
  realtime?.subscribeUserToRoom(req.user.id, room.id);
  realtime?.roomChanged(room.id, { type: 'member-joined', user: req.user.id });
  return res.json(await describe(await Room.findById(room.id), req.user.id));
});

module.exports = { rooms: router, invites, leaveRoom };
