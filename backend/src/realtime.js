const { Server } = require('socket.io');
const config = require('./config');
const Message = require('./models/message');
const Room = require('./models/room');
const User = require('./models/user');
const schemas = require('./validation');
const { userFromCookieHeader } = require('./auth');

const userChannel = (id) => `user:${id}`;
const roomChannel = (id) => `room:${id}`;

/**
 * Socket.IO messaging. Every socket is authenticated from the session cookie during the
 * handshake, and the sender of a message is always taken from that session, never from the
 * payload, so a client can't post as someone else.
 *
 * Each user's sockets share a `user:<id>` channel (several tabs all receive their messages) and
 * join a `room:<id>` channel for every room they belong to.
 */
function createRealtime(httpServer, { presence, adapter } = {}) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    ...(adapter ? { adapter } : {}),
  });

  io.use((socket, next) => {
    const user = userFromCookieHeader(socket.handshake.headers.cookie);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    return next();
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(userChannel(user.id));

    // Handlers are registered before any await, so an event sent right after connecting can't
    // arrive before its handler exists.
    const allowMessage = messageBudget(config.rateLimits.messagesPer10s, 10_000);

    socket.on('presence', async (userIds, ack) => {
      if (typeof ack !== 'function' || !Array.isArray(userIds)) return;
      const ids = userIds.filter((id) => typeof id === 'string').slice(0, 200);
      ack(await presence.online(ids));
    });

    socket.on('message', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      if (!allowMessage()) return reply({ error: 'Slow down' });

      const { error, value } = schemas.outgoingMessage.validate(payload, { stripUnknown: true });
      if (error) return reply({ error: error.message });

      try {
        if (value.to && !(await User.exists({ _id: value.to }))) {
          return reply({ error: 'No such user' });
        }
        if (value.room) {
          // Membership is checked on every message, not cached: a user removed from a room
          // must stop being able to post immediately.
          const isMember = await Room.exists({ _id: value.room, members: user.id });
          if (!isMember) return reply({ error: 'Not a member of this room' });
        }
        const message = await Message.create({
          from: user.id, fromUsername: user.username, to: value.to, room: value.room, text: value.text,
        });
        const json = message.toJSON();
        if (value.room) {
          io.to(roomChannel(value.room)).emit('message', json);
        } else {
          io.to([userChannel(value.to), userChannel(user.id)]).emit('message', json);
        }
        return reply({ message: json });
      } catch (err) {
        console.error(err);
        return reply({ error: 'Could not send the message' });
      }
    });

    socket.on('disconnect', async () => {
      if (await presence.disconnect(user.id)) {
        io.emit('presence', { userId: user.id, online: false });
      }
    });

    (async () => {
      const rooms = await Room.find({ members: user.id }, { _id: 1 });
      rooms.forEach((room) => socket.join(roomChannel(room.id)));
      if (await presence.connect(user.id)) {
        socket.broadcast.emit('presence', { userId: user.id, online: true });
      }
    })().catch((err) => console.error(err));
  });

  return {
    io,
    // Called by the REST routes after a user creates or joins a room, so their open sockets start
    // receiving its messages without reconnecting.
    subscribeUserToRoom(userId, roomId) {
      io.in(userChannel(userId)).socketsJoin(roomChannel(roomId));
    },
    announce(roomId, text) {
      io.to(roomChannel(roomId)).emit('announcement', { room: roomId, text, createdAt: new Date() });
    },
    close: () => io.close(),
  };
}

/** A fixed-window counter: at most `limit` calls per `windowMs`. */
function messageBudget(limit, windowMs) {
  let windowStart = Date.now();
  let used = 0;
  return () => {
    const now = Date.now();
    if (now - windowStart >= windowMs) {
      windowStart = now;
      used = 0;
    }
    used += 1;
    return used <= limit;
  };
}

module.exports = { createRealtime };
