import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Room } from './Room.js';

describe('Room', () => {
  let ioMock;
  let room;

  beforeEach(() => {
    ioMock = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };
    room = new Room('test-room', 5, ioMock, true);
  });

  afterEach(() => {
    if (room) {
      room.destroy();
    }
    vi.clearAllMocks();
  });

  it('should initialize with correct properties', () => {
    expect(room.roomId).toBe('test-room');
    expect(room.matchDuration).toBe(5 * 60);
    expect(room.gameState).toBe('lobby');
    expect(room.players.size).toBe(0);
  });

  it('should add a player', () => {
    const socketMock = { id: 'socket-1' };
    room.addPlayer(socketMock, 'Player 1', true);

    expect(room.players.has('socket-1')).toBe(true);
    const player = room.players.get('socket-1');
    expect(player.nickname).toBe('Player 1');
    expect(player.isHost).toBe(true);
  });

  it('should balance teams when adding players', () => {
    room.addPlayer({ id: 's1' }, 'P1', true); // blue
    room.addPlayer({ id: 's2' }, 'P2', false); // red
    room.addPlayer({ id: 's3' }, 'P3', false); // blue

    expect(room.players.get('s1').team).toBe('blue');
    expect(room.players.get('s2').team).toBe('red');
    expect(room.players.get('s3').team).toBe('blue');
  });

  it('should handle team switching', () => {
    room.addPlayer({ id: 's1' }, 'P1', true); // blue
    const result = room.switchTeam('s1', 'red');

    expect(result.success).toBe(true);
    expect(room.players.get('s1').team).toBe('red');
    expect(ioMock.emit).toHaveBeenCalledWith('room-update', expect.any(Object));
  });

  it('should prevent switching to a full team', () => {
    // Fill red team (max is 5)
    for (let i = 0; i < 5; i++) {
      room.players.set(`r${i}`, { team: 'red', nickname: `R${i}` });
    }

    room.addPlayer({ id: 's1' }, 'P1', true); // goes to blue
    const result = room.switchTeam('s1', 'red');

    expect(result.error).toBeDefined();
    expect(room.players.get('s1').team).toBe('blue');
  });

  it('should start game correctly', () => {
    room.addPlayer({ id: 's1' }, 'P1', true);
    room.startGame();

    expect(room.gameState).toBe('countdown');
    expect(room.gameLoop).toBeDefined();
    expect(ioMock.emit).toHaveBeenCalledWith('game-start', { countdown: 5 });
  });

  it('should remove player and handle host leaving', () => {
    room.addPlayer({ id: 's1' }, 'Host', true);
    room.addPlayer({ id: 's2' }, 'Guest', false);

    room.removePlayer('s1');
    expect(room.players.size).toBe(1);
    expect(room.isHost('s1')).toBe(false);
    // Note: Room.js removePlayer doesn't automatically assign new host,
    // server.js handles the room destruction if host leaves.
  });

  it('should identify empty room', () => {
    room.addPlayer({ id: 's1' }, 'P1', true);
    expect(room.isEmpty()).toBe(false);
  });

  describe('Host Migration', () => {
    it('should migrate host immediately', () => {
      room.addPlayer({ id: 's1' }, 'Host', true);
      room.addPlayer({ id: 's2' }, 'Guest', false);

      room.removePlayer('s1');
      room.migrateHost();

      expect(room.isHost('s2')).toBe(true); // Promoted
      expect(room.isHost('s1')).toBe(false);
    });

    it('should allow reclaimed host status', () => {
      room.addPlayer({ id: 's1' }, 'Host', true);
      room.addPlayer({ id: 's2' }, 'Guest', false);

      room.reclaimHost('s1');

      expect(room.isHost('s1')).toBe(true);
      expect(room.isHost('s2')).toBe(false);
    });

    it('should migrate to the next available player', () => {
      room.addPlayer({ id: 's1' }, 'Host', true);
      room.addPlayer({ id: 's2' }, 'Guest 1', false);
      room.addPlayer({ id: 's3' }, 'Guest 2', false);

      room.players.delete('s1'); // Simulate host gone
      room.migrateHost();

      expect(room.isHost('s2')).toBe(true);
      expect(room.isHost('s3')).toBe(false);
    });
  });
});
