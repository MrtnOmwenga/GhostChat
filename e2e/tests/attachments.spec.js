const { test, expect } = require('./fixtures');
const {
  twoUsers, openChatWith, conversation, delivered, uniqueName, signUp,
} = require('./helpers');
const { png, storedFileBytes } = require('./files');

const attach = (page, file) => page.getByTestId('file-input').setInputFiles(file);
const sendButton = (page) => page.getByRole('button', { name: 'Send', exact: true });

/** The file id from the signed envelope, as any participant's browser sees it. */
const attachmentId = (page) => page.evaluate(async () => {
  const [latest] = await (await fetch('/api/messages/conversations')).json();
  return latest.last.attachments[0].id;
});

test('a photo is encrypted in the browser, shown to the recipient, and loses its metadata', async ({ browser, withDb }) => {
  const [ada, grace] = await twoUsers(browser);
  const marker = uniqueName('GPS-49.2827N-123.1207W-');
  await openChatWith(ada.page, grace.name);

  await attach(ada.page, { name: 'holiday.png', mimeType: 'image/png', buffer: png(640, 400, marker) });
  await expect(ada.page.getByLabel('Attachment to send')).toHaveText('holiday.png');
  await ada.page.getByLabel('Message', { exact: true }).fill('Look at this');
  await sendButton(ada.page).click();
  await expect(delivered(ada.page, 'Look at this').getByRole('img', { name: /^holiday\.(webp|jpg)$/ })).toHaveAttribute('data-state', 'full');

  const row = grace.page.getByRole('button', { name: new RegExp(ada.name) });
  await expect(row).toContainText('📷 Look at this');
  await row.click();
  const image = delivered(grace.page, 'Look at this').getByRole('img', { name: /^holiday\./ });
  await expect(image).toHaveAttribute('data-state', 'full');
  expect(await image.evaluate((img) => img.naturalWidth)).toBe(640);
  await expect(delivered(grace.page, 'Look at this').getByRole('button', { name: /^Verify message 1:/ })).toHaveAttribute('aria-label', /verified/);

  await image.click();
  const viewer = grace.page.getByRole('dialog', { name: /^holiday\./ });
  await expect(viewer.getByRole('img')).toBeVisible();

  // The decrypted image grace got was re-encoded in ada's browser: the metadata never left it.
  const [download] = await Promise.all([grace.page.waitForEvent('download'), viewer.getByRole('button', { name: 'Download' }).click()]);
  const chunks = [];
  for await (const c of await download.createReadStream()) chunks.push(c);
  const received = Buffer.concat(chunks);
  expect(received.length).toBeGreaterThan(1000);
  expect(received.includes(marker)).toBe(false);
  await withDb(async (db) => expect((await storedFileBytes(db)).includes(marker)).toBe(false));

  await viewer.getByRole('button', { name: 'Close' }).click();
  await expect(viewer).toHaveCount(0);
});

test('a file downloads decrypted; outsiders and the database never see its content', async ({ browser, withDb }) => {
  const [ada, grace] = await twoUsers(browser);
  const secret = `quarterly numbers ${uniqueName('secret')}`;
  await openChatWith(ada.page, grace.name);
  await attach(ada.page, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from(secret) });
  await sendButton(ada.page).click();
  await expect(delivered(ada.page, 'notes.txt')).toBeVisible();

  await grace.page.getByRole('button', { name: new RegExp(ada.name) }).click();
  const [download] = await Promise.all([
    grace.page.waitForEvent('download'),
    delivered(grace.page, 'notes.txt').getByRole('button', { name: 'Download notes.txt' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('notes.txt');
  const chunks = [];
  for await (const c of await download.createReadStream()) chunks.push(c);
  expect(Buffer.concat(chunks).toString()).toBe(secret);

  await withDb(async (db) => {
    const stored = await storedFileBytes(db);
    expect(stored.length).toBeGreaterThan(secret.length);
    expect(stored.includes(secret)).toBe(false);
  });

  const id = await attachmentId(grace.page);
  const eve = await (await browser.newContext()).newPage();
  await signUp(eve, uniqueName('eve'));
  expect(await eve.evaluate(async (fileId) => (await fetch(`/api/files/${fileId}`)).status, id)).toBe(404);
});

test('deleting a message deletes its file from the server', async ({ browser, withDb }) => {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(ada.page, grace.name);
  await attach(ada.page, { name: 'draft.txt', mimeType: 'text/plain', buffer: Buffer.from('to be deleted') });
  await sendButton(ada.page).click();
  await expect(delivered(ada.page, 'draft.txt')).toBeVisible();
  const id = await attachmentId(ada.page);
  await withDb(async (db) => expect(await db.collection('files.files').countDocuments({ _id: id })).toBe(1));

  await delivered(ada.page, 'draft.txt').getByRole('button', { name: /^Verify message 1:/ }).click();
  const drawer = ada.page.getByRole('dialog', { name: 'Message #1' });
  await expect(drawer).toContainText('draft.txt');
  ada.page.once('dialog', (dialog) => dialog.accept());
  await drawer.getByRole('button', { name: 'Delete message' }).click();
  await expect(conversation(ada.page).getByText('Message deleted')).toBeVisible();

  await withDb(async (db) => expect(await db.collection('files.files').countDocuments({ _id: id })).toBe(0));
  expect(await grace.page.evaluate(async (fileId) => (await fetch(`/api/files/${fileId}`)).status, id)).toBe(404);
});
