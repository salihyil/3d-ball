import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../hooks/useNetwork';
import type { PlayerInfo, RoomInfo, Team } from '../types';

export default function Lobby() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [hostLeft, setHostLeft] = useState(false);

  useEffect(() => {
    const nickname = sessionStorage.getItem('bb-nickname');
    if (!nickname) {
      navigate(`/?join=${roomId}`);
      return;
    }

    socket.emit('join-room', { roomId: roomId!, nickname }, (res: { success: boolean; error?: string; room?: RoomInfo }) => {
      if (res.room) {
        setRoom(res.room);
      } else if (res.error === 'Room not found') {
        navigate('/');
      }
    });

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
    socket.emit('switch-team', { team }, (res: { error?: string; success?: boolean }) => {
      if (res.error) {
        alert(res.error);
      }
    });
  }, []);

  const handleStart = useCallback(() => {
    socket.emit('start-game');
  }, []);

  const handleLeave = useCallback(() => {
    socket.emit('leave-room');
    navigate('/');
  }, [navigate]);

  const handleCopyLink = useCallback(() => {
    const link = `${window.location.origin}/lobby/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomId]);

  if (hostLeft) {
    return (
      <>
        <div className="bg-animated" />
        <div className="page-center">
          <div className="glass-card animate-in text-center" style={{ padding: '40px', maxWidth: '400px' }}>
            <h2 style={{ color: '#ff4a4a', marginBottom: '16px' }}>Host Disconnected</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              The host has unexpectedly left the game or their connection dropped. This room has been closed.
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/')}>
              Return to Main Menu
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
          <p style={{ color: 'var(--text-secondary)' }}>Connecting to room...</p>
        </div>
      </>
    );
  }

  const myId = socket.id;
  const isHost = room.hostId === myId;
  const bluePlayers = room.players.filter((p: PlayerInfo) => p.team === 'blue');
  const redPlayers = room.players.filter((p: PlayerInfo) => p.team === 'red');
  const canStart = true; // Allow 1-player games

  return (
    <>
      <div className="bg-animated" />
      <div className="page-center">
        <div className="lobby-container">
          <div className="glass-card animate-in" style={{ padding: '32px' }}>
            {/* Header */}
            <div className="lobby-header">
              <h2 className="lobby-title">Game Lobby</h2>
              <div className="lobby-room-code">
                <span className="lobby-code">{roomId}</span>
                <button className="btn btn-outline lobby-copy-btn" onClick={handleCopyLink}>
                  {copied ? '✓ Copied!' : '📋 Copy Link'}
                </button>
              </div>
            </div>

            {/* Teams */}
            <div className="lobby-teams">
              <div className="team-panel blue">
                <div className="team-title">
                  <span className="team-dot" />
                  Blue Team ({bluePlayers.length}/5)
                </div>
                <div className="team-players">
                  {bluePlayers.map((p: PlayerInfo) => (
                    <div key={p.id} className="team-player">
                      {p.nickname}
                      {p.isHost && <span className="host-badge">HOST</span>}
                      {p.id === myId && <span className="you-badge">YOU</span>}
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-blue"
                  style={{ marginTop: '12px', width: '100%', fontSize: '13px', padding: '8px' }}
                  onClick={() => handleSwitchTeam('blue')}
                  disabled={bluePlayers.length >= 5}
                >
                  {bluePlayers.length >= 5 ? 'Team Full' : 'Join Blue'}
                </button>
              </div>

              <div className="team-panel red">
                <div className="team-title">
                  <span className="team-dot" />
                  Red Team ({redPlayers.length}/5)
                </div>
                <div className="team-players">
                  {redPlayers.map((p: PlayerInfo) => (
                    <div key={p.id} className="team-player">
                      {p.nickname}
                      {p.isHost && <span className="host-badge">HOST</span>}
                      {p.id === myId && <span className="you-badge">YOU</span>}
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-red"
                  style={{ marginTop: '12px', width: '100%', fontSize: '13px', padding: '8px' }}
                  onClick={() => handleSwitchTeam('red')}
                  disabled={redPlayers.length >= 5}
                >
                  {redPlayers.length >= 5 ? 'Team Full' : 'Join Red'}
                </button>
              </div>
            </div>

            {/* Settings + Actions */}
            <div className="lobby-settings">
              <span className="label">Duration</span>
              <span className="mono" style={{ color: 'var(--accent)' }}>
                {room.matchDuration} min
              </span>
              <span style={{ flex: 1 }} />
              <span className="label" style={{ color: 'var(--text-muted)' }}>
                {room.players.length}/10 players
              </span>
            </div>

            <div className="lobby-actions">
              <button className="btn btn-outline" onClick={handleLeave}>
                Leave
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
                  ⚔️ Enter Match
                </button>
              ) : isHost ? (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    sessionStorage.setItem(`in-room-${roomId}`, 'true');
                    handleStart();
                  }}
                  disabled={!canStart}
                >
                  {canStart ? '🚀 Start Game' : 'Need players on both teams'}
                </button>
              ) : (
                <div style={{ flex: 1, textAlign: 'center', color: 'var(--text-muted)', padding: '12px' }}>
                  Waiting for host to start...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
