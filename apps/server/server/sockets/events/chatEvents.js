import { rooms } from '../RoomManager.js';
import { sendChatMessage } from '../utils.js';

export function registerChatEvents(io, socket) {
  // ---- Chat ----
  socket.on('ping-check', (cb) => {
    if (typeof cb === 'function') cb();
  });

  socket.on('send-chat-message', (data) => {
    if (!socket.roomId) return;
    const { text } = data;
    if (!text || text.trim().length === 0 || text.length > 100) return;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    const nickname = room.getPlayerNickname(socket.id);
    sendChatMessage(io, socket, text, 'user', nickname);
  });
}
