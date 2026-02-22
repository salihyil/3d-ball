import { expect, test } from '@playwright/test';

test.describe('Localization', () => {
  test('should switch language', async ({ page }) => {
    await page.goto('/');

    const langBtn = page.getByTestId('lang-selector-btn');
    await langBtn.click();

    const trOption = page.getByTestId('lang-option-tr');
    await trOption.click();

    // Check if title changed (assuming 'Ball Brawl' stays but others change, or check specific text)
    // For now check if language code button text changed
    await expect(langBtn).toContainText('TR');
  });
});
