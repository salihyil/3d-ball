// ============================================================
// Room — manages players, teams, game state, timer
// ============================================================

import { GameLoop } from './GameLoop.js';
import { supabaseAdmin } from './config/supabase.js';

const MAX_PLAYERS_PER_TEAM = 5;
const COUNTDOWN_SECONDS = 3;
const GOAL_RESET_SECONDS = 2;

export class Room {
  constructor(roomId, matchDuration, io, enableFeatures = true) {
    this.roomId = roomId;
    this.matchDuration = Math.min(Math.max(matchDuration, 1), 15) * 60; // clamp 1-15 min → seconds
    this.io = io;
    this.enableFeatures = enableFeatures;
    this.players = new Map(); // socketId → { id, nickname, team, isHost, sessionId, disconnectedAt }
    this.disconnectedPlayers = new Map(); // sessionId → { player, timeout }
    this.gameState = 'lobby';
    this.score = { blue: 0, red: 0 };
    this.timeRemaining = this.matchDuration;
    this.gameLoop = null;
    this.lastActivity = Date.now();
    this.fieldTexture = '';
    this.hostToken = null;
    this.timers = new Set(); // Track all timeouts for cleanup
  }

  _setTimeout(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  addPlayer(
    socket,
    nickname,
    isHost,
    equippedAccessories = [],
    sessionId = null,
    cosmetics = {} // { title, nameColor, goalExplosion }
  ) {
    const team = this._getSmallestTeam();

    // Safety: ensure only one host exists if isHost is requested
    let assignedHostStatus = isHost;
    if (isHost && this._getHostId()) {
      console.log(
        `[ROOM] ${this.roomId} Already has a host. Denying host status for "${nickname}" during join.`
      );
      assignedHostStatus = false;
    }

    const player = {
      id: socket.user.id, // Databases ID
      socketId: socket.id, // Socket Connection ID
      sessionId, // Session ID for reconnection
      nickname,
      team,
      isHost: assignedHostStatus,
      socket,
      equippedAccessories,
      title: cosmetics.title || null,
      nameColor: cosmetics.nameColor || null,
      goalExplosion: cosmetics.goalExplosion || null,
      goals: 0,
    };
    this.players.set(socket.id, player);

    // If joining mid-game, do NOT add to game loop automatically.
    // They will be added when they explicitly 'enter-match'.

    this.lastActivity = Date.now();
  }

  addBot(team) {
    if (this.getTeamCount(team) >= MAX_PLAYERS_PER_TEAM) {
      return { error: 'Team is full (5/5 players)' };
    }

    const botId = `bot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nickname = `Bot ${Math.floor(Math.random() * 99) + 1}`;

    const player = {
      id: botId,
      socketId: botId,
      sessionId: botId,
      nickname,
      team,
      isHost: false,
      isBot: true,
      socket: null,
      equippedAccessories: [],
      goals: 0,
    };

    this.players.set(botId, player);

    if (this.gameLoop && this.gameState !== 'lobby') {
      this.gameLoop.addPlayer(botId, team, true);
    }

    this.lastActivity = Date.now();
    return { success: true };
  }

  removePlayer(socketId, isGraceful = false) {
    const player = this.players.get(socketId);
    if (!player) return;

    // Bots have no real socket connection — skip grace period, remove immediately
    if (!isGraceful && player.isBot) {
      this._finalRemovePlayer(socketId);
      return;
    }

    if (!isGraceful && player.sessionId) {
      const gracePeriod = process.env.NODE_ENV === 'test' ? 2000 : 15000;

      console.log(
        `[ROOM] ${this.roomId} Player "${
          player.nickname
        }" disconnected. Starting ${gracePeriod / 1000}s grace period.`
      );

      const timeout = this._setTimeout(() => {
        console.log(
          `[ROOM] ${this.roomId} Grace period expired for "${player.nickname}". Removing player.`
        );
        this._finalRemovePlayer(socketId);
      }, gracePeriod);

