import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Accessory, Profile } from '../types';
import { useAuth } from './useAuth';

export function usePlayerProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accessories, setAccessories] = useState<
    (Accessory & { is_equipped: boolean })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // 2. Fetch ALL accessories and those OWNED by user
      const [allAccRes, userAccRes] = await Promise.all([
        supabase
          .from('accessories')
          .select('*')
          .order('price', { ascending: true }),
        supabase.from('user_accessories').select('*').eq('user_id', user.id),
      ]);

      if (allAccRes.error) throw allAccRes.error;
      if (userAccRes.error) throw userAccRes.error;

      // 3. Merge catalog with ownership (Deduplicate by NAME)
      // Use a map to store catalog items by name, then overlay user data
      const accessoriesMap = new Map<
        string,
        Accessory & { isOwned: boolean; is_equipped: boolean }
      >();

      // First, populate with unique items by name from catalog
      allAccRes.data.forEach((acc) => {
        // Only keep the most complete one (usually the base catalog version)
        if (!accessoriesMap.has(acc.name)) {
          accessoriesMap.set(acc.name, {
            ...acc,
            isOwned: false,
            is_equipped: false,
          });
        }
      });

      // Then, match owned items by accessory_id back to name
      const idToNameMap = new Map(allAccRes.data.map((a) => [a.id, a.name]));

      userAccRes.data.forEach((ua) => {
        const itemName = idToNameMap.get(ua.accessory_id);
        if (itemName) {
          const existing = accessoriesMap.get(itemName);
          if (existing) {
            accessoriesMap.set(itemName, {
              ...existing,
              // Keep the ID from the owned record if possible,
              // but merging ownership status is most important
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

  const updateNickname = async (newNickname: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ nickname: newNickname })
      .eq('id', user.id);

    if (error) throw error;
    setProfile((prev) => (prev ? { ...prev, nickname: newNickname } : null));
  };

  const equipAccessory = async (accessoryId: string, category: string) => {
    if (!user) return;

    try {
      // 1. Unequip others in the same category
      // This is a bit complex in Supabase without a stored procedure,
      // but we can do it by finding IDs and then updating.
      // For simplicity in this phase, we target the specific user_accessories.

      // Get all owned accessories of that category to unequip them
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

      // 2. Equip the new one
      const { error } = await supabase
        .from('user_accessories')
        .update({ is_equipped: true })
        .eq('user_id', user.id)
        .eq('accessory_id', accessoryId);

      if (error) throw error;

      // 3. Update local state
      setAccessories((prev) =>
        prev.map((a) => {
          if (a.id === accessoryId) return { ...a, is_equipped: true };
          if (categoryAccIds.includes(a.id))
            return { ...a, is_equipped: false };
          return a;
        })
      );
    } catch (err: unknown) {
      console.error('Error equipping accessory:', err);
      throw err;
    }
  };

  return {
    profile,
    accessories,
    loading,
    error,
    updateNickname,
    equipAccessory,
    refreshProfile: fetchProfileData,
  };
}
