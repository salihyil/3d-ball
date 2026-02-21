// ============================================================
// GameLoop — Server-side physics at 30 Hz
// ============================================================

const FIELD_WIDTH = 80;
const FIELD_HEIGHT = 50;
const GOAL_WIDTH = 12;
const GOAL_DEPTH = 8;
const GOAL_HEIGHT = 3.5; // Matches visual goal height closely
const PLAYER_RADIUS = 1.0;
const BALL_RADIUS = 1.5;
const PLAYER_SPEED = 15;
const BOOST_SPEED = 25;
const BOOST_DURATION = 1.5;
const BOOST_COOLDOWN = 4.0;
const BALL_MAX_SPEED = 40;
const BALL_FRICTION = 0.98;
const KICK_FORCE = 20;
const WALL_BOUNCE = 0.6;
const PLAYER_BOUNCE = 0.3;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const GRAVITY = -40;
const JUMP_FORCE = 20;
const OBSTACLE_SPEED = 5;

const POWERUP_SPAWN_INTERVAL = 10;
const POWERUP_RADIUS = 1.5;

const FIELD_OBSTACLES = [
  { id: 'obs1', position: { x: -20, y: 0, z: -15 }, radius: 2.5, height: 10 },
  { id: 'obs2', position: { x: -20, y: 0, z: 15 }, radius: 2.5, height: 10 },
  { id: 'obs3', position: { x: 20, y: 0, z: -15 }, radius: 2.5, height: 10 },
  { id: 'obs4', position: { x: 20, y: 0, z: 15 }, radius: 2.5, height: 10 },
];

const FIELD_BOOST_PADS = [
  { id: 'pad1', position: { x: -10, y: 0.1, z: 0 }, radius: 3 },
  { id: 'pad2', position: { x: 10, y: 0.1, z: 0 }, radius: 3 },
  { id: 'pad3', position: { x: 0, y: 0.1, z: -15 }, radius: 3 },
  { id: 'pad4', position: { x: 0, y: 0.1, z: 15 }, radius: 3 },
];

export class GameLoop {
  constructor(room, playerData, enableFeatures = true) {
    this.room = room;
    this.enableFeatures = enableFeatures;
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

    for (const [id, teamName] of Object.entries(playerData)) {
      if (teamName === 'blue') blueTeam.push(id);
      else redTeam.push(id);
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
        boostRemaining: 0,
        boostCooldown: 0,
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

  addPlayer(socketId, team) {
    if (this.players[socketId]) return;

    const isBlue = team === 'blue';
    // Position late-joiners roughly near their goal so they don't spawn on top of active play
    let zOffset = (Math.random() - 0.5) * 10;

    this.players[socketId] = {
      position: { x: isBlue ? -25 : 25, y: 0.5, z: zOffset },
      velocity: { x: 0, y: 0, z: 0 },
      team,
      boostRemaining: 0,
      boostCooldown: 0,
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
    this.powerUpSpawnTimer += DT;
    if (
      this.powerUpSpawnTimer >= POWERUP_SPAWN_INTERVAL &&
      Object.keys(this.players).length > 0
    ) {
      if (this.powerUps.length < 3) {
        this._spawnPowerUp();
      }
      this.powerUpSpawnTimer = 0;
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

    // 1. Apply player inputs
    this._updatePlayers();

    // 2. Update ball physics
    this._updateBall();

    // 3. Check collisions
    this._checkPlayerBallCollisions();
    this._checkPlayerPlayerCollisions();
    this._checkPlayerPowerUpCollisions();
    if (this.enableFeatures) {
      this._checkPlayerBoostPadCollisions();
    }

    // 4. Check goals
    this._checkGoals();

    // 5. Broadcast snapshot
    this._broadcastSnapshot();
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
      if (
        input.boost &&
        player.boostCooldown <= 0 &&
        player.boostRemaining <= 0
      ) {
        player.boostRemaining = BOOST_DURATION;
      }
      if (player.boostRemaining > 0) {
        speed = BOOST_SPEED;
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
          if (distSq < minDist * minDist && distSq > 0) {
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

    // Apply magnet pull
    for (const [id, player] of Object.entries(this.players)) {
      if (player.activePowerUp && player.activePowerUp.type === 'magnet') {
        const dx = player.position.x - this.ball.position.x;
        const dy = player.position.y - this.ball.position.y;
        const dz = player.position.z - this.ball.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 30 && dist > 0.01) {
          const pullForce = 40;
          this.ball.velocity.x += (dx / dist) * pullForce * DT;
          this.ball.velocity.y += (dy / dist) * pullForce * DT;
          this.ball.velocity.z += (dz / dist) * pullForce * DT;
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
                other.activePowerUp = { type: 'frozen', timeLeft: 3 };
              }
            }
          } else if (type === 'magnet') {
            player.activePowerUp = { type: 'magnet', timeLeft: 5 };
          } else if (type === 'rocket') {
            player.activePowerUp = { type: 'rocket', timeLeft: 8 };
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
    const types = ['magnet', 'freeze', 'rocket'];
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
