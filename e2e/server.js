// Starts the real backend, serving the built frontend, against a throwaway in-memory MongoDB.
const path = require('path');
const crypto = require('crypto');
const { MongoMemoryServer } = require('../backend/node_modules/mongodb-memory-server');

(async () => {
  const mongo = await MongoMemoryServer.create();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: process.env.PORT || '5055',
    MONGODB_URI: mongo.getUri(),
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    STATIC_DIR: path.resolve(__dirname, '../frontend/dist'),
    CORS_ORIGINS: `http://localhost:${process.env.PORT || '5055'}`,
    SECURE_COOKIES: 'false',
    // Every test signs up several users from the same IP.
    RATE_LIMIT_AUTH: '1000',
    RATE_LIMIT_API: '100000',
  });
  require('../backend/src/index');
})();
