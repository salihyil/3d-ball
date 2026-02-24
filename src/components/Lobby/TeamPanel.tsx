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
                <span className="bot-badge" data-testid="bot-badge">
                  🤖 BOT
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
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        <button
          className={`btn btn-${team}`}
          style={{ flex: 1 }}
          onClick={() => onJoin(team)}
          data-testid={`join-${team}-btn`}
          disabled={
            players.find((p) => p.id === socket.id)?.team === team ||
            players.length >= 5
          }
        >
          {players.length >= 5 ? t('lobby.team_full') : t(`lobby.join_${team}`)}
        </button>
        {isHostUser && players.length < 5 && (
          <button
            className="btn btn-outline"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => onAddBot(team)}
            data-testid={`add-bot-${team}-btn`}
          >
            🤖 {t('lobby.add_bot')}
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(TeamPanel);
