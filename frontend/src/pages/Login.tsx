import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { user, login, loginWithGoogle, sendPasswordReset } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/profile', { replace: true });
  }, [user, navigate]);

  const googleError = (err: any) => {
    const code = err?.code || '';
    if (code.includes('operation-not-allowed')) return 'Google sign-in is not enabled in Firebase Authentication.';
    if (code.includes('unauthorized-domain')) return 'localhost is not authorized in Firebase Authentication settings.';
    if (code.includes('network-request-failed')) return 'Could not reach Google. Check your internet connection.';
    if (code.includes('redirect-timeout')) return 'Google sign-in was blocked here. Open http://localhost:3000/login in Chrome or Edge and try again.';
    return 'Google sign-in could not be completed. Please try again.';
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFormLoading(true);
    try {
      await login(email, password);
      navigate('/profile');
    } catch (err: any) {
      setError(err.message?.includes('invalid') ? 'Invalid email or password' : 'Failed to login');
    }
    setFormLoading(false);
  }

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      // Closing the account chooser is a cancellation, not an application
      // failure. Leave the form ready for an immediate retry.
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err?.code)) {
        setError(googleError(err));
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handlePasswordReset() {
    setError(''); setNotice('');
    if (!email.trim()) { setError('Enter your email address first, then choose password reset.'); return; }
    try {
      await sendPasswordReset(email);
      setNotice('If an account exists for this email, a password reset link has been sent.');
    } catch (err: any) {
      setError(err?.code?.includes('invalid-email') ? 'Enter a valid email address.' : 'Could not send a password reset email. Please retry.');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="auth-sub">Sign in to continue your learning journey</p>

        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-success" role="status">{notice}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <button type="button" className="auth-link-button" onClick={handlePasswordReset}>Forgot password?</button>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          <button type="submit" className="btn btn-primary auth-btn" disabled={formLoading || googleLoading}>
            {formLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button type="button" onClick={handleGoogle} className="btn btn-secondary auth-btn google-btn" disabled={formLoading || googleLoading}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          {googleLoading ? 'Opening Google…' : 'Continue with Google'}
        </button>

        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Sign up free</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
