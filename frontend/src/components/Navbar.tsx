import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SearchIcon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/api/search?q=${encodeURIComponent(query)}`);
        setResults(res.data.results);
        setShowResults(true);
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (result: any) => {
    setShowResults(false);
    setQuery('');
    if (result.type === 'path') navigate(`/paths/${result.id}`);
    else if (result.type === 'lesson') navigate(`/learn/${result.pathId}/${result.moduleId}/${result.id}`);
    else if (result.type === 'resource' && result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
  };

  const handleLogout = async () => {
    await logout();
    setShowProfile(false);
    navigate('/');
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span>Engineer</span> Made
      </Link>

      <ul className={`navbar-links ${showMobileMenu ? 'mobile-open' : ''}`}>
        <li><Link onClick={() => setShowMobileMenu(false)} to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link></li>
        <li><Link onClick={() => setShowMobileMenu(false)} to="/paths" className={location.pathname.startsWith('/paths') ? 'active' : ''}>Learning Paths</Link></li>
        <li><Link onClick={() => setShowMobileMenu(false)} to="/about" className={location.pathname === '/about' ? 'active' : ''}>About</Link></li>
        {user && <li className="mobile-dashboard-link"><Link onClick={() => setShowMobileMenu(false)} to="/dashboard">Dashboard</Link></li>}
      </ul>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          className="mobile-menu-btn"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={showMobileMenu}
          onClick={() => setShowMobileMenu(value => !value)}
        >
          {showMobileMenu ? '×' : '☰'}
        </button>
        <div className="navbar-search" ref={searchRef}>
          <SearchIcon size={16} />
          <input
            placeholder="Search courses, topics..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
          />
          {showResults && results.length > 0 && (
            <div className="search-dropdown">
              {results.map((r, i) => (
                <div key={i} className="search-result-item" onClick={() => handleResultClick(r)} style={{ cursor: 'pointer' }}>
                  <div className="search-result-type">{r.type}</div>
                  <div className="search-result-title">{r.title}</div>
                  {r.path && <div className="search-result-sub">{r.path}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {user && <Link to="/dashboard" className="dashboard-nav-cta">Dashboard</Link>}

        {user ? (
          <div className="profile-menu" ref={profileRef}>
            <button className="profile-btn" onClick={() => setShowProfile(!showProfile)}>
              {initials}
            </button>
            {showProfile && (
              <div className="profile-dropdown">
                <div className="profile-info">
                  <strong>{user.displayName || 'Engineer'}</strong>
                  <span>{user.email}</span>
                </div>
                <button onClick={handleLogout} className="profile-logout">Sign out</button>
              </div>
            )}
          </div>
        ) : (
          <div className="auth-buttons">
            <Link to="/login" className="btn-nav-login">Sign in</Link>
            <Link to="/signup" className="btn-nav-signup">Join Free</Link>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
