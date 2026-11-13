import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import hospitalImg from '../../assets/login page.png';

export default function Login() {
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
      const res = await authAPI.login({ email, password });
      localStorage.setItem('access_token', res.data.tokens.access);
      localStorage.setItem('refresh_token', res.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.error  ||
        'Login failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split">

      {/* ── Left: Illustration panel ── */}
      <div className="auth-left">
        <img src={hospitalImg} alt="Warm hospital illustration" />
        <div className="auth-left-overlay" />
        <div className="auth-left-text">
          <h1>Welcome back<br/>to Fair Bill.</h1>
          <p>
            Navigating normal-delivery hospital bills in Bengaluru
            with warmth, clarity, and peer transparency.
          </p>
        </div>
      </div>

      {/* ── Right: Login form ── */}
      <div className="auth-right">
        <div className="auth-card">

          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.75rem' }}>🏥</span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: '1.1rem',
                color: 'var(--primary)',
                letterSpacing: '-0.3px',
              }}>
                Fair Bill
              </span>
            </div>
            <h2>Sign in</h2>
            <p className="subtitle">Review your hospital bill and compare with peers.</p>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
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
                placeholder="Your password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: '1.25rem' }}
              disabled={loading}
            >
              {loading ? '⏳ Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div className="auth-footer">
            New here? <Link to="/register">Create an account</Link>
            <br />
            <Link to="/admin-login" style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.5rem', display: 'inline-block' }}>
              Admin login →
            </Link>
          </div>

        </div>
      </div>

    </div>
  );
}
