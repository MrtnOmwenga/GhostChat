const { test, expect } = require('./fixtures');
const {
  twoUsers, openChatWith, conversation,
} = require('./helpers');

test('emoji from the picker are inserted and emoji-only messages render large', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(ada.page, grace.name);

  await ada.page.getByRole('button', { name: 'Emoji' }).click();
  const picker = ada.page.getByRole('dialog', { name: 'Emoji picker' });
  await picker.getByRole('combobox', { name: 'Search' }).fill('fire');
  await picker.getByRole('option', { name: /^🔥/ }).first().click();
  await expect(ada.page.getByLabel('Message', { exact: true })).toHaveValue('🔥');
  await ada.page.getByLabel('Message', { exact: true }).press('Enter');

  const delivered = conversation(ada.page).getByRole('listitem').filter({ hasText: '🔥' }).filter({ hasNotText: 'Sending' });
  await expect(delivered).toBeVisible();
  const size = await delivered.locator('span').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThan(30);
});

test('Shift+Enter adds a line; Enter sends; line breaks arrive intact', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(ada.page, grace.name);
  const box = ada.page.getByLabel('Message', { exact: true });
  await box.pressSequentially('Line one');
  await box.press('Shift+Enter');
  await box.pressSequentially('Line two');
  await expect(box).toHaveValue('Line one\nLine two');
  await box.press('Enter');
  await expect(box).toHaveValue('');

  await grace.page.getByRole('button', { name: new RegExp(ada.name) }).click();
  const received = conversation(grace.page).getByRole('listitem').filter({ hasText: 'Line one' });
  expect(await received.locator('span').first().innerText()).toBe('Line one\nLine two');
});
