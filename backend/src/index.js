const http = require('http');
const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');
const { createRealtime } = require('./realtime');
const { MemoryPresence, RedisPresence } = require('./presence');

async function start() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');

  let presence = new MemoryPresence();
  let adapter;
  if (config.redisUrl) {
    const { createClient } = require('redis');
    const { createAdapter } = require('@socket.io/redis-adapter');
    const pub = createClient({ url: config.redisUrl });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    // With Redis, several instances can run behind a load balancer: the adapter relays events
    // between them and presence counts are shared.
    adapter = createAdapter(pub, sub);
    presence = new RedisPresence(pub);
    console.log('Using Redis for presence and cross-instance events');
  }

  const app = createApp();
  const server = http.createServer(app);
  const realtime = createRealtime(server, { presence, adapter });
  app.set('realtime', realtime);

  server.listen(config.port, () => console.log(`GhostChat listening on port ${config.port}`));

  const shutdown = async () => {
    realtime.close();
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
