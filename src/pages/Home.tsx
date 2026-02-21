import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../hooks/useNetwork';

export default function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [matchDuration, setMatchDuration] = useState(5);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = useCallback(() => {
    if (!nickname.trim()) {
      setError('Enter a nickname');
      return;
    }
    setLoading(true);
    setError('');

    socket.emit(
      'create-room',
      { nickname: nickname.trim(), matchDuration },
      (res: { roomId: string }) => {
        setLoading(false);
        if (res.roomId) {
          sessionStorage.setItem('bb-nickname', nickname.trim());
          navigate(`/lobby/${res.roomId}`);
        }
      }
    );
  }, [nickname, matchDuration, navigate]);

  const handleJoin = useCallback(() => {
    if (!nickname.trim()) {
      setError('Enter a nickname');
      return;
    }
    if (!roomCode.trim()) {
      setError('Enter a room code');
      return;
    }
    setLoading(true);
    setError('');

    socket.emit(
      'join-room',
      { roomId: roomCode.trim(), nickname: nickname.trim() },
      (res: { success: boolean; error?: string }) => {
        setLoading(false);
        if (res.success) {
          sessionStorage.setItem('bb-nickname', nickname.trim());
          navigate(`/lobby/${roomCode.trim()}`);
        } else {
          setError(res.error || 'Failed to join');
        }
      }
    );
  }, [nickname, roomCode, navigate]);

  return (
    <>
      <div className="bg-animated" />
      <div className="page-center">
        <div className="home-container">
          <h1 className="home-title animate-in">BALL BRAWL</h1>
          <p className="home-subtitle animate-in animate-in-delay-1">
            5v5 Multiplayer Soccer — Real-time 3D
          </p>

          <div
            className="glass-card animate-in animate-in-delay-2"
            style={{ padding: '32px' }}
          >
            <div className="home-form">
              <div>
                <label className="label">Your Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Enter nickname..."
                  maxLength={16}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                />
              </div>

              <div>
                <label className="label">Match Duration</label>
                <select
                  className="select"
                  value={matchDuration}
                  onChange={(e) => setMatchDuration(Number(e.target.value))}
                >
                  <option value={3}>3 Minutes</option>
                  <option value={5}>5 Minutes</option>
                  <option value={7}>7 Minutes</option>
                  <option value={10}>10 Minutes</option>
                </select>
              </div>

              <button
                className="btn btn-primary btn-lg"
                onClick={handleCreate}
                disabled={loading}
              >
                ⚽ Create Room
              </button>

              <div className="home-divider">or join existing</div>

              <div className="join-row">
                <input
                  className="input"
                  type="text"
                  placeholder="Room code..."
                  maxLength={8}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoin();
                  }}
                />
                <button
                  className="btn btn-outline"
                  onClick={handleJoin}
                  disabled={loading}
                >
                  Join
                </button>
              </div>

              {error ? (
                <p
                  style={{
                    color: 'var(--red-team)',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                >
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
