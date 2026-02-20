// ============================================================
// GameLoop — Server-side physics at 30 Hz
// ============================================================

const FIELD_WIDTH = 80;
const FIELD_HEIGHT = 50;
const GOAL_WIDTH = 12;
const GOAL_DEPTH = 8;
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

export class GameLoop {
  constructor(room, playerData) {
    this.room = room;
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

    // Previous snapshot for delta compression
    this.prevSnapshot = null;
  }

  _spawnPlayers(ids, team) {
    const side = team === 'blue' ? -1 : 1;
    const count = ids.length;

    for (let i = 0; i < count; i++) {
      const spread = FIELD_HEIGHT * 0.6;
      const zOffset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
      const xBase = (FIELD_WIDTH / 4) * side;

      this.players[ids[i]] = {
        position: { x: xBase, y: PLAYER_RADIUS, z: zOffset },
        velocity: { x: 0, y: 0, z: 0 },
        team,
        boostRemaining: 0,
        boostCooldown: 0,
      };
      this.inputs[ids[i]] = { dx: 0, dz: 0, boost: false, seq: 0 };
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
      position: { x: isBlue ? -20 : 20, y: 0.5, z: zOffset },
      velocity: { x: 0, y: 0, z: 0 },
      team,
      boostRemaining: 0,
      boostCooldown: 0,
    };
    this.inputs[socketId] = { dx: 0, dz: 0, boost: false, seq: 0 };
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
      this.inputs[id] = { dx: 0, dz: 0, boost: false, seq: 0 };
    }

    this._spawnPlayers(blueTeam, 'blue');
    this._spawnPlayers(redTeam, 'red');

    // Reset ball
    this.ball.position = { x: 0, y: BALL_RADIUS, z: 0 };
    this.ball.velocity = { x: 0, y: 0, z: 0 };
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

    // 1. Apply player inputs
    this._updatePlayers();

    // 2. Update ball physics
    this._updateBall();

    // 3. Check collisions
    this._checkPlayerBallCollisions();
    this._checkPlayerPlayerCollisions();

    // 4. Check goals
    this._checkGoals();

