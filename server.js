// ============================================================
// Ball Brawl — Game Server
// Express + Socket.IO
// ============================================================

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import express from 'express';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
// Using global fetch (available in Node 18+)
import { dirname, join } from 'path';
import { Server } from 'socket.io';
import Stripe from 'stripe';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { Room } from './server/Room.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// Initialize Stripe & Supabase Admin (for inventory updates)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Required for server-side writes
);

// --- JWT Verification Configuration (Handles HS256 and ES256) ---
let supabasePublicKey = null;
const JWKS_URL = `${process.env.VITE_SUPABASE_URL}/auth/v1/.well-known/jwks.json`;

async function refreshSupabasePublicKey() {
  try {
    const response = await fetch(JWKS_URL);
    const { keys } = await response.json();
    const jwk = keys[0]; // Supabase usually has one active ES256 key
    if (jwk) {
      supabasePublicKey = crypto.createPublicKey({ format: 'jwk', key: jwk });
      console.log('✅ Supabase Public Key loaded for ES256');
    }
  } catch (err) {
    console.error('❌ Failed to fetch Supabase JWKS:', err.message);
  }
}

// Initial fetch
refreshSupabasePublicKey();

function verifySupabaseToken(token) {
  const decodedHeader = jwt.decode(token, { complete: true });
  const alg = decodedHeader?.header?.alg;

  if (alg === 'ES256' && supabasePublicKey) {
    return jwt.verify(token, supabasePublicKey, { algorithms: ['ES256'] });
  }

  // Fallback to symmetric HS256
  return jwt.verify(token, process.env.SUPABASE_JWT_SECRET, {
    algorithms: ['HS256'],
  });
}
// -------------------------------------------------------------
const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 20000,
});

// Middleware for parsing Webhook raw body
app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(`[STRIPE] Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { userId, accessoryId } = session.metadata;

      console.log(
        `[STRIPE] Payment success for user ${userId}, item ${accessoryId}`
      );

      try {
        // 1. Grant accessory in Supabase
        const { error: accError } = await supabaseAdmin
          .from('user_accessories')
          .insert({
            user_id: userId,
            accessory_id: accessoryId,
            is_equipped: false,
          });

        if (accError) throw accError;

        // 2. Notify player via Socket if connected
        // Scan all connected sockets for this userId
        for (const [id, socket] of io.sockets.sockets) {
          if (socket.user?.id === userId) {
            socket.emit('item-unlocked', { id: accessoryId });
            console.log(`[STRIPE] Notified socket ${id} of unlock`);
          }
        }
      } catch (err) {
        console.error('[STRIPE] DB Error during grant:', err.message);
        return res.status(500).json({ error: 'Failed to grant item' });
      }
    }

    res.json({ received: true });
  }
);

// Regular JSON parser for other routes
app.use(express.json());

// Stripe: Create Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  const { accessToken, accessoryId, priceId } = req.body;

  try {
    // 1. Verify User
    const decoded = verifySupabaseToken(accessToken);
    const userId = decoded.sub;

    // 2. Create Session
    const finalPriceId = priceId || process.env.STRIPE_TEST_PRICE_ID;

    if (!finalPriceId) {
      return res.status(400).json({
        error:
          'This item does not have a Stripe Price ID configured. Set STRIPE_TEST_PRICE_ID in .env for testing.',
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: finalPriceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${req.headers.origin}/?purchase=success`,
      cancel_url: `${req.headers.origin}/?purchase=cancel`,
      metadata: { userId, accessoryId },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[STRIPE] Checkout failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Production: serve built React app
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

// ============================================================
// Room Management
// ============================================================

const rooms = new Map();

// Clean up empty rooms every 30s
setInterval(() => {
  for (const [id, room] of rooms) {
    if (room.isEmpty() && Date.now() - room.lastActivity > 60000) {
      room.destroy();
      rooms.delete(id);
      console.log(`[CLEANUP] Room ${id} deleted (inactive)`);
    }
  }
}, 30000);

// ============================================================
// Socket.IO Connection & Authentication
// ============================================================

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const nickname = socket.handshake.auth?.nickname;
  const equippedAccessories = socket.handshake.auth?.equippedAccessories || [];

  // Fallback for Guest mode if no token provided
  if (!token) {
    const guestId = `Guest_${uuidv4().substring(0, 8)}`;
    const finalNickname = nickname || `Guest ${guestId.split('_')[1]}`;
    socket.user = {
      id: guestId,
      email: null,
      nickname: finalNickname,
      equippedAccessories: [], // Guests cannot have accessories for now
      isGuest: true,
    };
    return next();
  }

  try {
    // Basic check for secret - if missing in dev, we might want to allow guest fallback or throw
    if (!process.env.SUPABASE_JWT_SECRET) {
      console.warn(
        '[AUTH] SUPABASE_JWT_SECRET is missing. Falling back to Guest mode for all.'
      );
      const guestId = `Guest_${uuidv4().substring(0, 8)}`;
      socket.user = {
        id: guestId,
        nickname: nickname || 'Guest',
        equippedAccessories: [],
        isGuest: true,
      };
      return next();
    }

    const decoded = verifySupabaseToken(token);
    // decoded contains sub (userId), email, etc.
    const verifiedNickname = nickname || decoded.email.split('@')[0];

    socket.user = {
      id: decoded.sub,
      email: decoded.email,
      nickname: verifiedNickname,
      equippedAccessories,
      isGuest: false,
    };
    next();
  } catch (err) {
    console.error('[AUTH] JWT Verification failed:', err.message);
    // On verification failure (expired etc), we can still allow them as Guest instead of rejecting
    const guestId = `Guest_${uuidv4().substring(0, 8)}`;
    socket.user = {
      id: guestId,
      nickname: (nickname || 'Guest') + ' (Exp)',
      equippedAccessories: [],
      isGuest: true,
    };
    next();
  }
});

