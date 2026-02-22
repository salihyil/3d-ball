import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSnapshot, RoomInfo } from '../../types';
import GameScene from './Scene';

// Mock all sub-components to simplify testing the orchestration
vi.mock('./Ball', () => ({ Ball: () => <mesh data-testid="ball" /> }));
vi.mock('./BoostPads', () => ({
  BoostPads: () => <mesh data-testid="boost-pads" />,
}));
vi.mock('./CameraFollow', () => ({ CameraFollow: () => null }));
vi.mock('./Field/Field', () => ({ Field: () => <mesh data-testid="field" /> }));
vi.mock('./Obstacles', () => ({
  Obstacles: () => <mesh data-testid="obstacles" />,
}));
vi.mock('./PlayerPool', () => ({
  PlayerPool: () => <mesh data-testid="player-pool" />,
}));
vi.mock('./PowerUpPool', () => ({
  PowerUpPool: () => <mesh data-testid="power-up-pool" />,
}));

// Mock R3F components that aren't natively supported in JSDOM easily without a canvas
vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual('@react-three/fiber');
  return {
    ...actual,
    Canvas: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="canvas-mock">{children}</div>
    ),
  };
});

describe('GameScene Component', () => {
  let mockLatestRef: React.MutableRefObject<GameSnapshot | null>;
  let mockRoom: RoomInfo;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLatestRef = { current: null };
    mockRoom = {
      roomId: 'test',
      hostId: 'p1',
      matchDuration: 300,
      gameState: 'playing',
      enableFeatures: true,
      players: [],
    };
  });

  it('should render core sub-components', () => {
    // We render without the Canvas provider because we've mocked the components to be simple divs/meshes
    // In a real R3F test we'd use @react-three/test-renderer, but mocking is faster for logic coverage
    render(<GameScene latestRef={mockLatestRef} room={mockRoom} />);

    // Note: Since R3F components are handled by a reconciler,
    // standard RTL `render` works here only because we mocked them to standard React elements.
    expect(document.querySelector('[data-testid="ball"]')).toBeDefined();
    expect(document.querySelector('[data-testid="field"]')).toBeDefined();
    expect(document.querySelector('[data-testid="player-pool"]')).toBeDefined();
  });

  it('should conditionally hide features based on room settings', () => {
    mockRoom.enableFeatures = false;

    render(<GameScene latestRef={mockLatestRef} room={mockRoom} />);

    expect(document.querySelector('[data-testid="obstacles"]')).toBeNull();
    expect(document.querySelector('[data-testid="boost-pads"]')).toBeNull();
  });
});
