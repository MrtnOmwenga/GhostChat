const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/message');
const Room = require('../models/room');
const User = require('../models/user');
const schemas = require('../validation');
const { validate, HttpError } = require('../errors');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const PAGE_SIZE = 100;

// People the user has exchanged direct messages with, most recent conversation first, so the
// sidebar can be rebuilt after a reload.
router.get('/conversations', async (req, res) => {
  const me = new mongoose.Types.ObjectId(req.user.id);
  const latest = await Message.aggregate([
    { $match: { to: { $ne: null }, $or: [{ from: me }, { to: me }] } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: { $cond: [{ $eq: ['$from', me] }, '$to', '$from'] }, lastAt: { $first: '$createdAt' } } },
    { $sort: { lastAt: -1 } },
    { $limit: PAGE_SIZE },
  ]);
  const users = await User.find({ _id: { $in: latest.map((c) => c._id) } });
  const byId = new Map(users.map((u) => [u.id, u]));
  res.json(latest.map((c) => byId.get(c._id.toString())).filter(Boolean));
});

// The latest messages of one conversation, oldest first. Only its participants can read it.
router.get('/', async (req, res) => {
  const query = validate(schemas.history, req.query);
  const me = req.user.id;

  let filter;
  if (query.room) {
    const isMember = await Room.exists({ _id: query.room, members: me });
    if (!isMember) throw new HttpError(403, 'Not a member of this room');
    filter = { room: query.room };
  } else {
    filter = { $or: [{ from: me, to: query.with }, { from: query.with, to: me }] };
  }

  const latest = await Message.find(filter).sort({ createdAt: -1 }).limit(PAGE_SIZE);
  res.json(latest.reverse());
});

module.exports = router;
