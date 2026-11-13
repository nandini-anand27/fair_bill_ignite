import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

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

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      <h2 className="mb-2">Admin Dashboard</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.users.total}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.users.active}</div>
          <div className="stat-label">Active Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.bills.total}</div>
          <div className="stat-label">Total Bills</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.bills.pending}</div>
          <div className="stat-label">Pending Bills</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.bills.approved}</div>
          <div className="stat-label">Approved Bills</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.bills.with_flags}</div>
          <div className="stat-label">Bills with Flags</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Quick Actions</div>
        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
          <Link to="/admin/users" className="btn btn-primary">Manage Users</Link>
          <Link to="/admin/bills" className="btn btn-primary">Review Bills ({stats.bills.pending} pending)</Link>
          <Link to="/admin/monitoring" className="btn btn-primary">View Audit Log</Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Recent Activity</div>
        <p className="text-muted">{stats.bills.this_week} bills uploaded in the last 7 days</p>
        <p className="text-muted">{stats.hospitals.total} hospitals in the database</p>
      </div>
    </div>
  );
}
