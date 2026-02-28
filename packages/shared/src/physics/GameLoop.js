// ============================================================
// GameLoop — Server-side physics at 30 Hz
// ============================================================

import {
  BALL_FRICTION,
  BALL_MAX_SPEED,
  BALL_RADIUS,
  BOOST_COOLDOWN,
  BOOST_DURATION,
  BOOST_SPEED,
  FIELD_BOOST_PADS,
  FIELD_HEIGHT,
  FIELD_OBSTACLES,
  FIELD_WIDTH,
  GOAL_DEPTH,
  GOAL_WIDTH,
  KICK_FORCE,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  POWERUP_DURATION_FROZEN,
  POWERUP_DURATION_GHOST,
  POWERUP_DURATION_GRAVITY,
  POWERUP_DURATION_MAGNET,
  POWERUP_DURATION_SPEED,
  POWERUP_RADIUS_SHOCKWAVE,
  SHOCKWAVE_FORCE,
} from '../types/index.js';

const GOAL_HEIGHT = 3.5;
const WALL_BOUNCE = 0.6;
const PLAYER_BOUNCE = 0.3;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const GRAVITY = -40;
const JUMP_FORCE = 20;
const OBSTACLE_SPEED = 5;

const POWERUP_SPAWN_INTERVAL = 10;
const POWERUP_RADIUS = 1.5;

