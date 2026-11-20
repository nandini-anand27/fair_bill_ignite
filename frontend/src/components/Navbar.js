import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useDarkMode from '../hooks/useDarkMode';

export default function Navbar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const userStr   = localStorage.getItem('user');
  const user      = userStr ? JSON.parse(userStr) : null;
  const isAdmin   = user && (user.is_admin || user.is_staff);
  const isAuthPage = ['/login', '/register', '/admin-login'].includes(location.pathname);
  const [dark, setDark] = useDarkMode();

  if (!user || isAuthPage) return null;

  const handleLogout = () => {
    localStorage.clear();
    navigate(isAdmin ? '/admin-login' : '/login');
  };

  return (
    <nav className="navbar">
      {/* Brand */}
      <Link
        to={isAdmin ? '/admin/dashboard' : '/dashboard'}
        className="navbar-brand"
        style={{ textDecoration: 'none' }}
      >
        <span style={{ fontSize: '1.4rem' }}>🏥</span>
        Fair Bill
        <span className="brand-dot" />
        {isAdmin && (
          <span style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-light)', padding: '.1rem .5rem', borderRadius: 20, marginLeft: '.25rem' }}>
            Admin
          </span>
        )}
      </Link>

      {/* Links */}
      <div className="navbar-links">
        {isAdmin ? (
          <>
            <Link to="/admin/dashboard">Dashboard</Link>
            <Link to="/admin/users">Users</Link>
            <Link to="/admin/bills">Bills</Link>
            <Link to="/admin/monitoring">Audit Log</Link>
          </>
        ) : (
          <>
            <Link to="/dashboard">My Bills</Link>
            <Link to="/upload">Upload Bill</Link>
            <Link to="/delete-bill">Delete Contribution</Link>
          </>
        )}

        {/* Dark mode toggle */}
        <label className="dark-toggle-wrap" title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
          <button
            className="dark-toggle"
            onClick={() => setDark(d => !d)}
            aria-label="Toggle dark mode"
          />
          <span>{dark ? '🌙' : '☀️'}</span>
        </label>

        <div className="navbar-user">
          <span className="user-pill" title={user.email}>{user.email}</span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
