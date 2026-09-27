const { test, expect } = require('./fixtures');
const {
  twoUsers, openChatWith, send, conversation, uniqueName, STRONG_PASSWORD,
} = require('./helpers');

test('the database never contains message text or passwords', async ({ browser, databaseDump }) => {
  const [ada, grace] = await twoUsers(browser);
  const secrets = [`direct-${uniqueName('secret')}`, `reply-${uniqueName('secret')}`, `room-${uniqueName('secret')}`];

  await openChatWith(ada.page, grace.name);
  await send(ada.page, secrets[0]);
  await grace.page.getByRole('button', { name: new RegExp(ada.name) }).click();
  await expect(conversation(grace.page).getByText(secrets[0])).toBeVisible();
  await send(grace.page, secrets[1]);
  await expect(conversation(ada.page).getByText(secrets[1])).toBeVisible();

  await ada.page.getByRole('button', { name: 'Menu' }).click();
  await ada.page.getByRole('button', { name: 'Create a room' }).click();
  await ada.page.getByLabel('Room name').fill(uniqueName('Room'));
  await ada.page.getByRole('button', { name: 'Create', exact: true }).click();
  await send(ada.page, secrets[2]);
  await expect(conversation(ada.page).getByText(secrets[2])).toBeVisible();

  const dump = Object.values(await databaseDump()).join('\n');
  expect(dump).toContain('ciphertext');
  for (const secret of [...secrets, STRONG_PASSWORD]) expect(dump).not.toContain(secret);
});

test('the sidebar shows decrypted previews the server never saw', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(ada.page, grace.name);
  await send(ada.page, 'Preview me');
  const row = grace.page.getByRole('button', { name: new RegExp(ada.name) });
  await expect(row).toContainText('Preview me');
  await grace.page.reload();
  await expect(grace.page.getByRole('button', { name: new RegExp(ada.name) })).toContainText('Preview me');
});
