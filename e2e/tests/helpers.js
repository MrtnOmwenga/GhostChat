const { expect } = require('./fixtures');

let counter = 0;
/** Usernames unique per test run, so parallel tests never collide. */
const uniqueName = (prefix) => `${prefix}${Date.now().toString(36).slice(-4)}${(counter += 1)}`;

const STRONG_PASSWORD = 'violet anchor tundra 1987 lamp';

/** Walks the three-step sign-up and returns the recovery phrase shown on screen. */
async function signUp(page, username, password = STRONG_PASSWORD) {
  await page.goto('/login-register');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await expect(page.getByText(/^(Strong|Very strong)\./)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  const words = await page.getByRole('list', { name: 'Recovery phrase' }).getByRole('listitem').evaluateAll(
    (items) => items.map((li) => li.lastChild.textContent.trim()),
  );
  await page.getByLabel("I've written down my recovery phrase").check();
  await page.getByRole('button', { name: 'Continue' }).click();
  for (const input of await page.getByLabel(/^Word #\d+$/).all()) {
    const n = Number((await input.getAttribute('id')).split('-')[1]);
    await input.fill(words[n]);
  }
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/chatpage$/);
  return words.join(' ');
}

async function signIn(page, username, password = STRONG_PASSWORD) {
  await page.goto('/login-register');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Two users, each in their own browser context (separate cookies). */
async function twoUsers(browser, options = {}) {
  const users = [];
  for (const prefix of ['ada', 'grace']) {
    const context = await browser.newContext(options[prefix] || {});
    const page = await context.newPage();
    const name = uniqueName(prefix);
    // eslint-disable-next-line no-await-in-loop
    const phrase = await signUp(page, name);
    users.push({
      page, name, context, phrase,
    });
  }
  return users;
}

async function openChatWith(page, username) {
  await page.getByLabel('Search users').fill(username);
  await page.getByLabel('Search users').press('Enter');
  await page.getByRole('button', { name: new RegExp(username) }).click();
}

async function send(page, text) {
  await page.getByLabel('Message', { exact: true }).fill(text);
  await page.getByLabel('Message', { exact: true }).press('Enter');
}

const conversation = (page) => page.getByRole('region', { name: /Conversation with/ });

/** A message that has landed (not the momentary "Sending…" copy shown while it's in flight). */
const delivered = (page, text) => conversation(page).getByRole('listitem').filter({ hasText: text }).filter({ hasNotText: 'Sending' });

/**
 * How long a sent file may take to show in full. Sending one re-encodes the image, encrypts it and
 * uploads it before the message exists, which on a busy machine takes longer than the five seconds
 * allowed for something that is only being drawn.
 */
const FILE_SENT = { timeout: 20_000 };

module.exports = {
  FILE_SENT,
  STRONG_PASSWORD, uniqueName, signUp, signIn, twoUsers, openChatWith, send, conversation, delivered,
};
