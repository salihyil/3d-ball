// ============================================================
// Shared type definitions for Ball Brawl
// ============================================================

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Team = "blue" | "red";
export type GameState = "lobby" | "countdown" | "playing" | "goalScored" | "ended";

export interface PlayerInfo {
  id: string;
  nickname: string;
  team: Team;
  isHost: boolean;
}

export type PowerUpType = "magnet" | "freeze" | "rocket" | "frozen";

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

export interface Obstacle {
  id: string;
  position: Vec3;
  radius: number;
  height: number;
}

export interface BoostPadState {
  id: string;
  active: boolean;
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
  boostPads: BoostPadState[];
}

export interface RoomInfo {
  roomId: string;
  players: PlayerInfo[];
  hostId: string;
  matchDuration: number;
  gameState: GameState;
  enableFeatures?: boolean;
}

export interface PlayerInput {
  dx: number; // -1 to 1
  dz: number; // -1 to 1
  boost: boolean;
  jump: boolean; // added jump
  seq: number; // sequence number for reconciliation
}

// Socket.IO event types
export interface ClientToServerEvents {
  "create-room": (
    data: { nickname: string; matchDuration: number; enableFeatures?: boolean },
    cb: (res: { roomId: string }) => void,
  ) => void;
  "join-room": (
    data: { roomId: string; nickname: string },
    cb: (res: { success: boolean; error?: string; room?: RoomInfo }) => void,
  ) => void;
  "switch-team": (
    data: { team: Team },
    cb: (res: { error?: string; success?: boolean }) => void,
  ) => void;
  "toggle-features": (data: { enableFeatures: boolean }) => void;
  "start-game": () => void;
  "player-input": (data: PlayerInput) => void;
  "leave-room": () => void;
}

export interface ServerToClientEvents {
  "room-update": (room: RoomInfo) => void;
  "game-start": (data: { countdown: number }) => void;
  "game-snapshot": (snapshot: GameSnapshot) => void;
  "goal-scored": (data: {
    team: Team;
    scorer: string;
    score: { blue: number; red: number };
  }) => void;
  "game-ended": (data: { score: { blue: number; red: number }; winner: Team | "draw" }) => void;
  "player-joined": (data: { nickname: string; team: Team }) => void;
  "player-left": (data: { nickname: string }) => void;
  error: (data: { message: string }) => void;
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

// Static field features
export const FIELD_OBSTACLES: Obstacle[] = [
  { id: "obs1", position: { x: -20, y: 0, z: -15 }, radius: 2.5, height: 10 },
  { id: "obs2", position: { x: -20, y: 0, z: 15 }, radius: 2.5, height: 10 },
  { id: "obs3", position: { x: 20, y: 0, z: -15 }, radius: 2.5, height: 10 },
  { id: "obs4", position: { x: 20, y: 0, z: 15 }, radius: 2.5, height: 10 },
];

export const FIELD_BOOST_PADS: { id: string; position: Vec3; radius: number }[] = [
  { id: "pad1", position: { x: -10, y: 0.1, z: 0 }, radius: 3 },
  { id: "pad2", position: { x: 10, y: 0.1, z: 0 }, radius: 3 },
  { id: "pad3", position: { x: 0, y: 0.1, z: -15 }, radius: 3 },
  { id: "pad4", position: { x: 0, y: 0.1, z: 15 }, radius: 3 },
];
