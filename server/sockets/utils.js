import { v4 as uuidv4 } from 'uuid';
import { rooms } from './RoomManager.js';

export function sendChatMessage(
  io,
  socket,
  text,
  type = 'user',
  nickname = null,
  key = null,
  params = null
) {
  const currentRoomId = socket.roomId;
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

  // Attach title/nameColor for user messages
  if (type === 'user' && currentRoomId) {
    const room = rooms.get(currentRoomId);
    if (room) {
      const player = room.players.get(socket.id);
      if (player?.title) {
        msg.title = player.title;
        msg.nameColor = player.nameColor;
      }
    }
  }

  io.to(currentRoomId).emit('chat_message', msg);
}
