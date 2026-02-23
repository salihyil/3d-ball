import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AuthModal from '../components/Auth/AuthModal';
import LanguageSelector from '../components/LanguageSelector';
import { AvatarModal } from '../components/Profile/AvatarModal';
import { useAuth } from '../hooks/useAuth';
import { socket } from '../hooks/useNetwork';

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [matchDuration, setMatchDuration] = useState(5);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  useEffect(() => {
    if (user?.email) {
      // If user is logged in and has no nickname set yet, try to use email prefix or metadata
      const savedNickname = sessionStorage.getItem('bb-nickname');
      if (!savedNickname) {
        const defaultNickname =
          user.user_metadata?.full_name || user.email.split('@')[0];
        setNickname(defaultNickname.substring(0, 16));
      } else {
        setNickname(savedNickname);
      }
    }
  }, [user]);

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
          left: '24px',
          zIndex: 1000,
          display: 'flex',
          gap: '12px',
        }}
      >
        {user ? (
          <div
            className="glass-card"
            style={{
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--accent)',
              }}
            >
              {user.email}
            </span>
            <button
              className="btn btn-primary"
              style={{
                padding: '4px 16px',
                fontSize: '12px',
                background:
                  'linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)',
              }}
              onClick={() => setIsAvatarModalOpen(true)}
            >
              {t('home.customize_btn', 'Karakteri Özelleştir')}
            </button>
            <button
              className="btn btn-outline"
              style={{ padding: '4px 12px', fontSize: '12px' }}
              onClick={() => signOut()}
            >
              {t('common.logout', 'Logout')}
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            style={{ padding: '8px 20px' }}
            onClick={() => setIsAuthModalOpen(true)}
          >
            {t('common.login', 'Login / Register')}
          </button>
        )}
      </div>

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

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <AvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
      />

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
                  data-testid="nickname-input"
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
                  data-testid="duration-select"
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
                data-testid="create-room-btn"
                className="btn btn-primary btn-lg"
                onClick={handleCreate}
                disabled={loading}
              >
                {t('home.create_room')}
              </button>

              <div className="home-divider">{t('home.or_join')}</div>

              <div className="join-row">
                <input
                  data-testid="room-code-input"
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
                  data-testid="join-room-btn"
                  className="btn btn-outline"
                  onClick={handleJoin}
                  disabled={loading}
                >
                  {t('home.join_btn')}
                </button>
              </div>

              {error ? (
                <p
                  data-testid="home-error"
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
