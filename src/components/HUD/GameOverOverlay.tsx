import React from 'react';
import { useTranslation } from 'react-i18next';

interface GameOverOverlayProps {
  gameOver: {
    score: { blue: number; red: number };
    winner: string;
  };
  onBackHome: () => void;
  onBackToLobby: () => void;
}

export const GameOverOverlay: React.FC<GameOverOverlayProps> = ({
  gameOver,
  onBackHome,
  onBackToLobby,
}) => {
  const { t } = useTranslation();

  return (
    <div className="gameover-overlay" data-testid="gameover-overlay">
      <div className="gameover-card glass-card">
        <div className="gameover-title" data-testid="gameover-title">
          {t('game.game_over')}
        </div>
        <div className="gameover-score" data-testid="gameover-score">
          <span
            style={{ color: 'var(--blue-team)' }}
            data-testid="final-score-blue"
          >
            {gameOver.score.blue}
          </span>
          {' — '}
          <span
            style={{ color: 'var(--red-team)' }}
            data-testid="final-score-red"
          >
            {gameOver.score.red}
          </span>
        </div>
        <div className="gameover-winner">
          {gameOver.winner === 'draw'
            ? t('game.draw')
            : t('game.wins', { team: t(`game.${gameOver.winner}`) })}
        </div>
        <div className="gameover-actions">
          <button className="btn btn-outline" onClick={onBackHome}>
            {t('game.home')}
          </button>
          <button className="btn btn-primary" onClick={onBackToLobby}>
            {t('game.back_to_lobby')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(GameOverOverlay);
