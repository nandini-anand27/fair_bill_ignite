import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../../services/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.adminLogin({ email, password });
      localStorage.setItem('access_token', res.data.tokens.access);
      localStorage.setItem('refresh_token', res.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/admin/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.error  ||
        'Admin login failed. Check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #1E3F20 0%, #2E6B32 60%, #3D6B41 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>🏥</div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '1.6rem',
            color: 'rgba(253,251,247,.9)',
            letterSpacing: '-0.5px',
          }}>
            Fair Bill Admin
          </div>
          <p style={{ color: 'rgba(253,251,247,.5)', fontSize: '.88rem', marginTop: '.25rem' }}>
            Administration portal
          </p>
        </div>

        <div className="auth-card" style={{ background: 'var(--white)' }}>
          <h2 style={{ marginBottom: '.4rem' }}>Admin Login</h2>
          <p className="subtitle">Sign in to manage users, bills, and the benchmark.</p>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@fairbill.com"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Admin password"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: '1rem' }}
              disabled={loading}
            >
              {loading ? '⏳ Authenticating…' : 'Sign In →'}
            </button>
          </form>

          <div className="auth-footer">
            <Link to="/login">← Back to user login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
