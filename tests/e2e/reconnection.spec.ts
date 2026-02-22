import { expect, test } from '@playwright/test';
import { HomePage } from './pom/HomePage';
import { LobbyPage } from './pom/LobbyPage';

test.describe('Reconnection Logic', () => {
  test('should keep player in room after page refresh if others are present', async ({
    browser,
  }) => {
    // 1. Setup multi-player room (so it doesn't close on host refresh)
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const hostHome = new HomePage(hostPage);
    const hostLobby = new LobbyPage(hostPage);

    await hostHome.goto();
    await hostHome.createRoom('HostPlayer');
    const roomCode = await hostLobby.getRoomCode();

    const joinerContext = await browser.newContext();
    const joinerPage = await joinerContext.newPage();
    const joinerHome = new HomePage(joinerPage);
    await joinerHome.goto();
    await joinerHome.joinRoom('JoinerPlayer', roomCode!);

    // 2. Refresh the host page
    await hostPage.reload();

    // 3. Should still be in the lobby and re-join automatically (via sessionStorage)
    await expect(hostPage).toHaveURL(new RegExp(`.*lobby/${roomCode}`));
    await expect(hostLobby.teamsGrid).toContainText('HostPlayer');

    await hostContext.close();
    await joinerContext.close();
  });
});