export class GameLoop {
  constructor(room, playerData, enableFeatures = true, gameMode = 'classic') {
    this.room = room;
    this.enableFeatures = enableFeatures;
    this.gameMode = gameMode;
    this.interval = null;
    this.paused = false;
    this.tick = 0;
    this.elapsed = 0;

    // Player states
    this.players = {};
    this.inputs = {};

    // Initialize players at spawn positions
    const blueTeam = [];
    const redTeam = [];
    this.isBotMap = {};

    for (const [id, data] of Object.entries(playerData)) {
      if (data.team === 'blue') blueTeam.push(id);
      else redTeam.push(id);
      this.isBotMap[id] = !!data.isBot;
    }

    this._spawnPlayers(blueTeam, 'blue');
    this._spawnPlayers(redTeam, 'red');

    // Ball
    this.ball = {
      position: { x: 0, y: BALL_RADIUS, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    };

    // Powerups
    this.powerUps = [];
    this.powerUpSpawnTimer = 0;

    // Boost Pads
    this.boostPads = this.enableFeatures
      ? FIELD_BOOST_PADS.map((pad) => ({
          id: pad.id,
          active: true,
          respawnTimer: 0,
        }))
      : [];

    // Static obstacles made dynamic
    this.obstacles = this.enableFeatures
      ? FIELD_OBSTACLES.map((obs) => ({
          ...obs,
          position: { ...obs.position },
        }))
      : [];

    // Previous snapshot for delta compression
    this.prevSnapshot = null;
  }

  _spawnPlayers(ids, team) {
    const side = team === 'blue' ? -1 : 1;
    const count = ids.length;

    for (let i = 0; i < count; i++) {
      const spread = FIELD_HEIGHT * 0.6;
      const zOffset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
      const xBase = (FIELD_WIDTH / 3) * side;

      this.players[ids[i]] = {
        position: { x: xBase, y: PLAYER_RADIUS, z: zOffset },
        velocity: { x: 0, y: 0, z: 0 },
        team,
        isBot: this.isBotMap ? this.isBotMap[ids[i]] : false,
        boostRemaining: 0,
        boostCooldown: 0,
        aiState:
          this.isBotMap && this.isBotMap[ids[i]]
            ? { wanderTarget: null, wanderExpiry: 0 }
            : null,
      };
      this.inputs[ids[i]] = { dx: 0, dz: 0, boost: false, jump: false, seq: 0 };
    }
  }

  start() {
    this.interval = setInterval(() => this._update(), 1000 / TICK_RATE);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  handleInput(socketId, input) {
    if (!this.players[socketId]) return;

    // Clamp input values
    this.inputs[socketId] = {
      dx: Math.max(-1, Math.min(1, input.dx || 0)),
      dz: Math.max(-1, Math.min(1, input.dz || 0)),
      boost: !!input.boost,
      jump: !!input.jump,
      seq: input.seq || 0,
    };
  }

  removePlayer(socketId) {
    delete this.players[socketId];
    delete this.inputs[socketId];
  }

  addPlayer(socketId, team, isBot = false) {
    if (this.players[socketId]) return;

    if (this.isBotMap) {
      this.isBotMap[socketId] = isBot;
    }

    const isBlue = team === 'blue';
    // Position late-joiners roughly near their goal so they don't spawn on top of active play
    let zOffset = (Math.random() - 0.5) * 10;

    this.players[socketId] = {
      position: { x: isBlue ? -25 : 25, y: 0.5, z: zOffset },
      velocity: { x: 0, y: 0, z: 0 },
      team,
      isBot,
      boostRemaining: 0,
      boostCooldown: 0,
      aiState: isBot ? { wanderTarget: null, wanderExpiry: 0 } : null,
    };
    this.inputs[socketId] = { dx: 0, dz: 0, boost: false, jump: false, seq: 0 };
  }

  resetPositions() {
    const blueTeam = [];
    const redTeam = [];

    for (const [id, p] of Object.entries(this.players)) {
      if (p.team === 'blue') blueTeam.push(id);
      else redTeam.push(id);
    }

    // Clear and re-spawn
    for (const id of [...blueTeam, ...redTeam]) {
      const team = this.players[id].team;
      delete this.players[id];
      this.inputs[id] = { dx: 0, dz: 0, boost: false, jump: false, seq: 0 };
    }

    this._spawnPlayers(blueTeam, 'blue');
    this._spawnPlayers(redTeam, 'red');

    // Reset ball
    this.ball.position = { x: 0, y: BALL_RADIUS, z: 0 };
    this.ball.velocity = { x: 0, y: 0, z: 0 };

    this.powerUps = [];
    this.powerUpSpawnTimer = 0;

    // Reset Boost Pads
    this.boostPads = this.enableFeatures
      ? FIELD_BOOST_PADS.map((pad) => ({
          id: pad.id,
          active: true,
          respawnTimer: 0,
        }))
      : [];
  }

  removePlayer(id) {
    if (this.players[id]) {
      delete this.players[id];
      delete this.inputs[id];
    }
  }

  // Fixed timestep update Loop ----

  _update() {
    if (this.paused) return;

    this.tick++;

    // During countdown, bypass physics but keep broadcasting so late clients see the timer
    if (this.room.gameState === 'countdown') {
      const remainingMs = this.room.matchStartTime - Date.now();
      const countdown = Math.max(0, Math.ceil(remainingMs / 1000));
      this._broadcastSnapshot(countdown);
      return;
    }

    this.elapsed += DT;

    // Update timer
    const timeRemaining = this.room.matchDuration - this.elapsed;
    this.room.onTimerUpdate(Math.max(0, timeRemaining));

    if (timeRemaining <= 0) return;

    // Powerups
    if (this.room.gameState === 'playing') {
      this.powerUpSpawnTimer += DT;
      const interval = this.gameMode === 'chaos' ? 3 : POWERUP_SPAWN_INTERVAL;
      if (this.powerUpSpawnTimer >= interval) {
        if (this.powerUps.length < 3 && Object.keys(this.players).length > 0) {
          this._spawnPowerUp();
        }
        this.powerUpSpawnTimer = 0;
      }
    }

    // Update boost pads
    if (this.enableFeatures) {
      for (const pad of this.boostPads) {
        if (!pad.active) {
          pad.respawnTimer -= DT;
          if (pad.respawnTimer <= 0) {
            pad.active = true;
            pad.respawnTimer = 0;
          }
        }
      }
    }

    // Update obstacles
    if (this.enableFeatures) {
      for (const obs of this.obstacles) {
        obs.position.z += OBSTACLE_SPEED * DT;
        // Wrap around logic
        const halfH = FIELD_HEIGHT / 2;
        if (obs.position.z > halfH) {
          obs.position.z = -halfH;
        }
      }
    }

    // 1. Compute Bot Inputs
    this._updateBots();

    // 2. Apply player inputs
    this._updatePlayers();

    // 3. Update ball physics
    this._updateBall();

    // 4. Check collisions
    this._checkPlayerBallCollisions();
    this._checkPlayerPlayerCollisions();
    this._checkPlayerPowerUpCollisions();
    if (this.enableFeatures) {
      this._checkPlayerBoostPadCollisions();
    }

    // 5. Check goals
    this._checkGoals();

    // 5. Broadcast snapshot
    this._broadcastSnapshot();
  }

  _updateBots() {
    // 1. Group bots by team to determine roles
    const botsByTeam = { blue: [], red: [] };
    for (const [id, player] of Object.entries(this.players)) {
      if (player.isBot) {
        botsByTeam[player.team].push(id);
      }
    }

    // 2. Determine roles for each team
    const botRoles = {}; // id -> 'chaser' | 'defender' | 'supporter'
    for (const team of ['blue', 'red']) {
      const teamBots = botsByTeam[team];
      if (teamBots.length === 0) continue;

      // Closest bot to ball is the chaser
      let closestId = null;
      let minDist = Infinity;
      const bx = this.ball.position.x;
      const bz = this.ball.position.z;

      teamBots.forEach((id) => {
        const p = this.players[id];
        const dist = Math.sqrt(
          (p.position.x - bx) ** 2 + (p.position.z - bz) ** 2
        );
        if (dist < minDist) {
          minDist = dist;
          closestId = id;
        }
      });

      teamBots.forEach((id) => {
        if (id === closestId) {
          botRoles[id] = 'chaser';
        } else if (
          teamBots.length > 1 &&
          id === teamBots.find((bid) => bid !== closestId)
        ) {
          botRoles[id] = 'defender';
        } else {
          botRoles[id] = 'supporter';
        }
      });
    }

    // 3. Process each bot's logic
    for (const [id, player] of Object.entries(this.players)) {
      if (!player.isBot) continue;

      // Reaction Delay (3-5 ticks)
      if (
        player.aiState &&
        player.aiState.nextActionTick &&
        this.tick < player.aiState.nextActionTick
      ) {
        if (this.inputs[id]) this.inputs[id].seq = this.tick;
        continue;
      }

      const bx = this.ball.position.x;
      const bz = this.ball.position.z;
      let role = botRoles[id];

      // Variable Targeting (Aim Error - ~1.5 units)
      const aimOffset = 1.5;
      const aimX = bx + (Math.random() - 0.5) * aimOffset;
      const aimZ = bz + (Math.random() - 0.5) * aimOffset;

      // Goals & Boundaries
      const isBlue = player.team === 'blue';
      const opponentGoalX = isBlue ? FIELD_WIDTH / 2 : -FIELD_WIDTH / 2;
      const ownGoalX = isBlue ? -FIELD_WIDTH / 2 : FIELD_WIDTH / 2;
      const attackDir = isBlue ? 1 : -1;

      // State variables
      let targetX = aimX;
      let targetZ = aimZ;
      let boost = false;
      let jump = false;

      // Strategy Layer
      const distToBall = Math.sqrt(
        (player.position.x - bx) ** 2 + (player.position.z - bz) ** 2
      );
      const isBehindBall = isBlue
        ? player.position.x < bx - 1
        : player.position.x > bx + 1;

      // Special Behavior: ACTIVE MAGNET
      if (player.activePowerUp && player.activePowerUp.type === 'magnet') {
        // Just run straight to the opponent's goal, the ball will follow
        targetX = opponentGoalX;
        targetZ = 0;
        boost = distToBall < 10;
      } else if (role === 'chaser') {
        if (!isBehindBall) {
          // Move to a point behind the ball to line up a shot
          targetX = aimX - attackDir * 5;
          targetZ = aimZ;
        } else {
          // Attack the ball!
          // Offset target slightly towards the goal center for a better angle
          const goalCenterZ = 0;
          const toGoalX = opponentGoalX - aimX;
          const toGoalZ = goalCenterZ - aimZ;
          const toGoalLen = Math.sqrt(toGoalX ** 2 + toGoalZ ** 2);

          // Target a point slightly "behind" the ball relative to the goal
          targetX = aimX - (toGoalX / toGoalLen) * 1.5;
          targetZ = aimZ - (toGoalZ / toGoalLen) * 1.5;

          if (distToBall < 5) boost = true;
        }
      } else if (role === 'defender') {
        // Dynamic Defense Line: Push up to midfield when attacking, fall back when defending
        const ballInOpponentHalf = isBlue ? bx > 0 : bx < 0;
        const pushUpFactor = ballInOpponentHalf
          ? Math.abs(bx) / (FIELD_WIDTH / 2)
          : 0;

        const deepDefenseX = ownGoalX * 0.6; // Not too deep, still allows some space
        const midfieldX = 0; // Midfield

        targetX = deepDefenseX + (midfieldX - deepDefenseX) * pushUpFactor;
        targetZ = bz * 0.4; // Follow the ball horizontally but stay central

        // If ball is very close to own goal, rush it!
        if (Math.abs(bx - ownGoalX) < 15) {
          targetX = aimX;
          targetZ = aimZ;
        } else if (Math.abs(bx - ownGoalX) > 40 && !ballInOpponentHalf) {
          // Ball is very far in our own half? Unlikely, but if idle, wander
          role = 'wanderer';
        }
      } else {
        // Supporter: Winger / Forward / Powerup gatherer
        let closestPU = null;
        let minPUDist = 15; // Prioritize position, only grab very close powerups

        this.powerUps.forEach((pu) => {
          const d = Math.sqrt(
            (pu.position.x - player.position.x) ** 2 +
              (pu.position.z - player.position.z) ** 2
          );
          if (d < minPUDist) {
            minPUDist = d;
            closestPU = pu;
          }
        });

        if (closestPU) {
          targetX = closestPU.position.x;
          targetZ = closestPU.position.z;
        } else {
          // Play as winger/forward: Stay slightly behind the ball's X position
          targetX = bx - attackDir * 12;

          // Spread out: if ball is on the wings, take the center. If ball is center, go to the wings.
          if (Math.abs(bz) > 8) {
            targetZ = 0; // Wait in center for a cross
          } else {
            // Ball is center, fan out to an open side
            targetZ = player.position.z > 0 ? 10 : -10;
          }
        }
      }

      // WANDER LOGIC (Exploration)
      if (role === 'wanderer') {
        if (!player.aiState.wanderTarget || player.aiState.wanderExpiry <= 0) {
          // Pick a random point on the field
          player.aiState.wanderTarget = {
            x: (Math.random() - 0.5) * FIELD_WIDTH * 0.8,
            z: (Math.random() - 0.5) * FIELD_HEIGHT * 0.8,
          };
          player.aiState.wanderExpiry = 2 + Math.random() * 3; // 2-5 seconds
        }

        targetX = player.aiState.wanderTarget.x;
        targetZ = player.aiState.wanderTarget.z;
        player.aiState.wanderExpiry -= DT;

        // If we reach the wander target, clear it
        const distToWander = Math.sqrt(
          (player.position.x - targetX) ** 2 +
            (player.position.z - targetZ) ** 2
        );
        if (distToWander < 2) {
          player.aiState.wanderExpiry = 0;
        }
      } else if (player.aiState) {
        // Clear wander timer if we switch to an active role
        player.aiState.wanderExpiry = 0;
      }

      // Input Logic
      let inputDx = targetX - player.position.x;
      let inputDz = targetZ - player.position.z;
      const targetDist = Math.sqrt(inputDx * inputDx + inputDz * inputDz);

      if (targetDist > 0.1) {
        inputDx /= targetDist;
        inputDz /= targetDist;
      }

      // ADD RANDOM NOISE (Humanization)
      // 20% random jitter to direction
      const jitter = 0.2;
      inputDx += (Math.random() - 0.5) * jitter;
      inputDz += (Math.random() - 0.5) * jitter;
      const newLen = Math.sqrt(inputDx * inputDx + inputDz * inputDz);
      if (newLen > 0.1) {
        inputDx /= newLen;
        inputDz /= newLen;
      }

      // Emergency Defend Boost
      if (
        role === 'defender' &&
        Math.abs(bx - ownGoalX) < 15 &&
        targetDist > 5
      ) {
        boost = true;
      }

      // Jump Logic
      if (this.ball.position.y > 4 && distToBall < 5) {
        jump = true;
      }

      // Apply Inputs
      this.inputs[id] = {
        dx: inputDx,
        dz: inputDz,
        boost,
        jump,
        seq: this.tick,
      };

      if (player.aiState) {
        // Next update in 3 to 5 ticks
        player.aiState.nextActionTick =
          this.tick + Math.floor(Math.random() * 3) + 3;
      }
    }
  }

  _updatePlayers() {
    for (const [id, player] of Object.entries(this.players)) {
      // Handle active power up timers
      if (player.activePowerUp) {
        player.activePowerUp.timeLeft -= DT;
        if (player.activePowerUp.timeLeft <= 0) {
          player.activePowerUp = null;
        }
      }

      // Check for being frozen
      if (player.activePowerUp && player.activePowerUp.type === 'frozen') {
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.velocity.z = 0;
        continue;
      }

      const input = this.inputs[id];
      if (!input) continue;

      // Boost management
      if (player.boostCooldown > 0) {
        player.boostCooldown -= DT;
      }

      let speed = PLAYER_SPEED;
      if (player.activePowerUp && player.activePowerUp.type === 'speed') {
        speed *= 1.8; // Huge speed boost
      }

      if (
        input.boost &&
        player.boostCooldown <= 0 &&
        player.boostRemaining <= 0
      ) {
        player.boostRemaining = BOOST_DURATION;
      }
      if (player.boostRemaining > 0) {
        let bSpeed = BOOST_SPEED;
        if (player.activePowerUp && player.activePowerUp.type === 'speed') {
          bSpeed *= 1.4; // Even faster boost
        }
        speed = bSpeed;
        player.boostRemaining -= DT;
        if (player.boostRemaining <= 0) {
          player.boostCooldown = BOOST_COOLDOWN;
        }
      }

      // Normalize input direction
      let dx = input.dx;
      let dz = input.dz;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 1) {
        dx /= len;
        dz /= len;
      }

      // Apply movement
      player.velocity.x = dx * speed;
      player.velocity.z = dz * speed;

      // Jump and Gravity
      const isGrounded = player.position.y <= PLAYER_RADIUS + 0.01;
      if (isGrounded) {
        player.position.y = PLAYER_RADIUS;
        player.velocity.y = 0;

        if (input.jump && !player.jumpProcessed) {
          player.velocity.y = JUMP_FORCE;
          player.jumpProcessed = true;
        }
      }

      if (!input.jump) {
        player.jumpProcessed = false;
      }

      player.velocity.y += GRAVITY * DT;

      player.position.x += player.velocity.x * DT;
      player.position.y += player.velocity.y * DT;
      player.position.z += player.velocity.z * DT;

      // Floor collision checks for Y
      if (player.position.y < PLAYER_RADIUS) {
        player.position.y = PLAYER_RADIUS;
        player.velocity.y = 0;
      }

      // Obstacle collision (Circle vs Circle on XZ plane)
      if (this.enableFeatures) {
        for (const obs of this.obstacles) {
          const dx = player.position.x - obs.position.x;
          const dz = player.position.z - obs.position.z;
          const distSq = dx * dx + dz * dz;
          const minDist = PLAYER_RADIUS + obs.radius;
          const isGhost =
            player.activePowerUp && player.activePowerUp.type === 'ghost';

          if (distSq < minDist * minDist && distSq > 0 && !isGhost) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            const nx = dx / dist;
            const nz = dz / dist;

            player.position.x += nx * overlap;
            player.position.z += nz * overlap;

            // Bounce lightly
            const dot = player.velocity.x * nx + player.velocity.z * nz;
            if (dot < 0) {
              player.velocity.x -= dot * nx * 1.2; // slight elastic response
              player.velocity.z -= dot * nz * 1.2;
            }
          }
        }
      }

      // Clamp to field bounds
      const fieldXBounds = FIELD_WIDTH / 2 - PLAYER_RADIUS;
      const fieldZBounds = FIELD_HEIGHT / 2 - PLAYER_RADIUS;
      const goalZBounds = GOAL_WIDTH / 2 - PLAYER_RADIUS;
      const maxGoalX = FIELD_WIDTH / 2 + GOAL_DEPTH - PLAYER_RADIUS;

      // Base clamp for Z on outer field walls
      player.position.z = Math.max(
        -fieldZBounds,
        Math.min(fieldZBounds, player.position.z)
      );

      if (Math.abs(player.position.x) > fieldXBounds) {
        if (
          Math.abs(player.position.z) > goalZBounds ||
          player.position.y > GOAL_HEIGHT
        ) {
          // Hit front wall, side net, or front wall above the goal
          const xPen = Math.abs(player.position.x) - fieldXBounds;
          let zPen = Math.abs(player.position.z) - goalZBounds;
          if (Math.abs(player.position.z) <= goalZBounds) {
            zPen = Infinity; // Above the goal, hitting front wall
          }

          if (xPen > zPen) {
            // Sliding against side net
            player.position.z = Math.sign(player.position.z) * goalZBounds;
            // Also clamp X to the back net
            player.position.x = Math.max(
              -maxGoalX,
              Math.min(maxGoalX, player.position.x)
            );
          } else {
            // Sliding against front wall
            player.position.x = Math.sign(player.position.x) * fieldXBounds;
          }
        } else {
          // Inside goal opening, clamp to back net
          player.position.x = Math.max(
            -maxGoalX,
            Math.min(maxGoalX, player.position.x)
          );

          // Check goal inner ceiling
          if (player.position.y > GOAL_HEIGHT - PLAYER_RADIUS) {
            player.position.y = GOAL_HEIGHT - PLAYER_RADIUS;
            if (player.velocity.y > 0) player.velocity.y *= -PLAYER_BOUNCE;
          }
        }
      }
    }
  }

