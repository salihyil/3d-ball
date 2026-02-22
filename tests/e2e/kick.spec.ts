import { expect, test } from '@playwright/test';
import { HomePage } from './pom/HomePage';
import { LobbyPage } from './pom/LobbyPage';

test.describe('Kick Capability', () => {
  test('should allow host to kick a player and the player should see kicked message', async ({
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

    // 3. Host kicks player
    await hostLobby.kickPlayer('JoinerPlayer');

    // 4. Verify player sees kicked message
    await expect(joinerLobby.kickedMessage).toBeVisible();
    await expect(joinerLobby.kickedMessage).toContainText('Kicked'); // Or whatever the text is, but we added a test ID

    // 5. Verify host no longer sees player in lobby
    await expect(hostLobby.teamsGrid).not.toContainText('JoinerPlayer');

    await hostContext.close();
    await joinerContext.close();
  });
});
