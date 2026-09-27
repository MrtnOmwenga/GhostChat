const http = require('http');
const mongoose = require('mongoose');
const request = require('supertest');
const { io: connect } = require('socket.io-client');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { createRealtime } = require('../src/realtime');
const { MemoryPresence } = require('../src/presence');

/** Starts the full server (HTTP + Socket.IO) on a random port against an in-memory MongoDB. */
async function startServer() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = createApp();
  const server = http.createServer(app);
  const realtime = createRealtime(server, { presence: new MemoryPresence() });
  app.set('realtime', realtime);
  await new Promise((resolve) => { server.listen(0, resolve); });
  const url = `http://localhost:${server.address().port}`;

  return {
    app,
    url,
    async reset() {
      await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
    },
    async stop() {
      realtime.close();
      await new Promise((resolve) => { server.close(resolve); });
      await mongoose.disconnect();
      await mongo.stop();
    },
  };
}

/** Registers a user and returns a supertest agent carrying their session cookie. */
async function signUp(app, username, password = 'correct horse') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ username, password }).expect(201);
  const cookie = res.headers['set-cookie'][0].split(';')[0];
  return { agent, user: res.body, cookie };
}

function connectSocket(url, cookie) {
  return new Promise((resolve, reject) => {
    const socket = connect(url, { extraHeaders: cookie ? { cookie } : {}, reconnection: false, forceNew: true });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => { socket.close(); reject(err); });
  });
}

const nextEvent = (socket, event) => new Promise((resolve) => { socket.once(event, resolve); });
const emitAck = (socket, event, payload) => new Promise((resolve) => { socket.emit(event, payload, resolve); });

module.exports = { startServer, signUp, connectSocket, nextEvent, emitAck };
