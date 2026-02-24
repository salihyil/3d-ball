import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { toast } from '../../utils/toast';
import { EyeIcon, EyeOffIcon } from '../Icons';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AuthFormData {
  email: string;
  password: string;
  nickname?: string;
  confirmPassword?: string;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signInWithGoogle } = useAuth();
  const { t } = useTranslation();

  const loginSchema = z.object({
    email: z.email({ error: t('auth.validation.email_invalid') }),
    password: z.string().min(6, t('auth.validation.password_min')),
  });

  const registerSchema = loginSchema
    .extend({
      nickname: z
        .string()
        .min(3, t('auth.validation.nickname_min'))
        .max(16, t('auth.validation.nickname_max'))
        .regex(/^[a-zA-Z0-9_]+$/, t('auth.validation.nickname_format')),
      confirmPassword: z.string().min(1, t('auth.validation.confirm_required')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.validation.passwords_mismatch'),
      path: ['confirmPassword'],
    });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AuthFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(isLogin ? loginSchema : registerSchema) as any,
    mode: 'onBlur',
  });

  useEffect(() => {
    reset();
    setError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [isOpen, isLogin, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: AuthFormData) => {
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              nickname: data.nickname || null,
            },
          },
        });
        if (error) throw error;
        toast.success(t('auth.register_success'));
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.error_generic'));
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

        <h2 className="modal-title">
          {isLogin ? t('auth.login') : t('auth.register')}
        </h2>

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
          {!isLogin && (
            <div>
              <label className="label">{t('auth.nickname_label')}</label>
              <input
                type="text"
                className="input"
                placeholder={t('auth.nickname_placeholder')}
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
          )}
          <div>
            <label className="label">{t('auth.email_label')}</label>
            <input
              type="email"
              className="input"
              placeholder={t('auth.email_placeholder')}
              {...register('email')}
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
            <label className="label">{t('auth.password_label')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="••••••••"
                style={{ paddingRight: '40px' }}
                {...register('password')}
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
          {!isLogin && (
            <div>
              <label className="label">
                {t('auth.confirm_password_label')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="••••••••"
                  style={{ paddingRight: '40px' }}
                  {...register('confirmPassword')}
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
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            {loading
              ? t('auth.processing')
              : isLogin
                ? t('auth.enter_arena')
                : t('auth.join_fleet')}
          </button>
        </form>

        <div className="home-divider">{t('auth.or_divider')}</div>

        <button
          onClick={signInWithGoogle}
          className="btn btn-outline btn-lg"
          style={{ width: '100%' }}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="G"
            style={{ width: '18px', marginRight: '8px' }}
          />
          {t('auth.continue_google')}
        </button>

        <p
          style={{
            marginTop: '24px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          {isLogin ? t('auth.new_pilot') : t('auth.already_registered')}{' '}
          <span
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            style={{
              color: 'var(--accent)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {isLogin ? t('auth.request_access') : t('auth.login_instead')}
          </span>
        </p>
      </div>
    </div>
  );
}
