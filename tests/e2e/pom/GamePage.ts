import { Locator, Page } from '@playwright/test';

export class GamePage {
  readonly page: Page;
  readonly scoreBlue: Locator;
  readonly scoreRed: Locator;
  readonly timer: Locator;
  readonly countdown: Locator;
  readonly goalOverlay: Locator;
  readonly gameOverOverlay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scoreBlue = page.getByTestId('score-blue');
    this.scoreRed = page.getByTestId('score-red');
    this.timer = page.getByTestId('hud-timer');
    this.countdown = page.getByTestId('countdown-number');
    this.goalOverlay = page.getByTestId('goal-overlay');
    this.gameOverOverlay = page.getByTestId('gameover-overlay');
  }

  async isGameOver() {
    return await this.gameOverOverlay.isVisible();
  }
}
