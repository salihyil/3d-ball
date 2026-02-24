import { expect, test } from '@playwright/test';

test.describe('Leaderboard', () => {
  test('should display leaderboard on home page', async ({ page }) => {
    // Intercept Supabase API calls
    await page.route('**/rest/v1/profiles?select=*', async (route) => {
      // Allow initial auth profile checks if any
      route.continue();
    });

    await page.route(
      /.*rest\/v1\/profiles\?select=nickname%2Cavatar_url%2Cwins%2Cgoals%2Cmatches_played%2Cxp%2Clevel%2Cbrawl_coins.*/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              nickname: 'E2ETesterPro',
              wins: 999,
              goals: 1500,
              matches_played: 1000,
              xp: 10000,
              level: 99,
              brawl_coins: 50000,
            },
            {
              nickname: 'SilverPlayer',
              wins: 50,
              goals: 100,
              matches_played: 60,
              xp: 1000,
              level: 10,
              brawl_coins: 500,
            },
          ]),
        });
      }
    );

    await page.goto('/');

    // Wait for Leaderboard button and click it
    const leaderboardBtn = page.getByRole('button', { name: /Leaderboard/i });
    await expect(leaderboardBtn).toBeVisible();
    await leaderboardBtn.click();

    // Verify modal is visible
    const modalTitle = page.getByRole('heading', { name: /Leaderboard/i });
    await expect(modalTitle).toBeVisible();

    // Verify mock data is rendered
    await expect(page.getByText('E2ETesterPro')).toBeVisible();
    await expect(page.getByText('999', { exact: true })).toBeVisible();
    await expect(page.getByText('1500', { exact: true })).toBeVisible();

    // Close modal
    const closeButton = page.locator('button.modal-close');
    await closeButton.click();
    await expect(modalTitle).toBeHidden();
  });
});
