const { test, expect } = require('./fixtures');

test('the hero fits the first screen and links to sign up', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByRole('heading', { name: 'Discover', level: 1 });
  await expect(hero).toBeInViewport();
  for (const word of ['Anonymity', 'Mystery', 'Freedom']) {
    await expect(page.getByText(word, { exact: true })).toBeInViewport();
  }
  await page.getByRole('main').getByRole('link', { name: 'Start messaging' }).click();
  await expect(page).toHaveURL(/\/login-register$/);
});

test('nav links scroll to their sections', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'FAQ' }).click();
  await expect(page.getByRole('heading', { name: /Mysterious queries/ })).toBeInViewport();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the menu collapses behind a button and the page never scrolls sideways', async ({ page }) => {
    await page.goto('/');
    const faqLink = page.getByRole('link', { name: 'FAQ' });
    await expect(faqLink).toBeHidden();
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(faqLink).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
