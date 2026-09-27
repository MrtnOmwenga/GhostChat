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
  appServer: [async ({}, use, workerInfo) => {
    const port = 5100 + workerInfo.parallelIndex;
    const url = `http://localhost:${port}`;
    const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    try {
      await waitForHealth(url);
      await use(url);
    } finally {
      server.kill('SIGTERM');
    }
  }, { scope: 'worker', auto: true }],

  baseURL: async ({ appServer }, use) => use(appServer),
});

module.exports = { test, expect: base.expect };
