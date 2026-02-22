import React from 'react';

interface CountdownOverlayProps {
  countdown: number;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  countdown,
}) => {
  return (
    <div className="countdown-overlay" data-testid="countdown-overlay">
      <div className="countdown-number" data-testid="countdown-number">
        {countdown}
      </div>
    </div>
  );
};

export default React.memo(CountdownOverlay);
