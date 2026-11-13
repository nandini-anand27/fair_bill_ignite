import React, { useState } from 'react';
import { billAPI } from '../../services/api';

export default function DeleteBill() {
  const [refCode, setRefCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await billAPI.delete(refCode);
      setResult(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setResult({ message: 'The reference code was not found. No data was deleted.' });
      } else {
        setError('Failed to process deletion request.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="mb-2">Delete My Contribution</h2>
      <p className="text-muted mb-2">
        If you contributed your bill to the benchmark, you received a 12-character reference code.
        Enter it below to request deletion of your bill. This is permanent and cannot be undone.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}
      {result && (
        <div className={`alert ${result.message.includes('not found') ? 'alert-warning' : 'alert-success'}`}>
          {result.message}
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Reference Code</label>
            <input type="text" value={refCode}
              onChange={(e) => setRefCode(e.target.value)}
              placeholder="Enter your 12-character reference code"
              required maxLength={12} />
          </div>
          <button type="submit" className="btn btn-danger btn-block btn-lg" disabled={loading}>
            {loading ? 'Processing...' : 'Delete My Bill'}
          </button>
        </form>
      </div>
    </div>
  );
}
