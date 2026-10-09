const { test, expect } = require('./fixtures');
const {
  twoUsers, uniqueName, send, conversation, signUp,
  delivered,
  FILE_SENT,
} = require('./helpers');

async function createRoom(page, name) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Create a room' }).click();
  await page.getByLabel('Room name').fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(conversation(page)).toHaveAccessibleName(`Conversation with ${name}`);
}

async function inviteLink(page) {
  await page.getByRole('button', { name: 'Invite people' }).click();
  await page.getByRole('button', { name: 'Create link' }).click();
  const link = await page.getByLabel('Invite link').inputValue();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  return link;
}

async function joinWithLink(page, link) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Join with an invite link' }).click();
  await page.getByLabel('Invite link').fill(link);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
}

const fingerprint = (page) => conversation(page).getByLabel('Room key fingerprint');

test('invite link: the secret stays in the fragment; the joiner sees the whole history', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  const room = uniqueName('Room');
  await createRoom(ada.page, room);
  await send(ada.page, 'Written before Grace joined');
  const link = await inviteLink(ada.page);
  expect(link).toMatch(/\/join\/[0-9a-f]{24}#[A-Za-z0-9_-]{43}$/);

  const requests = [];
  grace.page.on('request', (r) => requests.push(r.url() + (r.postData() || '')));
  await joinWithLink(grace.page, link);
  const secret = link.split('#')[1];
  expect(requests.join('\n')).not.toContain(secret);

  await expect(delivered(grace.page, 'Written before Grace joined')).toBeVisible();
  await expect(delivered(ada.page, `${grace.name} joined the room`)).toBeVisible();
  await expect(fingerprint(grace.page)).toHaveText(await fingerprint(ada.page).textContent());

  await send(grace.page, 'Hello, room');
  const received = conversation(ada.page).getByRole('listitem').filter({ hasText: 'Hello, room' });
  await expect(received).toContainText(grace.name);
});

test('opening an invite link while signed out joins after signing up', async ({ browser }) => {
  const [ada] = await twoUsers(browser);
  const room = uniqueName('Room');
  await createRoom(ada.page, room);
  const link = await inviteLink(ada.page);

  const page = await (await browser.newContext()).newPage();
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await expect(page).toHaveURL(/\/login-register$/);
  await signUp(page, uniqueName('grace'));
  await expect(conversation(page)).toHaveAccessibleName(`Conversation with ${room}`);
});

test('when someone leaves, the key is replaced before anyone can send again', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  const room = uniqueName('Room');
  await createRoom(ada.page, room);
  await joinWithLink(grace.page, await inviteLink(ada.page));
  await expect(delivered(ada.page, `${grace.name} joined the room`)).toBeVisible();
  const before = await fingerprint(ada.page).textContent();

  grace.page.once('dialog', (dialog) => dialog.accept());
  await grace.page.getByRole('button', { name: 'Leave room' }).click();
  await expect(grace.page.getByRole('button', { name: new RegExp(room) })).toHaveCount(0);
  await expect(delivered(ada.page, `${grace.name} left the room`)).toBeVisible();

  await send(ada.page, 'After Grace left');
  await expect(delivered(ada.page, 'After Grace left')).toBeVisible();
  await expect(delivered(ada.page, `${ada.name} replaced the room key`)).toBeVisible();
  await expect(fingerprint(ada.page)).not.toHaveText(before);
});

test('the menu closes with Escape', async ({ browser }) => {
  const [ada] = await twoUsers(browser);
  await ada.page.getByRole('button', { name: 'Menu' }).click();
  await expect(ada.page.getByRole('dialog')).toBeVisible();
  await ada.page.keyboard.press('Escape');
  await expect(ada.page.getByRole('dialog')).toBeHidden();
});

test('files shared in a room are in the history a new member sees; a member who left loses access', async ({ browser }) => {
  const { png } = require('./files');
  const [ada, grace] = await twoUsers(browser);
  await createRoom(ada.page, uniqueName('Room'));
  await ada.page.getByTestId('file-input').setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: png(200, 120, 'x') });
  await ada.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(conversation(ada.page).getByRole('img', { name: /^plan\./ })).toHaveAttribute('data-state', 'full', FILE_SENT);
  const link = await inviteLink(ada.page);

  await joinWithLink(grace.page, link);
  await expect(conversation(grace.page).getByRole('img', { name: /^plan\./ })).toHaveAttribute('data-state', 'full', FILE_SENT);
  const fileId = await grace.page.evaluate(async () => {
    const rooms = await (await fetch('/api/rooms/mine')).json();
    const history = await (await fetch(`/api/messages?conversation=room:${rooms[0].id}`)).json();
    return history.find((m) => m.attachments).attachments[0].id;
  });

  grace.page.once('dialog', (dialog) => dialog.accept());
  await grace.page.getByRole('button', { name: 'Leave room' }).click();
  await expect.poll(() => grace.page.evaluate(async (id) => (await fetch(`/api/files/${id}`, { cache: 'no-store' })).status, fileId)).toBe(404);
});
