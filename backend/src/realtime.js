const { Server } = require('socket.io');
const config = require('./config');
const Room = require('./models/room');
const { appendEnvelope } = require('./services/chain');
const { recordReceipt } = require('./services/receipts');
const { userFromCookieHeader } = require('./auth');

const userChannel = (id) => `user:${id}`;
const roomChannel = (id) => `room:${id}`;

/**
 * Socket.IO messaging. Every socket is authenticated from the session cookie during the
 * handshake; a message's signed sender must be that session's user, so a client can't post as
 * someone else, and the server only ever relays encrypted envelopes.
 *
 * Each user's sockets share a `user:<id>` channel (several tabs all receive their messages) and
 * join a `room:<id>` channel for every room they belong to.
 */
function createRealtime(httpServer, { presence, adapter } = {}) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    ...(adapter ? { adapter } : {}),
  });

  const broadcastEnvelope = (who, envelope) => {
    const channels = who.kind === 'dm' ? who.users.map(userChannel) : [roomChannel(who.room.id)];
    io.to(channels).emit('message', envelope);
  };

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

    // Envelopes are appended by the chain service, which checks signature, sender and chain link.
    // A stale link gets a 'conflict' reply with the missing messages; the client rebases and
    // resends on its own.
    socket.on('message', async (envelope, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      if (!allowMessage()) return reply({ status: 'error', error: 'Slow down' });
      try {
        const result = await appendEnvelope(envelope, user.id);
        if (result.status !== 'ok') return reply(result);
        broadcastEnvelope(result.access, result.envelope);
        return reply({ status: 'ok', envelope: result.envelope });
      } catch (err) {
        console.error(err);
        return reply({ status: 'error', error: 'Could not send the message' });
      }
    });

    // Signed read receipts, only between people who both have receipts turned on.
    socket.on('receipt', async (receipt, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const result = await recordReceipt(receipt, user.id);
        if (result.status !== 'ok') return reply(result);
        if (result.receipt) io.to(result.audience.map(userChannel)).emit('receipt', result.receipt);
        return reply({ status: 'ok' });
      } catch (err) {
        console.error(err);
        return reply({ status: 'error', error: 'Could not record the receipt' });
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
    broadcastEnvelope,
    // Called by the REST routes after a user creates or joins a room, so their open sockets start
    // receiving its messages without reconnecting.
    subscribeUserToRoom(userId, roomId) {
      io.in(userChannel(userId)).socketsJoin(roomChannel(roomId));
    },
    unsubscribeUserFromRoom(userId, roomId) {
      io.in(userChannel(userId)).socketsLeave(roomChannel(roomId));
    },
    // Membership and key changes, so open clients refresh the room without polling.
    roomChanged(roomId, change) {
      io.to(roomChannel(roomId)).emit('room', { room: roomId, ...change });
    },
    // Ends a deleted user's open sessions; their cookie is still a valid JWT until it expires.
    disconnectUser(userId) {
      io.in(userChannel(userId)).disconnectSockets(true);
    },
    // Everyone drops their cached copy of this user's key history; the user's other devices must
    // unlock the new vault.
    keysChanged(userId, version) {
      io.emit('keys-changed', { user: userId, version });
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
