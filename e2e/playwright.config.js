const { defineConfig, devices } = require('@playwright/test');

const port = 5055;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  // Sign-ups hash passwords with bcrypt (cost 12), which is slow when every worker signs up at once.
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    // Lets a machine without Playwright's own browser download use an installed Chromium.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node server.js',
    url: `http://localhost:${port}/health`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(port) },
  },
});
