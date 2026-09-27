const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { errorHandler } = require('./errors');

function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind one reverse proxy in production; rate limits key on the client IP

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        // libsodium runs as WebAssembly. 'wasm-unsafe-eval' allows compiling it without allowing
        // JavaScript eval.
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        upgradeInsecureRequests: config.secureTransport ? [] : null,
      },
    },
  }));
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      if (process.env.NODE_ENV === 'test') return;
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(1)}ms`);
    });
    next();
  });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimits.apiPer15Min,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests, try again later' },
  }));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  const { rooms, invites } = require('./routes/rooms');
  app.use('/api/rooms', rooms);
  app.use('/api/invites', invites);
  app.use('/api/messages', require('./routes/messages'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // In production the built frontend is served from here, so the API, the WebSocket and the
  // page share one origin and the session cookie never has to cross sites.
  if (config.staticDir) {
    app.use(express.static(config.staticDir));
    app.get('/{*splat}', (req, res) => res.sendFile(path.join(config.staticDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
