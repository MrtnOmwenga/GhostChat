const { test, expect } = require('./fixtures');
const {
  twoUsers, openChatWith, send, conversation, signIn, STRONG_PASSWORD,
  delivered,
} = require('./helpers');

async function openMyKeys(page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Your keys' }).click();
}

async function rotate(page, phrase, reason = 'Suspected compromise') {
  await openMyKeys(page);
  await page.getByRole('button', { name: 'Rotate keys' }).click();
  await page.getByLabel('Reason').selectOption(reason);
  await page.getByLabel('Recovery phrase').fill(phrase);
  await page.getByLabel('Password', { exact: true }).fill(STRONG_PASSWORD);
  await page.getByRole('button', { name: 'Rotate keys' }).click();
}

test('a rotation is shown to contacts as authorised; old and new messages both verify', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(ada.page, grace.name);
  await send(ada.page, 'before rotation');
  await grace.page.getByRole('button', { name: new RegExp(ada.name) }).click();
  await expect(delivered(grace.page, 'before rotation')).toBeVisible();

  await rotate(ada.page, ada.phrase);
  await expect(ada.page.getByText(/Keys rotated\. Your contacts/)).toBeVisible();
  await expect(ada.page.getByRole('dialog').getByText('Keys rotated · signed by the previous key ✓')).toBeVisible();
  await ada.page.keyboard.press('Escape');

  await expect(conversation(grace.page).getByText(/Keys rotated on .* signed by their previous key ✓/)).toBeVisible();
  await send(ada.page, 'after rotation');
  await expect(delivered(grace.page, 'after rotation')).toBeVisible();
  const shields = conversation(grace.page).getByRole('button', { name: /^Verify message/ });
  for (const shield of await shields.all()) await expect(shield).toHaveAttribute('aria-label', /verified/);
  await send(grace.page, 'reply to the new key');
  await expect(delivered(ada.page, 'reply to the new key')).toBeVisible();
});

test('the wrong recovery phrase cannot rotate keys', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  await rotate(ada.page, grace.phrase);
  await expect(ada.page.getByText("That recovery phrase doesn't match your current keys")).toBeVisible();
});

test('a contact verified on one device is verified on another, and unmarking follows too', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(grace.page, ada.name);
  await send(grace.page, 'hello');
  const openKeys = async (page) => {
    await page.getByRole('button', { name: new RegExp(ada.name) }).click();
    await conversation(page).getByRole('button', { name: 'Keys and safety number' }).click();
  };
  await conversation(grace.page).getByRole('button', { name: 'Keys and safety number' }).click();
  await grace.page.getByRole('button', { name: 'Mark as verified' }).click();
  await expect(grace.page.getByText(/^Verified:/)).toBeVisible();

  // Grace's other device: a browser that has never seen this account.
  const phone = await (await browser.newContext()).newPage();
  await signIn(phone, grace.name);
  await expect(phone).toHaveURL(/\/chatpage$/);
  await openKeys(phone);
  await expect(phone.getByText(/^Verified:/)).toBeVisible();

  // Unmarked there, it is unmarked here after a reload.
  await phone.getByRole('button', { name: 'Unmark as verified' }).click();
  await expect(phone.getByRole('button', { name: 'Mark as verified' })).toBeVisible();
  await grace.page.reload();
  await openKeys(grace.page);
  await expect(grace.page.getByRole('button', { name: 'Mark as verified' })).toBeVisible();
  await expect(grace.page.getByText(/^Verified:/)).toHaveCount(0);
});

test('safety numbers match on both sides; a reset after verifying raises a warning', async ({ browser }) => {
  const [ada, grace] = await twoUsers(browser);
  await openChatWith(ada.page, grace.name);
  await send(ada.page, 'hello');
  await grace.page.getByRole('button', { name: new RegExp(ada.name) }).click();

  const safety = async (page) => {
    await conversation(page).getByRole('button', { name: 'Keys and safety number' }).click();
    const number = await page.getByLabel('Safety number', { exact: true }).textContent();
    return number;
  };
  const adaNumber = await safety(ada.page);
  const graceNumber = await safety(grace.page);
  expect(adaNumber).toMatch(/^(\d{5} ){11}\d{5}$/);
  expect(graceNumber).toBe(adaNumber);
  await grace.page.getByRole('button', { name: 'Mark as verified' }).click();
  await expect(grace.page.getByText(/^Verified:/)).toBeVisible();
  await grace.page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await ada.page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  // Ada "loses" her phrase and resets.
  await openMyKeys(ada.page);
  await ada.page.getByRole('button', { name: 'Lost your phrase?' }).click();
  await ada.page.getByLabel('Password', { exact: true }).fill(STRONG_PASSWORD);
  await ada.page.getByRole('button', { name: 'Continue' }).click();
  const words = await ada.page.getByRole('list', { name: 'Recovery phrase' }).getByRole('listitem').evaluateAll(
    (items) => items.map((li) => li.lastChild.textContent.trim()),
  );
  await ada.page.getByLabel("I've written down my recovery phrase").check();
  await ada.page.getByRole('button', { name: 'Continue' }).click();
  for (const input of await ada.page.getByLabel(/^Word #\d+$/).all()) {
    await input.fill(words[Number((await input.getAttribute('id')).split('-')[1])]);
  }
  await ada.page.getByRole('button', { name: 'Reset keys' }).click();
  await expect(ada.page.getByText(/Keys reset\./)).toBeVisible();

  await expect(conversation(grace.page).getByRole('alert')).toContainText('did not authorise');
  expect(await safety(grace.page)).not.toBe(graceNumber);
});

test("rotating on one device locks the account's other devices until unlocked", async ({ browser }) => {
  const [ada] = await twoUsers(browser);
  const second = await (await browser.newContext()).newPage();
  await signIn(second, ada.name);
  await expect(second).toHaveURL(/\/chatpage$/);

  await rotate(ada.page, ada.phrase);
  await expect(second.getByRole('heading', { name: 'Unlock' })).toBeVisible();
  await second.getByLabel('Password').fill(STRONG_PASSWORD);
  await second.getByRole('button', { name: 'Unlock' }).click();
  await expect(second.getByText(ada.name, { exact: true })).toBeVisible();
});
