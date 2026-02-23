import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef } from 'react';
import { Socket, io } from 'socket.io-client';
import type {
  Accessory,
  ClientToServerEvents,
  GameSnapshot,
  Profile,
  ServerToClientEvents,
} from '../types';

interface CustomSocket extends Socket<
  ServerToClientEvents,
  ClientToServerEvents
> {
  auth: {
    token: string | null;
    nickname?: string;
    equippedAccessories: string[];
  };
}

// Single socket instance — connects to same origin in production, proxy in dev
export const socket: CustomSocket = io({
  autoConnect: false, // Must be manual to send Supabase JWT
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
}) as unknown as CustomSocket;

export function useSocketManager(
  session: Session | null,
  profile: Profile | null,
  accessories: (Accessory & { is_equipped: boolean })[]
) {
  useEffect(() => {
    // Socket Error Handling
    const onConnectError = (err: Error) => {
      console.error('[SOCKET] Connection Error:', err.message);
    };

    socket.on('connect_error', onConnectError);

    const onConnect = () => {
      console.log('[SOCKET] Connected successfully');
    };

    const onDisconnect = (reason: string) => {
      console.warn('[SOCKET] Disconnected. Reason:', reason);
      // Dispatch a custom event so pages can react to disconnection
      window.dispatchEvent(
        new CustomEvent('socket-disconnect', { detail: { reason } })
      );

      if (reason === 'io server disconnect') {
        socket.connect();
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Sync Auth Data
    if (session?.access_token) {
      if (!profile) {
        console.log('[SOCKET] Session found, waiting for profile...');
        return;
      }

      const equippedAccessories = accessories
        .filter((a) => a.is_equipped)
        .map((a) => a.id);

      socket.auth = {
        token: session.access_token,
        nickname: profile.nickname || session.user?.email?.split('@')[0],
        equippedAccessories,
      };
    } else {
      // Guest Mode
      socket.auth = {
        token: null,
        nickname: sessionStorage.getItem('bb-nickname') || undefined,
        equippedAccessories: [],
      };
    }

    if (socket.disconnected) {
      console.log('[SOCKET] Connecting...', socket.auth.nickname);
      socket.connect();
    } else {
      console.log(
        '[SOCKET] Re-connecting with new identity...',
        socket.auth.nickname
      );
      socket.disconnect().connect();
    }

    socket.on('item-unlocked', (data: { id: string }) => {
      console.log(`[SOCKET] Item unlocked: ${data.id}`);
      // Refresh profile to show new item
      // Note: We use the fetchProfileData from usePlayerProfile if possible,
      // but here we just log it. The AvatarModal will re-render when accessories change.
      // In a real app, you might want a global event or toast here.
      alert('Congratulations! New item unlocked!');
    });

    return () => {
      socket.off('connect_error', onConnectError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('item-unlocked');
    };
  }, [session, profile, accessories]);
}

// ---- Interpolation Buffer ----

const BUFFER_SIZE = 3;

export function useSnapshotBuffer() {
  const bufferRef = useRef<GameSnapshot[]>([]);
  const latestRef = useRef<GameSnapshot | null>(null);

  const push = useCallback((snapshot: GameSnapshot) => {
    bufferRef.current.push(snapshot);
    if (bufferRef.current.length > BUFFER_SIZE) {
      bufferRef.current.shift();
    }
    latestRef.current = snapshot;
  }, []);

  return { bufferRef, latestRef, push };
}

// ---- Ping Measurement ----

export function usePing() {
  const pingRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const start = Date.now();
      socket.volatile.emit('ping-check', () => {
        pingRef.current = Date.now() - start;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return pingRef;
}
