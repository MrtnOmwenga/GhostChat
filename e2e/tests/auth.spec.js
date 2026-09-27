const { test, expect } = require('./fixtures');
const {
  STRONG_PASSWORD, uniqueName, signUp, signIn,
} = require('./helpers');

test('sign up with a recovery phrase, sign out, sign back in', async ({ page }) => {
  const name = uniqueName('ada');
  const phrase = await signUp(page, name);
  expect(phrase.split(' ')).toHaveLength(24);
  await page.reload();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login-register$/);
  await signIn(page, name, 'wrong password entirely');
  await expect(page.getByText('Incorrect username or password')).toBeVisible();
  await signIn(page, name);
  await expect(page).toHaveURL(/\/chatpage$/);
});

test('weak passwords are refused before an account is created', async ({ page }) => {
  await page.goto('/login-register');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill(uniqueName('ada'));
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm password').fill('password123');
  await expect(page.getByText(/^(Very weak|Weak|Fair)\./)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Choose a stronger password')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Recovery phrase' })).toHaveCount(0);
});

test('a wrong confirmation word stops sign-up', async ({ page }) => {
  await page.goto('/login-register');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill(uniqueName('ada'));
  await page.getByLabel('Password', { exact: true }).fill(STRONG_PASSWORD);
  await page.getByLabel('Confirm password').fill(STRONG_PASSWORD);
  await expect(page.getByText(/^(Strong|Very strong)\./)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel("I've written down my recovery phrase").check();
  await page.getByRole('button', { name: 'Continue' }).click();
  for (const input of await page.getByLabel(/^Word #\d+$/).all()) await input.fill('wrong');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(/doesn't match/)).toBeVisible();
  await expect(page).toHaveURL(/\/login-register$/);
});

test('a new device signs in with just the password; the server never receives it', async ({ browser }) => {
  const name = uniqueName('ada');
  const first = await (await browser.newContext()).newPage();
  await signUp(first, name);

  const second = await (await browser.newContext()).newPage();
  const bodies = [];
  second.on('request', (r) => { if (r.method() === 'POST') bodies.push(r.postData() || ''); });
  await signIn(second, name);
  await expect(second).toHaveURL(/\/chatpage$/);
  expect(bodies.join('\n')).not.toContain(STRONG_PASSWORD);
});

test('clearing browser storage locks the keys until the password is entered', async ({ page }) => {
  const name = uniqueName('ada');
  await signUp(page, name);
  await page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('ghostchat');
    request.onsuccess = resolve;
    request.onerror = resolve;
    request.onblocked = resolve;
  }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Unlock' })).toBeVisible();
  await page.getByLabel('Password').fill('not it at all');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText('Incorrect password')).toBeVisible();
  await page.getByLabel('Password').fill(STRONG_PASSWORD);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
});

test('change password, then sign in with the new one only', async ({ page }) => {
  const name = uniqueName('ada');
  await signUp(page, name);
  const next = 'marble falcon quietly 2046 ember';
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Change password' }).click();
  await page.getByLabel('Current password').fill(STRONG_PASSWORD);
  await page.getByPlaceholder('New password').fill(next);
  await expect(page.getByText(/^(Strong|Very strong)\./)).toBeVisible();
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(page.getByText('Password changed')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, name);
  await expect(page.getByText('Incorrect username or password')).toBeVisible();
  await signIn(page, name, next);
  await expect(page).toHaveURL(/\/chatpage$/);
});

test('recover a forgotten password with the phrase; a wrong phrase is rejected', async ({ page, browser }) => {
  const name = uniqueName('ada');
  const phrase = await signUp(page, name);
  const next = 'harbour velvet sixty kettle 42';
  const other = await (await browser.newContext()).newPage();

  const recoverWith = async (words) => {
    await other.goto('/login-register');
    await other.getByRole('button', { name: 'Forgot password?' }).click();
    await other.getByLabel('Username').fill(name);
    await other.getByLabel('Recovery phrase').fill(words);
    await other.getByPlaceholder('New password').fill(next);
    await expect(other.getByText(/^(Strong|Very strong)\./)).toBeVisible();
    await other.getByRole('button', { name: 'Recover account' }).click();
  };

  const wrong = `${'abandon '.repeat(23)}art`;
  await recoverWith(wrong);
  await expect(other.getByText('That recovery phrase does not match this account')).toBeVisible();

  await recoverWith(phrase);
  await expect(other).toHaveURL(/\/chatpage$/);
  await signIn(page, name, next);
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
