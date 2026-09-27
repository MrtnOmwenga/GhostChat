const { test, expect } = require('./fixtures');
const { ObjectId } = require('../../backend/node_modules/mongodb');
const {
  twoUsers, openChatWith, send, conversation, delivered, signUp, uniqueName,
} = require('./helpers');

// These tests play a compromised server by editing its database directly. The worker option gives
// them servers of their own, so the damage can't leak into other tests.
test.use({ tampering: true });

const shield = (page, seq) => conversation(page).getByRole('button', { name: new RegExp(`^Verify message ${seq}:`) });

const conversationId = async (page) => page.evaluate(async () => {
  const response = await fetch('/api/messages/conversations', { credentials: 'include' });
  return (await response.json())[0].conversation;
});

async function chatOfThree(browser) {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(ada.page, grace.name);
  for (const text of ['one', 'two', 'three']) {
    // eslint-disable-next-line no-await-in-loop
    await send(ada.page, text);
    // eslint-disable-next-line no-await-in-loop
    await expect(delivered(ada.page, text)).toBeVisible();
  }
  await grace.page.getByRole('button', { name: new RegExp(ada.name) }).click();
  await expect(delivered(grace.page, 'three')).toBeVisible();
  return { ada, grace };
}

test('tampering with a stored message is flagged exactly where it happened', async ({ browser, tamper }) => {
  const { grace } = await chatOfThree(browser);
  const id = await conversationId(grace.page);
  tamper(id, 2, 'content');
  tamper(id, 3, 'link');

  await grace.page.reload();
  await grace.page.getByRole('button', { name: /one|two|three/ }).first().click();
  await expect(shield(grace.page, 1)).toHaveAttribute('aria-label', /verified/);
  await expect(shield(grace.page, 2)).toHaveAttribute('aria-label', /content does not match its hash/);
  await expect(shield(grace.page, 3)).toHaveAttribute('aria-label', /does not link to the previous message/);

  await conversation(grace.page).getByRole('button', { name: 'Show the message chain' }).click();
  const chain = grace.page.getByRole('dialog', { name: /Chain/ });
  await expect(chain.getByText('2 could not be verified', { exact: false })).toBeVisible();
});

test('a browser that saw the log notices when the server rewrites it', async ({ browser, withDb }) => {
  const [ada] = await twoUsers(browser);
  await ada.page.goto('/transparency');
  await expect(ada.page.getByRole('region', { name: 'Log status' })).toContainText('consistent');

  // The server rewrites an old entry, then the log keeps growing.
  await withDb((db) => db.collection('logleaves').updateOne({ _id: 0 }, { $set: { leafHash: 'ab'.repeat(32) } }));
  const late = await (await browser.newContext()).newPage();
  await signUp(late, uniqueName('carol'));

  await ada.page.reload();
  await expect(ada.page.getByRole('region', { name: 'Log status' })).toContainText('rewritten');
});

test("a key the log doesn't vouch for makes that person's messages fail verification", async ({ browser, withDb }) => {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(ada.page, grace.name);
  await send(ada.page, 'hello from ada');

  // The server hides ada's key from the log (as it would to show grace a substituted key).
  const adaId = await ada.page.evaluate(async () => (await (await fetch('/api/auth/me')).json()).id);
  await withDb((db) => db.collection('logleaves').deleteMany({ user: new ObjectId(adaId) }));

  await grace.page.reload();
  await grace.page.getByRole('button', { name: new RegExp(ada.name) }).click();
  const shield = conversation(grace.page).getByRole('button', { name: /^Verify message 1:/ });
  // Deleting entries also shrinks the log, so either detection may be reported first.
  await expect(shield).toHaveAttribute('aria-label', /transparency log/);
});
