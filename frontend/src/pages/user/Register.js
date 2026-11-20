import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import hospitalImg from '../../assets/login page.png';

// ── Password strength helper ───────────────────────────────────────────────
function passwordStrength(pwd) {
  const checks = [
    pwd.length >= 8,
    /[0-9]/.test(pwd),
    /[A-Z]/.test(pwd),
    /[^A-Za-z0-9]/.test(pwd),
  ];
  return checks;
}

const STRENGTH_COLORS = [
  'var(--danger)',
  'var(--warning)',
  '#D97706',
  'var(--success)',
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', phone: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.register(form);
      localStorage.setItem('access_token', res.data.tokens.access);
      localStorage.setItem('refresh_token', res.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      const d = err.response?.data;
      setError(d?.password?.[0] || d?.email?.[0] || d?.detail || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const strengthChecks = passwordStrength(form.password);
  const strengthScore  = strengthChecks.filter(Boolean).length;
  const strengthColor  = form.password.length === 0 ? 'var(--gray-300)' : STRENGTH_COLORS[strengthScore - 1] || 'var(--gray-300)';
  const strengthLabels = ['8+ chars', 'number', 'uppercase', 'special char'];

  return (
    <div className="auth-split">

      {/* ── Left: Illustration panel ── */}
      <div className="auth-left">
        <img src={hospitalImg} alt="Warm hospital illustration" />
        <div className="auth-left-overlay" />
        <div className="auth-left-text">
          <h1>Start understanding<br/>your hospital bill.</h1>
          <p>Free for families in Bengaluru. No medical jargon.</p>
        </div>
      </div>

      {/* ── Right: Register form ── */}
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
            <h2>Create your account</h2>
            <p className="subtitle">Join families who check their hospital bills with clarity.</p>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" name="username" value={form.username} onChange={handleChange} required placeholder="Your name" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@example.com" />
            </div>
            <div className="form-group">
              <label>Phone (optional)</label>
              <input type="text" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} required placeholder="At least 8 characters" />

              {/* Password strength indicator */}
              {form.password.length > 0 && (
                <div style={{ marginTop: '.6rem' }}>
                  <div style={{ display: 'flex', gap: '.35rem', marginBottom: '.35rem' }}>
                    {strengthChecks.map((met, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: 5,
                          borderRadius: 999,
                          background: met ? strengthColor : 'var(--gray-200)',
                          transition: 'background .25s',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    {strengthChecks.map((met, i) => (
                      <span key={i} style={{
                        fontSize: '.68rem',
                        fontWeight: 700,
                        color: met ? strengthColor : 'var(--gray-400)',
                        transition: 'color .25s',
                      }}>
                        {met ? '✓' : '○'} {strengthLabels[i]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input type="password" name="password2" value={form.password2} onChange={handleChange} required placeholder="Repeat your password" />
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: '1rem' }} disabled={loading}>
              {loading ? '⏳ Creating account…' : 'Create Account →'}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>

    </div>
  );
}
