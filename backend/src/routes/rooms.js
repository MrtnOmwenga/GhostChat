const express = require('express');
const bcrypt = require('bcryptjs');
const config = require('../config');
const Room = require('../models/room');
const Message = require('../models/message');
const schemas = require('../validation');
const { validate, HttpError } = require('../errors');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/mine', async (req, res) => {
  res.json(await Room.find({ members: req.user.id }).sort({ name: 1 }));
});

router.post('/', async (req, res) => {
  const { name, password } = validate(schemas.room, req.body);
  const room = await Room.create({
    name,
    passwordHash: await bcrypt.hash(password, config.bcryptRounds),
    creator: req.user.id,
    members: [req.user.id],
  });
  req.app.get('realtime')?.subscribeUserToRoom(req.user.id, room.id);
  res.status(201).json(room);
});

router.post('/join', async (req, res) => {
  const { name, password } = validate(schemas.room, req.body);
  const room = await Room.findOne({ name });
  const ok = room && await bcrypt.compare(password, room.passwordHash);
  if (!ok) throw new HttpError(401, 'Incorrect room name or password');

  const alreadyMember = room.members.some((m) => m.toString() === req.user.id);
  if (!alreadyMember) {
    room.members.push(req.user.id);
    await room.save();
    const realtime = req.app.get('realtime');
    realtime?.subscribeUserToRoom(req.user.id, room.id);
    realtime?.announce(room.id, `${req.user.username} joined the room`);
  }
  res.json(room);
});

router.delete('/:id', async (req, res) => {
  const id = validate(schemas.objectId, req.params.id);
  const room = await Room.findById(id);
  if (!room) throw new HttpError(404, 'Room not found');
  if (room.creator.toString() !== req.user.id) throw new HttpError(403, 'Only the creator can delete a room');
  await Message.deleteMany({ room: room.id });
  await room.deleteOne();
  res.status(204).end();
});

module.exports = router;
