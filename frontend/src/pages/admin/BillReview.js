import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function BillReview() {
  const [bills, setBills] = useState([]);
  const [view, setView] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [rejectReason, setRejectReason] = useState({});

  useEffect(() => {
    loadBills();
  }, [view]);

  const loadBills = async () => {
    setLoading(true);
    try {
      const res = view === 'pending' ? await adminAPI.pendingBills() : await adminAPI.allBills();
      setBills(res.data);
    } catch (err) {
      console.error('Failed to load bills', err);
    } finally {
      setLoading(false);
    }
  };

  const approveBill = async (id) => {
    try {
      await adminAPI.approveBill(id);
      setMessage(`Bill #${id} approved.`);
      if (view === 'pending') {
        setBills(bills.filter(b => b.id !== id));
      } else {
        loadBills();
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to approve bill.');
    }
  };

  const rejectBill = async (id) => {
    const reason = rejectReason[id] || 'Not specified';
    try {
      await adminAPI.rejectBill(id, reason);
      setMessage(`Bill #${id} rejected.`);
      if (view === 'pending') {
        setBills(bills.filter(b => b.id !== id));
      } else {
        loadBills();
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to reject bill.');
    }
  };

  const formatRupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const statusBadge = (status) => {
    const cls = status === 'approved' ? 'status-approved' : status === 'rejected' ? 'status-rejected' : 'status-pending';
    return <span className={`status-badge ${cls}`}>{status}</span>;
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      <h2 className="mb-2">Bill Review</h2>

      {message && <div className="alert alert-success">{message}</div>}

      <div className="flex gap-1 mb-2">
        <button className={`btn ${view === 'pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('pending')}>Pending</button>
        <button className={`btn ${view === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('all')}>All Bills</button>
      </div>

      {bills.length === 0 ? (
        <div className="card text-center">
          <p className="text-muted">{view === 'pending' ? 'No pending bills to review.' : 'No bills found.'}</p>
        </div>
      ) : (
        bills.map(bill => (
          <div key={bill.id} className="card">
            <div className="flex-between">
              <div>
                <strong>Bill #{bill.id}</strong> — {bill.hospital_name || 'Unknown hospital'}
                <span style={{ marginLeft: '1rem' }}>{statusBadge(bill.status)}</span>
              </div>
              <span className="text-muted">{new Date(bill.created_at).toLocaleString()}</span>
            </div>

            <div className="mt-1" style={{ fontSize: '.9rem', color: 'var(--gray-600)' }}>
              <p>User: {bill.user_email || 'N/A'} | Date: {bill.bill_date || 'N/A'} | Room: {bill.room_category || 'N/A'}</p>
              <p>Total: {formatRupees(bill.total_paise)} (Printed: {formatRupees(bill.printed_total_paise)})</p>
            </div>

            {bill.items && bill.items.length > 0 && (
              <table className="mt-1">
                <thead>
                  <tr><th>Item</th><th>Category</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {bill.items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.item_key}</td>
                      <td>{item.category}</td>
                      <td>{formatRupees(item.amount_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {bill.status === 'pending' && (
              <div className="mt-1">
                <div className="form-group">
                  <input type="text" placeholder="Reason for rejection (optional)"
                    value={rejectReason[bill.id] || ''}
                    onChange={(e) => setRejectReason({ ...rejectReason, [bill.id]: e.target.value })}
                    style={{ marginBottom: '.5rem' }} />
                </div>
                <div className="flex gap-1">
                  <button className="btn btn-success" onClick={() => approveBill(bill.id)}>Approve</button>
                  <button className="btn btn-danger" onClick={() => rejectBill(bill.id)}>Reject</button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
