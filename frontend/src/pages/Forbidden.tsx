import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Forbidden() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  async function switchAccount() { await logout(); navigate('/admin-access', { replace: true }); }
  return <section className="route-state route-state-forbidden">
    <div className="route-state-icon" aria-hidden="true">♜</div>
    <p className="route-state-kicker">RESTRICTED CHAMBER</p>
    <h1>Administrator permission required</h1>
    <p>{user?.email ? `${user.email} is signed in, but this account does not have permission to enter the control room.` : 'Sign in with an authorized administrator account to enter the control room.'}</p>
    <div className="route-state-actions">
      {user ? <button className="btn btn-primary" type="button" onClick={switchAccount}>Switch account</button> : <Link className="btn btn-primary" to="/admin-access">Administrator sign in</Link>}
      <Link className="btn btn-secondary" to={user ? '/dashboard' : '/'}>{user ? 'Learner dashboard' : 'Return home'}</Link>
    </div>
  </section>;
}
