const { test, expect } = require('@playwright/test');
const { uniqueName, signUp } = require('./helpers');

test('sign up, sign out, sign back in; the session survives a reload', async ({ page }) => {
  const name = uniqueName('ada');
  await signUp(page, name);
  await page.reload();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login-register$/);

  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password', { exact: true }).fill('wrong password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Incorrect username or password')).toBeVisible();

  await page.getByLabel('Password', { exact: true }).fill('correct horse');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/chatpage$/);
});

test('the chat page sends signed-out visitors to sign in', async ({ page }) => {
  await page.goto('/chatpage');
  await expect(page).toHaveURL(/\/login-register$/);
});

test('the session cookie is not readable from page scripts', async ({ page }) => {
  await signUp(page, uniqueName('ada'));
  expect(await page.evaluate(() => document.cookie)).not.toContain('ghostchat_session');
  const [cookie] = (await page.context().cookies()).filter((c) => c.name === 'ghostchat_session');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict' });
});
