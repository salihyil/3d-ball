// ============================================================
// Room — manages players, teams, game state, timer
// ============================================================

import { GameLoop } from './GameLoop.js';

const MAX_PLAYERS_PER_TEAM = 5;
const COUNTDOWN_SECONDS = 3;
const GOAL_RESET_SECONDS = 2;

export class Room {
  constructor(roomId, matchDuration, io) {
    this.roomId = roomId;
    this.matchDuration = Math.min(Math.max(matchDuration, 1), 15) * 60; // clamp 1-15 min → seconds
    this.io = io;
    this.players = new Map(); // socketId → { nickname, team, isHost }
    this.gameState = 'lobby';
    this.score = { blue: 0, red: 0 };
    this.timeRemaining = this.matchDuration;
    this.gameLoop = null;
    this.lastActivity = Date.now();
  }

  addPlayer(socket, nickname, isHost) {
    const team = this._getSmallestTeam();
    const player = {
      nickname,
      team,
      isHost,
      socket,
    };
    this.players.set(socket.id, player);

    // If joining mid-game, do NOT add to game loop automatically.
    // They will be added when they explicitly 'enter-match'.

    this.lastActivity = Date.now();
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    this.players.delete(socketId);

    // Remove from game loop
    if (this.gameLoop) {
      this.gameLoop.removePlayer(socketId);
    }

    this.lastActivity = Date.now();
  }

  enterMatch(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    // Only add if not already in the game loop
    if (this.gameLoop && this.gameState !== 'lobby') {
      if (!this.gameLoop.players[socketId]) {
        this.gameLoop.addPlayer(socketId, player.team);
      }
    }
  }

  switchTeam(socketId, team) {
    const player = this.players.get(socketId);
    if (!player) return { error: 'Player not found' };
    if (team !== 'blue' && team !== 'red') return { error: 'Invalid team' };
    
    if (player.team === team) return { success: true }; // No change
    
    // Check team limits before allowing switch
    if (this.getTeamCount(team) >= MAX_PLAYERS_PER_TEAM) {
      return { error: 'Team is full (5/5 players)' };
    }

    player.team = team;

    // MID-GAME TEAM SWITCH SYNC
    if (this.gameLoop && this.gameLoop.players[socketId]) {
      this.gameLoop.players[socketId].team = team;
      // Reposition them instantly to their new team's side
      const zOffset = (Math.random() - 0.5) * 10;
      this.gameLoop.players[socketId].position = {
        x: team === 'blue' ? -20 : 20,
        y: 0.5,
        z: zOffset
      };
      this.gameLoop.players[socketId].velocity = { x: 0, y: 0, z: 0 };
    }

    this.io.to(this.roomId).emit('room-update', this.getRoomInfo());
    return { success: true };
  }

  startGame() {
    this.gameState = 'countdown';
    this.score = { blue: 0, red: 0 };
    this.matchStartTime = Date.now() + 5000; // 5 seconds total countdown wait
    this.timeRemaining = this.matchDuration;

    // Create game loop with player data
    const playerData = {};
    for (const [id, p] of this.players.entries()) {
      playerData[id] = p.team;
    }

    this.gameLoop = new GameLoop(this, playerData);
    this.gameLoop.resetPositions();

    // Broadcast navigation signal with countdown data
    this.io.to(this.roomId).emit('game-start', { countdown: 5 });
    
    // Start physics loop immediately to broadcast the countdown at 30Hz
    this.gameLoop.start();

    setTimeout(() => {
      if (this.gameState === 'countdown') {
        this.gameState = 'playing';
      }
    }, 5000);
  }

  handleInput(socketId, input) {
    if (this.gameLoop) {
      this.gameLoop.handleInput(socketId, input);
    }
  }

  onGoalScored(team, scorerId) {
    this.score[team]++;
    const scorer = this.players.get(scorerId);
    const scorerName = scorer ? scorer.nickname : 'Unknown';

    this.gameState = 'goalScored';

    this.io.to(this.roomId).emit('goal-scored', {
      team,
      scorer: scorerName,
      score: { ...this.score },
    });

    setTimeout(() => {
      if (this.gameState === 'goalScored') {
        this.gameState = 'playing';
        this.gameLoop.resetPositions();
      }
    }, GOAL_RESET_SECONDS * 1000);
  }

  onTimerUpdate(timeRemaining) {
    this.timeRemaining = timeRemaining;
    if (timeRemaining <= 0) {
      this._endGame();
    }
  }

  broadcastSnapshot(snapshot) {
    snapshot.score = { ...this.score };
    snapshot.timeRemaining = this.timeRemaining;
    snapshot.gameState = this.gameState;
    this.io.to(this.roomId).emit('game-snapshot', snapshot);
  }

  _endGame() {
    this.gameState = 'ended';
    if (this.gameLoop) {
      this.gameLoop.stop();
      this.gameLoop = null;
    }

    const winner = this.score.blue > this.score.red ? 'blue' :
                   this.score.red > this.score.blue ? 'red' : 'draw';

    this.io.to(this.roomId).emit('game-ended', {
      score: { ...this.score },
      winner,
    });

    // Reset to lobby after 5s
    setTimeout(() => {
      this.gameState = 'lobby';
      this.io.to(this.roomId).emit('room-update', this.getRoomInfo());
    }, 5000);
  }

  // ---- Queries ----

  hasPlayer(socketId) {
    return this.players.has(socketId);
  }

  getRoomInfo() {
    const players = [];
    for (const [id, p] of this.players) {
      players.push({
        id,
        nickname: p.nickname,
        team: p.team,
        isHost: p.isHost,
      });
    }
    return {
      roomId: this.roomId,
      players,
      hostId: this._getHostId(),
      matchDuration: this.matchDuration / 60,
      gameState: this.gameState,
    };
  }

  getPlayerTeam(socketId) {
    const p = this.players.get(socketId);
    return p ? p.team : 'blue';
  }

  getPlayerNickname(socketId) {
    const p = this.players.get(socketId);
    return p ? p.nickname : 'Unknown';
  }

  getTeamCount(team) {
    let count = 0;
    for (const p of this.players.values()) {
      if (p.team === team) count++;
    }
    return count;
  }

  isHost(socketId) {
    const p = this.players.get(socketId);
    return p ? p.isHost : false;
  }

  isFull() {
    return this.players.size >= MAX_PLAYERS_PER_TEAM * 2;
  }

  isEmpty() {
    return this.players.size === 0;
  }

  destroy() {
    if (this.gameLoop) {
      this.gameLoop.stop();
      this.gameLoop = null;
    }
  }

  _getHostId() {
    for (const [id, p] of this.players) {
      if (p.isHost) return id;
    }
    return null;
  }

  _getSmallestTeam() {
    const blue = this.getTeamCount('blue');
    const red = this.getTeamCount('red');
    return blue <= red ? 'blue' : 'red';
  }
}
