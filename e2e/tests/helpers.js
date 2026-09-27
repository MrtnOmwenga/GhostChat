const { expect } = require('@playwright/test');

let counter = 0;
/** Usernames unique per test run, so parallel tests never collide. */
const uniqueName = (prefix) => `${prefix}${Date.now().toString(36).slice(-4)}${(counter += 1)}`;

async function signUp(page, username, password = 'correct horse') {
  await page.goto('/login-register');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/chatpage$/);
}

/** Two users, each in their own browser context (separate cookies). */
async function twoUsers(browser, options = {}) {
  const users = [];
  for (const prefix of ['ada', 'grace']) {
    const context = await browser.newContext(options[prefix] || {});
    const page = await context.newPage();
    const name = uniqueName(prefix);
    // eslint-disable-next-line no-await-in-loop
    await signUp(page, name);
    users.push({ page, name, context });
  }
  return users;
}

async function openChatWith(page, username) {
  await page.getByLabel('Search users').fill(username);
  await page.getByLabel('Search users').press('Enter');
  await page.getByRole('button', { name: new RegExp(username) }).click();
}

async function send(page, text) {
  await page.getByLabel('Message').fill(text);
  await page.getByLabel('Message').press('Enter');
}

const conversation = (page) => page.getByRole('region', { name: /Conversation with/ });

module.exports = { uniqueName, signUp, twoUsers, openChatWith, send, conversation };
