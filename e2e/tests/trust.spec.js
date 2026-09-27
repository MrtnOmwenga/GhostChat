const { test, expect } = require('./fixtures');
const { twoUsers, openChatWith, send, conversation } = require('./helpers');

const shield = (page, seq) => conversation(page).getByRole('button', { name: new RegExp(`^Verify message ${seq}:`) });

async function chatOfThree(browser) {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(ada.page, grace.name);
  for (const text of ['one', 'two', 'three']) {
    // eslint-disable-next-line no-await-in-loop
    await send(ada.page, text);
    // eslint-disable-next-line no-await-in-loop
    await expect(conversation(ada.page).getByRole('listitem').filter({ hasText: text }).filter({ hasNotText: 'Sending' })).toBeVisible();
  }
  await grace.page.getByRole('button', { name: new RegExp(ada.name) }).click();
  await expect(conversation(grace.page).getByText('three', { exact: true })).toBeVisible();
  return { ada, grace };
}

const conversationId = async (page) => page.evaluate(async () => {
  const response = await fetch('/api/messages/conversations', { credentials: 'include' });
  return (await response.json())[0].conversation;
});

test('every message carries a verified shield; the drawer shows hash, link and signature', async ({ browser }) => {
  const { grace } = await chatOfThree(browser);
  await expect(shield(grace.page, 2)).toHaveAttribute('aria-label', /Signature and chain link verified/);
  await shield(grace.page, 2).click();
  const drawer = grace.page.getByRole('dialog', { name: 'Message #2' });
  await expect(drawer.getByText('Links to #1 ✓')).toBeVisible();
  await expect(drawer.getByText(/Ed25519 signature matches/)).toBeVisible();
  await drawer.getByText('Raw envelope').click();
  await expect(drawer.locator('pre')).toContainText('"ciphertext"');
  await expect(drawer.getByRole('button', { name: 'Delete message' })).toHaveCount(0); // not grace's message
});

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

test('the author deletes a message; everyone sees a verified, signed deletion', async ({ browser }) => {
  const { ada, grace } = await chatOfThree(browser);
  await shield(ada.page, 2).click();
  ada.page.once('dialog', (dialog) => dialog.accept());
  await ada.page.getByRole('dialog', { name: 'Message #2' }).getByRole('button', { name: 'Delete message' }).click();

  await expect(conversation(grace.page).getByText('Message deleted')).toBeVisible();
  await expect(conversation(grace.page).getByText('two', { exact: true })).toHaveCount(0);
  await expect(shield(grace.page, 2)).toHaveAttribute('aria-label', /Deletion signed by the author/);
  await expect(shield(grace.page, 3)).toHaveAttribute('aria-label', /Signature and chain link verified/);
});
