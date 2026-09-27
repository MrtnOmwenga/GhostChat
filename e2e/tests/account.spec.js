const { test, expect } = require('@playwright/test');
const {
  twoUsers, openChatWith, send, conversation,
} = require('./helpers');

test('deleting an account removes it and every message it sent', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(ada.page, grace.name);
  await send(ada.page, 'This will vanish');
  await expect(grace.page.getByRole('button', { name: new RegExp(ada.name) })).toBeVisible();

  ada.page.once('dialog', (dialog) => dialog.accept());
  await ada.page.getByRole('button', { name: 'Menu' }).click();
  await ada.page.getByRole('button', { name: 'Delete account' }).click();
  await expect(ada.page).toHaveURL(/\/login-register$/);

  await grace.page.reload();
  await expect(grace.page.getByLabel('Search users')).toBeVisible();
  await grace.page.getByLabel('Search users').fill(ada.name);
  await grace.page.getByLabel('Search users').press('Enter');
  await expect(grace.page.getByText('No users found')).toBeVisible();

  await ada.page.getByLabel('Username').fill(ada.name);
  await ada.page.getByLabel('Password', { exact: true }).fill('correct horse');
  await ada.page.getByRole('button', { name: 'Sign in' }).click();
  await expect(ada.page.getByText('Incorrect username or password')).toBeVisible();
  await expect(conversation(grace.page)).toHaveCount(0);
});
