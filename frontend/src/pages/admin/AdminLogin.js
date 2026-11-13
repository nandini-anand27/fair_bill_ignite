import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../../services/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      setError(err.response?.data?.detail || err.response?.data?.error || 'Admin login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper" style={{ background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)' }}>
      <div className="auth-card">
        <h2>Admin Portal</h2>
        <p className="subtitle">Fair Bill Administration Dashboard</p>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Admin Email</label>
            <input type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required placeholder="admin@fairbill.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required placeholder="Admin password" />
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Authenticating...' : 'Admin Login'}
          </button>
        </form>
        <div className="auth-footer">
          <Link to="/login" style={{ fontSize: '.85rem', color: 'var(--gray-500)' }}>← Back to User Login</Link>
        </div>
      </div>
    </div>
  );
}
