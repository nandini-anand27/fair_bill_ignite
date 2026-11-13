import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user && (user.is_admin || user.is_staff);
  const isAuthPage = ['/login', '/register', '/admin-login'].includes(location.pathname);

  if (!user || isAuthPage) return null;

  const handleLogout = () => {
    localStorage.clear();
    navigate(isAdmin ? '/admin-login' : '/login');
  };

  return (
    <nav className="navbar">
      <Link to={isAdmin ? '/admin/dashboard' : '/dashboard'} className="navbar-brand">
        Fair Bill {isAdmin && <span style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>| Admin</span>}
      </Link>
      <div className="navbar-links">
        {isAdmin ? (
          <>
            <Link to="/admin/dashboard">Dashboard</Link>
            <Link to="/admin/users">Users</Link>
            <Link to="/admin/bills">Bills</Link>
            <Link to="/admin/monitoring">Monitoring</Link>
          </>
        ) : (
          <>
            <Link to="/dashboard">My Bills</Link>
            <Link to="/upload">Upload Bill</Link>
            <Link to="/delete-bill">Delete My Contribution</Link>
          </>
        )}
        <div className="navbar-user">
          <span className="badge">{user.email}</span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">Logout</button>
        </div>
      </div>
    </nav>
  );
}
