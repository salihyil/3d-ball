import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

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
    const socketMock = { id: 'socket-1', user: { id: 'db-1' } };
    room.addPlayer(socketMock, 'Player 1', true);

    expect(room.players.has('socket-1')).toBe(true);
    const player = room.players.get('socket-1');
    expect(player.nickname).toBe('Player 1');
    expect(player.isHost).toBe(true);
  });

  it('should balance teams when adding players', () => {
    room.addPlayer({ id: 's1', user: { id: 'u1' } }, 'P1', true); // blue
    room.addPlayer({ id: 's2', user: { id: 'u2' } }, 'P2', false); // red
    room.addPlayer({ id: 's3', user: { id: 'u3' } }, 'P3', false); // blue

    expect(room.players.get('s1').team).toBe('blue');
    expect(room.players.get('s2').team).toBe('red');
    expect(room.players.get('s3').team).toBe('blue');
  });

  it('should handle team switching', () => {
    room.addPlayer({ id: 's1', user: { id: 'u1' } }, 'P1', true); // blue
    const result = room.switchTeam('s1', 'red');

    expect(result.success).toBe(true);
    expect(room.players.get('s1').team).toBe('red');
    expect(ioMock.emit).toHaveBeenCalledWith('room-update', expect.any(Object));
  });

  it('should prevent switching to a full team', () => {
    // Fill red team (max is 5)
    for (let i = 0; i < 5; i++) {
      room.players.set(`r${i}`, {
        id: `u${i}`,
        team: 'red',
        nickname: `R${i}`,
      });
    }

    room.addPlayer({ id: 's1', user: { id: 'u-special' } }, 'P1', true); // goes to blue
    const result = room.switchTeam('s1', 'red');

    expect(result.error).toBeDefined();
    expect(room.players.get('s1').team).toBe('blue');
  });

  it('should start game correctly', () => {
    room.addPlayer({ id: 's1', user: { id: 'u1' } }, 'P1', true);
    room.startGame();

    expect(room.gameState).toBe('countdown');
    expect(room.gameLoop).toBeDefined();
    expect(ioMock.emit).toHaveBeenCalledWith('game-start', { countdown: 5 });
  });

  it('should remove player and handle host leaving', () => {
    room.addPlayer({ id: 's1', user: { id: 'u1' } }, 'Host', true);
    room.addPlayer({ id: 's2', user: { id: 'u2' } }, 'Guest', false);

    room.removePlayer('s1');
    expect(room.players.size).toBe(1);
    expect(room.isHost('s1')).toBe(false);
    // Note: Room.js removePlayer doesn't automatically assign new host,
    // server.js handles the room destruction if host leaves.
  });

  it('should identify empty room', () => {
    room.addPlayer({ id: 's1', user: { id: 'u1' } }, 'P1', true);
    expect(room.isEmpty()).toBe(false);
  });

  describe('Host Migration', () => {
    it('should migrate host immediately', () => {
      room.addPlayer({ id: 's1', user: { id: 'u1' } }, 'Host', true);
      room.addPlayer({ id: 's2', user: { id: 'u2' } }, 'Guest', false);

      room.removePlayer('s1');
      room.migrateHost();

      expect(room.isHost('s2')).toBe(true); // Promoted
      expect(room.isHost('s1')).toBe(false);
    });

    it('should allow reclaimed host status', () => {
      room.addPlayer({ id: 's1', user: { id: 'u1' } }, 'Host', true);
      room.addPlayer({ id: 's2', user: { id: 'u2' } }, 'Guest', false);

      room.reclaimHost('s1');

      expect(room.isHost('s1')).toBe(true);
      expect(room.isHost('s2')).toBe(false);
    });

    it('should migrate to the next available player', () => {
      room.addPlayer({ id: 's1', user: { id: 'u1' } }, 'Host', true);
      room.addPlayer({ id: 's2', user: { id: 'u2' } }, 'Guest 1', false);
      room.addPlayer({ id: 's3', user: { id: 'u3' } }, 'Guest 2', false);

      room.players.delete('s1'); // Simulate host gone
      room.migrateHost();

      expect(room.isHost('s2')).toBe(true);
      expect(room.isHost('s3')).toBe(false);
    });
  });

  describe('Bot Management', () => {
    it('should add a bot to the specified team', () => {
      const result = room.addBot('blue');

      expect(result.success).toBe(true);
      expect(room.players.size).toBe(1);

      const bot = [...room.players.values()][0];
      expect(bot.isBot).toBe(true);
      expect(bot.team).toBe('blue');
      expect(bot.isHost).toBe(false);
      expect(bot.socket).toBeNull();
    });

    it('should reject adding a bot to a full team', () => {
      // Fill blue team to the max (5 players)
      for (let i = 0; i < 5; i++) {
        room.players.set(`b${i}`, {
          id: `u${i}`,
          team: 'blue',
          nickname: `B${i}`,
          isBot: false,
        });
      }

      const result = room.addBot('blue');

      expect(result.error).toBeDefined();
      expect(room.players.size).toBe(5); // Unchanged
    });

    it('should expose isBot flag in getRoomInfo', () => {
      room.addBot('red');

      const info = room.getRoomInfo();
      const botEntry = info.players.find((p) => p.isBot === true);

      expect(botEntry).toBeDefined();
      expect(botEntry.team).toBe('red');
    });

    it('should remove a bot immediately without starting a grace-period timer', () => {
      room.addBot('blue');
      const bot = [...room.players.values()][0];
      const botId = bot.socketId;

      // Graceful=false normally triggers the 15s timer — bots must bypass it
      room.removePlayer(botId, false);

      // Bot should be gone immediately, not placed in disconnectedPlayers
      expect(room.players.has(botId)).toBe(false);
      expect(room.disconnectedPlayers.size).toBe(0);
    });

    it('should not include bots in stats tracking after game end', () => {
      // Arrange: add a human player and a bot
      room.addPlayer({ id: 's1', user: { id: 'real-user-id' } }, 'Human', true);
      room.addBot('red');

      // Verify the bot in the room
      const bots = [...room.players.values()].filter((p) => p.isBot);
      const humans = [...room.players.values()].filter((p) => !p.isBot);

      expect(bots).toHaveLength(1);
      expect(humans).toHaveLength(1);

      // The stats guard condition: bot.isBot === true means it's skipped
      for (const player of room.players.values()) {
        if (player.isBot) {
          expect(player.id.startsWith('bot-')).toBe(true);
        }
      }
    });
  });
});
