const env = process.env;

const isProduction = env.NODE_ENV === 'production';

// A short or default secret makes every session forgeable, so the server refuses to start with one.
const jwtSecret = env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters (e.g. `openssl rand -hex 32`)');
}

module.exports = {
  isProduction,
  port: Number(env.PORT) || 5000,
  mongoUri: env.MONGODB_URI || 'mongodb://localhost:27017/ghostchat',
  redisUrl: env.REDIS_URL || null,
  jwtSecret,
  sessionHours: Number(env.SESSION_HOURS) || 12,
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((o) => o.trim()),
  staticDir: env.STATIC_DIR || null,
  rateLimits: {
    apiPer15Min: Number(env.RATE_LIMIT_API) || 300,
    authPer15Min: Number(env.RATE_LIMIT_AUTH) || 10,
    messagesPer10s: Number(env.RATE_LIMIT_MESSAGES) || 20,
  },
};
