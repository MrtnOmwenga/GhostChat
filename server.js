const { instrument } = require('@socket.io/admin-ui');

const io = require('socket.io')(8000, {
  cors: {
    origin: ['http://localhost:3000', 'https://admin.socket.io/'],
    credentials: true,
  },
});
const app = require('./App'); // the actual Express application
const config = require('./utils/config');
const log = require('./utils/logger');

let users = [];

io.on('connection', (socket) => {
  log.info(`${socket.id} connected`);

  socket.on('login', (id, username) => {
    const Index = users.findIndex((x) => x.id === id);
    if (Index === -1) {
      users = users.concat({ id, username, socket_id: socket.id });
    } else {
      users[Index] = { id, username, socket_id: socket.id };
    }

    socket.broadcast.emit('changed-socket', id, 'online', socket.id);
  });

  socket.on('status', (id, cb) => {
    const Index = users.findIndex((x) => x.id === id);
    if (Index === -1) {
      cb('offline', null);
    } else {
      cb('online', users[Index].socket_id);
    }
  });

  socket.on('message', (message, to) => {
    if (to !== '') {
      socket.to(to).emit('receive-message', message);
    }
  });

  socket.on('logout', (id) => {
    const Index = users.findIndex((x) => x.id === id);
    if (Index !== -1) {
      users.splice(Index, 1);
    }
    socket.broadcast.emit('changed-socket', id, 'offline', null);
  });
});

app.listen(config.PORT, () => {
  log.info(`Server running on port ${config.PORT}`);
});

instrument(io, { auth: false });
