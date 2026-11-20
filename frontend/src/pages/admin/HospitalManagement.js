import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const TIERS = [
  { value: 'government',    label: 'Government'    },
  { value: 'mid_private',   label: 'Mid-Private'   },
  { value: 'large_private', label: 'Large Private' },
];

const TIER_FILTER_TABS = [
  { value: 'all',           label: 'All'          },
  { value: 'government',    label: 'Government'   },
  { value: 'mid_private',   label: 'Mid-Private'  },
  { value: 'large_private', label: 'Large Private'},
];

const EMPTY_FORM = { name: '', city: 'Bengaluru', tier: 'government', active: true };

export default function HospitalManagement() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [message, setMessage]     = useState({ text: '', type: 'success' });
  const [tierFilter, setTierFilter] = useState('all');
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    loadHospitals();
  }, []);

  const loadHospitals = async () => {
    try {
      const res = await adminAPI.hospitals();
      setHospitals(res.data);
    } catch (err) {
      console.error('Failed to load hospitals', err);
    } finally {
      setLoading(false);
    }
  };

  const notify = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'success' }), 3500);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return notify('Hospital name is required.', 'danger');
    setSaving(true);
    try {
      const res = await adminAPI.addHospital(form);
      setHospitals(h => [res.data, ...h]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      notify(`Hospital "${res.data.name}" added.`);
    } catch (err) {
      const data = err.response?.data;
      const status = err.response?.status;
      const msg = data?.name?.[0]
        || data?.normalized_name?.[0]
        || data?.non_field_errors?.[0]
        || data?.detail
        || (data ? JSON.stringify(data) : null)
        || err.message
        || 'Failed to add hospital.';
      notify(`${status ? `[${status}] ` : ''}${msg}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteHospital(id);
      setHospitals(h => h.filter(x => x.id !== id));
      notify(`"${name}" deleted.`);
    } catch (err) {
      notify('Failed to delete hospital.', 'danger');
    }
  };

  const tierLabel = (tier) => TIERS.find(t => t.value === tier)?.label || tier;

  const filtered = tierFilter === 'all'
    ? hospitals
    : hospitals.filter(h => h.tier === tierFilter);

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      <h2 className="page-title">Hospital Management</h2>
      <p className="page-subtitle">{hospitals.length} hospitals in the database</p>

      {message.text && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      {/* Add Hospital toggle */}
      <div className="mb-1">
        <button
          className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => { setShowForm(s => !s); setForm(EMPTY_FORM); }}
        >
          {showForm ? '✕ Cancel' : '+ Add Hospital'}
        </button>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="card">
          <div className="card-header">🏥 New Hospital</div>
          <form onSubmit={handleAdd}>
            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '2 1 240px' }}>
                <label>Hospital Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="e.g. St. John's Medical College"
                  required
                />
              </div>
              <div className="form-group" style={{ flex: '1 1 160px' }}>
                <label>City</label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleFormChange}
                  placeholder="Bengaluru"
                />
              </div>
              <div className="form-group" style={{ flex: '1 1 180px' }}>
                <label>Tier</label>
                <select name="tier" value={form.tier} onChange={handleFormChange}>
                  {TIERS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', textTransform: 'none', letterSpacing: 0, fontSize: '.9rem', cursor: 'pointer', marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    name="active"
                    checked={form.active}
                    onChange={handleFormChange}
                    style={{ width: 'auto' }}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="flex gap-1 mt-1">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Add Hospital'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tier filter tabs */}
      <div className="flex gap-1 mb-1" style={{ flexWrap: 'wrap' }}>
        {TIER_FILTER_TABS.map(t => (
          <button
            key={t.value}
            className={`btn btn-sm ${tierFilter === t.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTierFilter(t.value)}
          >
            {t.label}
            {t.value !== 'all' && (
              <span style={{ marginLeft: '.35rem', opacity: .7 }}>
                ({hospitals.filter(h => h.tier === t.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">🏥</div>
          <h3>No hospitals</h3>
          <p>{tierFilter !== 'all' ? `No ${tierLabel(tierFilter)} hospitals yet.` : 'Add the first hospital above.'}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '1.25rem 2rem .75rem' }}>
            {filtered.length} hospital{filtered.length !== 1 ? 's' : ''}
            {tierFilter !== 'all' && ` · ${tierLabel(tierFilter)}`}
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>City</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Data Source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(h => (
                <tr key={h.id}>
                  <td style={{ fontWeight: 700 }}>{h.name}</td>
                  <td style={{ fontSize: '.88rem', color: 'var(--text-muted)' }}>{h.city}</td>
                  <td>
                    <span className="status-badge status-approved" style={{
                      background: h.tier === 'government'    ? 'var(--info-light)'    :
                                  h.tier === 'mid_private'   ? 'var(--warning-light)' :
                                  'var(--accent-light)',
                      color:      h.tier === 'government'    ? 'var(--info)'          :
                                  h.tier === 'mid_private'   ? 'var(--warning)'       :
                                  'var(--accent)',
                    }}>
                      {tierLabel(h.tier)}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${h.active ? 'status-approved' : 'status-rejected'}`}>
                      {h.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>
                    {h.data_source || 'real'}
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(h.id, h.name)}
                    >
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
