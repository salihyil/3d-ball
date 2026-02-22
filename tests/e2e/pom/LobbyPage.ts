import { Locator, Page } from '@playwright/test';

export class LobbyPage {
  readonly page: Page;
  readonly roomCode: Locator;
  readonly startBtn: Locator;
  readonly joinBlueBtn: Locator;
  readonly joinRedBtn: Locator;
  readonly teamsGrid: Locator;
  readonly hostBadge: Locator;
  readonly kickButtons: Locator;
  readonly kickedMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.roomCode = page.getByTestId('room-code');
    this.startBtn = page.getByTestId('start-game-btn');
    this.joinBlueBtn = page.getByTestId('join-blue-btn');
    this.joinRedBtn = page.getByTestId('join-red-btn');
    this.teamsGrid = page.getByTestId('teams-grid');
    this.hostBadge = page.getByTestId('host-badge');
    this.kickButtons = page.getByTestId('btn-kick');
    this.kickedMessage = page.getByTestId('kicked-message');
  }

  async getRoomCode() {
    return await this.roomCode.textContent();
  }

  async startGame() {
    await this.startBtn.waitFor({ state: 'visible' });
    await this.startBtn.click();
  }

  async joinTeam(team: 'blue' | 'red') {
    if (team === 'blue') {
      await this.joinBlueBtn.click();
    } else {
      await this.joinRedBtn.click();
    }
  }

  async kickPlayer(nickname: string) {
    const playerRow = this.page.locator('.team-player', { hasText: nickname });
    const kickBtn = playerRow.getByTestId('btn-kick');
    await kickBtn.click();
  }
}
