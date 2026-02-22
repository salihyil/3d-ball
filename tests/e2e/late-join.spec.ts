import { expect, test } from '@playwright/test';
import { GamePage } from './pom/GamePage';
import { HomePage } from './pom/HomePage';
import { LobbyPage } from './pom/LobbyPage';

test.describe('Late Joiner Synchronization', () => {
  test('should allow a player to join a match already in progress', async ({
    browser,
  }) => {
    // 1. Host setup and start game
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const hostHome = new HomePage(hostPage);
    const hostLobby = new LobbyPage(hostPage);
    const hostGame = new GamePage(hostPage);

    await hostHome.goto();
    await hostHome.createRoom('HostPlayer');
    await expect(hostPage).toHaveURL(/.*lobby\/.*/);
    const roomCode = await hostLobby.getRoomCode();

    await hostLobby.startBtn.click();
    await expect(hostPage).toHaveURL(/.*game\/.*/);
    // Wait for game to be active (beyond countdown)
    await expect(hostGame.timer).toBeVisible();

    // 2. Late Joiner setup
    const joinerContext = await browser.newContext();
    const joinerPage = await joinerContext.newPage();
    const joinerHome = new HomePage(joinerPage);
    const joinerGame = new GamePage(joinerPage);

    await joinerHome.goto();
    await joinerHome.joinRoom('LatePlayer', roomCode!);

    // Late joiner should be in lobby and see "Enter Match"
    await expect(joinerPage).toHaveURL(new RegExp(`.*lobby/${roomCode}`));

    // In Lobby.tsx, when gameState !== 'lobby', the button text is "Enter Match"
    // I need to add a testid or select by text for the "Enter Match" button if it's different
    const enterMatchBtn = joinerPage.locator('button:has-text("Enter Match")');
    await expect(enterMatchBtn).toBeVisible();
    await enterMatchBtn.click();

    // Late joiner should now be in game and synced
    await expect(joinerPage).toHaveURL(/.*game\/.*/);
    await expect(joinerGame.timer).toBeVisible();

    // Verify scores are synced (roughly)
    const hostScore = await hostGame.scoreBlue.textContent();
    const joinerScore = await joinerGame.scoreBlue.textContent();
    expect(joinerScore).toBe(hostScore);

    await hostContext.close();
    await joinerContext.close();
  });
});
