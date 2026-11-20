import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function UserManagement() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await adminAPI.users();
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  const notify = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const toggleActive = async (id) => {
    try {
      const res = await adminAPI.toggleUser(id);
      setUsers(users.map(u => u.id === id ? { ...u, is_active: res.data.user.is_active } : u));
      notify(res.data.message);
    } catch (err) {
      notify('Failed to toggle user status.');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return;
    try {
      const res = await adminAPI.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
      notify(res.data.message);
    } catch (err) {
      notify('Failed to delete user.');
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  const activeCount = users.filter(u => u.is_active).length;

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      <h2 className="page-title">User Management</h2>

      {message && <div className="alert alert-success">{message}</div>}

      {/* Search + summary row */}
      <div className="flex-between mb-1" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <p className="text-muted" style={{ margin: 0, fontWeight: 600 }}>
          {users.length} user{users.length !== 1 ? 's' : ''} total &middot; {activeCount} active
        </p>
        <div className="form-group" style={{ margin: 0, minWidth: '260px' }}>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">👤</div>
          <h3>No users yet</h3>
          <p>Registered users will appear here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">🔍</div>
          <h3>No results</h3>
          <p>No users match "{search}".</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Bills</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 700 }}>{user.username}</td>
                  <td style={{ fontSize: '.88rem', color: 'var(--text-mid)' }}>{user.email}</td>
                  <td style={{ fontSize: '.88rem', color: 'var(--text-muted)' }}>{user.phone || '—'}</td>
                  <td>
                    <span style={{
                      fontWeight: 800,
                      color: user.bill_count > 0 ? 'var(--success)' : 'var(--text-muted)',
                    }}>
                      {user.bill_count}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.is_active ? 'status-approved' : 'status-rejected'}`}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ fontSize: '.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(user.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td>
                    <div className="flex gap-1" style={{ flexWrap: 'nowrap' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleActive(user.id)}
                      >
                        {user.is_active ? 'Disable' : 'Activate'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteUser(user.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
