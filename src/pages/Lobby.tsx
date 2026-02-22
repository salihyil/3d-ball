import { OrbitControls, Stage } from '@react-three/drei';
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
import Chat from '../components/Chat';
import { BoostPads, Field, Obstacles } from '../components/GameScene/index';
import LanguageSelector from '../components/LanguageSelector';
import FieldCustomizer from '../components/Lobby/FieldCustomizer';
import RoomLink from '../components/Lobby/RoomLink';
import TeamPanel from '../components/Lobby/TeamPanel';
import { socket } from '../hooks/useNetwork';
import { useSoundSettings } from '../hooks/useSoundSettings';
import type { GameSnapshot, RoomInfo, Team } from '../types';

const SAMPLE_TEXTURES = [
  { id: 'default', name: 'Default Green', url: '' },
  { id: 'grass', name: 'Lush Grass', url: '/textures/grass.png' },
  { id: 'cyber', name: 'Cyber Grid', url: '/textures/cyber.png' },
  { id: 'sand', name: 'Desert Sand', url: '/textures/sand.png' },
];

export default function Lobby() {
  const { t } = useTranslation();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [hostLeft, setHostLeft] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const { isSoundEnabled, toggleSound } = useSoundSettings();

  const [pitchTexture, setPitchTexture] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dummyLatestRef = useRef<GameSnapshot | null>(null);

  useEffect(() => {
    const nickname = sessionStorage.getItem('bb-nickname');
    if (!nickname) {
      navigate(`/?join=${roomId}`);
      return;
    }

    const hostToken = sessionStorage.getItem(`host-token-${roomId}`);

    socket.emit(
      'join-room',
      { roomId: roomId!, nickname, hostToken },
      (res: { success: boolean; error?: string; room?: RoomInfo }) => {
        if (res.room) {
          setRoom(res.room);
        } else if (res.error === 'Room not found') {
          navigate('/');
        }
      }
    );

    const handleRoomUpdate = (roomInfo: RoomInfo) => setRoom(roomInfo);
    const handleGameStart = () => {
      sessionStorage.setItem(`in-room-${roomId}`, 'true');
      navigate(`/game/${roomId}`);
    };
    const handleRoomDestroyed = () => setHostLeft(true);
    const handleKicked = () => setIsKicked(true);

    socket.on('room-update', handleRoomUpdate);
    socket.on('game-start', handleGameStart);
    socket.on('room-destroyed', handleRoomDestroyed);
    socket.on('kicked', handleKicked);

    return () => {
      socket.off('room-update', handleRoomUpdate);
      socket.off('game-start', handleGameStart);
      socket.off('room-destroyed', handleRoomDestroyed);
      socket.off('kicked', handleKicked);
    };
  }, [roomId, navigate]);

  const handleSwitchTeam = useCallback((team: Team) => {
    socket.emit(
      'switch-team',
      { team },
      (res: { error?: string; success?: boolean }) => {
        if (res.error) alert(res.error);
      }
    );
  }, []);

  const handleStart = useCallback(() => socket.emit('start-game'), []);
  const handleKick = useCallback((targetId: string) => {
    socket.emit('kick-player', { targetId });
  }, []);
  const handleLeave = useCallback(() => {
    socket.emit('leave-room');
    navigate('/');
  }, [navigate]);

  const handleToggleFeatures = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      socket.emit('toggle-features', { enableFeatures: e.target.checked });
    },
    []
  );

  const isHost = useMemo(() => room?.hostId === socket.id, [room?.hostId]);

  const handleTextureSelect = useCallback(
    (url: string) => {
      if (!isHost) return;
      setPitchTexture(url);
      localStorage.setItem('bb-custom-pitch', url || 'none');
      socket.emit('set-field-texture', { fieldTexture: url });
    },
    [isHost]
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isHost) {
      handleTextureSelect(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    if (
      room?.fieldTexture !== undefined &&
      room.fieldTexture !== pitchTexture
    ) {
      setPitchTexture(room.fieldTexture);
    }
  }, [room?.fieldTexture, pitchTexture]);

  if (hostLeft) {
    return (
      <>
        <div className="bg-animated" />
        <div className="page-center">
          <div
            className="glass-card animate-in text-center"
            style={{ padding: '40px', maxWidth: '400px' }}
          >
            <h2 style={{ color: '#ff4a4a', marginBottom: '16px' }}>
              {t('lobby.host_disconnected')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {t('lobby.host_disconnected_desc')}
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => navigate('/')}
            >
              {t('lobby.return_home')}
            </button>
          </div>
        </div>
      </>
    );
  }

  if (isKicked) {
    return (
      <>
        <div className="bg-animated" />
        <div className="page-center">
          <div
            className="glass-card animate-in text-center"
            style={{ padding: '40px', maxWidth: '400px' }}
          >
            <h2 style={{ color: '#ff4a4a', marginBottom: '16px' }}>
              {t('lobby.kicked_title')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {t('lobby.kicked_desc')}
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => navigate('/')}
            >
              {t('lobby.return_home')}
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!room) {
    return (
      <>
        <div className="bg-animated" />
        <div className="page-center">
          <p style={{ color: 'var(--text-secondary)' }}>
            {t('lobby.connecting')}
          </p>
        </div>
      </>
    );
  }

  const bluePlayers = room.players.filter((p) => p.team === 'blue');
  const redPlayers = room.players.filter((p) => p.team === 'red');

  return (
    <>
      <div className="bg-animated" />
      <div className="page-center">
        <div className="lobby-container" style={{ maxWidth: '1100px' }}>
          <div
            className="glass-card animate-in"
            style={{ padding: '32px', margin: '0 auto' }}
          >
            <div className="noise-overlay" />
            <div className="lobby-header" style={{ marginBottom: '24px' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <h2 className="lobby-title" style={{ fontSize: '24px' }}>
                  {t('lobby.title')}
                </h2>
                <LanguageSelector />
              </div>
              <RoomLink roomId={roomId!} />
              <button
                className="btn btn-outline"
                style={{ marginLeft: '8px', padding: '8px', width: '40px' }}
                onClick={toggleSound}
                title="Toggle Sound"
              >
                {isSoundEnabled ? '🔊' : '🔇'}
              </button>
            </div>

            <div
              className="lobby-teams animate-in"
              style={{ animationDelay: '0.1s' }}
              data-testid="teams-grid"
            >
              <TeamPanel
                team="blue"
                players={bluePlayers}
                onJoin={handleSwitchTeam}
                onKick={handleKick}
                isHostUser={isHost}
              />
              <TeamPanel
                team="red"
                players={redPlayers}
                onJoin={handleSwitchTeam}
                onKick={handleKick}
                isHostUser={isHost}
              />
            </div>

            <div
              className="lobby-content-grid animate-in"
              style={{ animationDelay: '0.2s' }}
            >
              <div className="lobby-content-left">
                <Chat />
              </div>

              <div className="lobby-content-right">
                <div className="lobby-settings">
                  <span className="label">{t('lobby.duration')}</span>
                  <span className="mono" style={{ color: 'var(--accent)' }}>
                    {room.matchDuration} min
                  </span>
                  <span style={{ flex: 1 }} />
                  <span
                    className="label"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('lobby.players_count', { count: room.players.length })}
                  </span>
                </div>

                <div className="feature-toggle-container">
                  <input
                    type="checkbox"
                    id="enableFeatures"
                    checked={room.enableFeatures !== false}
                    onChange={handleToggleFeatures}
                    disabled={!isHost}
                  />
                  <label htmlFor="enableFeatures" className="label">
                    {t('lobby.features_label')}
                  </label>
                </div>

                <FieldCustomizer
                  textures={SAMPLE_TEXTURES}
                  pitchTexture={pitchTexture}
                  isHost={isHost}
                  onSelect={handleTextureSelect}
                  onUpload={handleFileUpload}
                  fileInputRef={fileInputRef}
                />

                <div className="preview-canvas-container">
                  <div className="noise-overlay" style={{ opacity: 0.1 }} />
                  <div className="scan-line" />
                  <div className="preview-label">
                    {t('lobby.field_preview')}
                  </div>
                  <Canvas camera={{ position: [20, 20, 20], fov: 45 }}>
                    <Suspense fallback={null}>
                      <ambientLight intensity={0.5} />
                      <pointLight position={[10, 10, 10]} intensity={1} />
                      <Stage environment="city" intensity={0.5}>
                        <Field textureUrl={pitchTexture} />
                        {room.enableFeatures !== false && (
                          <>
                            <Obstacles latestRef={dummyLatestRef} />
                            <BoostPads latestRef={dummyLatestRef} />
                          </>
                        )}
                      </Stage>
                      <OrbitControls
                        autoRotate
                        autoRotateSpeed={0.5}
                        enableZoom={false}
                        enablePan={false}
                        maxPolarAngle={Math.PI / 2.1}
                      />
                    </Suspense>
                  </Canvas>
                </div>
              </div>
            </div>

            <div
              className="lobby-actions animate-in"
              style={{ marginTop: '32px', animationDelay: '0.3s' }}
            >
              <button className="btn btn-outline" onClick={handleLeave}>
                {t('lobby.leave')}
              </button>
              {room.gameState !== 'lobby' ? (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    sessionStorage.setItem(`in-room-${roomId}`, 'true');
                    socket.emit('enter-match');
                    navigate(`/game/${roomId}`);
                  }}
                >
                  {t('lobby.enter_match')}
                </button>
              ) : isHost ? (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    sessionStorage.setItem(`in-room-${roomId}`, 'true');
                    handleStart();
                  }}
                  data-testid="start-game-btn"
                >
                  {t('lobby.start_game')}
                </button>
              ) : (
                <div className="waiting-host-msg">
                  {t('lobby.waiting_host')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .feature-toggle-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(0,0,0,0.2);
          borderRadius: 8px;
          margin-bottom: 16px;
        }
        .preview-canvas-container {
          height: 200px;
          background: #050508;
          border-radius: var(--radius-md);
          overflow: hidden;
          position: relative;
          border: 1px solid var(--border-glass);
          box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
        }
        .scan-line {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          z-index: 5;
          animation: scan 3s linear infinite;
          opacity: 0.3;
        }
        .preview-label {
          position: absolute;
          top: 12px;
          left: 12px;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 10px;
          z-index: 10;
          pointer-events: none;
          font-family: var(--font-display);
          color: var(--accent);
          border-left: 2px solid var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .waiting-host-msg {
          flex: 1;
          text-align: center;
          color: var(--text-muted);
          padding: 12px;
        }
        @keyframes scan {
          from { top: 0; }
          to { top: 100%; }
        }
      `}</style>
    </>
  );
}
