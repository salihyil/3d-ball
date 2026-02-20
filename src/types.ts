// ============================================================
// Shared type definitions for Ball Brawl
// ============================================================

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Team = 'blue' | 'red';
export type GameState = 'lobby' | 'countdown' | 'playing' | 'goalScored' | 'ended';

export interface PlayerInfo {
  id: string;
  nickname: string;
  team: Team;
  isHost: boolean;
}

export type PowerUpType = 'magnet' | 'freeze' | 'rocket' | 'frozen';

export interface PowerUpItem {
  id: string;
  position: Vec3;
  type: PowerUpType;
}

export interface PlayerState {
  id: string;
  position: Vec3;
  velocity: Vec3;
  boostCooldown: number;
  team: Team;
  activePowerUp?: {
    type: PowerUpType;
    timeLeft: number;
  };
}

export interface BallState {
  position: Vec3;
  velocity: Vec3;
}

export interface GameSnapshot {
  players: Record<string, PlayerState>;
  ball: BallState;
  score: { blue: number; red: number };
  timeRemaining: number;
  gameState: GameState;
  tick: number;
  countdown?: number;
  powerUps: PowerUpItem[];
}

export interface RoomInfo {
  roomId: string;
  players: PlayerInfo[];
  hostId: string;
  matchDuration: number;
  gameState: GameState;
}

export interface PlayerInput {
  dx: number;     // -1 to 1
  dz: number;     // -1 to 1
  boost: boolean;
  jump: boolean;  // added jump
  seq: number;    // sequence number for reconciliation
}

// Socket.IO event types
export interface ClientToServerEvents {
  'create-room': (data: { nickname: string; matchDuration: number }, cb: (res: { roomId: string }) => void) => void;
  'join-room': (data: { roomId: string; nickname: string }, cb: (res: { success: boolean; error?: string; room?: RoomInfo }) => void) => void;
  'switch-team': (data: { team: Team }) => void;
  'start-game': () => void;
  'player-input': (data: PlayerInput) => void;
  'leave-room': () => void;
}

export interface ServerToClientEvents {
  'room-update': (room: RoomInfo) => void;
  'game-start': (data: { countdown: number }) => void;
  'game-snapshot': (snapshot: GameSnapshot) => void;
  'goal-scored': (data: { team: Team; scorer: string; score: { blue: number; red: number } }) => void;
  'game-ended': (data: { score: { blue: number; red: number }; winner: Team | 'draw' }) => void;
  'player-joined': (data: { nickname: string; team: Team }) => void;
  'player-left': (data: { nickname: string }) => void;
  'error': (data: { message: string }) => void;
}

// Game constants
export const FIELD_WIDTH = 80;
export const FIELD_HEIGHT = 50;
export const GOAL_WIDTH = 12;
export const GOAL_DEPTH = 8;
export const PLAYER_RADIUS = 1.0;
export const BALL_RADIUS = 1.5;
export const PLAYER_SPEED = 15;
export const BOOST_SPEED = 25;
export const BOOST_DURATION = 1.5;
export const BOOST_COOLDOWN = 4.0;
export const BALL_MAX_SPEED = 40;
export const BALL_FRICTION = 0.98;
export const KICK_FORCE = 20;
export const SERVER_TICK_RATE = 30;
export const CLIENT_SEND_RATE = 20;
export const MAX_PLAYERS_PER_TEAM = 5;
export const COUNTDOWN_SECONDS = 3;
export const GOAL_RESET_SECONDS = 2;
