// ============================================================
// Ball Brawl — Game Server
// Express + Socket.IO
// ============================================================

import express from 'express';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { Room } from './server/Room.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
  pingInterval: 2000,
  pingTimeout: 5000,
});

// Production: serve built React app
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

// ============================================================
// Room Management
// ============================================================

const rooms = new Map();

// Clean up empty rooms every 30s
setInterval(() => {
  for (const [id, room] of rooms) {
    if (room.isEmpty() && Date.now() - room.lastActivity > 60000) {
      room.destroy();
      rooms.delete(id);
      console.log(`[CLEANUP] Room ${id} deleted (inactive)`);
    }
  }
}, 30000);

// ============================================================
// Socket.IO Connection
// ============================================================

io.on('connection', (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  // Ping check for client latency measurement
  socket.on('ping-check', (cb) => {
    if (typeof cb === 'function') cb();
  });

  let currentRoomId = null;
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

  const sendChatMessage = (
    text,
    type = 'user',
    nickname = null,
    key = null,
    params = null
  ) => {
    if (!currentRoomId) return;
    const msg = {
      id: uuidv4(),
      type,
      nickname,
      text,
      timestamp: Date.now(),
      key,
      params,
    };
    io.to(currentRoomId).emit('chat-message', msg);
  };

  // ---- Create Room ----
  socket.on('create-room', (data, callback) => {
    const { nickname, matchDuration, enableFeatures } = data;
    if (!nickname || nickname.length < 1 || nickname.length > 16) {
      return callback({ roomId: null, error: 'Invalid nickname' });
    }

    const hostToken = uuidv4();
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = new Room(roomId, matchDuration, io, enableFeatures ?? true);
    room.hostToken = hostToken;
    rooms.set(roomId, room);

    room.addPlayer(socket, nickname, true);
    currentRoomId = roomId;
    socket.join(roomId);

    console.log(
      `[ROOM] Created: ${roomId} by "${nickname}" (Host Token: ${hostToken.slice(0, 4)}...)`
    );
    callback({ roomId, hostToken });
    io.to(roomId).emit('room-update', room.getRoomInfo());
  });

  // ---- Join Room ----
  socket.on('join-room', (data, callback) => {
    const { roomId, nickname } = data;
    if (!nickname || nickname.length < 1 || nickname.length > 16) {
      return callback({ success: false, error: 'Invalid nickname' });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    // If player is already in this room (e.g. creator navigated to lobby)
    if (room.hasPlayer(socket.id)) {
      currentRoomId = roomId;
      // If they have the host token, make sure they are host (re-claim if needed)
      if (data.hostToken && data.hostToken === room.hostToken) {
        room.reclaimHost(socket.id);
      }
      return callback({ success: true, room: room.getRoomInfo() });
    }

    if (room.isFull()) {
      return callback({ success: false, error: 'Room is full (10/10)' });
    }

    // Check if this player is the returning host
    const returningHost = data.hostToken && data.hostToken === room.hostToken;

    room.addPlayer(socket, nickname, returningHost);
    currentRoomId = roomId;
    socket.join(roomId);

    if (returningHost) {
      room.reclaimHost(socket.id);
    }

    console.log(
      `[ROOM] ${nickname} joined ${roomId} ${returningHost ? '(as recovering host)' : ''}`
    );
    callback({ success: true, room: room.getRoomInfo() });
    io.to(roomId).emit('room-update', room.getRoomInfo());
    socket.to(roomId).emit('player-joined', {
      nickname,
      team: room.getPlayerTeam(socket.id),
    });
    sendChatMessage(
      `${nickname} odaya katıldı.`,
      'system',
      null,
      'chat.player_joined',
      { nickname }
    );
  });

  // ---- Switch Team ----
  socket.on('switch-team', (teamArg, callback) => {
    if (!currentRoomId) return callback?.({ error: 'Not in a room' });
    const room = rooms.get(currentRoomId);
    if (!room) return callback?.({ error: 'Room not found' });

    // Allow switch-team even if game is running, as long as they are not in the active play yet
    // Handled in room.switchTeam which updates gameLoop if they are in it
    // Wait, if they are already playing, we let them switch mid-game anyway (from previous commit).
    // So no restriction is needed here, room.switchTeam handles both scenarios.

    // Lobby sends { team: 'red' }, unwrap if needed
    const targetTeam = typeof teamArg === 'object' ? teamArg.team : teamArg;

    const result = room.switchTeam(socket.id, targetTeam);

    if (result && result.error) {
      return callback?.(result);
    }

    // Success will be broadcasted via room-update anyway, but we can call back too
    const nickname = room.getPlayerNickname(socket.id);
    const teamKey = targetTeam === 'red' ? 'game.red' : 'game.blue';
    sendChatMessage(
      `${nickname} takıma geçti.`,
      'system',
      null,
      'chat.player_switched',
      { nickname, team: teamKey }
    );
    callback?.({ success: true });
  });

  socket.on('toggle-features', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room._getHostId() !== socket.id) return;

    room.enableFeatures = data.enableFeatures;
    io.to(currentRoomId).emit('room-update', room.getRoomInfo());
  });

  socket.on('set-field-texture', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room._getHostId() !== socket.id) return;

    room.fieldTexture = data.fieldTexture;
    io.to(currentRoomId).emit('room-update', room.getRoomInfo());
  });

  // ---- Game Flow ----
  socket.on('start-game', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (!room.isHost(socket.id)) return;
    if (room.gameState !== 'lobby') return;

    room.startGame();
  });

  // ---- Enter Match ----
  socket.on('enter-match', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (room.gameState === 'lobby') return; // If it's lobby, game hasn't started yet

    room.enterMatch(socket.id);
  });

  // ---- Player Input ----
  socket.on('player-input', (data) => {
    if (!currentRoomId) {
      console.log(`[INPUT] REJECTED: no currentRoomId for ${socket.id}`);
      return;
    }
    if (!checkRateLimit()) return;

    const room = rooms.get(currentRoomId);
    if (!room) {
      console.log(`[INPUT] REJECTED: room ${currentRoomId} not found`);
      return;
    }
    if (room.gameState !== 'playing') {
      // Only log once per state change to avoid spam
      if (
        !socket._lastLoggedState ||
        socket._lastLoggedState !== room.gameState
      ) {
        console.log(
          `[INPUT] REJECTED: gameState is '${room.gameState}', not 'playing'. Room: ${currentRoomId}`
        );
        socket._lastLoggedState = room.gameState;
      }
      return;
    }

    room.handleInput(socket.id, data);
  });

  // ---- Chat ----
  socket.on('send-chat-message', (data) => {
    if (!currentRoomId) return;
    const { text } = data;
    if (!text || text.trim().length === 0 || text.length > 100) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    const nickname = room.getPlayerNickname(socket.id);
    sendChatMessage(text, 'user', nickname);
  });

  // ---- Leave / Disconnect ----
  const leaveRoom = () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const nickname = room.getPlayerNickname(socket.id);
    const isHost = room.isHost(socket.id);

    room.removePlayer(socket.id);
    socket.leave(currentRoomId);

    if (room.isEmpty()) {
      room.destroy(); // Still call destroy for cleanup
      rooms.delete(currentRoomId);
      console.log(`[ROOM] ${currentRoomId} deleted (empty)`);
      io.to(currentRoomId).emit('room-destroyed');
    } else if (isHost) {
      console.log(
        `[ROOM] Host left ${currentRoomId}. Migrating host immediately...`
      );
      room.migrateHost();
    } else {
      io.to(currentRoomId).emit('room-update', room.getRoomInfo());
      socket.to(currentRoomId).emit('player-left', { nickname });
      sendChatMessage(
        `${nickname} odadan ayrıldı.`,
        'system',
        null,
        'chat.player_left',
        { nickname }
      );
    }

    currentRoomId = null;
  };

  // ---- Kick Player ----
  socket.on('kick-player', (data) => {
    if (!currentRoomId) return;
    const { targetId } = data;
    if (!targetId) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    // Only host can kick
    if (!room.isHost(socket.id)) return;

    // Cannot kick yourself
    if (targetId === socket.id) return;

    const targetNickname = room.getPlayerNickname(targetId);
    console.log(
      `[KICK] Host ${socket.id} kicked ${targetNickname} (${targetId}) from ${currentRoomId}`
    );

    // Notify the target player they were kicked
    io.to(targetId).emit('kicked', { reason: 'kicked_by_host' });

    // Remove the player from the room
    room.removePlayer(targetId);

    // Broadcast update to remaining players
    io.to(currentRoomId).emit('room-update', room.getRoomInfo());
    io.to(currentRoomId).emit('player-left', {
      nickname: targetNickname,
      reason: 'kicked',
    });

    sendChatMessage(
      `${targetNickname} host tarafından odadan çıkarıldı.`,
      'system',
      null,
      'chat.player_kicked',
      { nickname: targetNickname }
    );
  });

  socket.on('leave-room', leaveRoom);
  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] ${socket.id}`);
    leaveRoom();
  });
});

// ============================================================
// Start
// ============================================================

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n⚽ Ball Brawl server running on port ${PORT}\n`);
});
