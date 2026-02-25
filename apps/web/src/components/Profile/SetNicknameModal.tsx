import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { usePlayerProfile } from '../../hooks/usePlayerProfile';
import { toast } from '../../utils/toast';

interface SetNicknameModalProps {
  isOpen: boolean;
}

interface NicknameFormData {
  nickname: string;
}

export function SetNicknameModal({ isOpen }: SetNicknameModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { updateNickname } = usePlayerProfile();
  const { t } = useTranslation();

  const nicknameSchema = z.object({
    nickname: z
      .string()
      .min(3, t('auth.validation.nickname_min'))
      .max(16, t('auth.validation.nickname_max'))
      .regex(/^[a-zA-Z0-9_]+$/, t('auth.validation.nickname_format')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NicknameFormData>({
    resolver: zodResolver(nicknameSchema),
    mode: 'onBlur',
  });

  if (!isOpen) return null;

  const onSubmit = async (data: NicknameFormData) => {
    setError(null);
    setLoading(true);

    try {
      await updateNickname(data.nickname);
      toast.success(
        t('profile.nickname_updated', 'Nickname updated successfully')
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('profile.error_generic', 'An error occurred')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-card glass-card animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">
          {t('auth.set_nickname_title', 'Choose Your Nickname')}
        </h2>

        <p
          style={{
            color: 'var(--text-secondary)',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          {t(
            'auth.set_nickname_desc',
            'Please set a nickname to start playing.'
          )}
        </p>

        {error && (
          <div
            className="auth-error animate-in"
            style={{
              color: '#ff4a4a',
              background: 'rgba(220, 38, 38, 0.1)',
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="home-form">
          <div>
            <label className="label">
              {t('auth.nickname_label', 'Nickname')}
            </label>
            <input
              type="text"
              className="input"
              placeholder={t('auth.nickname_placeholder', 'Enter nickname...')}
              {...register('nickname')}
            />
            {errors.nickname && (
              <p
                style={{
                  color: '#ff4a4a',
                  fontSize: '12px',
                  marginTop: '4px',
                }}
              >
                {errors.nickname.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            {loading
              ? t('auth.processing', 'Processing...')
              : t('auth.save_nickname', 'Save Nickname')}
          </button>
        </form>
      </div>
    </div>
  );
}
