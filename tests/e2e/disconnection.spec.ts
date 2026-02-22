import { expect, test } from '@playwright/test';
import { HomePage } from './pom/HomePage';
import { LobbyPage } from './pom/LobbyPage';

test.describe('Host Disconnection', () => {
  test('should migrate host status when host leaves the lobby', async ({
    browser,
  }) => {
    // 1. Host setup
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const hostHome = new HomePage(hostPage);
    const hostLobby = new LobbyPage(hostPage);

    await hostHome.goto();
    await hostHome.createRoom('HostPlayer');
    const roomCode = await hostLobby.getRoomCode();

    // 2. Joiner setup
    const joinerContext = await browser.newContext();
    const joinerPage = await joinerContext.newPage();
    const joinerHome = new HomePage(joinerPage);
    const joinerLobby = new LobbyPage(joinerPage);

    await joinerHome.goto();
    await joinerHome.joinRoom('JoinerPlayer', roomCode!);
    await expect(joinerPage).toHaveURL(new RegExp(`.*lobby/${roomCode}`));

    // 3. Host leaves
    await hostPage.close();

    // 4. Joiner should become host via migration
    // The server assigns host to the next available player
    await expect(joinerLobby.hostBadge).toBeVisible();
    await expect(joinerLobby.startBtn).toBeEnabled();

    await joinerContext.close();
    await hostContext.close();
  });
});
