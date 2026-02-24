import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { usePlayerProfile } from '../../hooks/usePlayerProfile';
import { supabase } from '../../lib/supabase';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  SpinnerIcon,
} from '../Icons';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountSettingsModal({
  isOpen,
  onClose,
}: AccountSettingsModalProps) {
  const { user } = useAuth();
  const { profile, updateNickname } = usePlayerProfile();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const accountSchemaBase = z.object({
    nickname: z
      .string()
      .min(3, t('auth.validation.nickname_min'))
      .max(16, t('auth.validation.nickname_max'))
      .regex(/^[a-zA-Z0-9_]+$/, t('auth.validation.nickname_format'))
      .optional()
      .or(z.literal('')),
    email: z
      .email({ error: t('auth.validation.email_invalid') })
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .min(6, t('auth.validation.password_min'))
      .optional()
      .or(z.literal('')),
    confirmPassword: z.string().optional().or(z.literal('')),
  });

  const accountSchema = accountSchemaBase.refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    {
      message: t('auth.validation.passwords_mismatch'),
      path: ['confirmPassword'],
    }
  );

  type AccountFormData = z.infer<typeof accountSchema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    mode: 'onBlur',
    values: {
      nickname: profile?.nickname || '',
      email: user?.email || '',
      password: '',
      confirmPassword: '',
    },
    resetOptions: {
      keepDirtyValues: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        nickname: profile?.nickname || '',
        email: user?.email || '',
        password: '',
        confirmPassword: '',
      });
    }
  }, [isOpen, reset, profile?.nickname, user?.email]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const onSubmit = async (data: AccountFormData) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      let updatedAnything = false;

      // 1. Update Nickname if changed
      if (
        data.nickname &&
        data.nickname !== profile?.nickname &&
        data.nickname.trim() !== ''
      ) {
        await updateNickname(data.nickname.trim());
        updatedAnything = true;
      }

      // 2. Update Auth User details if changed
      const authUpdates: { email?: string; password?: string } = {};
      if (data.email && data.email !== user.email && data.email.trim() !== '') {
        authUpdates.email = data.email.trim();
      }
      if (data.password && data.password.trim() !== '') {
        authUpdates.password = data.password;
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: updateError } =
          await supabase.auth.updateUser(authUpdates);
        if (updateError) throw updateError;
        updatedAnything = true;
      }

      if (updatedAnything) {
        if (authUpdates.email) {
          setSuccess(t('settings.success_email'));
        } else {
          setSuccess(t('settings.success_generic'));
        }

        setTimeout(() => {
          setSuccess(null);
          if (!authUpdates.email) onClose();
        }, 2000);
      } else {
        // No changes made, just close the modal
        onClose();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('settings.error_generic')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card glass-card animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>

        <h2 className="modal-title">{t('settings.title')}</h2>

        {error && (
          <div
            className="auth-error animate-in"
            style={{
              color: '#ff4a4a',
              background: 'rgba(255, 74, 74, 0.1)',
              border: '1px solid rgba(255, 74, 74, 0.2)',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              lineHeight: '1.4',
            }}
          >
            <AlertCircleIcon className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            className="auth-success animate-in"
            style={{
              color: '#4ade80',
              background: 'rgba(74, 222, 128, 0.1)',
              border: '1px solid rgba(74, 222, 128, 0.2)',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              lineHeight: '1.4',
            }}
          >
            <CheckCircleIcon className="shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="home-form">
          <div>
            <label className="label">{t('settings.nickname_label')}</label>
            <input
              type="text"
              className="input"
              {...register('nickname')}
              placeholder={t('settings.nickname_placeholder')}
            />
            {errors.nickname && (
              <p
                style={{ color: '#ff4a4a', fontSize: '12px', marginTop: '4px' }}
              >
                {errors.nickname.message}
              </p>
            )}
          </div>

          <div>
            <label className="label">{t('settings.email_label')}</label>
            <input
              type="email"
              className="input"
              {...register('email')}
              placeholder={t('settings.email_placeholder')}
            />
            {errors.email && (
              <p
                style={{ color: '#ff4a4a', fontSize: '12px', marginTop: '4px' }}
              >
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="label">{t('settings.password_label')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                {...register('password')}
                placeholder="••••••••"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && (
              <p
                style={{ color: '#ff4a4a', fontSize: '12px', marginTop: '4px' }}
              >
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label className="label">
              {t('settings.confirm_password_label')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                className="input"
                {...register('confirmPassword')}
                placeholder="••••••••"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p
                style={{
                  color: '#ff4a4a',
                  fontSize: '12px',
                  marginTop: '4px',
                }}
              >
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || !!success}
            style={{
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease-in-out',
            }}
          >
            {loading && <SpinnerIcon />}
            {!loading && success && <CheckCircleIcon size={18} />}
            {loading
              ? t('settings.saving')
              : success
                ? t('settings.success_generic')
                : t('settings.save_changes')}
          </button>
        </form>
      </div>
    </div>
  );
}
