import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSnapshot } from '../types';
import { socket, usePing, useSnapshotBuffer } from './useNetwork';

describe('useNetwork Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  describe('usePing', () => {
    it('should emit ping-check every 3 seconds', () => {
      renderHook(() => usePing());

      // Advance 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(socket.volatile.emit).toHaveBeenCalledWith(
        'ping-check',
        expect.any(Function)
      );
    });

    it('should update ping value on callback', () => {
      const { result } = renderHook(() => usePing());

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Get the callback passed to emit
      // Use a more specific type for the mock call if possible, or a safer assertion
      const callback = (
        socket.volatile.emit as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls[0][1] as () => void;

      // Mock Date.now to simulate latency
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + 50);

      act(() => {
        callback();
      });

      expect(result.current.current).toBe(50);
    });
  });

  describe('useSnapshotBuffer', () => {
    const mockSnapshot = (): GameSnapshot =>
      ({
        players: {},
        ball: {
          position: { x: 0, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
        },
        timestamp: Date.now(),
        score: { blue: 0, red: 0 },
        timeRemaining: 300,
        gameState: 'playing',
      }) as unknown as GameSnapshot;

    it('should push snapshots to buffer and limit size', () => {
      const { result } = renderHook(() => useSnapshotBuffer());

      act(() => {
        result.current.push(mockSnapshot());
        result.current.push(mockSnapshot());
        result.current.push(mockSnapshot());
        result.current.push(mockSnapshot()); // Buffer size is 3
      });

      expect(result.current.bufferRef.current.length).toBe(3);
      expect(result.current.latestRef.current).toBeDefined();
    });
  });
});
