const { instrument } = require('@socket.io/admin-ui');

// Instantiate socket
const io = require('socket.io')(8000, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5000', 'https://admin.socket.io/'],
    credentials: true,
  },
});

// Import dependencies
const app = require('./App'); // the actual Express application
const config = require('./utils/config.utils');
const Queue = require('./services/queue.service');
const log = require('./utils/logger.utils');

// Store online users
let users = [];

// Socket methods
io.on('connection', (socket) => {
  // Log connection
  log.info(`${socket.id} connected`);

  // Add to list of onlune users
  socket.on('login', (id, username) => {
    const Index = users.findIndex((x) => x.id === id);
    if (Index === -1) {
      users = users.concat({ id, username, socket_id: socket.id });
    } else {
      users[Index] = { id, username, socket_id: socket.id };
    }

    // Inform other users that you're online
    socket.broadcast.emit('changed-socket', id, 'online', socket.id);
  });

  // Handle change of user status
  socket.on('status', (id, cb) => {
    const Index = users.findIndex((x) => x.id === id);
    if (Index === -1) {
      cb('offline', null);
    } else {
      cb('online', users[Index].socket_id);
    }
  });

  // Handle sending of messages
  socket.on('message', (message, to) => {
    if (to !== '') {
      socket.to(to).emit('receive-message', message);
    }
  });

  // Handle storing of messages sent to offline users
  socket.on('offline-queue', (message) => {
    const index = Queue.OfflineQueue.findIndex((object) => object.to === message.to);
    if (index === -1) {
      Queue.OfflineQueue.push({
        to: message.to,
        messages: [
          { ...message },
        ],
      });
    } else {
      Queue.OfflineQueue[index].messages.push({ ...message });
    }
  });

  // Handle users coming back online with messages sent to them while they were offline
  socket.on('now-online', (id, cb) => {
    const NewMessages = Queue.OfflineQueue.filter((message) => message.to === id);
    cb(NewMessages[0]?.messages);
  });

  // handle joining of rooms
  socket.on('join-room', (name, id, cb) => {
    if (name !== '' && id) {
      socket.join(id);
      cb(`Joined ${name}`);
      return;
    }
    cb('Room not found');
  });

  // Handle logging out
  socket.on('logout', (id) => {
    const Index = users.findIndex((x) => x.id === id);
    if (Index !== -1) {
      users.splice(Index, 1);
    }
    const index = Queue.OfflineQueue.findIndex((x) => x.to === id);
    if (index !== -1) {
      Queue.OfflineQueue.splice(index, 1);
    }
    socket.broadcast.emit('changed-socket', id, 'offline', null);
  });
});

app.listen(config.PORT, () => {
  log.info(`Server running on port ${config.PORT}`);
});

instrument(io, { auth: false });
