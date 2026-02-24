import { useCallback, useEffect, useState } from 'react';
import { ToastEventPayload } from '../../utils/toast';

interface Toast extends ToastEventPayload {
  animatingOut?: boolean;
}

const ICONS = {
  success: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--green-team)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  ),
  error: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--red-team)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  ),
  info: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  ),
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const animateOutAndRemove = useCallback(
    (id: string) => {
      setToasts((current) =>
        current.map((t) => (t.id === id ? { ...t, animatingOut: true } : t))
      );
      // Wait for exit animation to complete before removing
      setTimeout(() => {
        removeToast(id);
      }, 300);
    },
    [removeToast]
  );

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastEventPayload>;
      const newToast = customEvent.detail;

      setToasts((current) => [...current, newToast]);

      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          animateOutAndRemove(newToast.id);
        }, newToast.duration);
      }
    };

    window.addEventListener('bb-toast', handleToastEvent);

    return () => {
      window.removeEventListener('bb-toast', handleToastEvent);
    };
  }, [animateOutAndRemove]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'center',
        pointerEvents: 'none',
        maxWidth: '90vw',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`glass-card toast-item ${t.animatingOut ? 'toast-exit' : 'toast-enter'}`}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            minWidth: '280px',
            border: `1px solid ${
              t.type === 'success'
                ? 'rgba(34, 197, 94, 0.4)'
                : t.type === 'error'
                  ? 'rgba(239, 68, 68, 0.4)'
                  : 'rgba(124, 58, 237, 0.4)'
            }`,
            background: 'var(--card-bg)',
            backdropFilter: 'blur(16px)',
          }}
          onClick={() => animateOutAndRemove(t.id)}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {ICONS[t.type]}
          </div>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#fff',
              flex: 1,
            }}
          >
            {t.message}
          </span>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
            }}
            onClick={(e) => {
              e.stopPropagation();
              animateOutAndRemove(t.id);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
