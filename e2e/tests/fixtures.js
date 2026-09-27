const path = require('path');
const { spawn } = require('child_process');
const base = require('@playwright/test');

async function waitForHealth(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // eslint-disable-next-line no-await-in-loop
      if ((await fetch(`${url}/health`)).ok) return;
    } catch {
      // not listening yet
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => { setTimeout(r, 200); });
  }
  throw new Error(`server at ${url} did not become healthy`);
}

/**
 * Every Playwright worker gets its own app server on its own port, backed by its own in-memory
 * MongoDB, so tests running in parallel share no data and can't interfere with each other.
 */
const test = base.test.extend({
  // Tests that tamper with the server's data set this, so Playwright runs them in workers with a
  // server of their own and they can't corrupt what other tests see.
  tampering: [false, { option: true, scope: 'worker' }],

  appServer: [async ({ tampering }, use, workerInfo) => { // eslint-disable-line no-unused-vars
    const port = 5100 + workerInfo.parallelIndex;
    const url = `http://localhost:${port}`;
    const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const mongoUri = new Promise((resolve) => {
      let buffer = '';
      server.stdout.on('data', (chunk) => {
        buffer += chunk;
        const line = buffer.split('\n').find((l) => l.startsWith('{"mongoUri"'));
        if (line) resolve(JSON.parse(line).mongoUri);
      });
    });
    try {
      await waitForHealth(url);
      await use({ url, mongoUri: await mongoUri });
    } finally {
      server.kill('SIGTERM');
    }
  }, { scope: 'worker', auto: true }],

  baseURL: async ({ appServer }, use) => use(appServer.url),

  /** Runs the backend's tamper script against this worker's database. */
  tamper: async ({ appServer }, use) => {
    const { execFileSync } = require('child_process');
    await use((conversation, seq, mode = 'content') => execFileSync(
      process.execPath,
      [path.join(__dirname, '..', '..', 'backend', 'scripts', 'tamper.js'), conversation, String(seq), mode],
      { env: { ...process.env, MONGODB_URI: `${appServer.mongoUri}test` }, stdio: 'pipe' },
    ));
  },

  /** Direct access to this worker's database, for tests that play a malicious server. */
  withDb: async ({ appServer }, use) => {
    const { MongoClient } = require('../../backend/node_modules/mongodb');
    const client = await MongoClient.connect(appServer.mongoUri);
    await use((fn) => fn(client.db('test')));
    await client.close();
  },

  /** Everything stored in this worker's database, as one JSON string per collection. */
  databaseDump: async ({ appServer }, use) => {
    const { MongoClient } = require('../../backend/node_modules/mongodb');
    const client = await MongoClient.connect(appServer.mongoUri);
    await use(async () => {
      const db = client.db('test');
      const names = (await db.listCollections().toArray()).map((c) => c.name);
      const dump = {};
      for (const name of names) dump[name] = JSON.stringify(await db.collection(name).find().toArray());
      return dump;
    });
    await client.close();
  },
});

module.exports = { test, expect: base.expect };
