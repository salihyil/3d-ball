import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: '简体中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage =
    LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="language-selector" ref={dropdownRef}>
      <button
        className="btn btn-outline lang-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
        }}
      >
        <span style={{ fontSize: '18px' }}>{currentLanguage.flag}</span>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>
          {currentLanguage.code.toUpperCase()}
        </span>
      </button>

      {isOpen && (
        <div className="lang-dropdown glass-card animate-in">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`lang-option ${i18n.language === lang.code ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
            >
              <span className="lang-flag">{lang.flag}</span>
              <span className="lang-name">{lang.name}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .language-selector {
          position: relative;
          z-index: 1000;
        }
        .lang-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 140px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: rgba(15, 15, 15, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .lang-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          width: 100%;
          border: none;
          background: transparent;
          color: white;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
          text-align: left;
        }
        .lang-option:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .lang-option.active {
          background: var(--accent-gradient);
          font-weight: 600;
        }
        .lang-flag {
          font-size: 18px;
        }
        .lang-name {
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
