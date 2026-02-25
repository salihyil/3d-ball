import { rooms } from '../RoomManager.js';

export function registerGameEvents(io, socket) {
  let inputCount = 0;
  let inputResetTime = Date.now();

  // Rate limiting: max 25 inputs per second
  const checkRateLimit = () => {
    const now = Date.now();
    if (now - inputResetTime > 1000) {
      inputCount = 0;
      inputResetTime = now;
    }
    inputCount++;
    return inputCount <= 25;
  };

  // ---- Game Flow ----
  socket.on('start-game', () => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room) return;
    if (!room.isHost(socket.id)) return;
    if (room.gameState !== 'lobby') return;

    room.startGame();
  });

  // ---- Enter Match ----
  socket.on('enter-match', () => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room) return;
    if (room.gameState === 'lobby') return; // If it's lobby, game hasn't started yet

    room.enterMatch(socket.id);
  });

  // ---- Player Input ----
  socket.on('player-input', (data) => {
    if (!socket.roomId) {
      console.log(`[INPUT] REJECTED: no currentRoomId for ${socket.id}`);
      return;
    }
    if (!checkRateLimit()) return;

    const room = rooms.get(socket.roomId);
    if (!room) {
      console.log(`[INPUT] REJECTED: room ${socket.roomId} not found`);
      return;
    }
    if (room.gameState !== 'playing') {
      // Only log once per state change to avoid spam
      if (
        !socket._lastLoggedState ||
        socket._lastLoggedState !== room.gameState
      ) {
        console.log(
          `[INPUT] REJECTED: gameState is '${room.gameState}', not 'playing'. Room: ${socket.roomId}`
        );
        socket._lastLoggedState = room.gameState;
      }
      return;
    }

    room.handleInput(socket.id, data);
  });
}
