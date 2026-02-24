import { useContext } from 'react';
import { PlayerProfileContext } from '../context/PlayerProfileContextInstance';

export function usePlayerProfile() {
  const context = useContext(PlayerProfileContext);
  if (context === undefined) {
    throw new Error(
      'usePlayerProfile must be used within a PlayerProfileProvider'
    );
  }
  return context;
}
