// ============================================================
// Ball Brawl — Game Server
// Express + Socket.IO
// ============================================================

import express from "express";
import { createServer } from "http";
import { dirname, join } from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { Room } from "./server/Room.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5173"],
    methods: ["GET", "POST"],
  },
  pingInterval: 2000,
  pingTimeout: 5000,
});

// Production: serve built React app
if (process.env.NODE_ENV === "production") {
  app.use(express.static(join(__dirname, "dist")));
  app.get("*", (_req, res) => {
    res.sendFile(join(__dirname, "dist", "index.html"));
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

io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  // Ping check for client latency measurement
  socket.on("ping-check", (cb) => {
    if (typeof cb === "function") cb();
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

  // ---- Create Room ----
  socket.on("create-room", (data, callback) => {
    const { nickname, matchDuration } = data;
    if (!nickname || nickname.length < 1 || nickname.length > 16) {
      return callback({ roomId: null, error: "Invalid nickname" });
    }

    const roomId = uuidv4().slice(0, 8);
    const room = new Room(roomId, matchDuration, io);
    rooms.set(roomId, room);

    room.addPlayer(socket, nickname, true);
    currentRoomId = roomId;
    socket.join(roomId);

    console.log(`[ROOM] Created: ${roomId} by "${nickname}"`);
    callback({ roomId });
    io.to(roomId).emit("room-update", room.getRoomInfo());
  });

  // ---- Join Room ----
  socket.on("join-room", (data, callback) => {
    const { roomId, nickname } = data;
    if (!nickname || nickname.length < 1 || nickname.length > 16) {
      return callback({ success: false, error: "Invalid nickname" });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: "Room not found" });
    }

    // If player is already in this room (e.g. creator navigated to lobby)
    if (room.hasPlayer(socket.id)) {
      currentRoomId = roomId;
      return callback({ success: true, room: room.getRoomInfo() });
    }

    if (room.isFull()) {
      return callback({ success: false, error: "Room is full (10/10)" });
    }

    room.addPlayer(socket, nickname, false);
    currentRoomId = roomId;
    socket.join(roomId);

    console.log(`[ROOM] ${nickname} joined ${roomId}`);
    callback({ success: true, room: room.getRoomInfo() });
    io.to(roomId).emit("room-update", room.getRoomInfo());
    socket.to(roomId).emit("player-joined", {
      nickname,
      team: room.getPlayerTeam(socket.id),
    });
  });

  // ---- Switch Team ----
  socket.on("switch-team", (teamArg, callback) => {
    if (!currentRoomId) return callback?.({ error: "Not in a room" });
    const room = rooms.get(currentRoomId);
    if (!room) return callback?.({ error: "Room not found" });

    // Allow switch-team even if game is running, as long as they are not in the active play yet
    // Handled in room.switchTeam which updates gameLoop if they are in it
    // Wait, if they are already playing, we let them switch mid-game anyway (from previous commit).
    // So no restriction is needed here, room.switchTeam handles both scenarios.

    // Lobby sends { team: 'red' }, unwrap if needed
    const targetTeam = typeof teamArg === "object" ? teamArg.team : teamArg;

    const result = room.switchTeam(socket.id, targetTeam);

    if (result && result.error) {
      return callback?.(result);
    }

    // Success will be broadcasted via room-update anyway, but we can call back too
    callback?.({ success: true });
  });

  // ---- Start Game ----
  socket.on("start-game", () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (!room.isHost(socket.id)) return;
    if (room.gameState !== "lobby") return;

    room.startGame();
  });

  // ---- Enter Match ----
  socket.on("enter-match", () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (room.gameState === "lobby") return; // If it's lobby, game hasn't started yet

    room.enterMatch(socket.id);
  });

  // ---- Player Input ----
  socket.on("player-input", (data) => {
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
    if (room.gameState !== "playing") {
      // Only log once per state change to avoid spam
      if (!socket._lastLoggedState || socket._lastLoggedState !== room.gameState) {
        console.log(
          `[INPUT] REJECTED: gameState is '${room.gameState}', not 'playing'. Room: ${currentRoomId}`,
        );
        socket._lastLoggedState = room.gameState;
      }
      return;
    }

    room.handleInput(socket.id, data);
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

    if (isHost || room.isEmpty()) {
      room.destroy();
      rooms.delete(currentRoomId);
      console.log(`[ROOM] ${currentRoomId} deleted (host left or empty)`);
      io.to(currentRoomId).emit("room-destroyed");
    } else {
      io.to(currentRoomId).emit("room-update", room.getRoomInfo());
      socket.to(currentRoomId).emit("player-left", { nickname });
    }

    currentRoomId = null;
  };

  socket.on("leave-room", leaveRoom);
  socket.on("disconnect", () => {
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
