import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePlayerProfile } from '../../hooks/usePlayerProfile';
import { supabase } from '../../lib/supabase';

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

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (profile?.nickname) setNickname(profile.nickname);
      if (user?.email) setEmail(user.email);
      setPassword('');
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, profile, user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // 1. Update Nickname if changed
      if (nickname !== profile?.nickname && nickname.trim() !== '') {
        await updateNickname(nickname.trim());
      }

      // 2. Update Auth User details if changed
      const authUpdates: { email?: string; password?: string } = {};
      if (email !== user.email && email.trim() !== '') {
        authUpdates.email = email.trim();
      }
      if (password.trim() !== '') {
        authUpdates.password = password;
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: updateError } =
          await supabase.auth.updateUser(authUpdates);
        if (updateError) throw updateError;

        if (authUpdates.email) {
          setSuccess(
            'Updates saved! Please check your new email to confirm the change.'
          );
        } else {
          setSuccess('Profile updated successfully!');
        }
      } else {
        setSuccess('Profile updated successfully!');
      }

      setTimeout(() => {
        setSuccess(null);
        if (!authUpdates.email) onClose();
      }, 2000);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred while updating profile.'
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

        <h2 className="modal-title">Account Settings</h2>

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

        {success && (
          <div
            className="auth-success animate-in"
            style={{
              color: '#4ade80',
              background: 'rgba(74, 222, 128, 0.1)',
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '14px',
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="home-form">
          <div>
            <label className="label">Nickname</label>
            <input
              type="text"
              className="input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Your nickname"
            />
          </div>

          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pilot@ballbrawl.com"
            />
          </div>

          <div>
            <label className="label">
              New Password (leave blank to keep current)
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ marginTop: '10px' }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
