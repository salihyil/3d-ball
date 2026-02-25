import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { socket } from '../hooks/useNetwork';
import type { ChatMessage } from '@sasi/shared';

interface ChatProps {
  isGameOverlay?: boolean;
}

export default function Chat({ isGameOverlay = false }: ChatProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isVisible, setIsVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg].slice(-50));
      setLastActivity(Date.now());
      setIsVisible(true);
    };

    socket.on('chat_message', handleMessage);
    return () => {
      socket.off('chat_message', handleMessage);
    };
  }, []);

  // Handle fading logic for in-game overlay
  useEffect(() => {
    if (isGameOverlay && !isFocused) {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

      fadeTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 5000); // Fade after 5 seconds of inactivity
    } else {
      setIsVisible(true);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    }

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [isGameOverlay, isFocused, lastActivity]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    socket.emit('send-chat-message', { text: inputText });
    setInputText('');
  };

  // Add global key listener for 'Enter' to focus chat during game
  useEffect(() => {
    if (isGameOverlay) {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && document.activeElement !== inputRef.current) {
          inputRef.current?.focus();
        }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }
  }, [isGameOverlay]);

  return (
    <div
      className={`chat-container ${isGameOverlay ? 'game-overlay' : 'lobby-chat'} ${isFocused ? 'focused' : ''} ${!isVisible && isGameOverlay ? 'faded' : ''}`}
    >
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.type} animate-in`}>
            <span className="chat-timestamp">
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {msg.type === 'user' && (
              <>
                {msg.title && (
                  <span
                    className="chat-title-badge"
                    style={{
                      fontSize: '8px',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '3px',
                      marginRight: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      background: `${msg.nameColor || '#ffd700'}22`,
                      color: msg.nameColor || '#ffd700',
                      border: `1px solid ${msg.nameColor || '#ffd700'}44`,
                    }}
                  >
                    {msg.title}
                  </span>
                )}
                <span
                  className="chat-nickname"
                  style={msg.nameColor ? { color: msg.nameColor } : undefined}
                >
                  {msg.nickname}:{' '}
                </span>
              </>
            )}
            <span className="chat-text">
              {msg.key
                ? (() => {
                    const translatedParams = { ...msg.params };
                    Object.keys(translatedParams).forEach((k) => {
                      const val = translatedParams[k];
                      if (
                        typeof val === 'string' &&
                        (val.includes('.') || val.startsWith('common.'))
                      ) {
                        translatedParams[k] = t(val);
                      }
                    });
                    return t(msg.key, translatedParams);
                  })()
                : msg.text}
            </span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="chat-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder={isFocused ? '' : t('common.press_enter_chat')}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          maxLength={100}
        />
      </form>
    </div>
  );
}
