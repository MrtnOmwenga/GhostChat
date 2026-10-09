const { test, expect } = require('./fixtures');
const {
  twoUsers, openChatWith, send, conversation, signUp, uniqueName,
} = require('./helpers');

test('the transparency page shows a signed, consistent log with my keys provably included', async ({ page }) => {
  const name = uniqueName('ada');
  await signUp(page, name);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Transparency log' }).click();
  await expect(page).toHaveURL(/\/transparency$/);

  const status = page.getByRole('region', { name: 'Log status' });
  await expect(status).toContainText('Signed by the log key and consistent');
  const mine = page.getByRole('region', { name: 'Your key entries' });
  await expect(mine).toContainText('Key version 1');
  await expect(mine).toContainText('included ✓');
  await expect(page.getByRole('region', { name: 'Recent log entries' })).toContainText(name);
});

test('the transparency page says which build this is, and that what the browser was sent matches it', async ({ page, request }) => {
  await page.goto('/transparency');
  const code = page.getByRole('region', { name: 'The code this browser is running' });
  await expect(code).toContainText(/All \d+ files the server just sent match this build/);

  // The digest on the page is the one in the manifest, and the manifest lists what is really served.
  const manifest = await (await request.get('/bundle.json')).json();
  await expect(code).toContainText(manifest.digest);
  await expect(code).toContainText(`-a bundle=${manifest.digest}`);
  const crypto = require('crypto');
  for (const [name, hash] of Object.entries(manifest.files)) {
    const body = await (await request.get(`/${name}`)).body();
    expect([name, crypto.createHash('sha256').update(body).digest('hex')]).toEqual([name, hash]);
  }
  const listing = Object.keys(manifest.files).sort().map((name) => `${manifest.files[name]}  ${name}\n`).join('');
  expect(crypto.createHash('sha256').update(listing).digest('hex')).toBe(manifest.digest);
});
