import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function Monitoring() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      <h2 className="mb-2">Monitoring & Audit Log</h2>

      <div className="card">
        <div className="card-header">Recent Actions ({logs.length})</div>
        {logs.length === 0 ? (
          <p className="text-muted">No audit log entries yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>{log.actor}</td>
                  <td>{log.action}</td>
                  <td>{log.entity}</td>
                  <td>{log.entity_id || '-'}</td>
                  <td>{log.details ? JSON.stringify(log.details) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
