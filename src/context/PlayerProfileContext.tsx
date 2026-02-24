import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { socket } from '../hooks/useNetwork';
import { supabase } from '../lib/supabase';
import { Accessory, Profile } from '../types';
import { PlayerProfileContext } from './PlayerProfileContextInstance';

export function PlayerProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accessories, setAccessories] = useState<
    (Accessory & { is_equipped: boolean })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const [allAccRes, userAccRes] = await Promise.all([
        supabase
          .from('accessories')
          .select('*')
          .order('price', { ascending: true }),
        supabase.from('user_accessories').select('*').eq('user_id', user.id),
      ]);

      if (allAccRes.error) throw allAccRes.error;
      if (userAccRes.error) throw userAccRes.error;

      const accessoriesMap = new Map<
        string,
        Accessory & { isOwned: boolean; is_equipped: boolean }
      >();

      allAccRes.data.forEach((acc) => {
        if (!accessoriesMap.has(acc.name)) {
          accessoriesMap.set(acc.name, {
            ...acc,
            isOwned: false,
            is_equipped: false,
          });
        }
      });

      const idToNameMap = new Map(allAccRes.data.map((a) => [a.id, a.name]));

      userAccRes.data.forEach((ua) => {
        const itemName = idToNameMap.get(ua.accessory_id);
        if (itemName) {
          const existing = accessoriesMap.get(itemName);
          if (existing) {
            accessoriesMap.set(itemName, {
              ...existing,
              isOwned: true,
              is_equipped: ua.is_equipped,
            });
          }
        }
      });

      setAccessories(Array.from(accessoriesMap.values()));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching profile:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  useEffect(() => {
    if (!user) return;

    const handleItemUnlocked = () => {
      alert('Congratulations! New item unlocked!');
      fetchProfileData();
    };

    const handleCoinBalanceUpdated = (data: { balance: number }) => {
      setProfile((prev) =>
        prev ? { ...prev, brawl_coins: data.balance } : null
      );
    };

    socket.on('item-unlocked', handleItemUnlocked);
    socket.on('coin-balance-updated', handleCoinBalanceUpdated);

    return () => {
      socket.off('item-unlocked', handleItemUnlocked);
      socket.off('coin-balance-updated', handleCoinBalanceUpdated);
    };
  }, [user, fetchProfileData]);

  const updateNickname = async (newNickname: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ nickname: newNickname })
      .eq('id', user.id);

    if (error) throw error;
    setProfile((prev) => (prev ? { ...prev, nickname: newNickname } : null));
  };

  const toggleAccessory = async (accessoryId: string, category: string) => {
    if (!user) return;

    const accessory = accessories.find((a) => a.id === accessoryId);
    if (!accessory) return;

    const isCurrentlyEquipped = accessory.is_equipped;

    try {
      if (isCurrentlyEquipped) {
        const { error } = await supabase
          .from('user_accessories')
          .update({ is_equipped: false })
          .eq('user_id', user.id)
          .eq('accessory_id', accessoryId);

        if (error) throw error;

        setAccessories((prev) =>
          prev.map((a) =>
            a.id === accessoryId ? { ...a, is_equipped: false } : a
          )
        );
      } else {
        const categoryAccIds = accessories
          .filter((a) => a.category === category)
          .map((a) => a.id);

        if (categoryAccIds.length > 0) {
          await supabase
            .from('user_accessories')
            .update({ is_equipped: false })
            .eq('user_id', user.id)
            .in('accessory_id', categoryAccIds);
        }

        const { error } = await supabase
          .from('user_accessories')
          .update({ is_equipped: true })
          .eq('user_id', user.id)
          .eq('accessory_id', accessoryId);

        if (error) throw error;

        setAccessories((prev) =>
          prev.map((a) => {
            if (a.id === accessoryId) return { ...a, is_equipped: true };
            if (categoryAccIds.includes(a.id))
              return { ...a, is_equipped: false };
            return a;
          })
        );
      }
    } catch (err: unknown) {
      console.error('Error toggling accessory:', err);
      throw err;
    }
  };

  const buyWithCoins = useCallback(
    (
      accessoryId: string
    ): Promise<{ ok: boolean; error?: string; newBalance?: number }> => {
      return new Promise((resolve) => {
        if (!user) {
          return resolve({ ok: false, error: 'not_logged_in' });
        }

        socket.emit(
          'buy-item-with-coins',
          { accessoryId },
          (res: { ok: boolean; error?: string; newBalance?: number }) => {
            if (res.ok && res.newBalance !== undefined) {
              setProfile((prev) =>
                prev ? { ...prev, brawl_coins: res.newBalance! } : null
              );
              fetchProfileData();
            }
            resolve(res);
          }
        );
      });
    },
    [user, fetchProfileData]
  );

  return (
    <PlayerProfileContext.Provider
      value={{
        profile,
        accessories,
        loading,
        error,
        updateNickname,
        toggleAccessory,
        buyWithCoins,
        refreshProfile: fetchProfileData,
      }}
    >
      {children}
    </PlayerProfileContext.Provider>
  );
}
