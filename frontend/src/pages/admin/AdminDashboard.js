import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';

export default function AdminDashboard() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const res = await adminAPI.stats();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load stats', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="loading-overlay"><div className="spinner" /><p>Loading dashboard…</p></div>
  );

  if (!stats) return <div className="alert alert-danger">Failed to load dashboard statistics.</div>;

  const statItems = [
    { icon: '👥', value: stats.users.total,       label: 'Total Users'       },
    { icon: '✅', value: stats.users.active,       label: 'Active Users'      },
    { icon: '📋', value: stats.bills.total,        label: 'Total Bills'       },
    { icon: '⏳', value: stats.bills.pending,      label: 'Pending Review'    },
    { icon: '✔️', value: stats.bills.approved,     label: 'Approved'          },
    { icon: '🚩', value: stats.bills.with_flags,   label: 'Bills with Flags'  },
  ];

  return (
    <div>
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-subtitle">{stats.bills.this_week} bill(s) uploaded in the last 7 days · {stats.hospitals.total} hospitals in the database</p>

      <div className="stats-grid">
        {statItems.map(s => (
          <div className="stat-card" key={s.label}>
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">⚡ Quick Actions</div>
        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
          <Link to="/admin/users" className="btn btn-primary">
            👥 Manage Users
          </Link>
          <Link to="/admin/bills" className="btn btn-accent">
            📋 Review Bills {stats.bills.pending > 0 && `(${stats.bills.pending} pending)`}
          </Link>
          <Link to="/admin/monitoring" className="btn btn-outline">
            📜 Audit Log
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header">ℹ️ Benchmark Notes</div>
        <div className="alert alert-warning" style={{ marginBottom: 0, fontSize: '.88rem' }}>
          Bills submitted by users start as <strong>Pending</strong>. Only bills you approve appear in peer comparisons.
          Synthetic demo data is pre-approved and labelled "SYNTHETIC DEMO DATA — NOT VERIFIED MARKET PRICING".
        </div>
      </div>
    </div>
  );
}
