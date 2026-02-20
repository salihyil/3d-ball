import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GameScene from "../components/GameScene";
import MiniMap from "../components/MiniMap";
import { useGameInput } from "../hooks/useGameInput";
import { socket, usePing, useSnapshotBuffer } from "../hooks/useNetwork";
import type { GameSnapshot, RoomInfo, Team } from "../types";

export default function Game() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { getInput } = useGameInput();
  const { latestRef, push } = useSnapshotBuffer();
  const pingRef = usePing();
  const seqRef = useRef(0);
  const sendIntervalRef = useRef<number | null>(null);

  // Only these use React state (infrequent updates)
  const [score, setScore] = useState({ blue: 0, red: 0 });
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [gameState, setGameState] = useState<string>("countdown");
  const [countdown, setCountdown] = useState(3);
  const [goalInfo, setGoalInfo] = useState<{ team: Team; scorer: string } | null>(null);
  const [gameOver, setGameOver] = useState<{
    score: { blue: number; red: number };
    winner: string;
  } | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [boostCooldown, setBoostCooldown] = useState(0);
  const [activePowerUp, setActivePowerUp] = useState<{ type: string; timeLeft: number } | null>(
    null,
  );
  const [speed, setSpeed] = useState(0);
  const [ping, setPing] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [hostLeft, setHostLeft] = useState(false);

  // My team (from session)
  const myTeam = useRef<Team>("blue");

  // Format timer
  const timerDisplay = useMemo(() => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [timeRemaining]);

  useEffect(() => {
    // If not joined through lobby, go there first
    if (!sessionStorage.getItem(`in-room-${roomId}`)) {
      navigate(`/lobby/${roomId}`);
      return;
    }

    // ---- Re-join room to associate this socket with the room on server ----
    const nickname = sessionStorage.getItem("bb-nickname") || "Player";
    const rejoinRoom = () => {
      socket.emit(
        "join-room",
        { roomId, nickname },
        (res: {
          success: boolean;
          room?: { players: { id: string; team: string }[]; gameState: string };
        }) => {
          if (res.success && res.room) {
            const me = res.room.players.find((p: { id: string }) => p.id === socket.id);
            if (me) {
              myTeam.current = me.team as Team;
            }
            setRoom(res.room as RoomInfo);
            if (res.room.gameState !== "lobby") {
              socket.emit("enter-match");
            }
          }
        },
      );
    };

    // Join on mount
    rejoinRoom();

    // Re-join on reconnect (e.g. after server restart)
    socket.on("connect", rejoinRoom);

    // ---- Receive snapshots (update refs, minimal React state) ----
    const handleSnapshot = (snapshot: GameSnapshot) => {
      push(snapshot);

      // Update React state only for HUD values (throttled)
      setScore(snapshot.score);
      setTimeRemaining(snapshot.timeRemaining);
      setGameState(snapshot.gameState);

      if (snapshot.countdown !== undefined) {
        setCountdown(snapshot.countdown);
      }

      // Update my boost cooldown, powerup, speed and team identity
      const myState = snapshot.players[socket.id!];
      if (myState) {
        setBoostCooldown(myState.boostCooldown);
        setActivePowerUp(myState.activePowerUp || null);
        myTeam.current = myState.team;

        // Calculate and set speed (magnitude of velocity vector)
        const v = myState.velocity;
        const currentSpeed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        setSpeed(Math.round(currentSpeed));
      }
    };

    const handleGoalScored = (data: {
      team: Team;
      scorer: string;
      score: { blue: number; red: number };
    }) => {
      setGoalInfo(data);
      setScore(data.score);
      setTimeout(() => setGoalInfo(null), 2000);
    };

    const handleGameEnded = (data: { score: { blue: number; red: number }; winner: string }) => {
      setGameOver(data);
    };

    const handleGameStart = (data: { countdown: number }) => {
      setCountdown(data.countdown);
      setGameState("countdown");
      setShowControls(false); // Force close the controls overlay so the countdown takes priority
    };

    const handleRoomDestroyed = () => {
      setHostLeft(true);
    };

    const handleRoomUpdate = (updatedRoom: RoomInfo) => {
      setRoom(updatedRoom);
    };

    socket.on("game-snapshot", handleSnapshot);
    socket.on("goal-scored", handleGoalScored);
    socket.on("game-ended", handleGameEnded);
    socket.on("game-start", handleGameStart);
    socket.on("room-destroyed", handleRoomDestroyed);
    socket.on("room-update", handleRoomUpdate);

    // ---- Send inputs at 20 Hz ----
    sendIntervalRef.current = window.setInterval(() => {
      const input = getInput();
      seqRef.current++;
      socket.volatile.emit("player-input", {
        dx: input.dx,
        dz: input.dz,
        boost: input.boost,
        jump: input.jump,
        seq: seqRef.current,
      });
    }, 50); // 20 Hz

    // ---- Ping display update ----
    const pingInterval = setInterval(() => {
      setPing(pingRef.current);
    }, 3000);

    return () => {
      socket.off("connect", rejoinRoom);
      socket.off("game-snapshot", handleSnapshot);
      socket.off("goal-scored", handleGoalScored);
      socket.off("game-ended", handleGameEnded);
      socket.off("game-start", handleGameStart);
      socket.off("room-destroyed", handleRoomDestroyed);
      socket.off("room-update", handleRoomUpdate);
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
      clearInterval(pingInterval);
    };
  }, [roomId, getInput, push, pingRef]);

  const handleBackToLobby = useCallback(() => {
    setGameOver(null);
    navigate(`/lobby/${roomId}`);
  }, [navigate, roomId]);

  const handleBackHome = useCallback(() => {
    socket.emit("leave-room");
    navigate("/");
  }, [navigate]);

  // Boost bar percentage (4s cooldown)
  const boostPercent = Math.max(0, Math.min(100, (1 - boostCooldown / 4) * 100));

  const getPowerUpIcon = (type: string) => {
    switch (type) {
      case "magnet":
        return "🧲";
      case "freeze":
        return "🧊";
      case "rocket":
        return "🚀";
      case "frozen":
        return "❄️";
      default:
        return "⭐";
    }
  };

  const getPowerUpColor = (type: string) => {
    switch (type) {
      case "magnet":
        return "#a855f7";
      case "freeze":
        return "#38bdf8";
      case "rocket":
        return "#f97316";
      case "frozen":
        return "#87ceeb";
      default:
        return "#fbbf24";
    }
  };

  const getPowerUpName = (type: string) => {
    switch (type) {
      case "magnet":
        return "Magnet";
      case "freeze":
        return "Freeze";
      case "rocket":
        return "Rocket Kick";
      case "frozen":
        return "Frozen!";
      default:
        return "Power-up";
    }
  };

  const getPowerUpDescription = (type: string) => {
    switch (type) {
      case "magnet":
        return "Pulls the ball towards you";
      case "freeze":
        return "Freezes opponents instantly";
      case "rocket":
        return "Massive force on next hit";
      case "frozen":
        return "You are stuck in ice!";
      default:
        return "Special effect active";
    }
  };

  return (
    <div className="game-container">
      {/* 3D Canvas */}
      <Canvas
        className="game-canvas"
        camera={{ fov: 60, near: 0.1, far: 500, position: [0, 30, 40] }}
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}>
        <GameScene
          latestRef={latestRef}
          room={room}
        />
      </Canvas>

      {/* HUD */}
      <div className="hud">
        <div className="hud-top">
          <div className="hud-score">
            <div className="hud-score-blue">{score.blue}</div>
            <div className="hud-score-divider" />
            <div className="hud-score-red">{score.red}</div>
          </div>
          <div className={`hud-timer ${timeRemaining < 30 ? "warning" : ""}`}>{timerDisplay}</div>
        </div>

        <div className="hud-ping">{ping}ms</div>

        {/* MiniMap */}
        <div className="hud-minimap-wrapper">
          <MiniMap latestRef={latestRef} />
        </div>

        {/* Speedometer */}
        <div className="hud-speedometer">
          <div className="hud-speed-value">{speed}</div>
          <div className="hud-speed-unit">KPH</div>
        </div>

        <div className="hud-boost">
          <div className="hud-boost-label">Boost</div>
          <div className="hud-boost-bar">
            <div
              className={`hud-boost-fill ${boostCooldown > 0 ? "cooldown" : ""}`}
              style={{ width: `${boostPercent}%` }}
            />
          </div>
        </div>

        {/* Active PowerUp */}
        {activePowerUp && (
          <div
            className="hud-powerup-container"
            style={{ "--glow-color": getPowerUpColor(activePowerUp.type) } as React.CSSProperties}>
            <div className="hud-powerup-details">
              <div className="hud-powerup-name glow-text">{getPowerUpName(activePowerUp.type)}</div>
              <div className="hud-powerup-desc">{getPowerUpDescription(activePowerUp.type)}</div>
            </div>

            <div className="hud-powerup glow">
              <div className="hud-powerup-icon">{getPowerUpIcon(activePowerUp.type)}</div>
              <div className="hud-powerup-timer">{Math.ceil(activePowerUp.timeLeft)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Countdown Overlay */}
      {gameState === "countdown" && (
        <div className="countdown-overlay">
          <div className="countdown-number">{countdown}</div>
        </div>
      )}

      {/* Goal Scored Overlay */}
      {goalInfo && (
        <div className="goal-overlay">
          <div className={`goal-text ${goalInfo.team}`}>
            GOAL!
            <div style={{ fontSize: "24px", marginTop: "8px", fontWeight: 500 }}>
              {goalInfo.scorer}
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && !hostLeft && (
        <div className="gameover-overlay">
          <div className="gameover-card glass-card">
            <div className="gameover-title">Game Over</div>
            <div className="gameover-score">
              <span style={{ color: "var(--blue-team)" }}>{gameOver.score.blue}</span>
              {" — "}
              <span style={{ color: "var(--red-team)" }}>{gameOver.score.red}</span>
            </div>
            <div className="gameover-winner">
              {gameOver.winner === "draw"
                ? "Draw!"
                : `${gameOver.winner === "blue" ? "Blue" : "Red"} Team Wins! 🏆`}
            </div>
            <div className="gameover-actions">
              <button
                className="btn btn-outline"
                onClick={handleBackHome}>
                Home
              </button>
              <button
                className="btn btn-primary"
                onClick={handleBackToLobby}>
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Host Left Overlay */}
      {hostLeft && (
        <div
          className="gameover-overlay"
          style={{ zIndex: 1000 }}>
          <div className="gameover-card glass-card">
            <div
              className="gameover-title"
              style={{ color: "#ff4a4a", fontSize: "2rem" }}>
              Host Disconnected
            </div>
            <div
              style={{
                color: "var(--text-secondary)",
                marginBottom: "24px",
                textAlign: "center",
                lineHeight: 1.5,
              }}>
              The host has unexpectedly left the game or their connection dropped. The room is now
              closed.
            </div>
            <div
              className="gameover-actions"
              style={{ justifyContent: "center" }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/")}>
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Controls Hint - Only shown during Countdown and early Game */}
      {gameState === "countdown" && (
        <div className="controls-hint-overlay">
          <div className="controls-hint-card">
            <h3>How to Play</h3>
            <div className="hint-row">
              <div className="hint-keys">
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd>
              </div>
              <span>Move player</span>
            </div>
            <div className="hint-row">
              <div className="hint-keys">
                <kbd className="key-wide">Spacebar</kbd>
              </div>
              <span>Jump</span>
            </div>
            <div className="hint-row">
              <div className="hint-keys">
                <kbd className="key-wide">Shift</kbd>
              </div>
              <span>Boost Dash</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
