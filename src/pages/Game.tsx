import { Canvas } from '@react-three/fiber';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import GameScene from '../components/GameScene';
import MiniMap from '../components/MiniMap';
import { useGameInput } from '../hooks/useGameInput';
import { socket, usePing, useSnapshotBuffer } from '../hooks/useNetwork';
import { useSoundSettings } from '../hooks/useSoundSettings';
import type { GameSnapshot, RoomInfo, Team } from '../types';
import { AudioManager } from '../utils/AudioManager';

export default function Game() {
  const { t } = useTranslation();
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
  const [gameState, setGameState] = useState<string>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [goalInfo, setGoalInfo] = useState<{
    team: Team;
    scorer: string;
  } | null>(null);
  const [gameOver, setGameOver] = useState<{
    score: { blue: number; red: number };
    winner: string;
  } | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [boostCooldown, setBoostCooldown] = useState(0);
  const [activePowerUp, setActivePowerUp] = useState<{
    type: string;
    timeLeft: number;
  } | null>(null);
  const [speed, setSpeed] = useState(0);
  const [ping, setPing] = useState(0);
  const [, setShowControls] = useState(true);
  const [hostLeft, setHostLeft] = useState(false);
  const { isSoundEnabled, toggleSound } = useSoundSettings();

  // My team (from session)
  const myTeam = useRef<Team>('blue');

  // Format timer
  const timerDisplay = useMemo(() => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeRemaining]);

  useEffect(() => {
    // If not joined through lobby, go there first
    if (!sessionStorage.getItem(`in-room-${roomId}`)) {
      navigate(`/lobby/${roomId}`);
      return;
    }

    // Read custom pitch texture
    localStorage.getItem('bb-custom-pitch');

    // ---- Re-join room to associate this socket with the room on server ----
    const nickname = sessionStorage.getItem('bb-nickname') || 'Player';
    const rejoinRoom = () => {
      socket.emit(
        'join-room',
        { roomId, nickname },
        (res: {
          success: boolean;
          room?: { players: { id: string; team: string }[]; gameState: string };
        }) => {
          if (res.success && res.room) {
            const me = res.room.players.find(
              (p: { id: string }) => p.id === socket.id
            );
            if (me) {
              myTeam.current = me.team as Team;
            }
            setRoom(res.room as RoomInfo);
            if (res.room.gameState !== 'lobby') {
              socket.emit('enter-match');
            }
          }
        }
      );
    };

    // Join on mount
    rejoinRoom();

    // Re-join on reconnect (e.g. after server restart)
    socket.on('connect', rejoinRoom);

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

      // Detect powerup pickup
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
      if (isSoundEnabled) {
        AudioManager.playGoal();
      }
      setTimeout(() => setGoalInfo(null), 2000);
    };

    const handleGameEnded = (data: {
      score: { blue: number; red: number };
      winner: string;
    }) => {
      setGameOver(data);
    };

    const handleGameStart = (data: { countdown: number }) => {
      setCountdown(data.countdown);
      setGameState('countdown');
      setShowControls(false); // Force close the controls overlay so the countdown takes priority
    };

    const handleRoomDestroyed = () => {
      setHostLeft(true);
    };

    const handleRoomUpdate = (updatedRoom: RoomInfo) => {
      setRoom(updatedRoom);
    };

    socket.on('game-snapshot', handleSnapshot);
    socket.on('goal-scored', handleGoalScored);
    socket.on('game-ended', handleGameEnded);
    socket.on('game-start', handleGameStart);
    socket.on('room-destroyed', handleRoomDestroyed);
    socket.on('room-update', handleRoomUpdate);

    // ---- Send inputs at 20 Hz ----
    sendIntervalRef.current = window.setInterval(() => {
      const input = getInput();
      seqRef.current++;
      socket.volatile.emit('player-input', {
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
      socket.off('connect', rejoinRoom);
      socket.off('game-snapshot', handleSnapshot);
      socket.off('goal-scored', handleGoalScored);
      socket.off('game-ended', handleGameEnded);
      socket.off('game-start', handleGameStart);
      socket.off('room-destroyed', handleRoomDestroyed);
      socket.off('room-update', handleRoomUpdate);
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
      clearInterval(pingInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, push, getInput]);

  const handleBackToLobby = useCallback(() => {
    setGameOver(null);
    navigate(`/lobby/${roomId}`);
  }, [navigate, roomId]);

  const handleBackHome = useCallback(() => {
    socket.emit('leave-room');
    navigate('/');
  }, [navigate]);

  // Boost bar percentage (4s cooldown)
  const boostPercent = Math.max(
    0,
    Math.min(100, (1 - boostCooldown / 4) * 100)
  );

  const getPowerUpIcon = (type: string) => {
    switch (type) {
      case 'magnet':
        return '🧲';
      case 'freeze':
        return '🧊';
      case 'rocket':
        return '🚀';
      case 'frozen':
        return '❄️';
      default:
        return '⭐';
    }
  };

  const getPowerUpColor = (type: string) => {
    switch (type) {
      case 'magnet':
        return '#a855f7';
      case 'freeze':
        return '#38bdf8';
      case 'rocket':
        return '#f97316';
      case 'frozen':
        return '#87ceeb';
      default:
        return '#fbbf24';
    }
  };

  const getPowerUpName = (type: string) => {
    switch (type) {
      case 'magnet':
        return t('game.powerups.magnet');
      case 'freeze':
        return t('game.powerups.freeze');
      case 'rocket':
        return t('game.powerups.rocket');
      case 'frozen':
        return t('game.powerups.frozen');
      default:
        return t('game.powerups.generic');
    }
  };

  const getPowerUpDescription = (type: string) => {
    switch (type) {
      case 'magnet':
        return t('game.powerups.magnet_desc');
      case 'freeze':
        return t('game.powerups.freeze_desc');
      case 'rocket':
        return t('game.powerups.rocket_desc');
      case 'frozen':
        return t('game.powerups.frozen_desc');
      default:
        return t('game.powerups.generic_desc');
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
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <GameScene
            latestRef={latestRef}
            room={room}
            pitchTextureUrl={localStorage.getItem('bb-custom-pitch') || ''}
          />
        </Suspense>
      </Canvas>

      {/* HUD */}
      <div className="hud">
        <div className="hud-top">
          <div className="hud-score">
            <div className="hud-score-blue">{score.blue}</div>
            <div className="hud-score-divider" />
            <div className="hud-score-red">{score.red}</div>
          </div>
          <div className={`hud-timer ${timeRemaining < 30 ? 'warning' : ''}`}>
            {timerDisplay}
          </div>
        </div>

        <div className="hud-ping">{ping}ms</div>

        <button
          className="hud-sound-toggle"
          onClick={toggleSound}
          title="Toggle Sound"
        >
          {' '}
          {isSoundEnabled ? '🔊' : '🔇'}
        </button>

        {/* MiniMap */}
        <div className="hud-minimap-wrapper">
          <MiniMap latestRef={latestRef} />
        </div>

        {/* Speedometer */}
        <div className="hud-speedometer">
          <div className="hud-speed-value">{speed}</div>
          <div className="hud-speed-unit">{t('game.kph')}</div>
        </div>

        <div className="hud-boost">
          <div className="hud-boost-label">{t('game.boost')}</div>
          <div className="hud-boost-bar">
            <div
              className={`hud-boost-fill ${boostCooldown > 0 ? 'cooldown' : ''}`}
              style={{ width: `${boostPercent}%` }}
            />
          </div>
        </div>

        {/* Active PowerUp */}
        {activePowerUp ? (
          <div
            className="hud-powerup-container"
            style={
              {
                '--glow-color': getPowerUpColor(activePowerUp.type),
              } as React.CSSProperties
            }
          >
            <div className="hud-powerup-details">
              <div className="hud-powerup-name glow-text">
                {getPowerUpName(activePowerUp.type)}
              </div>
              <div className="hud-powerup-desc">
                {getPowerUpDescription(activePowerUp.type)}
              </div>
            </div>

            <div className="hud-powerup glow">
              <div className="hud-powerup-icon">
                {getPowerUpIcon(activePowerUp.type)}
              </div>
              <div className="hud-powerup-timer">
                {Math.ceil(activePowerUp.timeLeft)}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Countdown Overlay */}
      {gameState === 'countdown' ? (
        <div className="countdown-overlay">
          <div className="countdown-number">{countdown}</div>
        </div>
      ) : null}

      {/* Goal Scored Overlay */}
      {goalInfo ? (
        <div className="goal-overlay">
          <div className={`goal-text ${goalInfo.team}`}>
            {t('game.goal')}
            <div
              style={{ fontSize: '24px', marginTop: '8px', fontWeight: 500 }}
            >
              {goalInfo.scorer}
            </div>
          </div>
        </div>
      ) : null}

      {/* Game Over Overlay */}
      {gameOver && !hostLeft ? (
        <div className="gameover-overlay">
          <div className="gameover-card glass-card">
            <div className="gameover-title">{t('game.game_over')}</div>
            <div className="gameover-score">
              <span style={{ color: 'var(--blue-team)' }}>
                {gameOver.score.blue}
              </span>
              {' — '}
              <span style={{ color: 'var(--red-team)' }}>
                {gameOver.score.red}
              </span>
            </div>
            <div className="gameover-winner">
              {gameOver.winner === 'draw'
                ? t('game.draw')
                : t('game.wins', { team: t(`game.${gameOver.winner}`) })}
            </div>
            <div className="gameover-actions">
              <button className="btn btn-outline" onClick={handleBackHome}>
                {t('game.home')}
              </button>
              <button className="btn btn-primary" onClick={handleBackToLobby}>
                {t('game.back_to_lobby')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Host Left Overlay */}
      {hostLeft ? (
        <div className="gameover-overlay" style={{ zIndex: 1000 }}>
          <div className="gameover-card glass-card">
            <div
              className="gameover-title"
              style={{ color: '#ff4a4a', fontSize: '2rem' }}
            >
              {t('lobby.host_disconnected')}
            </div>
            <div
              style={{
                color: 'var(--text-secondary)',
                marginBottom: '24px',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              {t('game.host_disconnected_desc')}
            </div>
            <div
              className="gameover-actions"
              style={{ justifyContent: 'center' }}
            >
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                {t('lobby.return_home')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modern Controls Hint - Only shown during Countdown and early Game */}
      {gameState === 'countdown' ? (
        <div className="controls-hint-overlay">
          <div className="controls-hint-card">
            <h3>{t('game.how_to_play')}</h3>
            <div className="hint-row">
              <div className="hint-keys">
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd>
              </div>
              <span>{t('game.move_player')}</span>
            </div>
            <div className="hint-row">
              <div className="hint-keys">
                <kbd className="key-wide">{t('game.space')}</kbd>
              </div>
              <span>{t('game.jump')}</span>
            </div>
            <div className="hint-row">
              <div className="hint-keys">
                <kbd className="key-wide">{t('game.shift')}</kbd>
              </div>
              <span>{t('game.boost_dash')}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
