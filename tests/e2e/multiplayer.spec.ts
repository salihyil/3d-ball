import { expect, test } from '@playwright/test';
import { GamePage } from './pom/GamePage';
import { HomePage } from './pom/HomePage';
import { LobbyPage } from './pom/LobbyPage';

test.describe('Multiplayer Flow', () => {
  test('should allow a host to create a room and a joiner to enter', async ({
    browser,
  }) => {
    // 1. Host setup
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const hostHome = new HomePage(hostPage);
    const hostLobby = new LobbyPage(hostPage);

    await hostHome.goto();
    await hostHome.createRoom('HostPlayer');

    // Wait for lobby
    await expect(hostPage).toHaveURL(/.*lobby\/.*/);
    const roomCode = await hostLobby.getRoomCode();
    expect(roomCode).not.toBeNull();

    // 2. Joiner setup
    const joinerContext = await browser.newContext();
    const joinerPage = await joinerContext.newPage();
    const joinerHome = new HomePage(joinerPage);
    const joinerLobby = new LobbyPage(joinerPage);

    await joinerHome.goto();
    await joinerHome.joinRoom('JoinerPlayer', roomCode!);

    // Wait for joiner in lobby
    await expect(joinerPage).toHaveURL(new RegExp(`.*lobby/${roomCode}`));
    await expect(joinerLobby.teamsGrid).toContainText('JoinerPlayer');

    // 3. Start game (Host only)
    await hostLobby.startGame();

    // Both should be in game
    const hostGame = new GamePage(hostPage);
    const joinerGame = new GamePage(joinerPage);

    await expect(hostPage).toHaveURL(/.*game\/.*/);
    await expect(joinerPage).toHaveURL(/.*game\/.*/);

    // Verify game starts with countdown
    await expect(hostGame.countdown).toBeVisible();
    await expect(joinerGame.countdown).toBeVisible();

    await hostContext.close();
    await joinerContext.close();
  });
});
