import { Locator, Page } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly nicknameInput: Locator;
  readonly createRoomBtn: Locator;
  readonly roomCodeInput: Locator;
  readonly joinRoomBtn: Locator;
  readonly errorMsg: Locator;
  readonly durationSelect: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nicknameInput = page.getByTestId('nickname-input');
    this.createRoomBtn = page.getByTestId('create-room-btn');
    this.roomCodeInput = page.getByTestId('room-code-input');
    this.joinRoomBtn = page.getByTestId('join-room-btn');
    this.errorMsg = page.getByTestId('home-error');
    this.durationSelect = page.getByTestId('duration-select');
  }

  async goto() {
    await this.page.goto('/');
  }

  async createRoom(nickname: string) {
    await this.nicknameInput.fill(nickname);
    await this.createRoomBtn.click();
  }

  async joinRoom(nickname: string, code: string) {
    await this.nicknameInput.fill(nickname);
    await this.roomCodeInput.fill(code);
    await this.joinRoomBtn.click();
  }
}
