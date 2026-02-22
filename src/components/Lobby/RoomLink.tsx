import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface RoomLinkProps {
  roomId: string;
}

export const RoomLink: React.FC<RoomLinkProps> = ({ roomId }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/lobby/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="lobby-room-code">
      <span data-testid="room-code" className="lobby-code">
        {roomId}
      </span>
      <button
        className="btn btn-outline lobby-copy-btn"
        onClick={handleCopyLink}
        data-testid="copy-link-btn"
      >
        {copied ? t('lobby.copied') : t('lobby.copy_link')}
      </button>
    </div>
  );
};

export default React.memo(RoomLink);