    // 5. Broadcast snapshot
    this._broadcastSnapshot();
  }

  _updatePlayers() {
    for (const [id, player] of Object.entries(this.players)) {
      const input = this.inputs[id];
      if (!input) continue;

      // Boost management
      if (player.boostCooldown > 0) {
        player.boostCooldown -= DT;
      }

      let speed = PLAYER_SPEED;
      if (input.boost && player.boostCooldown <= 0 && player.boostRemaining <= 0) {
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

      player.position.x += player.velocity.x * DT;
      player.position.z += player.velocity.z * DT;

      // Clamp to field bounds
      const fieldXBounds = FIELD_WIDTH / 2 - PLAYER_RADIUS;
      const fieldZBounds = FIELD_HEIGHT / 2 - PLAYER_RADIUS;
      const goalZBounds = GOAL_WIDTH / 2 - PLAYER_RADIUS;
      const maxGoalX = FIELD_WIDTH / 2 + GOAL_DEPTH - PLAYER_RADIUS;

      // Base clamp for Z on outer field walls
      player.position.z = Math.max(-fieldZBounds, Math.min(fieldZBounds, player.position.z));

      if (Math.abs(player.position.x) > fieldXBounds) {
        if (Math.abs(player.position.z) > goalZBounds) {
          // Hit front wall or side net
          const xPen = Math.abs(player.position.x) - fieldXBounds;
          const zPen = Math.abs(player.position.z) - goalZBounds;

          if (xPen > zPen) {
            // Sliding against side net
            player.position.z = Math.sign(player.position.z) * goalZBounds;
            // Also clamp X to the back net
            player.position.x = Math.max(-maxGoalX, Math.min(maxGoalX, player.position.x));
          } else {
            // Sliding against front wall
            player.position.x = Math.sign(player.position.x) * fieldXBounds;
          }
        } else {
          // Inside goal opening, clamp to back net
          player.position.x = Math.max(-maxGoalX, Math.min(maxGoalX, player.position.x));
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
      this.ball.velocity.x ** 2 + this.ball.velocity.z ** 2
    );
    if (speed > BALL_MAX_SPEED) {
      const scale = BALL_MAX_SPEED / speed;
      this.ball.velocity.x *= scale;
      this.ball.velocity.z *= scale;
    }

    // Stop very slow ball
    if (speed < 0.1) {
      this.ball.velocity.x = 0;
      this.ball.velocity.z = 0;
    }

    // Move ball
    this.ball.position.x += this.ball.velocity.x * DT;
    this.ball.position.z += this.ball.velocity.z * DT;

    // Wall collisions (top/bottom)
    const halfH = FIELD_HEIGHT / 2 - BALL_RADIUS;
    if (this.ball.position.z > halfH) {
      this.ball.position.z = halfH;
      this.ball.velocity.z *= -WALL_BOUNCE;
    } else if (this.ball.position.z < -halfH) {
      this.ball.position.z = -halfH;
      this.ball.velocity.z *= -WALL_BOUNCE;
    }

    // Wall collisions (left/right — considering goal area)
    const fieldXBounds = FIELD_WIDTH / 2 - BALL_RADIUS;
    const goalZBounds = GOAL_WIDTH / 2 - BALL_RADIUS;
    const maxGoalX = FIELD_WIDTH / 2 + GOAL_DEPTH - BALL_RADIUS;

    if (Math.abs(this.ball.position.x) > fieldXBounds) {
      if (Math.abs(this.ball.position.z) > goalZBounds) {
        // Hit front wall or side net
        const xPen = Math.abs(this.ball.position.x) - fieldXBounds;
        const zPen = Math.abs(this.ball.position.z) - goalZBounds;
        
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
      }
    }
  }

  _checkPlayerBallCollisions() {
    const bx = this.ball.position.x;
    const bz = this.ball.position.z;
    let closestPlayerId = null;
    let closestDist = Infinity;

    for (const [id, player] of Object.entries(this.players)) {
      const dx = bx - player.position.x;
      const dz = bz - player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = PLAYER_RADIUS + BALL_RADIUS;

      if (dist < minDist && dist > 0.001) {
        // Separate ball from player
        const overlap = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;

        this.ball.position.x += nx * overlap;
        this.ball.position.z += nz * overlap;

        // Calculate kick force based on player velocity
        const playerSpeed = Math.sqrt(
          player.velocity.x ** 2 + player.velocity.z ** 2
        );
        const force = KICK_FORCE + playerSpeed * 0.8;

        this.ball.velocity.x = nx * force;
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
        const dz = b.position.z - a.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = PLAYER_RADIUS * 2;

        if (dist < minDist && dist > 0.001) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const nz = dz / dist;

          a.position.x -= nx * overlap;
          a.position.z -= nz * overlap;
          b.position.x += nx * overlap;
          b.position.z += nz * overlap;

          // Bounce velocities
          const dvx = a.velocity.x - b.velocity.x;
          const dvz = a.velocity.z - b.velocity.z;
          const dot = dvx * nx + dvz * nz;

          if (dot > 0) {
            a.velocity.x -= dot * nx * PLAYER_BOUNCE;
            a.velocity.z -= dot * nz * PLAYER_BOUNCE;
            b.velocity.x += dot * nx * PLAYER_BOUNCE;
            b.velocity.z += dot * nz * PLAYER_BOUNCE;
          }
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
    if (bx < -halfW && Math.abs(bz) < goalHalf) {
      this.room.onGoalScored('red', this._lastToucher);
      return;
    }

    // Goal in red side (right, x > halfW) → blue scores
    if (bx > halfW && Math.abs(bz) < goalHalf) {
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
      };
    }

    const snapshot = {
      tick: this.tick,
      players,
      ball: {
        position: { ...this.ball.position },
        velocity: { ...this.ball.velocity },
      },
      score: { ...this.room.score },
      timeRemaining: this.room.timeRemaining,
      gameState: this.room.gameState,
      countdown, // Sent during exactly the 'countdown' state
    };

    this.room.broadcastSnapshot(snapshot);
  }
}
