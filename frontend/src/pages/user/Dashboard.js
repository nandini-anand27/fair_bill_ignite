import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { billAPI } from '../../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      const res = await billAPI.list();
      setBills(res.data);
    } catch (err) {
      console.error('Failed to load bills', err);
    } finally {
      setLoading(false);
    }
  };

  const formatRupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const statusBadge = (status) => {
    const cls = status === 'approved' ? 'status-approved' : status === 'rejected' ? 'status-rejected' : 'status-pending';
    return <span className={`status-badge ${cls}`}>{status}</span>;
  };

  return (
    <div>
      <div className="flex-between mb-2">
        <h2>My Bills</h2>
        <Link to="/upload" className="btn btn-primary">+ Upload New Bill</Link>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : bills.length === 0 ? (
        <div className="card text-center">
          <p className="text-muted mb-1">No bills uploaded yet.</p>
          <Link to="/upload" className="btn btn-primary mt-1">Upload your first bill</Link>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Hospital</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(bill => (
                <tr key={bill.id}>
                  <td>{bill.id}</td>
                  <td>{bill.hospital_name || 'Not specified'}</td>
                  <td>{bill.bill_date || '-'}</td>
                  <td>{formatRupees(bill.total_paise)}</td>
                  <td>{statusBadge(bill.status)}</td>
                  <td>
                    {bill.status === 'pending' || bill.comparison_result === null ? (
                      <Link to={`/review/${bill.id}`} className="btn btn-secondary btn-sm">Review</Link>
                    ) : (
                      <Link to={`/results/${bill.id}`} className="btn btn-secondary btn-sm">View Results</Link>
                    )}
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
