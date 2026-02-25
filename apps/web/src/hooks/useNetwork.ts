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
} from '@sasi/shared';

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
  accessories: (Accessory & { is_equipped: boolean })[],
  authLoading: boolean,
  profileLoading: boolean
) {
  // 1. One-time setup for listeners
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

      if (isUnloading.current || reason === 'io client disconnect') {
        return;
      }

      window.dispatchEvent(
        new CustomEvent('socket-disconnect', { detail: { reason } })
      );

      if (reason === 'io server disconnect') {
        socket.connect();
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect_error', onConnectError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  // 2. Identity and Connection management
  const prevIdentityRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading || profileLoading) {
      console.log('[SOCKET] Waiting for auth/profile to load...');
      return;
    }

    const sessionId = getSessionId();

    let targetIdentity = '';
    let targetNickname = '';
    let targetToken: string | null = null;
    let targetAccessories: string[] = [];
    let targetUserId = '';
    let targetIsGuest = true;

    if (session?.access_token) {
      if (!profile) {
        console.log('[SOCKET] Session found, waiting for profile data...');
        return;
      }

      const equippedAccessories = accessories
        .filter((a) => a.is_equipped)
        .map((a) => a.id)
        .sort(); // Sort to ensure stable string representation

      targetNickname =
        profile.nickname || session.user?.email?.split('@')[0] || 'Player';
      targetToken = session.access_token;
      targetAccessories = equippedAccessories;
      targetUserId = session.user.id;
      targetIsGuest = false;

      // Create a stable identity string based on things that should trigger a reconnect
      targetIdentity = `token:${targetToken}|nick:${targetNickname}|acc:${targetAccessories.join(',')}`;
    } else {
      // Guest Mode
      targetNickname =
        globalThis.sessionStorage?.getItem('bb-nickname') || 'Guest';
      targetIsGuest = true;
      targetUserId = `Guest_${sessionId.substring(0, 8)}`;

      targetIdentity = `guest|nick:${targetNickname}`;
    }

    // Only reconnect if the derived identity has changed
    if (prevIdentityRef.current === targetIdentity) {
      // Just a re-render or irrelevant profile change (e.g. coin balance), do nothing
      return;
    }

    prevIdentityRef.current = targetIdentity;

    socket.auth = {
      token: targetToken,
      nickname: targetNickname,
      equippedAccessories: targetAccessories,
      sessionId,
    };

    socket.user = {
      id: targetUserId,
      sessionId,
      nickname: targetNickname,
      isGuest: targetIsGuest,
    };

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
  }, [session, profile, accessories, authLoading, profileLoading]);
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