  _updateBall() {
    // Apply friction
    this.ball.velocity.x *= BALL_FRICTION;
    this.ball.velocity.z *= BALL_FRICTION;

    // Clamp speed
    const speed = Math.sqrt(
      this.ball.velocity.x ** 2 +
        this.ball.velocity.y ** 2 +
        this.ball.velocity.z ** 2
    );
    if (speed > BALL_MAX_SPEED) {
      const scale = BALL_MAX_SPEED / speed;
      this.ball.velocity.x *= scale;
      this.ball.velocity.y *= scale;
      this.ball.velocity.z *= scale;
    }

    // Stop very slow ball
    if (speed < 0.1 && this.ball.position.y <= BALL_RADIUS + 0.05) {
      this.ball.velocity.x = 0;
      this.ball.velocity.y = 0;
      this.ball.velocity.z = 0;
    }

    // Apply gravity
    this.ball.velocity.y += GRAVITY * DT;

    // Apply magnet / gravity pull
    for (const [id, player] of Object.entries(this.players)) {
      if (!player.activePowerUp) continue;
      const type = player.activePowerUp.type;

      if (type === 'magnet' || type === 'gravity') {
        const dx = player.position.x - this.ball.position.x;
        const dy = player.position.y - this.ball.position.y;
        const dz = player.position.z - this.ball.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const maxDist = type === 'gravity' ? 40 : 30;
        const pullForce = type === 'gravity' ? 80 : 40;

        if (dist < maxDist && dist > 0.01) {
          const strength = type === 'gravity' ? 1 : 1; // can be distance scaled if desired
          this.ball.velocity.x += (dx / dist) * pullForce * DT * strength;
          this.ball.velocity.y += (dy / dist) * pullForce * DT * strength;
          this.ball.velocity.z += (dz / dist) * pullForce * DT * strength;
        }
      }
    }

    // Move ball
    this.ball.position.x += this.ball.velocity.x * DT;
    this.ball.position.y += this.ball.velocity.y * DT;
    this.ball.position.z += this.ball.velocity.z * DT;

    // Internal NaN Recovery
    if (
      isNaN(this.ball.position.x) ||
      isNaN(this.ball.position.y) ||
      isNaN(this.ball.position.z)
    ) {
      this.ball.position = { x: 0, y: BALL_RADIUS, z: 0 };
      this.ball.velocity = { x: 0, y: 0, z: 0 };
    }

    // Floor collision
    if (this.ball.position.y < BALL_RADIUS) {
      this.ball.position.y = BALL_RADIUS;
      this.ball.velocity.y *= -WALL_BOUNCE;

      if (Math.abs(this.ball.velocity.y) < 2) {
        this.ball.velocity.y = 0;
      }
    }

    // Obstacle collision
    if (this.enableFeatures) {
      for (const obs of this.obstacles) {
        const dx = this.ball.position.x - obs.position.x;
        const dz = this.ball.position.z - obs.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = BALL_RADIUS + obs.radius;
        // Note: check Y only if ball is lower than obstacle height
        if (
          this.ball.position.y - BALL_RADIUS < obs.height &&
          distSq < minDist * minDist &&
          distSq > 0
        ) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = dx / dist;
          const nz = dz / dist;

          this.ball.position.x += nx * overlap;
          this.ball.position.z += nz * overlap;

          const dot = this.ball.velocity.x * nx + this.ball.velocity.z * nz;
          if (dot < 0) {
            this.ball.velocity.x -= dot * nx * (1 + WALL_BOUNCE);
            this.ball.velocity.z -= dot * nz * (1 + WALL_BOUNCE);
          }
        }
      }
    }

