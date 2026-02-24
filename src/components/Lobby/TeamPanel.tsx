import React from 'react';
import { useTranslation } from 'react-i18next';
import { socket } from '../../hooks/useNetwork';
import type { PlayerInfo, Team } from '../../types';

interface TeamPanelProps {
  team: Team;
  players: PlayerInfo[];
  onJoin: (team: Team) => void;
  onKick: (targetId: string) => void;
  onAddBot: (team: Team) => void;
  isHostUser: boolean;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({
  team,
  players,
  onJoin,
  onKick,
  onAddBot,
  isHostUser,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`team-panel ${team}`} data-testid={`team-${team}`}>
      <div className="team-title" style={{ color: `var(--${team}-team)` }}>
        <div
          className="team-dot"
          style={{
            backgroundColor: `var(--${team}-team)`,
            boxShadow: `0 0 10px var(--${team}-team)`,
          }}
        />
        {t(`lobby.${team}_team`, { count: players.length })}
      </div>
      <div className="team-players">
        {players.map((p) => (
          <div key={p.id} className="team-player">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="mono">{p.nickname}</span>
              {p.isBot && (
                <span
                  className="bot-badge"
                  data-testid="bot-badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 8V4H8" />
                    <rect width="16" height="12" x="4" y="8" rx="2" />
                    <path d="M2 14h2" />
                    <path d="M20 14h2" />
                    <path d="M15 13v2" />
                    <path d="M9 13v2" />
                  </svg>
                  BOT
                </span>
              )}
              {p.equippedAccessories && p.equippedAccessories.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', opacity: 0.8 }}>
                  {p.equippedAccessories.map((accId) => (
                    <span key={accId} style={{ fontSize: '14px' }}>
                      {accId.includes('hat')
                        ? '👒'
                        : accId.includes('skin')
                          ? '🟡'
                          : '✨'}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {p.isHost && (
              <span className="host-badge" data-testid="host-badge">
                {t('common.host')}
              </span>
            )}
            {p.id === socket.id && (
              <span className="you-badge">{t('common.you')}</span>
            )}
            <div style={{ flex: 1 }} />
            {isHostUser && p.id !== socket.id && (
              <button
                className="btn-kick"
                onClick={() => onKick(p.id)}
                title={t('lobby.kick_btn')}
                data-testid="btn-kick"
              >
                {t('lobby.kick_btn')}
              </button>
            )}
          </div>
        ))}
        {players.length === 0 && (
          <div
            className="team-player"
            style={{ opacity: 0.3, fontStyle: 'italic' }}
          >
            {t('lobby.empty_team')}
          </div>
        )}
        {isHostUser && players.length < 5 && (
          <button
            className="team-player add-bot-slot"
            onClick={() => onAddBot(team)}
            data-testid={`add-bot-${team}-btn`}
          >
            <span
              style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
            </span>
            <span className="add-bot-text">{t('lobby.add_bot')}</span>
            <div style={{ flex: 1 }} />
            <span className="add-bot-plus">+</span>
          </button>
        )}
      </div>
      <div style={{ marginTop: '20px' }}>
        <button
          className={`btn btn-${team}`}
          style={{ width: '100%' }}
          onClick={() => onJoin(team)}
          data-testid={`join-${team}-btn`}
          disabled={
            players.find((p) => p.id === socket.id)?.team === team ||
            players.length >= 5
          }
        >
          {players.find((p) => p.id === socket.id)?.team === team ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t(`lobby.join_${team}`)}
            </span>
          ) : players.length >= 5 ? (
            t('lobby.team_full')
          ) : (
            t(`lobby.join_${team}`)
          )}
        </button>
      </div>
    </div>
  );
};

export default React.memo(TeamPanel);
