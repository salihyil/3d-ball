import { v4 as uuidv4 } from 'uuid';
import { Room } from '../../Room.js';
import { rooms } from '../RoomManager.js';
import { sendChatMessage } from '../utils.js';

export function handleLeaveRoom(io, socket) {
  if (!socket.roomId) return;
  const room = rooms.get(socket.roomId);
  if (!room) {
    socket.roomId = null;
    return;
  }

  const nickname = room.getPlayerNickname(socket.id);

  // When explicitly leaving (or creating/joining a new room), we don't use grace period
  room.removePlayer(socket.id, true);
  socket.leave(socket.roomId);

  if (room.isEmpty()) {
    room.destroy(); // Still call destroy for cleanup
    rooms.delete(socket.roomId);
    console.log(`[ROOM] ${socket.roomId} deleted (empty)`);
    io.to(socket.roomId).emit('room-destroyed');
  } else {
    socket.to(socket.roomId).emit('player-left', { nickname });
    sendChatMessage(
      io,
      socket,
      `${nickname} odadan ayrıldı.`,
      'system',
      null,
      'chat.player_left',
      { nickname }
    );
    io.to(socket.roomId).emit('room-update', room.getRoomInfo());
  }

  socket.roomId = null;
}

export function registerRoomEvents(io, socket) {
  // ---- Create Room ----
  socket.on('create-room', (data, callback) => {
    if (socket.roomId) {
      handleLeaveRoom(io, socket);
    }

    const { nickname, matchDuration, enableFeatures } = data;
    if (!nickname || nickname.length < 1 || nickname.length > 16) {
      return callback({ roomId: null, error: 'Invalid nickname' });
    }

    const hostToken = uuidv4();
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = new Room(roomId, matchDuration, io, enableFeatures ?? true);
    room.hostToken = hostToken;
    rooms.set(roomId, room);

    // Update socket user nickname for this session
    socket.user.nickname = nickname.trim();

    room.addPlayer(
      socket,
      nickname.trim(),
      true,
      socket.user.equippedAccessories,
      socket.user.sessionId,
      socket.user.cosmetics || {}
    );
    socket.roomId = roomId;
    socket.join(roomId);

    console.log(
      `[ROOM] Created: ${roomId} by "${socket.user.nickname}" (${socket.user.id})`
    );
    callback({ roomId, hostToken });
    io.to(roomId).emit('room-update', room.getRoomInfo());
  });

  // ---- Join Room ----
  socket.on('join-room', (data, callback) => {
    const { roomId, nickname } = data;

    if (socket.roomId && socket.roomId !== roomId) {
      handleLeaveRoom(io, socket);
    }

    if (!nickname || nickname.length < 1 || nickname.length > 16) {
      return callback({ success: false, error: 'Invalid nickname' });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    // If player is already in this room (prevent duplicates with same session)
    const existingPlayer = room.getPlayerBySessionId(socket.user.sessionId);
    if (existingPlayer) {
      if (existingPlayer.socketId !== socket.id) {
        room._performSocketSwap(existingPlayer, socket);
      }
      socket.roomId = roomId;
      socket.join(roomId);
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

    // Update socket user nickname for this session
    socket.user.nickname = nickname.trim();

    room.addPlayer(
      socket,
      nickname.trim(),
      returningHost,
      socket.user.equippedAccessories,
      socket.user.sessionId,
      socket.user.cosmetics || {}
    );
    socket.roomId = roomId;
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
      io,
      socket,
      `${nickname} odaya katıldı.`,
      'system',
      null,
      'chat.player_joined',
      { nickname }
    );
  });

  // ---- Switch Team ----
  socket.on('switch-team', (teamArg, callback) => {
    if (!socket.roomId) return callback?.({ error: 'Not in a room' });
    const room = rooms.get(socket.roomId);
    if (!room) return callback?.({ error: 'Room not found' });

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
      io,
      socket,
      `${nickname} takıma geçti.`,
      'system',
      null,
      'chat.player_switched',
      { nickname, team: teamKey }
    );
    callback?.({ success: true });
  });

  socket.on('toggle-features', (data) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room._getHostId() !== socket.id) return;

    room.enableFeatures = data.enableFeatures;
    io.to(socket.roomId).emit('room-update', room.getRoomInfo());
  });

  socket.on('set-field-texture', (data) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room._getHostId() !== socket.id) return;

    room.fieldTexture = data.fieldTexture;
    io.to(socket.roomId).emit('room-update', room.getRoomInfo());
  });

  // ---- Leave / Disconnect ----
  socket.on('leave-room', () => {
    handleLeaveRoom(io, socket);
  });

  // ---- Kick Player ----
  socket.on('kick-player', (data) => {
    if (!socket.roomId) return;
    const { targetId } = data;
    if (!targetId) return;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    // Only host can kick
    if (!room.isHost(socket.id)) return;

    // Cannot kick yourself
    if (targetId === socket.id) return;

    const targetNickname = room.getPlayerNickname(targetId);
    console.log(
      `[KICK] Host ${socket.id} kicked ${targetNickname} (${targetId}) from ${socket.roomId}`
    );

    // Notify the target player they were kicked
    io.to(targetId).emit('kicked', { reason: 'kicked_by_host' });

    // Remove the player from the room (immediate, no grace period)
    room.removePlayer(targetId, true);

    // Broadcast update to remaining players
    io.to(socket.roomId).emit('room-update', room.getRoomInfo());
    io.to(socket.roomId).emit('player-left', {
      nickname: targetNickname,
      reason: 'kicked',
    });

    sendChatMessage(
      io,
      socket,
      `${targetNickname} host tarafından odadan çıkarıldı.`,
      'system',
      null,
      'chat.player_kicked',
      { nickname: targetNickname }
    );
  });
}
