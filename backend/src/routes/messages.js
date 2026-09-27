const express = require('express');
const Joi = require('joi');
const Message = require('../models/message');
const Room = require('../models/room');
const User = require('../models/user');
const { validate, HttpError } = require('../errors');
const { requireAuth } = require('../auth');
const { access, checkDeletion, tombstone } = require('../services/chain');
const { visibleReceipts } = require('../services/receipts');

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

router.get('/receipts', async (req, res) => {
  const { conversation } = validate(historyQuery.fork(['after', 'limit'], (f) => f.strip()), req.query);
  const receipts = await visibleReceipts(conversation, req.user.id);
  if (!receipts) throw new HttpError(403, 'Not a participant in this conversation');
  res.json(receipts);
});

// Deleting one message: the author signs the deletion; the content is erased and a tombstone keeps
// the chain intact. Participants receive the tombstone like any other envelope.
router.post('/delete', async (req, res) => {
  const { deletion } = validate(Joi.object({ deletion: Joi.object().required() }), req.body);
  const problem = await checkDeletion(deletion, req.user.id);
  if (problem) throw new HttpError(400, problem);
  if (deletion.type !== 'delete') throw new HttpError(400, 'expected a single-message deletion');
  const message = await Message.findOne({ conversation: deletion.conversation, seq: deletion.seq });
  if (!message || message.envelope.hash !== deletion.hash) throw new HttpError(404, 'No such message');
  if (message.sender.toString() !== req.user.id) throw new HttpError(403, 'You can only delete your own messages');
  if (message.envelope.deleted) throw new HttpError(409, 'Already deleted');
  const envelope = tombstone(message.envelope, deletion);
  await Message.updateOne({ _id: message._id }, { $set: { envelope } });
  const who = await access(deletion.conversation, req.user.id);
  req.app.get('realtime')?.broadcastEnvelope(who, envelope);
  res.json(envelope);
});

module.exports = router;
