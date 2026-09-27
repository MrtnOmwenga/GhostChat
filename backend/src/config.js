const env = process.env;

const isProduction = env.NODE_ENV === 'production';

// A short or default secret makes every session forgeable, so the server refuses to start with one.
const jwtSecret = env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters (e.g. `openssl rand -hex 32`)');
}

// Secure cookies and HTTPS upgrades need TLS in front of the app; off for plain-HTTP local runs.
const secureTransport = env.SECURE_COOKIES ? env.SECURE_COOKIES === 'true' : isProduction;

module.exports = {
  isProduction,
  secureTransport,
  port: Number(env.PORT) || 5000,
  mongoUri: env.MONGODB_URI || 'mongodb://localhost:27017/ghostchat',
  redisUrl: env.REDIS_URL || null,
  jwtSecret,
  sessionHours: Number(env.SESSION_HOURS) || 12,
  // Lowered only in tests, where hundreds of sign-ups at production cost make suites slow and flaky.
  bcryptRounds: Number(env.BCRYPT_ROUNDS) || 12,
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((o) => o.trim()),
  staticDir: env.STATIC_DIR || null,
  logSigningKey: env.LOG_SIGNING_KEY || null,
  // Daily OpenTimestamps anchoring of the key log; on in production unless ANCHORING=off.
  anchoring: env.ANCHORING ? env.ANCHORING === 'on' : isProduction,
  otsCalendars: (env.OTS_CALENDARS || 'https://b.pool.opentimestamps.org,https://a.pool.eternitywall.com').split(',').map((c) => c.trim()),
  esploraUrl: env.ESPLORA_URL || 'https://blockstream.info/api',
  files: {
    maxBytes: (Number(env.FILE_MAX_MB) || 10) * 1024 * 1024,
    quotaBytes: (Number(env.FILE_QUOTA_MB) || 200) * 1024 * 1024,
  },
  rateLimits: {
    apiPer15Min: Number(env.RATE_LIMIT_API) || 300,
    authPer15Min: Number(env.RATE_LIMIT_AUTH) || 10,
    messagesPer10s: Number(env.RATE_LIMIT_MESSAGES) || 20,
  },
};
