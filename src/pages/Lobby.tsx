import { OrbitControls, Stage } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import Chat from '../components/Chat';
import { BoostPads, Field, Obstacles } from '../components/GameScene';
import LanguageSelector from '../components/LanguageSelector';
import { socket } from '../hooks/useNetwork';
import { useSoundSettings } from '../hooks/useSoundSettings';
import type { GameSnapshot, PlayerInfo, RoomInfo, Team } from '../types';

const SAMPLE_TEXTURES = [
  { id: 'default', name: 'Default Green', url: '' },
  {
    id: 'grass',
    name: 'Lush Grass',
    url: '/textures/grass.png',
  },
  {
    id: 'cyber',
    name: 'Cyber Grid',
    url: '/textures/cyber.png',
  },
  {
    id: 'sand',
    name: 'Desert Sand',
    url: '/textures/sand.png',
  },
];

export default function Lobby() {
  const { t } = useTranslation();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [hostLeft, setHostLeft] = useState(false);
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

    const handleRoomUpdate = (roomInfo: RoomInfo) => {
      setRoom(roomInfo);
    };

    const handleGameStart = () => {
      sessionStorage.setItem(`in-room-${roomId}`, 'true');
      navigate(`/game/${roomId}`);
    };

    const handleRoomDestroyed = () => {
      setHostLeft(true);
    };

    socket.on('room-update', handleRoomUpdate);
    socket.on('game-start', handleGameStart);
    socket.on('room-destroyed', handleRoomDestroyed);

    return () => {
      socket.off('room-update', handleRoomUpdate);
      socket.off('game-start', handleGameStart);
      socket.off('room-destroyed', handleRoomDestroyed);
    };
  }, [roomId, navigate]);

  const handleSwitchTeam = useCallback((team: Team) => {
    socket.emit(
      'switch-team',
      { team },
      (res: { error?: string; success?: boolean }) => {
        if (res.error) {
          alert(res.error);
        }
      }
    );
  }, []);

  const handleStart = useCallback(() => {
    socket.emit('start-game');
  }, []);

  const handleLeave = useCallback(() => {
    socket.emit('leave-room');
    navigate('/');
  }, [navigate]);

  const handleToggleFeatures = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const enabled = e.target.checked;
      socket.emit('toggle-features', { enableFeatures: enabled });
    },
    []
  );

  const handleCopyLink = useCallback(() => {
    const link = `${window.location.origin}/lobby/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomId]);

  const myId = socket.id;
  const isHost = room?.hostId === myId;

  const handleTextureSelect = (url: string) => {
    if (!isHost) return;
    setPitchTexture(url);
    if (!url || url === '' || url === 'none') {
      localStorage.setItem('bb-custom-pitch', 'none');
    } else {
      localStorage.setItem('bb-custom-pitch', url);
    }
    socket.emit('set-field-texture', { fieldTexture: url });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost) return;
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      handleTextureSelect(url);
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

  const bluePlayers = room.players.filter((p: PlayerInfo) => p.team === 'blue');
  const redPlayers = room.players.filter((p: PlayerInfo) => p.team === 'red');
  const canStart = true; // Allow 1-player games

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
              <div className="lobby-room-code">
                <span data-testid="room-code" className="lobby-code">
                  {roomId}
                </span>
                <button
                  className="btn btn-outline lobby-copy-btn"
                  onClick={handleCopyLink}
                  data-testid="copy-link-btn"
                >
                  {copied ? t('lobby.copied') : t('lobby.copy_link')}
                </button>
              </div>
              <button
                className="btn btn-outline"
                style={{ marginLeft: '8px', padding: '8px', width: '40px' }}
                onClick={toggleSound}
                title="Toggle Sound"
              >
                {isSoundEnabled ? '🔊' : '🔇'}
              </button>
            </div>

            {/* Teams Grid */}
            <div
              className="lobby-teams animate-in"
              style={{ animationDelay: '0.1s' }}
              data-testid="teams-grid"
            >
              {/* Blue Team */}
              <div className="team-panel blue" data-testid="team-blue">
                <div
                  className="team-title"
                  style={{ color: 'var(--blue-team)' }}
                >
                  <div
                    className="team-dot"
                    style={{
                      backgroundColor: 'var(--blue-team)',
                      boxShadow: '0 0 10px var(--blue-team)',
                    }}
                  />
                  {t('lobby.blue_team', { count: bluePlayers.length })}
                </div>
                <div className="team-players">
                  {bluePlayers.map((p: PlayerInfo) => (
                    <div key={p.id} className="team-player">
                      <span className="mono">{p.nickname}</span>
                      {p.isHost && (
                        <span className="host-badge" data-testid="host-badge">
                          {t('common.host')}
                        </span>
                      )}
                      {p.id === socket.id && (
                        <span className="you-badge">{t('common.you')}</span>
                      )}
                    </div>
                  ))}
                  {bluePlayers.length === 0 && (
                    <div
                      className="team-player"
                      style={{ opacity: 0.3, fontStyle: 'italic' }}
                    >
                      {t('lobby.empty_team')}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-blue"
                  style={{ marginTop: '20px', width: '100%' }}
                  onClick={() => handleSwitchTeam('blue')}
                  data-testid="join-blue-btn"
                  disabled={
                    bluePlayers.find((p: PlayerInfo) => p.id === socket.id)
                      ?.team === 'blue' || bluePlayers.length >= 5
                  }
                >
                  {bluePlayers.length >= 5
                    ? t('lobby.team_full')
                    : t('lobby.join_blue')}
                </button>
              </div>

              {/* Red Team */}
              <div className="team-panel red" data-testid="team-red">
                <div
                  className="team-title"
                  style={{ color: 'var(--red-team)' }}
                >
                  <div
                    className="team-dot"
                    style={{
                      backgroundColor: 'var(--red-team)',
                      boxShadow: '0 0 10px var(--red-team)',
                    }}
                  />
                  {t('lobby.red_team', { count: redPlayers.length })}
                </div>
                <div className="team-players">
                  {redPlayers.map((p: PlayerInfo) => (
                    <div key={p.id} className="team-player">
                      <span className="mono">{p.nickname}</span>
                      {p.isHost && (
                        <span className="host-badge" data-testid="host-badge">
                          {t('common.host')}
                        </span>
                      )}
                      {p.id === socket.id && (
                        <span className="you-badge">{t('common.you')}</span>
                      )}
                    </div>
                  ))}
                  {redPlayers.length === 0 && (
                    <div
                      className="team-player"
                      style={{ opacity: 0.3, fontStyle: 'italic' }}
                    >
                      {t('lobby.empty_team')}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-red"
                  style={{ marginTop: '20px', width: '100%' }}
                  onClick={() => handleSwitchTeam('red')}
                  data-testid="join-red-btn"
                  disabled={
                    redPlayers.find((p: PlayerInfo) => p.id === socket.id)
                      ?.team === 'red' || redPlayers.length >= 5
                  }
                >
                  {redPlayers.length >= 5
                    ? t('lobby.team_full')
                    : t('lobby.join_red')}
                </button>
              </div>
            </div>

            {/* Side-by-Side Layout for Chat and Controls */}
            <div
              className="lobby-content-grid animate-in"
              style={{ animationDelay: '0.2s' }}
            >
              <div className="lobby-content-left">
                <Chat />
              </div>

              <div className="lobby-content-right">
                {/* Settings + Actions */}
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

                {/* Feature Customization */}
                <div
                  style={{
                    marginTop: '0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <input
                    type="checkbox"
                    id="enableFeatures"
                    data-testid="features-checkbox"
                    checked={room.enableFeatures !== false}
                    onChange={handleToggleFeatures}
                    disabled={!isHost}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: isHost ? 'pointer' : 'default',
                    }}
                  />
                  <label
                    htmlFor="enableFeatures"
                    className="label"
                    style={{
                      marginBottom: 0,
                      cursor: isHost ? 'pointer' : 'default',
                    }}
                  >
                    {t('lobby.features_label')}
                  </label>
                </div>

                {/* Field Customization */}
                <div
                  className="lobby-customization"
                  style={{
                    marginTop: '0',
                    padding: '16px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      marginBottom: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span className="label">{t('lobby.field_texture')}</span>
                    <button
                      className="btn btn-outline"
                      style={{
                        fontSize: '12px',
                        padding: '4px 8px',
                        opacity: isHost ? 1 : 0.5,
                        cursor: isHost ? 'pointer' : 'not-allowed',
                      }}
                      onClick={() => isHost && fileInputRef.current?.click()}
                      disabled={!isHost}
                    >
                      {t('lobby.upload_custom')}
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      overflowX: 'auto',
                      paddingBottom: '8px',
                    }}
                  >
                    {SAMPLE_TEXTURES.map((texture) => (
                      <div
                        key={texture.id}
                        onClick={() => handleTextureSelect(texture.url)}
                        style={{
                          cursor: isHost ? 'pointer' : 'default',
                          width: '60px',
                          height: '40px',
                          borderRadius: '4px',
                          border:
                            pitchTexture === texture.url
                              ? '2px solid #ffaa00'
                              : '2px solid transparent',
                          background: texture.url
                            ? `url(${texture.url}) center/cover`
                            : 'var(--field-color, #1a5c2a)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                          flexShrink: 0,
                        }}
                        title={texture.name}
                      >
                        {!texture.url ? 'Default' : null}
                      </div>
                    ))}

                    {pitchTexture &&
                    !SAMPLE_TEXTURES.find((t) => t.url === pitchTexture) ? (
                      <div
                        style={{
                          cursor: 'pointer',
                          width: '60px',
                          height: '40px',
                          borderRadius: '4px',
                          border: '2px solid var(--accent)',
                          background: `url(${pitchTexture}) center/cover`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          flexShrink: 0,
                        }}
                        title="Custom Upload"
                      />
                    ) : null}
                  </div>
                </div>

                {/* 3D Preview Section */}
                <div
                  style={{
                    marginTop: '0',
                    height: '200px',
                    background: '#050508',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid var(--border-glass)',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
                  }}
                >
                  <div className="noise-overlay" style={{ opacity: 0.1 }} />
                  {/* Scanning Line Animation */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '2px',
                      background:
                        'linear-gradient(90deg, transparent, var(--accent), transparent)',
                      zIndex: 5,
                      animation: 'scan 3s linear infinite',
                      opacity: 0.3,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      background: 'rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(4px)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      zIndex: 10,
                      pointerEvents: 'none',
                      fontFamily: 'var(--font-display)',
                      color: 'var(--accent)',
                      borderLeft: '2px solid var(--accent)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {t('lobby.field_preview')}
                  </div>
                  <Canvas camera={{ position: [20, 20, 20], fov: 45 }}>
                    <Suspense fallback={null}>
                      <ambientLight intensity={0.5} />
                      <pointLight position={[10, 10, 10]} intensity={1} />
                      <Stage environment="city" intensity={0.5}>
                        <Field textureUrl={pitchTexture} />
                        {room.enableFeatures !== false ? (
                          <>
                            <Obstacles latestRef={dummyLatestRef} />
                            <BoostPads latestRef={dummyLatestRef} />
                          </>
                        ) : null}
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
                  disabled={!canStart}
                >
                  {canStart ? t('lobby.start_game') : t('lobby.need_players')}
                </button>
              ) : (
                <div
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    padding: '12px',
                  }}
                >
                  {t('lobby.waiting_host')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
