import React, { createContext, ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { PlayerState } from '../../types';

interface HUDContextType {
  score: { blue: number; red: number };
  timeRemaining: number;
  speed: number;
  boostPercent: number;
  boostCooldown: number;
  ping: number;
  activePowerUp: PlayerState['activePowerUp'] | null;
  isSoundEnabled: boolean;
  toggleSound: () => void;
}

const HUDContext = createContext<HUDContextType | null>(null);

export function useHUD() {
  const context = useContext(HUDContext);
  if (!context) throw new Error('useHUD must be used within HUD.Root');
  return context;
}

export const HUD = {
  Root: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: HUDContextType;
  }) => (
    <HUDContext.Provider value={value}>
      <div className="hud">{children}</div>
    </HUDContext.Provider>
  ),

  ScoreAndTimer: () => {
    const { score, timeRemaining } = useHUD();
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);
    const timerDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    return (
      <div className="hud-top">
        <div className="hud-score" data-testid="hud-score">
          <div className="hud-score-blue" data-testid="score-blue">
            {score.blue}
          </div>
          <div className="hud-score-divider" />
          <div className="hud-score-red" data-testid="score-red">
            {score.red}
          </div>
        </div>
        <div
          className={`hud-timer ${timeRemaining < 30 ? 'warning' : ''}`}
          data-testid="hud-timer"
        >
          {timerDisplay}
        </div>
      </div>
    );
  },

  Ping: () => {
    const { ping } = useHUD();
    return <div className="hud-ping">{ping}ms</div>;
  },

  SoundToggle: () => {
    const { isSoundEnabled, toggleSound } = useHUD();
    return (
      <button
        className="hud-sound-toggle"
        onClick={toggleSound}
        title="Toggle Sound"
      >
        {isSoundEnabled ? '🔊' : '🔇'}
      </button>
    );
  },

  Speedometer: () => {
    const { speed } = useHUD();
    const { t } = useTranslation();
    return (
      <div className="hud-speedometer">
        <div className="hud-speed-value">{speed}</div>
        <div className="hud-speed-unit">{t('game.kph')}</div>
      </div>
    );
  },

  BoostBar: () => {
    const { boostPercent, boostCooldown } = useHUD();
    const { t } = useTranslation();
    return (
      <div className="hud-boost">
        <div className="hud-boost-label">{t('game.boost')}</div>
        <div className="hud-boost-bar">
          <div
            className={`hud-boost-fill ${boostCooldown > 0 ? 'cooldown' : ''}`}
            style={{ width: `${boostPercent}%` }}
          />
        </div>
      </div>
    );
  },

  PowerUp: () => {
    const { activePowerUp } = useHUD();
    const { t } = useTranslation();
    if (!activePowerUp) return null;

    const getPowerUpIcon = (type: string) => {
      switch (type) {
        case 'magnet':
          return '🧲';
        case 'freeze':
          return '🧊';
        case 'rocket':
          return '🚀';
        case 'frozen':
          return '❄️';
        default:
          return '⭐';
      }
    };

    const getPowerUpColor = (type: string) => {
      switch (type) {
        case 'magnet':
          return '#a855f7';
        case 'freeze':
          return '#38bdf8';
        case 'rocket':
          return '#f97316';
        case 'frozen':
          return '#87ceeb';
        default:
          return '#fbbf24';
      }
    };

    return (
      <div
        className="hud-powerup-container"
        style={
          {
            '--glow-color': getPowerUpColor(activePowerUp.type),
          } as React.CSSProperties
        }
      >
        <div className="hud-powerup-details">
          <div className="hud-powerup-name glow-text">
            {t(`game.powerups.${activePowerUp.type}`)}
          </div>
          <div className="hud-powerup-desc">
            {t(`game.powerups.${activePowerUp.type}_desc`)}
          </div>
        </div>
        <div className="hud-powerup glow">
          <div className="hud-powerup-icon">
            {getPowerUpIcon(activePowerUp.type)}
          </div>
          <div className="hud-powerup-timer">
            {Math.ceil(activePowerUp.timeLeft)}
          </div>
        </div>
      </div>
    );
  },
};
