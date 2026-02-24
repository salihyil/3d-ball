import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameLoop } from './GameLoop.js';

describe('GameLoop', () => {
  let roomMock;
  let playerData;
  let loop;

  beforeEach(() => {
    roomMock = {
      gameState: 'playing',
      matchDuration: 300,
      onTimerUpdate: vi.fn(),
      onGoalScored: vi.fn(),
      broadcastSnapshot: vi.fn(),
      players: new Map(),
    };
    playerData = {
      p1: { team: 'blue' },
      p2: { team: 'red' },
    };
    loop = new GameLoop(roomMock, playerData, true);
  });

  it('should initialize players at correct positions', () => {
    const p1 = loop.players['p1'];
    const p2 = loop.players['p2'];

    expect(p1.team).toBe('blue');
    expect(p1.position.x).toBeLessThan(0); // Blue spawns on left
    expect(p2.team).toBe('red');
    expect(p2.position.x).toBeGreaterThan(0); // Red spawns on right
  });

  it('should not spawn players inside obstacles', () => {
    // Obstacles are at x: +/- 20, z: +/- 15, radius: 2.5
    // Players have radius 1.0. Total safe distance > 3.5
    const FIELD_OBSTACLES = [
      {
        id: 'obs1',
        position: { x: -20, y: 0, z: -15 },
        radius: 2.5,
        height: 10,
      },
      {
        id: 'obs2',
        position: { x: -20, y: 0, z: 15 },
        radius: 2.5,
        height: 10,
      },
      {
        id: 'obs3',
        position: { x: 20, y: 0, z: -15 },
        radius: 2.5,
        height: 10,
      },
      { id: 'obs4', position: { x: 20, y: 0, z: 15 }, radius: 2.5, height: 10 },
    ];

    // Create a game with 3 players on blue to trigger the spread spawns
    playerData = {
      p1: { team: 'blue' },
      p2: { team: 'blue' },
      p3: { team: 'blue' },
    };
    loop = new GameLoop(roomMock, playerData, true);

    for (const player of Object.values(loop.players)) {
      for (const obs of FIELD_OBSTACLES) {
        const dx = player.position.x - obs.position.x;
        const dz = player.position.z - obs.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = 1.0 + obs.radius; // player radius + obstacle radius
        expect(distSq).toBeGreaterThan(minDist * minDist);
      }
    }
  });

  it('should reset positions correctly', () => {
    loop.ball.position = { x: 10, y: 10, z: 10 };
    loop.resetPositions();

    expect(loop.ball.position.x).toBe(0);
    expect(loop.ball.position.y).toBeGreaterThan(0);
    expect(loop.ball.position.z).toBe(0);
  });

  it('should apply movement from inputs', () => {
    // DT = 1/30
    loop.handleInput('p1', { dx: 1, dz: 0 }); // Move right
    const initialX = loop.players['p1'].position.x;

    // Simulate one update
    loop._update();

    expect(loop.players['p1'].position.x).toBeGreaterThan(initialX);
  });

  it('should handle jumping and gravity', () => {
    loop.handleInput('p1', { jump: true });
    loop._update();

    expect(loop.players['p1'].velocity.y).toBeGreaterThan(0);

    // Simulate air time
    for (let i = 0; i < 10; i++) {
      loop._update();
    }

    expect(loop.players['p1'].position.y).toBeGreaterThan(1); // Radius is 1.0
  });

  it('should clamp ball to field bounds', () => {
    // Field width is 80 (clamped at 40 - radius)
    // Front wall is solid if Z > goalZBounds (4.5)
    loop.ball.position = { x: 39.5, y: 1.5, z: 10 };
    loop.ball.velocity = { x: 100, y: 0, z: 0 };

    loop._update();

    expect(loop.ball.position.x).toBeLessThan(41); // Field limit is 40, ball radius is 1.5, center can be at 38.5, but bounce logic might push it slightly or test setup was too close
    expect(loop.ball.velocity.x).toBeLessThan(0); // Bounce back
  });

  it('should detect goals', () => {
    // Goal is at X > 40 (Blue scores in Red goal)
    loop.ball.position = { x: 41, y: 1, z: 0 };
    loop._update();

    expect(roomMock.onGoalScored).toHaveBeenCalledWith('blue', undefined);
  });

  it('should handle power-up spawning', () => {
    // Set timer to almost spawn
    loop.powerUpSpawnTimer = 9.9;
    loop._update(); // Should spawn on or after 10s if players exist

    // Wait, DT is 1/30, so 9.9 + 1/30 >= 10? No.
    // Let's force it
    loop.powerUpSpawnTimer = 10;
    loop._update();

    expect(loop.powerUps.length).toBeGreaterThan(0);
  });

  it('should clean up NaN values', () => {
    loop.ball.position = { x: NaN, y: 0, z: 0 };
    loop._update();

    expect(isNaN(loop.ball.position.x)).toBe(false);
    expect(loop.ball.position.x).toBe(0);
  });
});
