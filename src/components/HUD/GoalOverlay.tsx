import React from 'react';
import { useTranslation } from 'react-i18next';
import { Team } from '../../types';

interface GoalOverlayProps {
  goalInfo: {
    team: Team;
    scorer: string;
  };
}

export const GoalOverlay: React.FC<GoalOverlayProps> = ({ goalInfo }) => {
  const { t } = useTranslation();

  return (
    <div className="goal-overlay" data-testid="goal-overlay">
      <div className={`goal-text ${goalInfo.team}`} data-testid="goal-text">
        {t('game.goal')}
        <div
          style={{ fontSize: '24px', marginTop: '8px', fontWeight: 500 }}
          data-testid="goal-scorer"
        >
          {goalInfo.scorer}
        </div>
      </div>
    </div>
  );
};

export default React.memo(GoalOverlay);
