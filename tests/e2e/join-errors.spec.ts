import { expect, test } from '@playwright/test';
import { HomePage } from './pom/HomePage';

test.describe('Join Errors', () => {
  test('should show error when nickname is missing', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.createRoomBtn.click();
    await expect(home.errorMsg).toBeVisible();
  });

  test('should show error when joining without room code', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.nicknameInput.fill('Tester');
    await home.joinRoomBtn.click();
    await expect(home.errorMsg).toBeVisible();
  });
});
