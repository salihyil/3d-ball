// ============================================================
// Ball Brawl — Game Server
// Express + Socket.IO (Refactored)
// ============================================================

import express from 'express';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { stripeRouter } from './server/routes/stripe.js';
import { initializeSockets } from './server/sockets/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// Socket.IO Setup
const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 20000,
});

// Pass Socket.IO to Express routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Express Routes (Stripe handles its own raw body parsing for webhooks)
app.use(stripeRouter);

// Regular JSON parser for any other routes (if added later)
app.use(express.json());

// Production: serve built React app
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

// ============================================================
// Initialize Sockets
// ============================================================
initializeSockets(io);

// ============================================================
// Start Server
// ============================================================
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n⚽ Ball Brawl server running on port ${PORT}\n`);
});
