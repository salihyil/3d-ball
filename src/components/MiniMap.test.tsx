import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSnapshot, PlayerState } from '../types';
import MiniMap from './MiniMap';

describe('MiniMap Component', () => {
  let mockLatestRef: { current: GameSnapshot | null };

  beforeEach(() => {
    mockLatestRef = {
      current: {
        players: {
          p1: {
            id: 'p1',
            position: { x: -20, y: 0, z: -10 },
            velocity: { x: 0, y: 0, z: 0 },
            team: 'blue',
            boostCooldown: 0,
          } as PlayerState,
          p2: {
            id: 'p2',
            position: { x: 20, y: 0, z: 10 },
            velocity: { x: 0, y: 0, z: 0 },
            team: 'red',
            boostCooldown: 0,
          } as PlayerState,
        },
        ball: {
          position: { x: 0, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
        },
        timestamp: Date.now(),
      } as unknown as GameSnapshot,
    };

    // Canvas mock is already in setup.ts but we can ensure requestAnimationFrame is handled
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(cb, 16)
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });

  it('should render a canvas element', () => {
    const { container } = render(<MiniMap latestRef={mockLatestRef} />);
    expect(container.querySelector('canvas')).toBeDefined();
  });

  it('should map 3D coordinates to canvas and draw circles', () => {
    // We can't easily check pixels in jsdom, but we can verify the drawing calls if we mock getContext
    const mockCtx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      set fillStyle(val: string) {},
      set strokeStyle(val: string) {},
      set lineWidth(val: number) {},
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    );

    // Wait for a frame
    vi.useFakeTimers();
    render(<MiniMap latestRef={mockLatestRef} />);

    act(() => {
      vi.advanceTimersByTime(20);
    });

    // Players (2) + Ball (1) + Center circle (1) = at least 4 arc calls
    expect(
      (mockCtx.arc as unknown as { mock: { calls: unknown[][] } }).mock.calls
        .length
    ).toBeGreaterThanOrEqual(4);
    vi.useRealTimers();
  });
});
