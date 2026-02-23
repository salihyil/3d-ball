// ============================================================
// Shared type definitions for Ball Brawl
// ============================================================

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Team = 'blue' | 'red';
export type GameState =
  | 'lobby'
  | 'countdown'
  | 'playing'
  | 'goalScored'
  | 'ended';

export interface PlayerInfo {
  id: string;
  nickname: string;
  team: Team;
  isHost: boolean;
  equippedAccessories?: string[];
  sessionId?: string;
  isDisconnected?: boolean;
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
  equippedAccessories?: string[];
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
  obstacles: Obstacle[];
}

export interface RoomInfo {
  roomId: string;
  players: PlayerInfo[];
  hostId: string;
  matchDuration: number;
  gameState: GameState;
  enableFeatures?: boolean;
  fieldTexture?: string;
}

export interface PlayerInput {
  dx: number; // -1 to 1
  dz: number; // -1 to 1
  boost: boolean;
  jump: boolean; // added jump
  seq: number; // sequence number for reconciliation
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'system';
  nickname?: string;
  text: string;
  timestamp: number;
  key?: string; // Translation key for system messages
  params?: Record<string, string | number>; // Dynamic parameters for translation
}

// Socket.IO event types
export interface ClientToServerEvents {
  'create-room': (
    data: { nickname: string; matchDuration: number; enableFeatures?: boolean },
    cb: (res: { roomId: string; hostToken: string }) => void
  ) => void;
  'join-room': (
    data: { roomId: string; nickname: string; hostToken?: string | null },
    cb: (res: { success: boolean; error?: string; room?: RoomInfo }) => void
  ) => void;
  'switch-team': (
    data: { team: Team },
    cb: (res: { error?: string; success?: boolean }) => void
  ) => void;
  'toggle-features': (data: { enableFeatures: boolean }) => void;
  'set-field-texture': (data: { fieldTexture: string }) => void;
  'start-game': () => void;
  'enter-match': () => void;
  'player-input': (data: PlayerInput) => void;
  'send-chat-message': (data: { text: string }) => void;
  'leave-room': () => void;
  'ping-check': (cb: () => void) => void;
  'kick-player': (data: { targetId: string }) => void;
  'update-accessories': (data: { accessories: string[] }) => void;
}

export interface ServerToClientEvents {
  'room-update': (room: RoomInfo) => void;
  'game-start': (data: { countdown: number }) => void;
  'game-snapshot': (snapshot: GameSnapshot) => void;
  'goal-scored': (data: {
    team: Team;
    scorer: string;
    score: { blue: number; red: number };
  }) => void;
  'game-ended': (data: {
    score: { blue: number; red: number };
    winner: Team | 'draw';
  }) => void;
  'player-joined': (data: { nickname: string; team: Team }) => void;
  'player-left': (data: { nickname: string }) => void;
  chat_message: (message: ChatMessage) => void;
  'room-destroyed': () => void;
  kicked: () => void;
  'item-unlocked': (data: { id: string }) => void;
  error: (data: { message: string }) => void;
}

// ============================================================
// Database & Profile Types (Supabase)
// ============================================================

export interface Profile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
}

export interface Accessory {
  id: string;
  name: string;
  category: 'ball_skin' | 'trail' | 'hat' | 'aura' | 'decal';
  preview_url: string | null;
  price: number;
  stripe_price_id?: string | null;
  // Included for Shop UI state
  isOwned?: boolean;
  is_equipped?: boolean;
}

export interface UserAccessory {
  user_id: string;
  accessory_id: string;
  is_equipped: boolean;
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
  { id: 'obs1', position: { x: -20, y: 0, z: -15 }, radius: 2.5, height: 10 },
  { id: 'obs2', position: { x: -20, y: 0, z: 15 }, radius: 2.5, height: 10 },
  { id: 'obs3', position: { x: 20, y: 0, z: -15 }, radius: 2.5, height: 10 },
  { id: 'obs4', position: { x: 20, y: 0, z: 15 }, radius: 2.5, height: 10 },
];

export const FIELD_BOOST_PADS: {
  id: string;
  position: Vec3;
  radius: number;
}[] = [
  { id: 'pad1', position: { x: -10, y: 0.1, z: 0 }, radius: 3 },
  { id: 'pad2', position: { x: 10, y: 0.1, z: 0 }, radius: 3 },
  { id: 'pad3', position: { x: 0, y: 0.1, z: -15 }, radius: 3 },
  { id: 'pad4', position: { x: 0, y: 0.1, z: 15 }, radius: 3 },
];
