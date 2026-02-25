import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeaderboard } from '../hooks/useLeaderboard';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaderboardModal = memo(function LeaderboardModal({
  isOpen,
  onClose,
}: LeaderboardModalProps) {
  const { t } = useTranslation();
  const { leaderboard, loading, error, refreshLeaderboard } =
    useLeaderboard(isOpen);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card glass-card animate-in"
        style={{
          padding: '24px',
          background: 'rgba(5, 5, 8, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: '500px',
          maxWidth: '800px',
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>

        <div
          style={{
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            className="modal-title"
            style={{
              fontSize: '24px',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            🏆 {t('leaderboard.title', 'Leaderboard')}
          </h2>
          <button
            className="btn btn-outline"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              marginRight: '32px',
            }}
            onClick={refreshLeaderboard}
            disabled={loading}
          >
            {loading ? '...' : '🔄'}
          </button>
        </div>

        <div
          className="premium-scroll"
          style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}
        >
          {error && (
            <div
              style={{
                color: 'var(--red-team)',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {loading && leaderboard.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div
                className="animate-spin"
                style={{
                  display: 'inline-block',
                  width: '24px',
                  height: '24px',
                  border: '2px solid rgba(255,255,255,0.05)',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%',
                }}
              ></div>
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '14px',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <th style={{ padding: '12px 8px' }}>#</th>
                  <th style={{ padding: '12px 8px' }}>
                    {t('leaderboard.player', 'Player')}
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>
                    {t('leaderboard.wins', 'Wins')}
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>
                    {t('leaderboard.goals', 'Goals')}
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>
                    {t('leaderboard.matches', 'Matches')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((player, index) => {
                  let rankColor = 'inherit';
                  let rankShadow = 'none';
                  if (index === 0) {
                    rankColor = '#ffd700'; // Gold
                    rankShadow = '0 0 10px rgba(255,215,0,0.5)';
                  } else if (index === 1) {
                    rankColor = '#c0c0c0'; // Silver
                    rankShadow = '0 0 10px rgba(192,192,192,0.5)';
                  } else if (index === 2) {
                    rankColor = '#cd7f32'; // Bronze
                    rankShadow = '0 0 10px rgba(205,127,50,0.5)';
                  }

                  return (
                    <tr
                      key={index}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background:
                          index % 2 === 0
                            ? 'rgba(255,255,255,0.02)'
                            : 'transparent',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          'rgba(255,255,255,0.05)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background =
                          index % 2 === 0
                            ? 'rgba(255,255,255,0.02)'
                            : 'transparent')
                      }
                    >
                      <td
                        style={{
                          padding: '12px 8px',
                          color: rankColor,
                          fontWeight: index < 3 ? '900' : 'normal',
                          textShadow: rankShadow,
                        }}
                      >
                        {index + 1}
                      </td>
                      <td
                        style={{
                          padding: '12px 8px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {player.avatar_url ? (
                          <img
                            src={player.avatar_url}
                            alt="avatar"
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                            }}
                          >
                            {player.nickname?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        {player.nickname || 'Unknown'}
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                          }}
                        >
                          Lvl {player.level || 1}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '12px 8px',
                          textAlign: 'right',
                          color: '#4ade80',
                          fontWeight: 'bold',
                        }}
                      >
                        {player.wins || 0}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        {player.goals || 0}
                      </td>
                      <td
                        style={{
                          padding: '12px 8px',
                          textAlign: 'right',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {player.matches_played || 0}
                      </td>
                    </tr>
                  );
                })}
                {leaderboard.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: 'center',
                        padding: '30px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t('leaderboard.empty', 'No data yet.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
});
