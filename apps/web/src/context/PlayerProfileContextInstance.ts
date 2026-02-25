import { createContext } from 'react';
import { Accessory, Profile } from '@sasi/shared';

export interface PlayerProfileContextType {
  profile: Profile | null;
  accessories: (Accessory & { is_equipped: boolean })[];
  loading: boolean;
  error: string | null;
  updateNickname: (newNickname: string) => Promise<void>;
  toggleAccessory: (accessoryId: string, category: string) => Promise<void>;
  buyWithCoins: (
    accessoryId: string
  ) => Promise<{ ok: boolean; error?: string; newBalance?: number }>;
  refreshProfile: () => Promise<void>;
}

export const PlayerProfileContext = createContext<
  PlayerProfileContextType | undefined
>(undefined);
