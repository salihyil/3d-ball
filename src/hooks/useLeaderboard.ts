import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

export function useLeaderboard(isOpen: boolean = true) {
  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select(
          'nickname, avatar_url, wins, goals, matches_played, xp, level, brawl_coins'
        )
        .order('wins', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      setLeaderboard(data as Profile[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching leaderboard:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [fetchLeaderboard, isOpen]);

  return { leaderboard, loading, error, refreshLeaderboard: fetchLeaderboard };
}