    // Wall collisions (top/bottom)
    const halfH = FIELD_HEIGHT / 2 - BALL_RADIUS;
    if (this.ball.position.z > halfH) {
      this.ball.position.z = halfH;
      this.ball.velocity.z *= -WALL_BOUNCE;
    } else if (this.ball.position.z < -halfH) {
      this.ball.position.z = -halfH;
      this.ball.velocity.z *= -WALL_BOUNCE;
    }

    const CEILING = 100;
    if (this.ball.position.y > CEILING - BALL_RADIUS) {
      this.ball.position.y = CEILING - BALL_RADIUS;
      this.ball.velocity.y *= -WALL_BOUNCE;
    }

    // Wall collisions (left/right — considering goal area)
    const fieldXBounds = FIELD_WIDTH / 2 - BALL_RADIUS;
    const goalZBounds = GOAL_WIDTH / 2 - BALL_RADIUS;
    const maxGoalX = FIELD_WIDTH / 2 + GOAL_DEPTH - BALL_RADIUS;

    if (Math.abs(this.ball.position.x) > fieldXBounds) {
      if (
        Math.abs(this.ball.position.z) > goalZBounds ||
        this.ball.position.y > GOAL_HEIGHT
      ) {
        // Hit front wall (above goal too) or side net
        const xPen = Math.abs(this.ball.position.x) - fieldXBounds;
        let zPen = Math.abs(this.ball.position.z) - goalZBounds;
        if (Math.abs(this.ball.position.z) <= goalZBounds) {
          zPen = Infinity; // We are above the goal, so we must be hitting the front wall, not side net
        }

        if (xPen > zPen) {
          // Bounced off side net
          this.ball.position.z = Math.sign(this.ball.position.z) * goalZBounds;
          this.ball.velocity.z *= -WALL_BOUNCE;
        } else {
          // Bounced off front wall
          this.ball.position.x = Math.sign(this.ball.position.x) * fieldXBounds;
          this.ball.velocity.x *= -WALL_BOUNCE;
        }
      } else {
        // Inside goal opening, check back net
        if (Math.abs(this.ball.position.x) > maxGoalX) {
          this.ball.position.x = Math.sign(this.ball.position.x) * maxGoalX;
          this.ball.velocity.x *= -WALL_BOUNCE;
        }
        // Check goal inner ceiling
        if (this.ball.position.y > GOAL_HEIGHT - BALL_RADIUS) {
          this.ball.position.y = GOAL_HEIGHT - BALL_RADIUS;
          this.ball.velocity.y *= -WALL_BOUNCE;
        }
      }
    }
  }

  _checkPlayerBallCollisions() {
    const bx = this.ball.position.x;
    const by = this.ball.position.y;
    const bz = this.ball.position.z;
    let closestPlayerId = null;
    let closestDist = Infinity;

    for (const [id, player] of Object.entries(this.players)) {
      const dx = bx - player.position.x;
      const dy = by - player.position.y;
      const dz = bz - player.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const minDist = PLAYER_RADIUS + BALL_RADIUS;

      if (dist < minDist && dist > 0.001) {
        // Separate ball from player
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        this.ball.position.x += nx * overlap;
        this.ball.position.y += ny * overlap;
        this.ball.position.z += nz * overlap;

        // Calculate kick force based on player velocity
        const playerSpeed = Math.sqrt(
          player.velocity.x ** 2 +
            player.velocity.y ** 2 +
            player.velocity.z ** 2
        );
        let multiplier = 1;
        if (player.activePowerUp && player.activePowerUp.type === 'rocket') {
          multiplier = 2.5; // Super powerful kick
          player.activePowerUp = null; // consume
        }
        const force = (KICK_FORCE + playerSpeed * 0.8) * multiplier;

        this.ball.velocity.x = nx * force;
        this.ball.velocity.y =
          ny * force + (Math.abs(player.velocity.y) > 0 ? 0 : 5); // Add a small pop up if grounded hit
        this.ball.velocity.z = nz * force;

        // Track closest for goal attribution
        if (dist < closestDist) {
          closestDist = dist;
          closestPlayerId = id;
        }
      }
    }

    if (closestPlayerId) {
      this._lastToucher = closestPlayerId;
    }
  }

  _checkPlayerPlayerCollisions() {
    const ids = Object.keys(this.players);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = this.players[ids[i]];
        const b = this.players[ids[j]];

        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const dz = b.position.z - a.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDist = PLAYER_RADIUS * 2;

        if (dist < minDist && dist > 0.001) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;

          a.position.x -= nx * overlap;
          a.position.y -= ny * overlap;
          a.position.z -= nz * overlap;
          b.position.x += nx * overlap;
          b.position.y += ny * overlap;
          b.position.z += nz * overlap;

          // Bounce velocities
          const dvx = a.velocity.x - b.velocity.x;
          const dvy = a.velocity.y - b.velocity.y;
          const dvz = a.velocity.z - b.velocity.z;
          const dot = dvx * nx + dvy * ny + dvz * nz;

          if (dot > 0) {
            // Apply ghost logic: Skip bounce if either is ghost
            const eitherGhost =
              (a.activePowerUp && a.activePowerUp.type === 'ghost') ||
              (b.activePowerUp && b.activePowerUp.type === 'ghost');

            if (!eitherGhost) {
              a.velocity.x -= dot * nx * PLAYER_BOUNCE;
              a.velocity.y -= dot * ny * PLAYER_BOUNCE;
              a.velocity.z -= dot * nz * PLAYER_BOUNCE;
              b.velocity.x += dot * nx * PLAYER_BOUNCE;
              b.velocity.y += dot * ny * PLAYER_BOUNCE;
              b.velocity.z += dot * nz * PLAYER_BOUNCE;
            }
          }
        }
      }
    }
  }

  _checkPlayerPowerUpCollisions() {
    for (const [id, player] of Object.entries(this.players)) {
      for (let i = this.powerUps.length - 1; i >= 0; i--) {
        const pu = this.powerUps[i];
        const dx = pu.position.x - player.position.x;
        const dy = pu.position.y - player.position.y;
        const dz = pu.position.z - player.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDist = PLAYER_RADIUS + POWERUP_RADIUS;

        if (dist < minDist) {
          const type = pu.type;
          this.powerUps.splice(i, 1);

          if (type === 'freeze') {
            for (const [otherId, other] of Object.entries(this.players)) {
              if (other.team !== player.team) {
                other.activePowerUp = {
                  type: 'frozen',
                  timeLeft: POWERUP_DURATION_FROZEN,
                };
              }
            }
          } else if (type === 'magnet') {
            player.activePowerUp = {
              type: 'magnet',
              timeLeft: POWERUP_DURATION_MAGNET,
            };
          } else if (type === 'rocket') {
            player.activePowerUp = { type: 'rocket', timeLeft: 8 };
          } else if (type === 'gravity') {
            player.activePowerUp = {
              type: 'gravity',
              timeLeft: POWERUP_DURATION_GRAVITY,
            };
          } else if (type === 'speed') {
            player.activePowerUp = {
              type: 'speed',
              timeLeft: POWERUP_DURATION_SPEED,
            };
          } else if (type === 'ghost') {
            player.activePowerUp = {
              type: 'ghost',
              timeLeft: POWERUP_DURATION_GHOST,
            };
          } else if (type === 'shockwave') {
            // Instant AOE Push
            const explosionPos = player.position;
            const RADIUS = POWERUP_RADIUS_SHOCKWAVE;
            const FORCE = SHOCKWAVE_FORCE;

            // Push players
            for (const [otherId, other] of Object.entries(this.players)) {
              if (otherId === id) continue; // Don't push self
              const dx = other.position.x - explosionPos.x;
              const dy = other.position.y - explosionPos.y;
              const dz = other.position.z - explosionPos.z;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (dist < RADIUS && dist > 0.01) {
                const strength = 1 - dist / RADIUS;
                other.velocity.x += (dx / dist) * FORCE * strength;
                other.velocity.y += (dy / dist) * FORCE * strength + 5;
                other.velocity.z += (dz / dist) * FORCE * strength;
              }
            }
            // Push ball
            const bdx = this.ball.position.x - explosionPos.x;
            const bdy = this.ball.position.y - explosionPos.y;
            const bdz = this.ball.position.z - explosionPos.z;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy + bdz * bdz);
            if (bdist < RADIUS && bdist > 0.01) {
              const bstrength = 1 - bdist / RADIUS;
              this.ball.velocity.x += (bdx / bdist) * FORCE * bstrength;
              this.ball.velocity.y += (bdy / bdist) * FORCE * bstrength + 8;
              this.ball.velocity.z += (bdz / bdist) * FORCE * bstrength;
            }
          }
        }
      }
    }
  }

  _checkPlayerBoostPadCollisions() {
    for (const [id, player] of Object.entries(this.players)) {
      for (let i = 0; i < this.boostPads.length; i++) {
        const padState = this.boostPads[i];
        if (!padState.active) continue;

        const staticPad = FIELD_BOOST_PADS[i];
        const dx = player.position.x - staticPad.position.x;
        const dz = player.position.z - staticPad.position.z;
        const distSq = dx * dx + dz * dz;
        const hitDist = PLAYER_RADIUS + staticPad.radius;

        if (distSq < hitDist * hitDist) {
          // Player hit pad
          padState.active = false;
          padState.respawnTimer = 10; // 10 seconds to respawn
          player.boostCooldown = 0;
          player.boostRemaining = BOOST_DURATION; // Auto-activate boost!
        }
      }
    }
  }

  _checkGoals() {
    if (this.room.gameState !== 'playing') return;

    const halfW = FIELD_WIDTH / 2;
    const goalHalf = GOAL_WIDTH / 2;
    const bx = this.ball.position.x;
    const bz = this.ball.position.z;

    // Goal in blue side (left, x < -halfW) → red scores
    if (
      bx < -halfW &&
      Math.abs(bz) < goalHalf &&
      this.ball.position.y < GOAL_HEIGHT + 1
    ) {
      this.room.onGoalScored('red', this._lastToucher);
      return;
    }

    // Goal in red side (right, x > halfW) → blue scores
    if (
      bx > halfW &&
      Math.abs(bz) < goalHalf &&
      this.ball.position.y < GOAL_HEIGHT + 1
    ) {
      this.room.onGoalScored('blue', this._lastToucher);
      return;
    }
  }

  _broadcastSnapshot(countdown = undefined) {
    const players = {};
    for (const [id, p] of Object.entries(this.players)) {
      players[id] = {
        id,
        position: { ...p.position },
        velocity: { ...p.velocity },
        boostCooldown: Math.max(0, p.boostCooldown),
        team: p.team,
        activePowerUp: p.activePowerUp,
        equippedAccessories:
          this.room.players.get(id)?.equippedAccessories || [],
      };
    }

    const snapshot = {
      tick: this.tick,
      players,
      ball: {
        position: {
          x: isNaN(this.ball.position.x) ? 0 : this.ball.position.x,
          y: isNaN(this.ball.position.y) ? BALL_RADIUS : this.ball.position.y,
          z: isNaN(this.ball.position.z) ? 0 : this.ball.position.z,
        },
        velocity: {
          x: isNaN(this.ball.velocity.x) ? 0 : this.ball.velocity.x,
          y: isNaN(this.ball.velocity.y) ? 0 : this.ball.velocity.y,
          z: isNaN(this.ball.velocity.z) ? 0 : this.ball.velocity.z,
        },
      },
      score: { ...this.room.score },
      timeRemaining: Math.max(0, this.room.matchDuration - this.elapsed),
      gameState: this.room.gameState,
      countdown,
      powerUps: this.powerUps.map((p) => ({ ...p })),
      boostPads: this.boostPads.map((p) => ({ id: p.id, active: p.active })),
      obstacles: this.obstacles.map((o) => ({ ...o })),
    };

    this.room.broadcastSnapshot(snapshot);
  }

  _spawnPowerUp() {
    const types = [
      'magnet',
      'freeze',
      'rocket',
      'gravity',
      'shockwave',
      'speed',
      'ghost',
    ];
    const type = types[Math.floor(Math.random() * types.length)];

    // Random position avoiding edges and goals
    const side = Math.random() < 0.5 ? 1 : -1;
    const x = side * (Math.random() * (FIELD_WIDTH / 2 - 10));
    const z = (Math.random() - 0.5) * (FIELD_HEIGHT - 10);

    this.powerUps.push({
      id: `pu_${Date.now()}_${Math.random()}`,
      position: { x, y: 1.5, z },
      type,
    });
  }
}
