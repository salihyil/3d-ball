import { describe, expect, it, vi } from 'vitest';
import { Room } from '../server/Room.js';

describe('Room class', () => {
  const mockIo = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  } as any;

  it('should initialize with an empty fieldTexture', () => {
    const room = new Room('test-room', 5, mockIo);
    expect(room.fieldTexture).toBe('');
  });

  it('should include fieldTexture in getRoomInfo', () => {
    const room = new Room('test-room', 5, mockIo);
    room.fieldTexture = 'grass.png';
    const info = room.getRoomInfo();
    expect(info.fieldTexture).toBe('grass.png');
  });

  it('should broadcast room-update when switching teams', () => {
    const room = new Room('test-room', 5, mockIo);
    const mockSocket = { id: 'player1' } as any;
    room.addPlayer(mockSocket, 'Player 1', true);

    room.switchTeam('player1', 'red');

    expect(mockIo.to).toHaveBeenCalledWith('test-room');
    expect(mockIo.emit).toHaveBeenCalledWith('room-update', expect.any(Object));
  });
});
