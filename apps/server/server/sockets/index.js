import { socketAuthMiddleware } from './auth.js';
import { registerChatEvents } from './events/chatEvents.js';
import { registerGameEvents } from './events/gameEvents.js';
import { registerRoomEvents } from './events/roomEvents.js';
import { registerShopEvents } from './events/shopEvents.js';
import { rooms, startRoomCleanupInterval } from './RoomManager.js';

export function initializeSockets(io) {
  startRoomCleanupInterval();
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    console.log(
      `[CONNECT] ${socket.user.nickname} (${socket.user.id}) connected via ${socket.id} (Session: ${socket.user.sessionId})`
    );

    socket.roomId = null;

    // ---- Session Recovery Check ----
    if (socket.user.sessionId) {
      for (const [id, room] of rooms) {
        if (room.reconnectPlayer(socket.user.sessionId, socket)) {
          socket.roomId = id;
          socket.join(id);
          console.log(
            `[RECONNECT] ${socket.user.nickname} recovered session in room ${id}`
          );
          // Inform fellow players
          socket.to(id).emit('room-update', room.getRoomInfo());
          // Inform the reconnected player
          socket.emit('reconnected', { room: room.getRoomInfo() });
          break;
        }
      }
    }

    // Register event handlers
    registerRoomEvents(io, socket);
    registerGameEvents(io, socket);
    registerChatEvents(io, socket);
    registerShopEvents(io, socket);

    socket.on('disconnect', () => {
      console.log(`[DISCONNECT] ${socket.id} (${socket.user.nickname})`);
      if (socket.roomId) {
        const room = rooms.get(socket.roomId);
        if (room) {
          room.removePlayer(socket.id, false); // Use grace period
          io.to(socket.roomId).emit('room-update', room.getRoomInfo());
        }
      }
    });
  });
}
