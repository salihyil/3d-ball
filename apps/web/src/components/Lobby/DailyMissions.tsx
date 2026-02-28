import React from 'react';
import { useTranslation } from 'react-i18next';

interface Mission {
  id: string;
  titleKey: string;
  xpReward: number;
  progress: number;
  goal: number;
}

export const DailyMissions: React.FC = () => {
  const { t } = useTranslation();

  // For now, hardcoded missions. In a real app, these would come from an API or State.
  const missions: Mission[] = [
    {
      id: '1',
      titleKey: 'missions.first_win',
      xpReward: 50,
      progress: 0,
      goal: 1,
    },
    {
      id: '2',
      titleKey: 'missions.sniper',
      xpReward: 100,
      progress: 2,
      goal: 5,
    },
    {
      id: '3',
      titleKey: 'missions.marathon',
      xpReward: 75,
      progress: 1,
      goal: 3,
    },
  ];

  return (
    <div className="daily-missions-container">
      <h3 className="missions-title">{t('game.missions_title')}</h3>
      <div className="missions-list">
        {missions.map((mission) => (
          <div key={mission.id} className="mission-item">
            <div className="mission-info">
              <span className="mission-name">{t(mission.titleKey)}</span>
              <span className="mission-reward">+{mission.xpReward} XP</span>
            </div>
            <div className="mission-progress-bar">
              <div
                className="mission-progress-fill"
                style={{ width: `${(mission.progress / mission.goal) * 100}%` }}
              />
              <span className="mission-progress-text">
                {mission.progress}/{mission.goal}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
