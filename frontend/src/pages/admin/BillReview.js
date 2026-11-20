import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const STATUS_TABS = ['pending', 'approved', 'rejected', 'all'];

function provenanceBadge(bill) {
  if (bill.is_synthetic) {
    return (
      <span className="status-badge status-pending" style={{ marginLeft: '.5rem' }}>
        🧪 Synthetic
      </span>
    );
  }
  if (bill.data_provenance) {
    return (
      <span className="status-badge status-approved" style={{ marginLeft: '.5rem' }}>
        👤 User
      </span>
    );
  }
  return null;
}

function flagsBadge(flags) {
  if (!flags || flags.length === 0) return null;
  return (
    <span className="status-badge status-rejected" style={{ marginLeft: '.5rem' }}>
      🚩 {flags.length} flag{flags.length !== 1 ? 's' : ''}
    </span>
  );
}

function statusBadge(status) {
  const cls = status === 'approved'
    ? 'status-approved'
    : status === 'rejected'
    ? 'status-rejected'
    : 'status-pending';
  return <span className={`status-badge ${cls}`}>{status}</span>;
}

function formatRupees(paise) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function BillCard({ bill, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason]     = useState('');

  return (
    <div className="card">
      {/* Header row */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
        <div>
          <strong>Bill #{bill.id}</strong>
          {' — '}
          {bill.hospital_name || 'Unknown hospital'}
          {statusBadge(bill.status)}
          {provenanceBadge(bill)}
          {flagsBadge(bill.flags)}
        </div>
        <span className="text-muted" style={{ fontSize: '.82rem' }}>
          {new Date(bill.created_at).toLocaleString()}
        </span>
      </div>

      {/* Meta */}
      <div className="mt-1" style={{ fontSize: '.88rem', color: 'var(--gray-600)' }}>
        <p>
          User: {bill.user_email || 'N/A'} &nbsp;|&nbsp;
          Date: {bill.bill_date || 'N/A'} &nbsp;|&nbsp;
          Room: {bill.room_category || 'N/A'} &nbsp;|&nbsp;
          Tier: {bill.hospital_tier || 'N/A'}
        </p>
        <p>
          Total: {formatRupees(bill.total_paise)}
          &nbsp;(Printed: {formatRupees(bill.printed_total_paise)})
        </p>
      </div>

      {/* Collapsible line items */}
      {bill.items && bill.items.length > 0 && (
        <div className="mt-1">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? '▲ Hide items' : `▼ Show items (${bill.items.length})`}
          </button>

          {expanded && (
            <table className="mt-1">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.item_key}</td>
                    <td style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>{item.category}</td>
                    <td>{item.quantity}</td>
                    <td>{formatRupees(item.amount_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Approve / Reject controls — only for pending */}
      {bill.status === 'pending' && (
        <div className="mt-1">
          <div className="form-group">
            <input
              type="text"
              placeholder="Reason for rejection (optional)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            <button className="btn btn-success" onClick={() => onApprove(bill.id)}>
              Approve
            </button>
            <button className="btn btn-danger" onClick={() => onReject(bill.id, reason)}>
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillReview() {
  const [bills, setBills]       = useState([]);
  const [tab, setTab]           = useState('pending');
  const [loading, setLoading]   = useState(true);
  const [message, setMessage]   = useState('');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    loadBills();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBills = async () => {
    setLoading(true);
    try {
      const res = tab === 'all' || tab === 'approved' || tab === 'rejected'
        ? await adminAPI.allBills()
        : await adminAPI.pendingBills();
      setBills(res.data);
    } catch (err) {
      console.error('Failed to load bills', err);
    } finally {
      setLoading(false);
    }
  };

  const notify = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const approveBill = async (id) => {
    try {
      await adminAPI.approveBill(id);
      notify(`Bill #${id} approved.`);
      loadBills();
    } catch {
      notify('Failed to approve bill.');
    }
  };

  const rejectBill = async (id, reason) => {
    try {
      await adminAPI.rejectBill(id, reason);
      notify(`Bill #${id} rejected.`);
      loadBills();
    } catch {
      notify('Failed to reject bill.');
    }
  };

  // Filter by tab status (all bills response includes every status)
  const byTab = tab === 'all'
    ? bills
    : bills.filter(b => b.status === tab);

  // Filter by hospital search
  const filtered = byTab.filter(b =>
    !search || (b.hospital_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h2 className="page-title">Bill Review</h2>

      {message && <div className="alert alert-success">{message}</div>}

      {/* Status tabs */}
      <div className="flex gap-1 mb-1" style={{ flexWrap: 'wrap' }}>
        {STATUS_TABS.map(t => (
          <button
            key={t}
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Hospital search */}
      <div className="form-group mb-2">
        <input
          type="text"
          placeholder="Filter by hospital name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">📋</div>
          <h3>{search ? 'No results' : tab === 'pending' ? 'No pending bills' : 'No bills found'}</h3>
          <p>{search ? `No bills matching "${search}".` : 'Nothing here right now.'}</p>
        </div>
      ) : (
        filtered.map(bill => (
          <BillCard
            key={bill.id}
            bill={bill}
            onApprove={approveBill}
            onReject={rejectBill}
          />
        ))
      )}
    </div>
  );
}
