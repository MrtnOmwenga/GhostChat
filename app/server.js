/* The code is setting up a server using the Socket.IO library in JavaScript. Here's a breakdown of
what the code does: */
const { instrument } = require('@socket.io/admin-ui');

// Instantiate socket
const io = require('socket.io')(8000, {
  cors: {
    origin: ['http://localhost:3000', 'https://admin.socket.io/', 'http://localhost:5000'],
    credentials: true,
  },
});

// Import dependencies

const app = require('./App'); // the actual Express application
const config = require('./utils/config');
const Queue = require('./Services/Queue');
const log = require('./utils/logger');

// Store online users
let users = [];

// Socket methods
io.on('connection', (socket) => {
  // Log connection
  log.info(`${socket.id} connected`);

  // Add to list of online users
  /* The `socket.on('login', (id, username) => { ... })` function is an event listener that listens for
  the 'login' event emitted by the client. */
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
  /* The `socket.on('status', (id, cb) => { ... })` function is an event listener that listens for the
  'status' event emitted by the client. */
  socket.on('status', (id, cb) => {
    const Index = users.findIndex((x) => x.id === id);
    if (Index === -1) {
      cb('offline', null);
    } else {
      cb('online', users[Index].socket_id);
    }
  });

  // Handle sending of messages
  /* The `socket.on('message', (message, to) => { ... })` function is an event listener that listens
  for the 'message' event emitted by the client. */
  socket.on('message', (message, to) => {
    if (to !== '') {
      socket.to(to).emit('receive-message', message);
    }
  });

  // Handle storing of messages sent to offline users
  /* The `socket.on('offline-queue', (message) => { ... })` function is an event listener that listens
  for the 'offline-queue' event emitted by the client. */
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
  /* The `socket.on('now-online', (id, cb) => { ... })` function is an event listener that listens for
  the 'now-online' event emitted by the client. */
  socket.on('now-online', (id, cb) => {
    const NewMessages = Queue.OfflineQueue.filter((message) => message.to === id);
    cb(NewMessages[0]?.messages);
  });

  // handle joining of rooms
  /* The `socket.on('join-room', (name, id, cb) => { ... })` function is an event listener that listens
  for the 'join-room' event emitted by the client. */
  socket.on('join-room', (name, id, cb) => {
    if (name !== '' && id) {
      socket.join(id);
      cb(`Joined ${name}`);
      return;
    }
    cb('Room not found');
  });

  // Handle logging out
  /* The `socket.on('logout', (id) => { ... })` function is an event listener that listens for the
  'logout' event emitted by the client. When this event is triggered, the code inside the function
  is executed. */
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

/* `app.listen(config.PORT, () => { ... })` is starting the server and listening for incoming requests
on the specified port. */
app.listen(config.PORT, () => {
  log.info(`Server running on port ${config.PORT}`);
});

/* The `instrument(io, { auth: false })` function is used to enable the Socket.IO Admin UI. It allows
you to monitor and manage the Socket.IO server in real-time. The `io` parameter is the Socket.IO
server instance, and the `{ auth: false }` option disables authentication for accessing the admin
UI. */
instrument(io, { auth: false });
