const { test, expect } = require('./fixtures');
const { twoUsers, uniqueName, send, conversation } = require('./helpers');

async function roomForm(page, action, name, password, { confirm = true } = {}) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: action }).click();
  await page.getByLabel('Room name').fill(name);
  await page.getByLabel('Password', { exact: true }).fill(password);
  if (confirm) await page.getByLabel('Confirm password').fill(password);
}

test('create a room, join it with the password, and talk in it', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  const room = uniqueName('Room');

  await roomForm(ada.page, 'Create a room', room, 'difference engine');
  await ada.page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(conversation(ada.page)).toHaveAccessibleName(`Conversation with ${room}`);

  await roomForm(grace.page, 'Join a room', room, 'not the password', { confirm: false });
  await grace.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(grace.page.getByText('Incorrect room name or password')).toBeVisible();

  await grace.page.getByLabel('Password', { exact: true }).fill('difference engine');
  await grace.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(conversation(ada.page).getByText(`${grace.name} joined the room`)).toBeVisible();

  await send(grace.page, 'Hello, room');
  const received = conversation(ada.page).getByRole('listitem').filter({ hasText: 'Hello, room' });
  await expect(received).toContainText(grace.name); // room messages name their sender
});

test('the menu closes with Escape', async ({ browser }) => {
  const [ada] = await twoUsers(browser);
  await ada.page.getByRole('button', { name: 'Menu' }).click();
  await expect(ada.page.getByRole('dialog')).toBeVisible();
  await ada.page.keyboard.press('Escape');
  await expect(ada.page.getByRole('dialog')).toBeHidden();
});
