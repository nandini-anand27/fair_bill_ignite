import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

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

  const toggleActive = async (id) => {
    try {
      const res = await adminAPI.toggleUser(id);
      setUsers(users.map(u => u.id === id ? { ...u, is_active: res.data.user.is_active } : u));
      setMessage(res.data.message);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to toggle user status.');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      const res = await adminAPI.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
      setMessage(res.data.message);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to delete user.');
    }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      <h2 className="mb-2">User Management</h2>
      {message && <div className="alert alert-success">{message}</div>}

      {users.length === 0 ? (
        <div className="card text-center">
          <p className="text-muted">No users registered yet.</p>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
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
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{user.phone || '-'}</td>
                  <td>{user.bill_count}</td>
                  <td>
                    <span className={`status-badge ${user.is_active ? 'status-approved' : 'status-rejected'}`}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm mb-1" onClick={() => toggleActive(user.id)} style={{ display: 'block', width: '100%', marginBottom: '4px' }}>
                      {user.is_active ? 'Disable' : 'Activate'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteUser(user.id)} style={{ width: '100%' }}>
                      Delete
                    </button>
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
