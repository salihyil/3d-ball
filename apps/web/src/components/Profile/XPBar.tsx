import { calculateLevel, getLevelProgress } from '@sasi/shared';
import React from 'react';
import { usePlayerProfile } from '../../hooks/usePlayerProfile';

export const XPBar: React.FC = () => {
  const { profile } = usePlayerProfile();

  if (!profile) return null;

  const xp = profile.xp || 0;
  const level = profile.level || calculateLevel(xp);
  const progress = getLevelProgress(xp);

  return (
    <div className="xp-bar-container">
      <div className="xp-level-badge">
        <span className="xp-level-label">LVL</span>
        <span className="xp-level-number">{level}</span>
      </div>
      <div className="xp-progress-track">
        <div
          className="xp-progress-fill"
          style={{ width: `${progress * 100}%` }}
        >
          <div className="xp-progress-glow" />
        </div>
        <div className="xp-text-overlay">{xp} XP</div>
      </div>
    </div>
  );
};
