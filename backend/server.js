const redis = require('redis');
const io = require('socket.io')(8000, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5000'],
    credentials: true,
  },
});

const app = require('./App');
const config = require('./utils/config.utils');
const log = require('./utils/logger.utils');

// Initialize clientStack
const client = redis.createClient({
  // Enable legacy mode for compatibility with older versions of Node Redis
  legacyMode: true
});

// Connect to Redis
client.connect().catch(console.error);

// Handle errors
client.on('error', (error) => {
  console.error('Redis client error:', error);
});

// Socket methods
io.on('connection', (socket) => {
  // Log connection
  log.info(`${socket.id} connected`);

  // Add to list of online users and inform other users
  socket.on('login', async (id, username) => {
    try {
      await client.set(`online_users:${id}`, socket.id);
      socket.broadcast.emit('changed-socket', id, 'online', socket.id);
    } catch (error) {
      console.error(error);
    }
  });

  // Handle change of user status
  socket.on('status', async (id, cb) => {
    try {
      const socketId = await client.get(`online_users:${id}`);
      cb(socketId ? 'online' : 'offline', socketId);
    } catch (error) {
      console.error(error);
      cb('offline', null);
    }
  });

  // Handle sending of messages
  socket.on('message', async (message, to) => {
    try {
      const socketId = await client.get(`online_users:${to}`);
      if (socketId) {
        io.to(socketId).emit('receive-message', message);
      } else {
        await client.lpush(`offline_messages:${to}`, JSON.stringify(message));
      }
    } catch (error) {
      console.error(error);
    }
  });

  // Handle logging out
  socket.on('logout', async (id) => {
    try {
      await client.del(`online_users:${id}`);
      await client.del(`offline_messages:${id}`);
      socket.broadcast.emit('changed-socket', id, 'offline', null);
    } catch (error) {
      console.error(error);
    }
  });
});

// Listen for server shutdown
process.on('SIGINT', () => {
  // Gracefully close the Redis client
  client.quit(() => {
    console.log('Redis client disconnected');
    // Exit the process
    process.exit();
  });
});

app.listen(config.PORT, () => {
  log.info(`Server running on port ${config.PORT}`);
});
