import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert(
          'Registration successful! Please check your email for verification.'
        );
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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

        <h2 className="modal-title">{isLogin ? 'Login' : 'Register'}</h2>

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

        <form onSubmit={handleSubmit} className="home-form">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="pilot@ballbrawl.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            {loading ? 'Processing...' : isLogin ? 'Enter Arena' : 'Join Fleet'}
          </button>
        </form>

        <div className="home-divider">OR</div>

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
          Continue with Google
        </button>

        <p
          style={{
            marginTop: '24px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          {isLogin ? 'New pilot?' : 'Already registered?'}{' '}
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
            {isLogin ? 'Request Access' : 'Login instead'}
          </span>
        </p>
      </div>
    </div>
  );
}
