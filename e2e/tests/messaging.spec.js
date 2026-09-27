const { test, expect } = require('@playwright/test');
const {
  twoUsers, openChatWith, send, conversation,
} = require('./helpers');

test('a direct message arrives live, marks the chat unread, and survives a reload', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);

  await openChatWith(ada.page, grace.name);
  await send(ada.page, 'Hello from Ada');
  await expect(conversation(ada.page).getByText('Hello from Ada')).toBeVisible();

  const adaRow = grace.page.getByRole('button', { name: new RegExp(ada.name) });
  await expect(adaRow.getByLabel('Unread messages')).toBeVisible();
  await expect(adaRow.getByText('Online')).toBeVisible();
  await adaRow.click();
  await expect(conversation(grace.page).getByText('Hello from Ada')).toBeVisible();

  await send(grace.page, 'Hi Ada');
  await expect(conversation(ada.page).getByText('Hi Ada')).toBeVisible();

  await ada.page.reload();
  await ada.page.getByRole('button', { name: new RegExp(grace.name) }).click();
  await expect(conversation(ada.page).getByText('Hello from Ada')).toBeVisible();
  await expect(conversation(ada.page).getByText('Hi Ada')).toBeVisible();
});

test('presence switches to offline when the other user signs out', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(ada.page, grace.name);
  const status = ada.page.getByRole('button', { name: new RegExp(grace.name) });
  await expect(status.getByText('Online')).toBeVisible();
  await grace.page.getByRole('button', { name: 'Sign out' }).click();
  await expect(status.getByText('Offline')).toBeVisible();
});

test.describe('on a phone', () => {
  test('the list and the conversation take turns on screen', async ({ browser }) => {
    const [ada, grace] = await twoUsers(browser, { grace: { viewport: { width: 390, height: 844 } } });
    await openChatWith(ada.page, grace.name);
    await send(ada.page, 'Fits on a phone?');

    const search = grace.page.getByLabel('Search users');
    await grace.page.getByRole('button', { name: new RegExp(ada.name) }).click();
    await expect(conversation(grace.page).getByText('Fits on a phone?')).toBeVisible();
    await expect(search).toBeHidden();

    await grace.page.getByRole('button', { name: 'Back to conversations' }).click();
    await expect(search).toBeVisible();
  });
});
