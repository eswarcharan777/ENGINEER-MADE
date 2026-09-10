import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminAccess() {
  const { user, loading, isAdmin, login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="admin-gate"><div className="spinner" /></div>;
  if (user) return <Navigate to={isAdmin ? '/admin' : '/forbidden'} replace />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await login(email.trim(), password);
    } catch (reason: any) {
      setError(reason?.code === 'auth/invalid-credential'
        ? 'This account does not have an email/password login. Use Continue with Google below.'
        : reason?.message || 'Administrator sign-in failed.');
    } finally { setBusy(false); }
  }

  async function googleSignIn() {
    setBusy(true); setError('');
    try {
      await loginWithGoogle();
    } catch (reason: any) {
      setError(reason?.code === 'auth/popup-closed-by-user'
        ? 'Google sign-in was closed before it finished. Please try again.'
        : reason?.message || 'Google administrator sign-in failed.');
    } finally { setBusy(false); }
  }

  return <div className="admin-gate">
    <section className="admin-gate-card">
      <span className="admin-gate-seal">EK</span>
      <p className="dashboard-kicker">PRIVATE CONTROL ROOM</p>
      <h1>Administrator access</h1>
      <p>This portal is isolated from the learner website. Authorized accounts only.</p>
      {!user ? <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="username" /></label>
        <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" /></label>
        {error && <div className="admin-alert error">{error}</div>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Verifying…' : 'Enter control room'}</button>
        <div className="admin-auth-divider"><span>or</span></div>
        <button className="admin-google-btn" type="button" disabled={busy} onClick={googleSignIn}><b>G</b> Continue with Google</button>
      </form> : null}
      <a href="/">Return to public website</a>
    </section>
  </div>;
}
