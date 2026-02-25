import { renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi, type Mock } from 'vitest';
import { supabase } from '../lib/supabase';
import { useLeaderboard } from './useLeaderboard';

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

test('handles successful leaderboard fetch', async () => {
  const mockData = [
    {
      nickname: 'Player1',
      wins: 50,
      goals: 100,
      matches_played: 60,
      xp: 1000,
      level: 10,
      brawl_coins: 500,
    },
    {
      nickname: 'Player2',
      wins: 40,
      goals: 80,
      matches_played: 50,
      xp: 800,
      level: 8,
      brawl_coins: 400,
    },
  ];

  const selectMock = vi.fn().mockReturnThis();
  const orderMock = vi.fn().mockReturnThis();
  const limitMock = vi.fn().mockResolvedValue({ data: mockData, error: null });

  (supabase.from as Mock).mockReturnValue({
    select: selectMock,
    order: orderMock,
    limit: limitMock,
  });

  const { result } = renderHook(() => useLeaderboard());

  expect(result.current.loading).toBe(true);

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.leaderboard).toEqual(mockData);
  expect(result.current.error).toBeNull();
});

test('handles fetch error', async () => {
  const selectMock = vi.fn().mockReturnThis();
  const orderMock = vi.fn().mockReturnThis();
  const limitMock = vi
    .fn()
    .mockResolvedValue({ data: null, error: new Error('Network error') });

  (supabase.from as Mock).mockReturnValue({
    select: selectMock,
    order: orderMock,
    limit: limitMock,
  });

  const { result } = renderHook(() => useLeaderboard());

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.error).toBe('Network error');
  expect(result.current.leaderboard).toEqual([]);
});