      this.disconnectedPlayers.set(player.sessionId, {
        player,
        timeout,
      });
      return;
    }

    this._finalRemovePlayer(socketId);
  }

  _finalRemovePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    const wasHost = player.isHost;

    this.players.delete(socketId);
    if (player.sessionId) {
      this.disconnectedPlayers.delete(player.sessionId);
    }

    // Remove from game loop
    if (this.gameLoop) {
      this.gameLoop.removePlayer(socketId);
    }

    // If the host is gone for good, migrate!
    if (wasHost) {
      this.migrateHost();
    }

    this.lastActivity = Date.now();
  }

  reconnectPlayer(sessionId, newSocket) {
    // 1. Check disconnected pool (grace period)
    const disconnected = this.disconnectedPlayers.get(sessionId);
    if (disconnected) {
      const { player, timeout } = disconnected;
      console.log(
        `[ROOM] ${this.roomId} Player "${player.nickname}" reconnected within grace period (Session: ${sessionId})`
      );

      // Cancel removal timer
      clearTimeout(timeout);
      this.timers.delete(timeout);
      this.disconnectedPlayers.delete(sessionId);

      // Swap socket IDs
      this._performSocketSwap(player, newSocket);

      this.lastActivity = Date.now();
      return true;
    }

    // 2. Check active players pool (fast refresh / competing tab)
    const activePlayer = this.getPlayerBySessionId(sessionId);
    if (activePlayer && activePlayer.socketId !== newSocket.id) {
      console.log(
        `[ROOM] ${this.roomId} Player "${activePlayer.nickname}" stealing session ${sessionId} (Active Swap)`
      );

      // Swap socket IDs
      this._performSocketSwap(activePlayer, newSocket);

      this.lastActivity = Date.now();
      return true;
    }

    return false;
  }

  _performSocketSwap(player, newSocket) {
    const oldSocketId = player.socketId;
    this.players.delete(oldSocketId);

    player.socketId = newSocket.id;
    player.socket = newSocket;
    this.players.set(newSocket.id, player);

    // Update game loop if active
    if (this.gameLoop && this.gameLoop.players[oldSocketId]) {
      this.gameLoop.players[newSocket.id] = this.gameLoop.players[oldSocketId];
      delete this.gameLoop.players[oldSocketId];
    }
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
        z: zOffset,
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
      playerData[id] = { team: p.team, isBot: p.isBot };
    }

    this.gameLoop = new GameLoop(this, playerData, this.enableFeatures);
    this.gameLoop.resetPositions();

    // Broadcast navigation signal with countdown data
    this.io.to(this.roomId).emit('game-start', { countdown: 5 });

    // Start physics loop immediately to broadcast the countdown at 30Hz
    this.gameLoop.start();

    this._setTimeout(() => {
      if (this.gameState === 'countdown') {
        this.gameState = 'playing';
      }
    }, 5000);
  }

  updatePlayerAccessories(socketId, accessories) {
    const player = this.players.get(socketId);
    if (player) {
      player.equippedAccessories = accessories;
    }
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
    if (scorer) scorer.goals++;

    this.gameState = 'goalScored';

    this.io.to(this.roomId).emit('goal-scored', {
      team,
      scorer: scorerName,
      score: { ...this.score },
      goalExplosion: scorer?.goalExplosion || null,
    });

    this._setTimeout(() => {
      if (this.gameState === 'goalScored') {
        this.gameState = 'playing';
        if (this.gameLoop) this.gameLoop.resetPositions();
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

    const winner =
      this.score.blue > this.score.red
        ? 'blue'
        : this.score.red > this.score.blue
          ? 'red'
          : 'draw';

    // Update match stats for authenticated users
    for (const [socketId, player] of this.players) {
      if (player.isBot || !player.id || player.id.startsWith('guest-'))
        continue;
      const won = player.team === winner;
      const goals = player.goals || 0;
      this._updatePlayerStats(player.id, won, goals).catch((err) => {
        console.error(
          `[ROOM] Failed to update stats for ${player.nickname}`,
          err
        );
      });
    }

    this.io.to(this.roomId).emit('game-ended', {
      score: { ...this.score },
      winner,
    });

    // Reset to lobby after 5s
    this._setTimeout(() => {
      this.gameState = 'lobby';
      this.io.to(this.roomId).emit('room-update', this.getRoomInfo());
    }, 5000);
  }

  async _updatePlayerStats(userId, won, goals) {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('wins, goals, matches_played')
        .eq('id', userId)
        .single();

      if (profile) {
        await supabaseAdmin
          .from('profiles')
          .update({
            wins: profile.wins + (won ? 1 : 0),
            goals: profile.goals + goals,
            matches_played: profile.matches_played + 1,
          })
          .eq('id', userId);
      }
    } catch (err) {
      console.error('[ROOM] Error updating player stats', err);
    }
  }

  // ---- Queries ----

  hasPlayer(socketId) {
    return this.players.has(socketId);
  }

  getPlayerBySessionId(sessionId) {
    if (!sessionId) return null;
    for (const p of this.players.values()) {
      if (p.sessionId === sessionId) return p;
    }
    return null;
  }

  getRoomInfo() {
    const players = [];
    for (const [socketId, p] of this.players) {
      const isDisconnected = this.disconnectedPlayers.has(p.sessionId);
      players.push({
        id: socketId, // Keep for backward compatibility with UI
        userId: p.id,
        nickname: p.nickname,
        team: p.team,
        isHost: p.isHost,
        equippedAccessories: p.equippedAccessories,
        isDisconnected,
        title: p.title || undefined,
        nameColor: p.nameColor || undefined,
        isBot: p.isBot || false,
      });
    }
    return {
      roomId: this.roomId,
      players,
      hostId: this._getHostId(),
      matchDuration: this.matchDuration / 60,
      gameState: this.gameState,
      enableFeatures: this.enableFeatures,
      fieldTexture: this.fieldTexture,
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
    // A room is truly empty only if there are NO players (even disconnected ones)
    // BUT for cleanup purposes, if everyone is disconnected, the room should eventually die.
    // If the only players are in grace period, room.players.size is > 0.
    // We want rooms to stay alive during grace period.
    return this.players.size === 0 && this.disconnectedPlayers.size === 0;
  }

  isFullyDisconnected() {
    // Are all players currently in grace period?
    if (this.players.size === 0) return true;
    for (const [socketId, p] of this.players) {
      if (!this.disconnectedPlayers.has(p.sessionId)) return false;
    }
    return true;
  }

  destroy() {
    if (this.gameLoop) {
      this.gameLoop.stop();
      this.gameLoop = null;
    }
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
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

  // ---- Host Migration ----

  migrateHost() {
    console.log(`[ROOM] ${this.roomId} Host migration triggered.`);

    // First, find the current host and remove their status
    for (const p of this.players.values()) {
      if (p.isHost) p.isHost = false;
    }

    // Assign new host: the oldest player in the Map who is NOT disconnected
    let foundNewHost = false;
    for (const [socketId, p] of this.players) {
      if (!this.disconnectedPlayers.has(p.sessionId)) {
        p.isHost = true;
        console.log(
          `[ROOM] ${this.roomId} Host migrated to "${p.nickname}" (${socketId})`
        );
        foundNewHost = true;
        break;
      }
    }

    if (!foundNewHost) {
      console.log(
        `[ROOM] ${this.roomId} No active players to migrate host to.`
      );
    }

    this.io.to(this.roomId).emit('room-update', this.getRoomInfo());
  }

  // Safety method to check if a room has a host, and migrate if not
  validateHost() {
    if (this.players.size > 0 && !this._getHostId()) {
      console.warn(
        `[ROOM] ${this.roomId} Hostless room detected. Recovering...`
      );
      this.migrateHost();
    }
  }

  reclaimHost(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      // Safety: only allow reclamation if NO current host exists
      if (!this._getHostId() || this._getHostId() === socketId) {
        player.isHost = true;
        console.log(
          `[ROOM] ${this.roomId} Host reclaimed by "${player.nickname}"`
        );
      } else {
        console.log(
          `[ROOM] ${this.roomId} Host reclamation denied for "${player.nickname}" - Room already has a host (${this._getHostId()})`
        );
        player.isHost = false; // Just in case it was true
      }
    }
  }
}
