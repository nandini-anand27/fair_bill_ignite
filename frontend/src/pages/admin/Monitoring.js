import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

function actionBadgeClass(action) {
  if (action.includes('approve'))    return 'status-badge status-approved';
  if (action.includes('reject'))     return 'status-badge status-rejected';
  if (action.includes('delete'))     return 'status-badge status-rejected';
  if (action.includes('toggle'))     return 'status-badge status-pending';
  if (action.includes('contribut'))  return 'status-badge';
  return 'status-badge';
}

function actionBadgeStyle(action) {
  if (action.includes('approve'))   return {};
  if (action.includes('reject'))    return {};
  if (action.includes('delete'))    return {};
  if (action.includes('toggle'))    return {};
  if (action.includes('contribut')) return { background: '#DBEAFE', color: '#1D4ED8' };
  return { background: 'var(--gray-200)', color: 'var(--gray-700)' };
}

function formatDetails(details) {
  if (!details || Object.keys(details).length === 0) return '—';
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(' · ');
}

export default function Monitoring() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const res = await adminAPI.auditLog();
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load audit log', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter(log => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (log.actor  || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      <h2 className="page-title">Monitoring &amp; Audit Log</h2>

      {/* Search */}
      <div className="form-group mb-1">
        <input
          type="text"
          placeholder="Filter by actor or action…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '1.25rem 2rem .75rem' }}>
          Showing {filtered.length} of {logs.length} entries
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state" style={{ borderRadius: 0, border: 'none' }}>
            <div className="empty-emoji">🔍</div>
            <h3>No results</h3>
            <p>No log entries match "{search}".</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: '.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td style={{ fontSize: '.88rem', fontWeight: 600 }}>{log.actor}</td>
                  <td>
                    <span
                      className={actionBadgeClass(log.action)}
                      style={actionBadgeStyle(log.action)}
                    >
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ fontSize: '.88rem', color: 'var(--text-mid)' }}>{log.entity}</td>
                  <td style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>
                    {log.entity_id || '—'}
                  </td>
                  <td style={{ fontSize: '.82rem', color: 'var(--text-muted)', maxWidth: '220px', wordBreak: 'break-word' }}>
                    {formatDetails(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
