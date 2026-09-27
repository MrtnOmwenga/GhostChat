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
