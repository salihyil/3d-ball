import React from 'react';
import { useTranslation } from 'react-i18next';

interface Texture {
  id: string;
  name: string;
  url: string;
}

interface FieldCustomizerProps {
  textures: Texture[];
  pitchTexture: string;
  isHost: boolean;
  onSelect: (url: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const FieldCustomizer: React.FC<FieldCustomizerProps> = ({
  textures,
  pitchTexture,
  isHost,
  onSelect,
  onUpload,
  fileInputRef,
}) => {
  const { t } = useTranslation();

  return (
    <div className="lobby-customization">
      <div
        style={{
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span className="label">{t('lobby.field_texture')}</span>
        <button
          className="btn btn-outline"
          style={{
            fontSize: '12px',
            padding: '4px 8px',
            opacity: isHost ? 1 : 0.5,
            cursor: isHost ? 'pointer' : 'not-allowed',
          }}
          onClick={() => isHost && fileInputRef.current?.click()}
          disabled={!isHost}
        >
          {t('lobby.upload_custom')}
        </button>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={onUpload}
        />
      </div>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        {textures.map((texture) => (
          <div
            key={texture.id}
            onClick={() => onSelect(texture.url)}
            style={{
              cursor: isHost ? 'pointer' : 'default',
              width: '60px',
              height: '40px',
              borderRadius: '4px',
              border:
                pitchTexture === texture.url
                  ? '2px solid #ffaa00'
                  : '2px solid transparent',
              background: texture.url
                ? `url(${texture.url}) center/cover`
                : 'var(--field-color, #1a5c2a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
              flexShrink: 0,
            }}
            title={texture.name}
          >
            {!texture.url ? 'Default' : null}
          </div>
        ))}

        {pitchTexture && !textures.find((t) => t.url === pitchTexture) && (
          <div
            style={{
              cursor: 'pointer',
              width: '60px',
              height: '40px',
              borderRadius: '4px',
              border: '2px solid var(--accent)',
              background: `url(${pitchTexture}) center/cover`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              flexShrink: 0,
            }}
            title="Custom Upload"
          />
        )}
      </div>
    </div>
  );
};

export default React.memo(FieldCustomizer);
