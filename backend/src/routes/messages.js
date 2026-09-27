const express = require('express');
const Joi = require('joi');
const Message = require('../models/message');
const Room = require('../models/room');
const User = require('../models/user');
const { validate, HttpError } = require('../errors');
const { requireAuth } = require('../auth');
const { access } = require('../services/chain');

const router = express.Router();
router.use(requireAuth);

const historyQuery = Joi.object({
  conversation: Joi.string().pattern(/^(dm:[0-9a-f]{24}:[0-9a-f]{24}|room:[0-9a-f]{32})$/).required(),
  after: Joi.number().integer().min(0),
  limit: Joi.number().integer().min(1).max(2000).default(100),
});

// Envelopes of one conversation in chain order. Without `after`, the latest `limit` of them;
// with it, everything after that sequence number (used to fill gaps and to load a full chain).
router.get('/', async (req, res) => {
  const { conversation, after, limit } = validate(historyQuery, req.query);
  if (!(await access(conversation, req.user.id))) throw new HttpError(403, 'Not a participant in this conversation');
  const messages = after === undefined
    ? (await Message.find({ conversation }).sort({ seq: -1 }).limit(limit)).reverse()
    : await Message.find({ conversation, seq: { $gt: after } }).sort({ seq: 1 }).limit(limit);
  res.json(messages);
});

// Every conversation the user is part of, most recent first, each with its latest envelope so
// the browser can decrypt a preview. The server can't produce previews itself.
router.get('/conversations', async (req, res) => {
  const me = req.user.id;
  const rooms = await Room.find({ members: me }, { _id: 1 });
  const dmPattern = new RegExp(`^dm:(${me}:[0-9a-f]{24}|[0-9a-f]{24}:${me})$`);
  const latest = await Message.aggregate([
    { $match: { $or: [{ conversation: dmPattern }, { conversation: { $in: rooms.map((r) => `room:${r._id}`) } }] } },
    { $sort: { seq: -1 } },
    { $group: { _id: '$conversation', envelope: { $first: '$envelope' }, at: { $first: '$receivedAt' } } },
    { $sort: { at: -1 } },
    { $limit: 200 },
  ]);
  const peerIds = latest.filter((c) => c._id.startsWith('dm:'))
    .map((c) => c._id.slice(3).split(':').find((id) => id !== me));
  const peers = new Map((await User.find({ _id: { $in: peerIds } })).map((u) => [u.id, u]));
  res.json(latest.map((c) => {
    if (c._id.startsWith('room:')) return { conversation: c._id, last: c.envelope };
    const peer = peers.get(c._id.slice(3).split(':').find((id) => id !== me));
    return peer ? { conversation: c._id, peer, last: c.envelope } : null;
  }).filter(Boolean));
});

module.exports = router;
