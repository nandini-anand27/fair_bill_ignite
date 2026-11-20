import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';

function actionLabel(action) {
  const map = {
    approve_bill:       'Approved bill',
    reject_bill:        'Rejected bill',
    delete_user:        'Deleted user',
    toggle_user_active: 'Toggled user',
    contribute_bill:    'Contributed bill',
  };
  return map[action] || action.replace(/_/g, ' ');
}

function actionBadgeClass(action) {
  if (action.includes('approve'))   return 'status-badge status-approved';
  if (action.includes('reject'))    return 'status-badge status-rejected';
  if (action.includes('delete'))    return 'status-badge status-rejected';
  if (action.includes('toggle'))    return 'status-badge status-pending';
  return 'status-badge';
}

function TierBar({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-1">
      <div className="flex-between" style={{ marginBottom: '.25rem' }}>
        <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-mid)' }}>{label}</span>
        <span style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
      </div>
      <div style={{
        height: '8px',
        background: 'var(--gray-200)',
        borderRadius: '50px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'var(--primary)',
          borderRadius: '50px',
          transition: 'width .4s ease',
        }} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats]     = useState(null);
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminAPI.stats(), adminAPI.auditLog()])
      .then(([statsRes, logsRes]) => {
        setStats(statsRes.data);
        setLogs(logsRes.data.slice(0, 5));
      })
      .catch((err) => console.error('Dashboard load error', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-overlay"><div className="spinner" /><p>Loading dashboard…</p></div>
  );

  if (!stats) return <div className="alert alert-danger">Failed to load dashboard statistics.</div>;

  const statItems = [
    { icon: '👥', value: stats.users.total,      label: 'Total Users'      },
    { icon: '✅', value: stats.users.active,      label: 'Active Users'     },
    { icon: '📋', value: stats.bills.total,       label: 'Total Bills'      },
    { icon: '⏳', value: stats.bills.pending,     label: 'Pending Review'   },
    { icon: '✔️', value: stats.bills.approved,    label: 'Approved'         },
    { icon: '🚩', value: stats.bills.with_flags,  label: 'Bills with Flags' },
  ];

  const approvedTotal = stats.bills.approved;
  // Tier breakdown is not in the stats endpoint — we show what we have.
  // synthetic vs real split is available via bills.total and bills counts.
  const syntheticCount = stats.bills.synthetic || 0;
  const realCount      = approvedTotal - syntheticCount;

  return (
    <div>
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-subtitle">
        {stats.bills.this_week} bill(s) uploaded in the last 7 days &middot; {stats.hospitals.total} hospitals in the database
      </p>

      {/* Stats grid */}
      <div className="stats-grid">
        {statItems.map(s => (
          <div className="stat-card" key={s.label}>
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* This Week highlight */}
      <div className="card">
        <div className="card-header">📅 This Week</div>
        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
          <div className="stat-card" style={{ flex: '1 1 180px', marginBottom: 0 }}>
            <span className="stat-icon">📤</span>
            <div className="stat-value">{stats.bills.this_week}</div>
            <div className="stat-label">Bills Uploaded</div>
          </div>
          <div className="stat-card" style={{ flex: '1 1 180px', marginBottom: 0 }}>
            <span className="stat-icon">⏳</span>
            <div className="stat-value">{stats.bills.pending}</div>
            <div className="stat-label">Awaiting Review</div>
          </div>
          <div className="stat-card" style={{ flex: '1 1 180px', marginBottom: 0 }}>
            <span className="stat-icon">🚩</span>
            <div className="stat-value">{stats.bills.with_flags}</div>
            <div className="stat-label">Flagged Bills</div>
          </div>
        </div>
      </div>

      {/* Benchmark Health */}
      <div className="card">
        <div className="card-header">📊 Benchmark Health</div>
        <div className="flex gap-1 mb-1" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
              {approvedTotal}
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
              Approved Bills
            </div>
          </div>
          <div style={{ flex: '1 1 140px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--success)', fontFamily: 'var(--font-display)' }}>
              {realCount}
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
              Real (User)
            </div>
          </div>
          <div style={{ flex: '1 1 140px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--warning)', fontFamily: 'var(--font-display)' }}>
              {syntheticCount}
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
              Synthetic
            </div>
          </div>
        </div>

        <div className="mt-1">
          <TierBar label="Government"    count={stats.bills.tier_government    || 0} total={approvedTotal} />
          <TierBar label="Mid-Private"   count={stats.bills.tier_mid_private   || 0} total={approvedTotal} />
          <TierBar label="Large Private" count={stats.bills.tier_large_private || 0} total={approvedTotal} />
        </div>

        <div className="alert alert-warning mt-1" style={{ marginBottom: 0, fontSize: '.88rem' }}>
          Bills submitted by users start as <strong>Pending</strong>. Only approved bills appear in peer comparisons.
          Synthetic demo data is pre-approved and labelled accordingly.
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">⚡ Quick Actions</div>
        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
          <Link to="/admin/users" className="btn btn-primary">
            👥 Manage Users
          </Link>
          <Link to="/admin/bills" className="btn btn-accent">
            📋 Review Bills {stats.bills.pending > 0 && `(${stats.bills.pending} pending)`}
          </Link>
          <Link to="/admin/hospitals" className="btn btn-outline">
            🏥 Hospitals
          </Link>
          <Link to="/admin/monitoring" className="btn btn-secondary">
            📜 Audit Log
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">🕒 Recent Activity</div>
        {logs.length === 0 ? (
          <p className="text-muted">No recent activity.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td style={{ fontSize: '.88rem' }}>{log.actor}</td>
                  <td>
                    <span className={actionBadgeClass(log.action)}>
                      {actionLabel(log.action)}
                    </span>
                  </td>
                  <td style={{ fontSize: '.88rem', color: 'var(--text-mid)' }}>
                    {log.entity} {log.entity_id ? `#${log.entity_id}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-1">
          <Link to="/admin/monitoring" className="btn btn-secondary btn-sm">View full audit log →</Link>
        </div>
      </div>
    </div>
  );
}
