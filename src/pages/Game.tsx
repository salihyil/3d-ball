import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import Chat from '../components/Chat';
import GameScene from '../components/GameScene';
import CountdownOverlay from '../components/HUD/CountdownOverlay';
import GameOverOverlay from '../components/HUD/GameOverOverlay';
import GoalOverlay from '../components/HUD/GoalOverlay';
import { HUD } from '../components/HUD/HUD';
import MiniMap from '../components/MiniMap';
import { useGameInput } from '../hooks/useGameInput';
import { socket, usePing, useSnapshotBuffer } from '../hooks/useNetwork';
import { useSoundSettings } from '../hooks/useSoundSettings';
import type {
  GameSnapshot,
  PlayerInfo,
  PlayerState,
  RoomInfo,
  Team,
} from '../types';
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
  const [activePowerUp, setActivePowerUp] = useState<
    PlayerState['activePowerUp'] | null
  >(null);
  const [speed, setSpeed] = useState(0);
  const [ping, setPing] = useState(0);
  const [hostLeft, setHostLeft] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const { isSoundEnabled, toggleSound } = useSoundSettings();

  const myTeam = useRef<Team>('blue');

  useEffect(() => {
    if (!sessionStorage.getItem(`in-room-${roomId}`)) {
      navigate(`/lobby/${roomId}`);
      return;
    }

    const rejoinRoom = () => {
      const nickname = sessionStorage.getItem('bb-nickname') || 'Player';
      const hostToken = sessionStorage.getItem(`host-token-${roomId}`);
      socket.emit(
        'join-room',
        { roomId: roomId!, nickname, hostToken },
        (res: { success: boolean; error?: string; room?: RoomInfo }) => {
          if (res.success && res.room) {
            const me = res.room.players.find(
              (p: PlayerInfo) => p.id === socket.id
            );
            if (me) myTeam.current = me.team as Team;
            setRoom(res.room as RoomInfo);
            setIsDisconnected(false); // Hide overlay ONLY on success
            if (res.room.gameState !== 'lobby') socket.emit('enter-match');
          }
        }
      );
    };

    rejoinRoom();
    socket.on('connect', rejoinRoom);

    const handleSnapshot = (snapshot: GameSnapshot) => {
      push(snapshot);
      setScore(snapshot.score);
      setTimeRemaining(snapshot.timeRemaining);
      setGameState(snapshot.gameState);
      if (snapshot.countdown !== undefined) setCountdown(snapshot.countdown);

      const myState = snapshot.players[socket.id!];
      if (myState) {
        setBoostCooldown(myState.boostCooldown);
        setActivePowerUp(myState.activePowerUp || null);
        myTeam.current = myState.team;
        const v = myState.velocity;
        setSpeed(Math.round(Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)));
      }
    };

    const handleGoalScored = (data: {
      team: Team;
      scorer: string;
      score: { blue: number; red: number };
    }) => {
      setGoalInfo(data);
      setScore(data.score);
      if (isSoundEnabled) AudioManager.playGoal();
      setTimeout(() => setGoalInfo(null), 2000);
    };

    const handleGameEnded = (data: {
      score: { blue: number; red: number };
      winner: Team | 'draw';
    }) => setGameOver(data);
    const handleGameStart = (data: { countdown: number }) => {
      setCountdown(data.countdown);
      setGameState('countdown');
    };
    const handleRoomDestroyed = () => setHostLeft(true);
    const handleRoomUpdate = (updatedRoom: RoomInfo) => setRoom(updatedRoom);
    const handleSocketDisconnect = () => setIsDisconnected(true);
    const handleSocketConnect = () => {
      // setIsDisconnected(false); // REMOVED: Wait for rejoinRoom ACK
      rejoinRoom();
    };

    socket.on('game-snapshot', handleSnapshot);
    socket.on('goal-scored', handleGoalScored);
    socket.on('game-ended', handleGameEnded);
    socket.on('game-start', handleGameStart);
    socket.on('room-destroyed', handleRoomDestroyed);
    socket.on('room-update', handleRoomUpdate);
    window.addEventListener('socket-disconnect', handleSocketDisconnect);
    socket.on('connect', handleSocketConnect);

    sendIntervalRef.current = window.setInterval(() => {
      const input = getInput();
      seqRef.current++;
      socket.volatile.emit('player-input', { ...input, seq: seqRef.current });
    }, 50);

    const pingInterval = setInterval(() => setPing(pingRef.current), 3000);

    return () => {
      socket.off('connect', rejoinRoom);
      socket.off('game-snapshot', handleSnapshot);
      socket.off('goal-scored', handleGoalScored);
      socket.off('game-ended', handleGameEnded);
      socket.off('game-start', handleGameStart);
      socket.off('room-destroyed', handleRoomDestroyed);
      socket.off('room-update', handleRoomUpdate);
      window.removeEventListener('socket-disconnect', handleSocketDisconnect);
      socket.off('connect', handleSocketConnect);
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
      clearInterval(pingInterval);
    };
  }, [roomId, push, getInput, isSoundEnabled, navigate, pingRef]);

  const handleBackToLobby = useCallback(() => {
    setGameOver(null);
    navigate(`/lobby/${roomId}`);
  }, [navigate, roomId]);

  const handleBackHome = useCallback(() => {
    socket.emit('leave-room');
    navigate('/');
  }, [navigate]);

  const boostPercent = Math.max(
    0,
    Math.min(100, (1 - boostCooldown / 4) * 100)
  );

  return (
    <div className="game-container">
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
            pitchTextureUrl={room?.fieldTexture || ''}
          />
        </Suspense>
      </Canvas>

      <HUD.Root
        value={{
          score,
          timeRemaining,
          speed,
          boostPercent,
          boostCooldown,
          ping,
          activePowerUp,
          isSoundEnabled,
          toggleSound,
        }}
      >
        <HUD.ScoreAndTimer />
        <HUD.Ping />
        <HUD.SoundToggle />
        <div className="hud-minimap-wrapper">
          <MiniMap latestRef={latestRef} />
        </div>
        <HUD.Speedometer />
        <HUD.BoostBar />
        <HUD.PowerUp />
        <Chat isGameOverlay />
      </HUD.Root>

      {gameState === 'countdown' && <CountdownOverlay countdown={countdown} />}
      {goalInfo && <GoalOverlay goalInfo={goalInfo} />}
      {gameOver && !hostLeft && (
        <GameOverOverlay
          gameOver={gameOver}
          onBackHome={handleBackHome}
          onBackToLobby={handleBackToLobby}
        />
      )}

      {hostLeft && (
        <div className="gameover-overlay" style={{ zIndex: 1000 }}>
          <div className="gameover-card glass-card">
            <div
              className="gameover-title"
              style={{ color: '#ff4a4a', fontSize: '2rem' }}
            >
              {t('lobby.host_disconnected')}
            </div>
            <div className="host-left-desc">
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
      )}

      {isDisconnected && (
        <div className="gameover-overlay" style={{ zIndex: 1100 }}>
          <div className="gameover-card glass-card">
            <div
              className="gameover-title"
              style={{ color: '#ff4a4a', fontSize: '2rem' }}
            >
              {t('lobby.connection_lost') || 'Connection Lost'}
            </div>
            <div className="host-left-desc">
              {t('lobby.connection_lost_desc') ||
                'Your connection to the server was interrupted.'}
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
      )}

      {gameState === 'countdown' && (
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
      )}
      <style>{`
        .host-left-desc {
          color: var(--text-secondary);
          margin-bottom: 24px;
          text-align: center;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
