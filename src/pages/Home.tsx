import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LanguageSelector from '../components/LanguageSelector';
import { socket } from '../hooks/useNetwork';

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [matchDuration, setMatchDuration] = useState(5);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = useCallback(() => {
    if (!nickname.trim()) {
      setError(t('home.error_nickname'));
      return;
    }
    setLoading(true);
    setError('');

    socket.emit(
      'create-room',
      { nickname: nickname.trim(), matchDuration },
      (res: { roomId: string; hostToken?: string }) => {
        setLoading(false);
        if (res.roomId) {
          sessionStorage.setItem('bb-nickname', nickname.trim());
          if (res.hostToken) {
            sessionStorage.setItem(`host-token-${res.roomId}`, res.hostToken);
          }
          navigate(`/lobby/${res.roomId}`);
        }
      }
    );
  }, [nickname, matchDuration, navigate, t]);

  const handleJoin = useCallback(() => {
    if (!nickname.trim()) {
      setError(t('home.error_nickname'));
      return;
    }
    if (!roomCode.trim()) {
      setError(t('home.error_room_code'));
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
          setError(res.error || t('home.error_join_failed'));
        }
      }
    );
  }, [nickname, roomCode, navigate, t]);

  return (
    <>
      <div className="bg-animated" />
      <div
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          zIndex: 1000,
        }}
      >
        <LanguageSelector />
      </div>
      <div className="page-center">
        <div className="home-container">
          <h1 className="home-title animate-in">{t('home.title')}</h1>
          <p className="home-subtitle animate-in animate-in-delay-1">
            {t('home.subtitle')}
          </p>

          <div
            className="glass-card animate-in animate-in-delay-2"
            style={{ padding: '32px' }}
          >
            <div className="home-form">
              <div>
                <label className="label">{t('home.nickname_label')}</label>
                <input
                  className="input"
                  type="text"
                  placeholder={t('home.nickname_placeholder')}
                  maxLength={16}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                />
              </div>

              <div>
                <label className="label">{t('home.duration_label')}</label>
                <select
                  className="select"
                  value={matchDuration}
                  onChange={(e) => setMatchDuration(Number(e.target.value))}
                >
                  <option value={3}>
                    {t('home.duration_minutes', { count: 3 })}
                  </option>
                  <option value={5}>
                    {t('home.duration_minutes', { count: 5 })}
                  </option>
                  <option value={7}>
                    {t('home.duration_minutes', { count: 7 })}
                  </option>
                  <option value={10}>
                    {t('home.duration_minutes', { count: 10 })}
                  </option>
                </select>
              </div>

              <button
                className="btn btn-primary btn-lg"
                onClick={handleCreate}
                disabled={loading}
              >
                {t('home.create_room')}
              </button>

              <div className="home-divider">{t('home.or_join')}</div>

              <div className="join-row">
                <input
                  className="input"
                  type="text"
                  placeholder={t('home.room_code_placeholder')}
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
                  {t('home.join_btn')}
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