io.on('connection', (socket) => {
  console.log(
    `[CONNECT] ${socket.user.nickname} (${socket.user.id}) connected via ${socket.id}`
  );

  // Ping check for client latency measurement
  socket.on('ping-check', (cb) => {
    if (typeof cb === 'function') cb();
  });

  let currentRoomId = null;
  let inputCount = 0;
  let inputResetTime = Date.now();

  // Rate limiting: max 25 inputs per second
  const checkRateLimit = () => {
    const now = Date.now();
    if (now - inputResetTime > 1000) {
      inputCount = 0;
      inputResetTime = now;
    }
    inputCount++;
    return inputCount <= 25;
  };

  const sendChatMessage = (
    text,
    type = 'user',
    nickname = null,
    key = null,
    params = null
  ) => {
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
    io.to(currentRoomId).emit('chat_message', msg);
  };

  // ---- Create Room ----
  socket.on('create-room', (data, callback) => {
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
      socket.user.equippedAccessories
    );
    currentRoomId = roomId;
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
    if (!nickname || nickname.length < 1 || nickname.length > 16) {
      return callback({ success: false, error: 'Invalid nickname' });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    // If player is already in this room (e.g. creator navigated to lobby)
    if (room.hasPlayer(socket.id)) {
      currentRoomId = roomId;
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
      socket.user.equippedAccessories
    );
    currentRoomId = roomId;
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
      `${nickname} odaya katıldı.`,
      'system',
      null,
      'chat.player_joined',
      { nickname }
    );
  });

  // ---- Switch Team ----
  socket.on('switch-team', (teamArg, callback) => {
    if (!currentRoomId) return callback?.({ error: 'Not in a room' });
    const room = rooms.get(currentRoomId);
    if (!room) return callback?.({ error: 'Room not found' });

    // Allow switch-team even if game is running, as long as they are not in the active play yet
    // Handled in room.switchTeam which updates gameLoop if they are in it
    // Wait, if they are already playing, we let them switch mid-game anyway (from previous commit).
    // So no restriction is needed here, room.switchTeam handles both scenarios.

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
      `${nickname} takıma geçti.`,
      'system',
      null,
      'chat.player_switched',
      { nickname, team: teamKey }
    );
    callback?.({ success: true });
  });

  socket.on('toggle-features', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room._getHostId() !== socket.id) return;

    room.enableFeatures = data.enableFeatures;
    io.to(currentRoomId).emit('room-update', room.getRoomInfo());
  });

  socket.on('set-field-texture', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room._getHostId() !== socket.id) return;

    room.fieldTexture = data.fieldTexture;
    io.to(currentRoomId).emit('room-update', room.getRoomInfo());
  });

  // ---- Game Flow ----
  socket.on('start-game', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (!room.isHost(socket.id)) return;
    if (room.gameState !== 'lobby') return;

    room.startGame();
  });

  // ---- Enter Match ----
  socket.on('enter-match', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (room.gameState === 'lobby') return; // If it's lobby, game hasn't started yet

    room.enterMatch(socket.id);
  });

  // ---- Player Input ----
  socket.on('player-input', (data) => {
    if (!currentRoomId) {
      console.log(`[INPUT] REJECTED: no currentRoomId for ${socket.id}`);
      return;
    }
    if (!checkRateLimit()) return;

    const room = rooms.get(currentRoomId);
    if (!room) {
      console.log(`[INPUT] REJECTED: room ${currentRoomId} not found`);
      return;
    }
    if (room.gameState !== 'playing') {
      // Only log once per state change to avoid spam
      if (
        !socket._lastLoggedState ||
        socket._lastLoggedState !== room.gameState
      ) {
        console.log(
          `[INPUT] REJECTED: gameState is '${room.gameState}', not 'playing'. Room: ${currentRoomId}`
        );
        socket._lastLoggedState = room.gameState;
      }
      return;
    }

    room.handleInput(socket.id, data);
  });

  // ---- Chat ----
  socket.on('send-chat-message', (data) => {
    if (!currentRoomId) return;
    const { text } = data;
    if (!text || text.trim().length === 0 || text.length > 100) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    const nickname = room.getPlayerNickname(socket.id);
    sendChatMessage(text, 'user', nickname);
  });

  // ---- Leave / Disconnect ----
  const leaveRoom = () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const nickname = room.getPlayerNickname(socket.id);
    const isHost = room.isHost(socket.id);

    room.removePlayer(socket.id);
    socket.leave(currentRoomId);

    if (room.isEmpty()) {
      room.destroy(); // Still call destroy for cleanup
      rooms.delete(currentRoomId);
      console.log(`[ROOM] ${currentRoomId} deleted (empty)`);
      io.to(currentRoomId).emit('room-destroyed');
    } else if (isHost) {
      console.log(
        `[ROOM] Host left ${currentRoomId}. Migrating host immediately...`
      );
      room.migrateHost();
    } else {
      io.to(currentRoomId).emit('room-update', room.getRoomInfo());
      socket.to(currentRoomId).emit('player-left', { nickname });
      sendChatMessage(
        `${nickname} odadan ayrıldı.`,
        'system',
        null,
        'chat.player_left',
        { nickname }
      );
    }

    currentRoomId = null;
  };

  // ---- Kick Player ----
  socket.on('kick-player', (data) => {
    if (!currentRoomId) return;
    const { targetId } = data;
    if (!targetId) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    // Only host can kick
    if (!room.isHost(socket.id)) return;

    // Cannot kick yourself
    if (targetId === socket.id) return;

    const targetNickname = room.getPlayerNickname(targetId);
    console.log(
      `[KICK] Host ${socket.id} kicked ${targetNickname} (${targetId}) from ${currentRoomId}`
    );

    // Notify the target player they were kicked
    io.to(targetId).emit('kicked', { reason: 'kicked_by_host' });

    // Remove the player from the room
    room.removePlayer(targetId);

    // Broadcast update to remaining players
    io.to(currentRoomId).emit('room-update', room.getRoomInfo());
    io.to(currentRoomId).emit('player-left', {
      nickname: targetNickname,
      reason: 'kicked',
    });

    sendChatMessage(
      `${targetNickname} host tarafından odadan çıkarıldı.`,
      'system',
      null,
      'chat.player_kicked',
      { nickname: targetNickname }
    );
  });

  // ---- Accessory Update ----
  socket.on('update-accessories', (data) => {
    const { accessories } = data;
    if (!Array.isArray(accessories)) return;

    // Update socket user state
    socket.user.equippedAccessories = accessories;

    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.updatePlayerAccessories(socket.id, accessories);
        io.to(currentRoomId).emit('room-update', room.getRoomInfo());
      }
    }
  });

  socket.on('leave-room', leaveRoom);
  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] ${socket.id}`);
    leaveRoom();
  });
});

// ============================================================
// Start
// ============================================================

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n⚽ Ball Brawl server running on port ${PORT}\n`);
});
