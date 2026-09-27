const express = require('express');
const Message = require('../models/message');
const Room = require('../models/room');
const schemas = require('../validation');
const { validate, HttpError } = require('../errors');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const PAGE_SIZE = 100;

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
