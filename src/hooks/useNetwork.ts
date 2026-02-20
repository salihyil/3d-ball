import { useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import type { GameSnapshot } from '../types';

// Single socket instance — connects to same origin in production, proxy in dev
export const socket = io({
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
});

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
