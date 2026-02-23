import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef } from 'react';
import { Socket, io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
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
    sessionId: string;
  };
  user?: {
    id: string;
    sessionId: string;
    nickname: string;
    isGuest: boolean;
  };
}

const SESSION_KEY = 'bb-session-id';

// Initialize or retrieve sessionId
const getSessionId = () => {
  let id = globalThis.sessionStorage?.getItem(SESSION_KEY);
  if (!id) {
    id = uuidv4();
    globalThis.sessionStorage?.setItem(SESSION_KEY, id);
  }
  return id;
};

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

    const isUnloading = { current: false };
    const handleUnload = () => {
      isUnloading.current = true;
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    const onConnect = () => {
      console.log('[SOCKET] Connected successfully with ID:', socket.id);
    };

    const onDisconnect = (reason: string) => {
      console.warn('[SOCKET] Disconnected. Reason:', reason);

      // If we are unloading (refreshing) or it was an intentional client disconnect, skip UI
      if (isUnloading.current || reason === 'io client disconnect') {
        return;
      }

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

    const sessionId = getSessionId();

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
        sessionId,
      };
      socket.user = {
        id: session.user.id,
        sessionId,
        nickname: socket.auth.nickname!,
        isGuest: false,
      };
    } else {
      // Guest Mode
      socket.auth = {
        token: null,
        nickname: globalThis.sessionStorage.getItem('bb-nickname') || undefined,
        equippedAccessories: [],
        sessionId,
      };
      socket.user = {
        id: `Guest_${sessionId.substring(0, 8)}`,
        sessionId,
        nickname: socket.auth.nickname || 'Guest',
        isGuest: true,
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

    return () => {
      socket.off('connect_error', onConnectError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
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
